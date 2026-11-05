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
  const upd = await staff.c.from("complaints").update({ status: "in-progress" }).eq("id", cit.data!.id).select("id");
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
  const sum = await admin.from("api_usage_events").select("id", { count: "exact", head: true }).eq("user_id", a.id);
  ok("R8 usage entries total exactly 30", sum.count === 30, sum.count);
  const bOk = await b.c.rpc("consume_ai_quota" as never, { _endpoint: "civic-chat" } as never);
  ok("R9 other user has independent limit", (bOk.data as any)?.allowed === true, bOk.data);
  const conc = await Promise.all(Array.from({ length: 50 }, () => b.c.rpc("consume_ai_quota" as never, { _endpoint: "analyze-image" } as never)));
  const concOk = conc.filter(r => (r.data as any)?.allowed).length;
  ok("R10 50 simultaneous requests: exactly 29 more allowed (30 total)", concOk === 29, concOk);
  // ---- Rolling window (synthetic clock, service role only; production limit 30 / 600s)
  const R = (uid: string, t: number, ep = "civic-chat") => admin.rpc("_consume_ai_quota_rolling" as never, { _uid: uid, _endpoint: ep, _now: new Date(t).toISOString(), _limit: 30, _window_seconds: 600 } as never).then(r => r.data as any);
  const c = await user("clock"); const T0 = Date.parse("2030-01-01T10:09:00Z");
  let early = 0; for (let k = 0; k < 30; k++) if ((await R(c.id, T0 + k * 1000)).allowed) early++;   // 10:09:00..10:09:29
  ok("B1 30 requests in first burst allowed", early === 30, early);
  let late = 0; for (let k = 0; k < 30; k++) if ((await R(c.id, T0 + 60_000 + k * 100)).allowed) late++; // 10:10:00.. (old fixed-window boundary)
  ok("B2 old boundary trick: 0 more allowed right after the 10-minute mark", late === 0, late);
  const at599 = await R(c.id, T0 + 599_000);
  ok("B3 at 599s after oldest: refused, Retry-After = 2s", at599.allowed === false && at599.retry_after === 2, at599);
  const at600 = await R(c.id, T0 + 600_000);
  ok("B4 at exactly 600s after oldest: refused, Retry-After = 1s", at600.allowed === false && at600.retry_after === 1, at600);
  const at601 = await R(c.id, T0 + 601_000);
  ok("B5 at 601s after oldest: allowed (oldest fell out)", at601.allowed === true && at601.used === 30, at601);
  const again = await R(c.id, T0 + 601_100);
  ok("B6 next request at 601.1s refused (window full again), Retry-After matches next oldest", again.allowed === false && again.retry_after === 1, again);
  const evCount = await admin.from("api_usage_events").select("id", { count: "exact", head: true }).eq("user_id", c.id);
  ok("B7 refused requests are not stored (31 entries total)", evCount.count === 31, evCount.count);
  // concurrency at the boundary: 20 simultaneous calls when 1 slot frees
  const conc2 = await Promise.all(Array.from({ length: 20 }, () => R(c.id, T0 + 602_000)));
  ok("B8 20 simultaneous calls when 1 slot opens: exactly 1 allowed", conc2.filter(x => x.allowed).length === 1, conc2.filter(x => x.allowed).length);
  const tenMin = await R(b.id, Date.now() + 601_000);
  ok("B9 user B fresh again 601s later", tenMin.allowed === true && tenMin.used === 1, tenMin);
  // ---- 24h cleanup (real clock)
  const old = await R(c.id, Date.now() - 25 * 3600_000, "cleanup-test");
  ok("C1 entry dated 25h ago recorded", old.allowed === true, old);
  const oldOther = await R(b.id, Date.now() - 26 * 3600_000, "cleanup-test");
  await R(a.id, Date.now(), "cleanup-trigger"); // any call triggers cleanup (a is over limit; still cleans)
  const leftOld = await admin.from("api_usage_events").select("id").eq("endpoint", "cleanup-test");
  ok("C2 entries older than 24h removed automatically (own and other users')", oldOther.allowed && (leftOld.data?.length ?? 1) === 0, leftOld.data);
  const keptNew = await admin.from("api_usage_events").select("id", { count: "exact", head: true }).eq("user_id", a.id);
  ok("C3 recent entries kept", (keptNew.count ?? 0) >= 30, keptNew.count);

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
  const fu = await admin.from("api_usage_events").select("endpoint").eq("user_id", fresh.id);
  ok("H10 that call counted once against civic-chat", fu.data?.length === 1 && fu.data[0].endpoint === "civic-chat", fu.data);
  const counts1 = await Promise.all(["complaints", "profiles", "audit_logs"].map(t => admin.from(t).select("*", { count: "exact", head: true })));
  console.log("DURING (incl. test rows) complaints/profiles/audits:", counts1.map(c => c.count).join("/"));
} catch (e) { fail++; console.error("ERROR", e); }
finally {
  if (complaints.length) await admin.from("complaints").delete().in("id", complaints);
  if (users.length) { await admin.from("api_usage").delete().in("user_id", users); await admin.from("api_usage_events").delete().in("user_id", users); await admin.from("user_roles").delete().in("user_id", users); }
  for (const id of users) await admin.auth.admin.deleteUser(id);
  const c = await admin.from("complaints").select("*", { count: "exact", head: true });
  console.log("AFTER cleanup complaints:", c.count);
  console.log(`\nRESULT: ${pass} PASS / ${fail} FAIL`);
  await safety.release();
}
