// SA-05 + SA-06 checks. Throw-away accounts only; never touches the Super Admin or existing records.
// High-volume quota tests call the quota function directly (no paid AI). Endpoint tests use
// pre-filled quota so the AI gateway is never reached, except where noted.
import { createClient } from "@supabase/supabase-js";
import { acquireSafety } from "./_safety";
const url = process.env.SUPABASE_URL!, svc = process.env.SUPABASE_SERVICE_ROLE_KEY!, anonKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
const APP = process.env.APP_URL || "http://localhost:8080";
const admin = createClient(url, svc, { auth: { persistSession: false } });
const pub = createClient(url, anonKey, { auth: { persistSession: false } });
const safety = await acquireSafety("rate-limit");
let pass = 0, fail = 0;
const ok = (n: string, c: unknown, d?: unknown) => { c ? pass++ : fail++; console.log(c ? "PASS" : "FAIL", n, c ? "" : JSON.stringify(d)?.slice(0, 300)); };
const users: string[] = [], complaints: string[] = []; const T = Date.now();
const ENDPOINTS = ["civic-chat", "analyze-image", "voice-stt", "voice-transcribe", "generate-summary", "analyze-sentiment", "predict-trends", "generate-admin-report"];
async function user(tag: string) {
  const email = `rl-${tag}-${T}@example.com`;
  const { data } = await admin.auth.admin.createUser({ email, password: "Test-pass-12345!", email_confirm: true });
  users.push(data.user!.id);
  const c = createClient(url, anonKey, { auth: { persistSession: false } });
  const s = await c.auth.signInWithPassword({ email, password: "Test-pass-12345!" });
  return { id: data.user!.id, c, token: s.data.session!.access_token };
}
const call = (ep: string, token?: string) => fetch(`${APP}/api/public/fn/${ep}`, {
  method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: "{}",
});
try {
  const counts0 = await Promise.all(["complaints", "profiles", "audit_logs"].map(t => admin.from(t).select("*", { count: "exact", head: true })));
  console.log("BEFORE complaints/profiles/audits:", counts0.map(c => c.count).join("/"));
  const a = await user("a"), b = await user("b"), staff = await user("staff");
  await admin.from("user_roles").insert({ user_id: staff.id, role: "admin", city: "RateTestCity" });
  const base = { description: "TEST record for SA-05 checks", category: "other", priority: "low", location: "TEST", city: "RateTestCity" };

  // ---- SA-05
  const wa = await pub.from("complaints").insert({ ...base, title: "TEST sa05 wa", source: "whatsapp", submitted_by: "x" });
  ok("W1 signed-out WhatsApp insert with public key rejected", !!wa.error, wa.error);
  const wa2 = await pub.from("complaints").insert({ ...base, title: "TEST sa05 web", source: "web", submitted_by: "x" });
  ok("W2 signed-out non-WhatsApp insert also rejected", !!wa2.error, wa2.error);
  const left = await admin.from("complaints").select("id").eq("city", "RateTestCity");
  ok("W3 no rows created by signed-out attempts", (left.data?.length ?? 0) === 0, left.data);
  const hook = await fetch(`${APP}/api/public/fn/whatsapp-webhook`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ from: "+910000000000", body: "TEST" }) });
  ok("W4 webhook without token/staff session -> 401", hook.status === 401, hook.status);
  const nonStaff = await fetch(`${APP}/api/public/fn/whatsapp-webhook`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${a.token}` }, body: "{}" });
  ok("W5 webhook with citizen session -> 401", nonStaff.status === 401, nonStaff.status);
  const sim = await fetch(`${APP}/api/public/fn/whatsapp-webhook`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${staff.token}` }, body: JSON.stringify({ from: "+910000000001", body: "TEST DEMO streetlight broken near test road", latitude: 23.33, longitude: 75.03 }) });
  const simBody = await sim.json().catch(() => ({}));
  ok("W6 staff WhatsApp simulator creates complaint via server", sim.status === 200, { s: sim.status, simBody });
  const simRow = await admin.from("complaints").select("id,source,user_id").eq("whatsapp_number", "+910000000001").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (simRow.data) complaints.push(simRow.data.id);
  ok("W7 simulator row has source=whatsapp and no account", simRow.data?.source === "whatsapp" && simRow.data.user_id === null, simRow.data);
  const cit = await a.c.from("complaints").insert({ ...base, user_id: a.id, title: "TEST citizen", submitted_by: "T" }).select("id").single();
  if (cit.data) complaints.push(cit.data.id);
  ok("W8 normal signed-in citizen complaint still works", !cit.error, cit.error);
  const an = await a.c.from("complaints").insert({ ...base, user_id: a.id, title: "TEST anon", anonymous: true, submitted_by: "x" }).select("id").single();
  if (an.data) complaints.push(an.data.id);
  ok("W9 anonymous complaint still works", !an.error, an.error);
  const upd = await staff.c.from("complaints").update({ status: "in_progress" }).eq("id", cit.data!.id).select("id");
  ok("W10 City Admin can still update complaints in their city", (upd.data?.length ?? 0) === 1, upd);

  // ---- SA-06 database layer
  const read = await a.c.from("api_usage").select("*");
  ok("R1 user cannot read usage table", !!read.error || (read.data?.length ?? 0) === 0, read);
  const ins = await a.c.from("api_usage").insert({ user_id: a.id, endpoint: "civic-chat", window_start: new Date().toISOString(), request_count: -100 });
  ok("R2 user cannot write usage rows", !!ins.error, ins);
  const internal = await a.c.rpc("_consume_ai_quota" as never, { _uid: a.id, _endpoint: "x", _now: new Date().toISOString(), _limit: 99999, _window_seconds: 1 } as never);
  ok("R3 user cannot call internal function to raise own limit", !!internal.error, internal);
  const anonRpc = await pub.rpc("consume_ai_quota" as never, { _endpoint: "civic-chat" } as never);
  ok("R4 signed-out caller cannot touch counters", !!anonRpc.error || (anonRpc.data as any)?.allowed === false, anonRpc);
  let lastOk = 0;
  for (let i = 0; i < 30; i++) { const r = await a.c.rpc("consume_ai_quota" as never, { _endpoint: ENDPOINTS[i % 8] } as never); if ((r.data as any)?.allowed) lastOk++; }
  ok("R5 first 30 requests allowed (mixed endpoints)", lastOk === 30, lastOk);
  const r31 = await a.c.rpc("consume_ai_quota" as never, { _endpoint: "civic-chat" } as never);
  ok("R6 31st request refused with retry_after", (r31.data as any)?.allowed === false && (r31.data as any).retry_after > 0 && (r31.data as any).retry_after <= 600, r31.data);
  const r31b = await a.c.rpc("consume_ai_quota" as never, { _endpoint: "brand-new-endpoint" } as never);
  ok("R7 changing endpoint name does not bypass shared limit", (r31b.data as any)?.allowed === false, r31b.data);
  const sum = await admin.from("api_usage").select("request_count").eq("user_id", a.id);
  ok("R8 counters total exactly 30", (sum.data ?? []).reduce((s, x) => s + x.request_count, 0) === 30, sum.data);
  const bOk = await b.c.rpc("consume_ai_quota" as never, { _endpoint: "civic-chat" } as never);
  ok("R9 other user has independent limit", (bOk.data as any)?.allowed === true, bOk.data);
  const conc = await Promise.all(Array.from({ length: 50 }, () => b.c.rpc("consume_ai_quota" as never, { _endpoint: "analyze-image" } as never)));
  const concOk = conc.filter(r => (r.data as any)?.allowed).length;
  ok("R10 50 simultaneous requests: exactly 29 more allowed (30 total)", concOk === 29, concOk);
  // window reset (synthetic clock, service role only, 60s window)
  const now = new Date("2030-01-01T00:00:10Z");
  for (let i = 0; i < 3; i++) await admin.rpc("_consume_ai_quota" as never, { _uid: a.id, _endpoint: "civic-chat", _now: now.toISOString(), _limit: 3, _window_seconds: 60 } as never);
  const full = await admin.rpc("_consume_ai_quota" as never, { _uid: a.id, _endpoint: "civic-chat", _now: now.toISOString(), _limit: 3, _window_seconds: 60 } as never);
  ok("R11 limit hit within window", (full.data as any)?.allowed === false, full.data);
  const next = await admin.rpc("_consume_ai_quota" as never, { _uid: a.id, _endpoint: "civic-chat", _now: "2030-01-01T00:01:01Z", _limit: 3, _window_seconds: 60 } as never);
  ok("R12 counter resets when the window expires", (next.data as any)?.allowed === true && (next.data as any).used === 1, next.data);
  const tenMin = await admin.rpc("_consume_ai_quota" as never, { _uid: b.id, _endpoint: "civic-chat", _now: new Date(Date.now() + 601_000).toISOString(), _limit: 30, _window_seconds: 600 } as never);
  ok("R13 production 10-minute window: fresh after 10 minutes", (tenMin.data as any)?.allowed === true && (tenMin.data as any).used === 1, tenMin.data);

  // ---- SA-06 HTTP layer: user A is already over the limit, so no AI is called
  for (const ep of ENDPOINTS) {
    const r = await call(ep); ok(`H-${ep} signed-out -> 401`, r.status === 401, r.status);
  }
  const staffFill = await Promise.all(Array.from({ length: 30 }, () => staff.c.rpc("consume_ai_quota" as never, { _endpoint: "civic-chat" } as never)));
  ok("H0 staff quota pre-filled (no AI spent)", staffFill.every(r => (r.data as any)?.allowed), null);
  for (const ep of ENDPOINTS) {
    const tok = ep === "generate-admin-report" ? staff.token : a.token;
    const r = await call(ep, tok); const j = await r.json().catch(() => ({}));
    ok(`H-${ep} over limit -> 429 + Retry-After`, r.status === 429 && Number(r.headers.get("retry-after")) > 0 && /try again/i.test(j.error), { s: r.status, j });
  }
  // One real (cheap) call below the limit proves AI still works
  const fresh = await user("fresh");
  const chat = await fetch(`${APP}/api/public/fn/civic-chat`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${fresh.token}` }, body: JSON.stringify({ messages: [{ role: "user", content: "Say hello in 3 words" }], language: "en" }) });
  ok("H9 below limit: civic chat still answers (1 real AI call)", chat.status === 200, chat.status);
  const fu = await admin.from("api_usage").select("endpoint,request_count").eq("user_id", fresh.id);
  ok("H10 that call counted once against civic-chat", fu.data?.length === 1 && fu.data[0].request_count === 1 && fu.data[0].endpoint === "civic-chat", fu.data);
  const counts1 = await Promise.all(["complaints", "profiles", "audit_logs"].map(t => admin.from(t).select("*", { count: "exact", head: true })));
  console.log("DURING (incl. test rows) complaints/profiles/audits:", counts1.map(c => c.count).join("/"));
} catch (e) { fail++; console.error("ERROR", e); }
finally {
  if (complaints.length) await admin.from("complaints").delete().in("id", complaints);
  if (users.length) { await admin.from("api_usage").delete().in("user_id", users); await admin.from("user_roles").delete().in("user_id", users); }
  for (const id of users) await admin.auth.admin.deleteUser(id);
  const c = await admin.from("complaints").select("*", { count: "exact", head: true });
  console.log("AFTER cleanup complaints:", c.count);
  console.log(`\nRESULT: ${pass} PASS / ${fail} FAIL`);
  await safety.release();
}
