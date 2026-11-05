// Security & role tests (A–L). Uses throw-away test accounts; never touches the real Super Admin.
// SAFE MODE: never writes to the real root account; deletes only rows for accounts this run created.
import { createClient } from "@supabase/supabase-js";
const url = process.env.SUPABASE_URL!, svc = process.env.SUPABASE_SERVICE_ROLE_KEY!, anon = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
const admin = createClient(url, svc, { auth: { persistSession: false } });
import { acquireSafety } from "./_safety";
const safety = await acquireSafety("security");
let pass = 0, fail = 0;
const ok = (n: string, c: unknown, d?: unknown) => { c ? pass++ : fail++; console.log(c ? "PASS" : "FAIL", n, c ? "" : JSON.stringify(d)?.slice(0, 300)); };
const made: string[] = [];
const T = Date.now();
async function user(tag: string) {
  const email = `sec-${tag}-${T}@example.com`;
  const { data } = await admin.auth.admin.createUser({ email, password: "Test-pass-12345!", email_confirm: true });
  made.push(data.user!.id);
  const c = createClient(url, anon, { auth: { persistSession: false } });
  await c.auth.signInWithPassword({ email, password: "Test-pass-12345!" });
  return { id: data.user!.id, email, c };
}
const { data: rootCfg } = await admin.from("app_config").select("value").eq("key", "root_admin_user_id").single();
const ROOT = rootCfg!.value;
const { data: rootUser } = await admin.auth.admin.getUserById(ROOT);
const ROOT_EMAIL = rootUser.user!.email!;

const cit = await user("citizen");
const adA = await user("adminA");
const adB = await user("adminB");
const wk = await user("worker");
// City admins are created the legitimate way: application -> decision. Simulate root decision with service role.
await admin.from("user_roles").insert([{ user_id: adA.id, role: "admin", city: "TestCityA" }, { user_id: adB.id, role: "admin", city: "TestCityB" }]);

// A — public signup
const { data: citRoles } = await admin.from("user_roles").select("role").eq("user_id", cit.id);
ok("A1 new signup has no admin/moderator role", !(citRoles ?? []).some((r) => r.role !== "user"), citRoles);
ok("A2 new signup is not super admin", (await cit.c.rpc("is_main_admin")).data === false);

// D — privilege escalation
const self = await cit.c.from("user_roles").insert({ user_id: cit.id, role: "admin", city: "TestCityA" });
ok("D1 citizen cannot self-insert admin role", !!self.error, self);
const grant = await cit.c.rpc("admin_grant_role_by_email", { _email: cit.email, _role: "admin", _city: "TestCityA" });
ok("D2 citizen cannot call grant RPC", !!grant.error);
const aSelf = await adA.c.from("user_roles").insert({ user_id: adA.id, role: "admin", city: "TestCityB" });
ok("D3 City Admin cannot grant itself another city", !!aSelf.error, aSelf);
const aUpd = await adA.c.from("user_roles").update({ city: null }).eq("user_id", adA.id).select();
ok("D4 City Admin cannot widen own role to all cities", !!aUpd.error || (aUpd.data ?? []).length === 0, aUpd);
const cfg = await adA.c.from("app_config").update({ value: adA.id }).eq("key", "root_admin_user_id").select();
ok("D5 nobody can overwrite the root identity", !!cfg.error || (cfg.data ?? []).length === 0, cfg);
const noCity = await admin.from("user_roles").insert({ user_id: cit.id, role: "admin", city: null });
ok("D6 a second all-city admin cannot be created (even by service)", !!noCity.error, noCity);

// E — super admin protection
const delRoot = await adA.c.from("user_roles").delete().eq("user_id", ROOT).select();
ok("E1 City Admin cannot delete root roles", (delRoot.data ?? []).length === 0, delRoot);
const revRoot = await adA.c.rpc("admin_revoke_role_by_email", { _email: ROOT_EMAIL, _role: "admin" });
ok("E2 City Admin cannot revoke root via RPC", !!revRoot.error);
const susRoot = await adA.c.rpc("root_set_admin_status" as any, { _user_id: ROOT, _status: "suspended" });
ok("E3 City Admin cannot suspend root", !!susRoot.error);
// E4 (service-role delete of root roles) removed: a destructive probe against the real account is never run on a shared database.
const updRoot = await adA.c.from("user_roles").update({ status: "suspended" }).eq("user_id", ROOT).select();
ok("E4 City Admin cannot suspend root roles by direct update", (updRoot.data ?? []).length === 0, updRoot);

