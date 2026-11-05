// Verifies the Nov 2026 security-scan fixes. Throw-away accounts only; never touches the real Super Admin.
// No AI is called: every request is either rejected before the AI step or uses a missing complaint.
import { createClient } from "@supabase/supabase-js";
import { acquireSafety } from "./_safety";
const url = process.env.SUPABASE_URL!, svc = process.env.SUPABASE_SERVICE_ROLE_KEY!, anon = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
const APP = process.env.APP_URL || "http://localhost:8080";
const admin = createClient(url, svc, { auth: { persistSession: false } });
const safety = await acquireSafety("scan-fixes");
let pass = 0, fail = 0;
const ok = (n: string, c: unknown, d?: unknown) => { c ? pass++ : fail++; console.log(c ? "PASS" : "FAIL", n, c ? "" : JSON.stringify(d)?.slice(0, 300)); };
const made: string[] = []; const T = Date.now();
async function user(tag: string) {
  const email = `scan-${tag}-${T}@example.com`;
  const { data } = await admin.auth.admin.createUser({ email, password: "Test-pass-12345!", email_confirm: true });
  made.push(data.user!.id);
  const c = createClient(url, anon, { auth: { persistSession: false } });
  const { data: s } = await c.auth.signInWithPassword({ email, password: "Test-pass-12345!" });
  return { id: data.user!.id, c, token: s.session!.access_token };
}
const call = (fn: string, body: unknown, token?: string) => fetch(`${APP}/api/public/fn/${fn}`, {
  method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body),
});
try {
  const cit = await user("citizen"); const other = await user("other"); const adA = await user("adminA");
  await admin.from("user_roles").insert({ user_id: adA.id, role: "admin", city: "ScanTestCityA" });
  const { data: c } = await admin.from("complaints").insert({ user_id: other.id, title: "SCAN TEST", description: "scan test record", category: "other", location: "Test", city: "ScanTestCityB", submitted_by: "test" }).select("id").single();

  // Paid / mutating endpoints reject signed-out callers
  for (const fn of ["civic-chat", "analyze-image", "voice-stt", "voice-transcribe", "predict-trends", "generate-summary", "analyze-sentiment", "generate-admin-report", "simulate-worker-movement", "send-sms"]) {
    const r = await call(fn, { messages: [{ role: "user", content: "hi" }] });
    ok(`1 ${fn} rejects signed-out caller (401)`, r.status === 401, r.status);
    const pk = await call(fn, {}, anon);
    ok(`2 ${fn} rejects publishable key as identity`, pk.status === 401, pk.status);
  }
  // Ownership / role checks
  const gs = await call("generate-summary", { complaint_id: c!.id, title: "x" }, cit.token);
  ok("3 citizen cannot summarise another person's complaint", gs.status === 403, gs.status);
  const ar = await call("generate-admin-report", { period: "weekly" }, cit.token);
  ok("4 citizen cannot generate admin report", ar.status === 403, ar.status);
  const sw = await call("simulate-worker-movement", { worker_id: "00000000-0000-0000-0000-000000000000", complaint_id: c!.id }, cit.token);
  ok("5 citizen cannot move workers", sw.status === 403, sw.status);
  const sw2 = await call("simulate-worker-movement", { worker_id: "00000000-0000-0000-0000-000000000000", complaint_id: c!.id }, adA.token);
  ok("6 City Admin cannot move workers for another city", sw2.status === 403, sw2.status);
  const sms = await call("send-sms", { to: "+919999999999", body: "hi", complaint_id: c!.id }, adA.token);
  ok("7 City Admin cannot text a citizen in another city", sms.status === 403, sms.status);
  const sms2 = await call("send-sms", { to: "+919999999999", body: "hi" }, adA.token);
  ok("8 SMS requires a complaint", sms2.status === 400, sms2.status);
  // Reward points can no longer be self-awarded
  const before = (await admin.from("profiles").select("green_points").eq("user_id", cit.id).single()).data?.green_points;
  const up = await cit.c.from("profiles").update({ green_points: 99999 }).eq("user_id", cit.id).select();
  const after = (await admin.from("profiles").select("green_points").eq("user_id", cit.id).single()).data?.green_points;
  ok("9 citizen cannot set own green_points", !!up.error && after === before, { up: up.error?.message, before, after });
  const cc = await cit.c.from("profiles").update({ complaints_count: 500, badge_level: "diamond" }).eq("user_id", cit.id).select();
  ok("10 citizen cannot set complaints_count/badge", !!cc.error, cc.error?.message);
  const nm = await cit.c.from("profiles").update({ full_name: "Scan Tester" }).eq("user_id", cit.id).select("full_name");
  ok("11 citizen can still edit own name", !nm.error && nm.data?.[0]?.full_name === "Scan Tester", nm.error);
  const hc = await cit.c.rpc("set_my_home_city", { _city: "Ratlam" });
  ok("12 home-city RPC still works", !hc.error && hc.data === "Ratlam", hc.error);
  const ct = await cit.c.rpc("update_my_profile_contact", { _phone: "+919000000000", _opt_in: true });
  ok("13 contact RPC still works", !ct.error, ct.error);
  await admin.from("complaints").delete().eq("id", c!.id);
} finally {
  await admin.from("user_roles").delete().in("user_id", made);
  for (const id of made) await admin.auth.admin.deleteUser(id);
  console.log(`\n${pass} passed, ${fail} failed`);
  await safety.release();
}