// F — admin application
const app = await cit.c.from("admin_requests").insert({ user_id: cit.id, email: cit.email, full_name: "Applicant", reason: "test", requested_city: "TestCityA" }).select("id").single();
ok("F1 citizen submits application", !app.error, app.error);
const fakeApproved = await cit.c.from("admin_requests").insert({ user_id: cit.id, email: cit.email, status: "approved" });
ok("F2 applicant cannot submit pre-approved", !!fakeApproved.error);
const aSee = await adA.c.from("admin_requests").select("id");
ok("F3 City Admin cannot see applications", (aSee.data ?? []).length === 0, aSee);
const aDecide = await adA.c.rpc("root_decide_admin_request" as any, { _request_id: app.data!.id, _approve: true, _city: "TestCityA" });
ok("F4 City Admin cannot approve applications", !!aDecide.error);
const cDecide = await cit.c.rpc("root_decide_admin_request" as any, { _request_id: app.data!.id, _approve: true, _city: "TestCityA" });
ok("F5 applicant cannot approve self", !!cDecide.error);
const { data: stillNo } = await admin.from("user_roles").select("role").eq("user_id", cit.id).eq("role", "admin");
ok("F6 no admin rights before approval", (stillNo ?? []).length === 0);

// I / J — complaint management + cross-city
const mk = async (city: string) => (await cit.c.from("complaints").insert({ user_id: cit.id, title: `Sec ${city}`, description: "sec test", category: "broken-road", priority: "medium", location: city, city, submitted_by: "T" }).select("id,complaint_id").single()).data!;
const cA = await mk("TestCityA"), cB = await mk("TestCityB");
const { data: dept } = await admin.from("departments").select("id").limit(2);
const edit = await adA.c.from("complaints").update({ description: "corrected", category: "garbage", priority: "high", department_id: dept?.[1]?.id ?? dept?.[0]?.id, due_at: new Date(Date.now() + 86400e3).toISOString(), status: "in-progress" }).eq("id", cA.id).select("id");
ok("I1 City Admin edits/routes/prioritises own-city complaint", !edit.error && edit.data?.length === 1, edit);
const note = await adA.c.from("complaint_timeline").insert({ complaint_id: cA.id, status: "in-progress", note: "Internal note", updated_by: adA.id });
ok("I2 City Admin adds timeline note", !note.error, note.error);
const { data: w } = await admin.from("workers").insert({ name: "Sec Worker", city: "TestCityA", user_id: wk.id }).select("id").single();
const asg = await adA.c.from("worker_assignments").insert({ complaint_id: cA.id, worker_id: w!.id }).select("id").single();
ok("I3 City Admin assigns field worker", !asg.error, asg.error);
const resolveNoProof = await adA.c.from("complaints").update({ status: "resolved" }).eq("id", cA.id).select("id");
ok("K1 admin cannot resolve without after-photo", !!resolveNoProof.error, resolveNoProof);
const crossEdit = await adA.c.from("complaints").update({ description: "hacked" }).eq("id", cB.id).select("id");
ok("J1 City Admin cannot edit other city's complaint", (crossEdit.data ?? []).length === 0, crossEdit);
const crossMove = await adA.c.from("complaints").update({ city: "TestCityB" }).eq("id", cA.id).select("id");
ok("J2 City Admin cannot move complaint into another city", !!crossMove.error || (crossMove.data ?? []).length === 0, crossMove);
const crossAsg = await adA.c.from("worker_assignments").insert({ complaint_id: cB.id, worker_id: w!.id });
ok("J3 City Admin cannot assign on other city's complaint", !!crossAsg.error);
const del = await adA.c.from("complaints").delete().eq("id", cA.id).select("id");
ok("J4 City Admin cannot delete complaint evidence", (del.data ?? []).length === 0, del);
const bWorker = await adB.c.from("workers").update({ name: "x" }).eq("id", w!.id).select();
ok("J5 City Admin B cannot edit City A workers", (bWorker.data ?? []).length === 0, bWorker);
const deptHack = await adA.c.from("departments").insert({ name: "Hack dept" });
ok("J6 City Admin cannot change global departments", !!deptHack.error);
// K — worker flow
const done = await wk.c.rpc("worker_update_job", { _assignment_id: asg.data!.id, _status: "completed", _after_photo_url: "https://example.com/a.jpg" });
ok("K2 field worker completes with proof", !done.error, done.error);
const { data: res } = await admin.from("complaints").select("status").eq("id", cA.id).single();
ok("K3 complaint resolved via proof workflow", res?.status === "resolved", res);

// H — audit
const { data: logsA } = await admin.from("audit_logs").select("action,city,user_id").eq("target_id", cA.complaint_id);
ok("H1 complaint changes are audit-logged with actor", (logsA ?? []).some((l) => l.action === "complaint_updated" && l.user_id === adA.id), logsA);
const bLogs = await adB.c.from("audit_logs").select("id,city");
ok("H2 City Admin B sees no City A logs", !(bLogs.data ?? []).some((l) => l.city === "TestCityA"), bLogs.data?.length);
const cLogs = await cit.c.from("audit_logs").select("id");
ok("H3 citizen sees no audit logs", (cLogs.data ?? []).length === 0);
const fake = await adA.c.from("audit_logs").insert({ user_id: adA.id, action: "fake", target_type: "x" });
ok("H4 admins cannot write fake audit entries", !!fake.error);
const anyLogId = (await admin.from("audit_logs").select("id").limit(1).single()).data?.id;
const delLog = await adA.c.from("audit_logs").delete().eq("id", anyLogId).select();
const updLog = await adA.c.from("audit_logs").update({ action: "x" }).eq("id", anyLogId).select();
ok("H5 audit entries cannot be edited or deleted", (delLog.data ?? []).length === 0 && (updLog.data ?? []).length === 0);
const roleLog = await admin.from("audit_logs").select("id").eq("action", "role_granted").eq("target_id", adA.id);
ok("H6 role grants are audit-logged", (roleLog.data ?? []).length > 0);

// C / L — city isolation on private data
const aOverview = await adA.c.rpc("root_platform_overview" as any);
ok("C1 City Admin cannot open platform overview", !!aOverview.error);
const aList = await adA.c.rpc("admin_list_role_assignments");
ok("C2 City Admin cannot list admin accounts/emails", !!aList.error);
const bRoles = await adB.c.from("user_roles").select("user_id");
ok("C3 City Admin B cannot read other users' roles", !(bRoles.data ?? []).some((r) => r.user_id !== adB.id));
const { data: aMayB } = await adA.c.rpc("admin_can_manage_city", { _user_id: adA.id, _city: "TestCityB" });
ok("C4 City Admin A has no rights in City B", aMayB === false);
// suspension
await admin.from("user_roles").update({ status: "suspended" }).eq("user_id", adA.id);
const susp = await adA.c.from("complaints").update({ description: "after suspend" }).eq("id", cA.id).select("id");
ok("L1 suspended City Admin loses access immediately", (susp.data ?? []).length === 0, susp);

// G — email privacy
const pub = createClient(url, anon, { auth: { persistSession: false } });
const leaks: string[] = [];
for (const t of ["profiles", "complaints", "complaint_comments", "workers", "departments", "admin_requests", "audit_logs", "app_config", "user_roles"]) {
  const r = await pub.from(t as any).select("*").limit(500);
  if (JSON.stringify(r.data ?? "").toLowerCase().includes(ROOT_EMAIL.toLowerCase())) leaks.push(t);
  const r2 = await adA.c.from(t as any).select("*").limit(500);
  if (JSON.stringify(r2.data ?? "").toLowerCase().includes(ROOT_EMAIL.toLowerCase())) leaks.push("admin:" + t);
}
ok("G1 super admin email not exposed to public or City Admins", leaks.length === 0, leaks);
const rid = await pub.rpc("main_admin_email" as any);
ok("G2 email helper not callable publicly", !!rid.error);

// B — logout does not release root
const rootRoles = await admin.from("user_roles").select("role").eq("user_id", ROOT);
ok("B1 root identity stored server-side by ID", ROOT && (rootRoles.data ?? []).length >= 1);
await adA.c.auth.signOut();
const { data: still } = await admin.from("app_config").select("value").eq("key", "root_admin_user_id").single();
ok("B2 root identity unchanged after sign-outs", still?.value === ROOT);

// cleanup
await admin.from("worker_assignments").delete().eq("complaint_id", cA.id);
await admin.from("complaints").delete().in("id", [cA.id, cB.id]);
await admin.from("workers").delete().eq("id", w!.id);
await admin.from("admin_requests").delete().eq("user_id", cit.id);
await admin.from("user_roles").delete().in("user_id", made);
for (const id of made) await admin.auth.admin.deleteUser(id);
console.log(`\n${pass} passed, ${fail} failed`);
await safety.release();
