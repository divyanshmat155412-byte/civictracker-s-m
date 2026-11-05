// End-to-end: automatic escalation, public accountability score, safe duplicate merging.
// Temporary accounts + two temporary demo cities; everything is deleted at the end.
import { createClient } from "@supabase/supabase-js";
const url = process.env.SUPABASE_URL!, svc = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anon = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
const admin = createClient(url, svc, { auth: { persistSession: false } });
import { acquireSafety } from "./_safety";
const safety = await acquireSafety("innovation");
let pass = 0, fail = 0;
const ok = (n: string, c: unknown, d?: unknown) => { c ? pass++ : fail++; console.log(c ? "PASS" : "FAIL", n, c ? "" : JSON.stringify(d)?.slice(0, 300)); };
const T = Date.now(), made: string[] = [], PW = "Test-pass-12345!";
const fresh = () => createClient(url, anon, { auth: { persistSession: false } });
async function user(tag: string) {
  const email = `inno-${tag}-${T}@example.com`;
  const { data } = await admin.auth.admin.createUser({ email, password: PW, email_confirm: true });
  made.push(data.user!.id);
  const c = fresh(); await c.auth.signInWithPassword({ email, password: PW });
  return { id: data.user!.id, c };
}
const A = `Escalpur${T % 100000}`, B = `Mergegarh${T % 100000}`;
const H = 3600_000;
const notes = async (uid: string) => (await admin.from("user_notifications").select("title,kind").eq("user_id", uid).eq("kind", "escalation")).data ?? [];
try {
  const cit = await user("citizen"), modA = await user("modA"), adA = await user("adminA"), adB = await user("adminB");
  await admin.from("user_roles").insert([
    { user_id: modA.id, role: "moderator", city: A, status: "active" },
    { user_id: adA.id, role: "admin", city: A, status: "active" },
    { user_id: adB.id, role: "admin", city: B, status: "active" },
  ]);
  const mk = (title: string, lat = 10.33, lng = 10.04, category = "garbage", city = A) =>
    cit.c.from("complaints").insert({ user_id: cit.id, title, description: title + " near the market", category, priority: "medium", location: "Demo", city, latitude: lat, longitude: lng, submitted_by: "T" }).select("id").single();

  // ===== A. Escalation =====
  const e = await mk("Overflowing garbage bin");
  ok("A0 complaint created", !e.error, e.error);
  const due = new Date(Date.now() - 2 * H);
  await admin.from("complaints").update({ due_at: due.toISOString() }).eq("id", e.data!.id);
  const citEsc = await cit.c.rpc("escalate_overdue_complaints" as never);
  ok("A1 citizens cannot run escalation", !!citEsc.error);
  const selfEsc = await cit.c.from("complaints").update({ escalation_level: 3 } as never).eq("id", e.data!.id).select("id");
  ok("A2 citizen cannot set escalation level", !!selfEsc.error || (selfEsc.data ?? []).length === 0, selfEsc);
  await admin.rpc("escalate_overdue_complaints" as never);
  let row = (await admin.from("complaints").select("escalation_level,status").eq("id", e.data!.id).single()).data as { escalation_level: number } | null;
  ok("A3 missed deadline -> level 1", row?.escalation_level === 1, row);
  ok("A4 city A officer notified", (await notes(modA.id)).length === 1);
  ok("A5 city B admin NOT notified", (await notes(adB.id)).length === 0);
  ok("A6 reporter told it was escalated", (await notes(cit.id)).length === 1);
  await admin.rpc("escalate_overdue_complaints" as never);
  ok("A7 re-running does not repeat (no spam)", (await notes(modA.id)).length === 1);
  await admin.rpc("escalate_overdue_complaints" as never, { _now: new Date(due.getTime() + 25 * H).toISOString() } as never);
  row = (await admin.from("complaints").select("escalation_level").eq("id", e.data!.id).single()).data as never;
  ok("A8 +24h -> level 2, City Admin notified", row?.escalation_level === 2 && (await notes(adA.id)).length === 1, row);
  const aud = await admin.from("audit_logs").select("id").eq("action", "complaint_escalated").eq("target_id", e.data!.id);
  ok("A9 each escalation step is in the audit log", (aud.data ?? []).length === 2, aud.data);
  await admin.from("complaints").update({ due_at: new Date(Date.now() + 48 * H).toISOString() }).eq("id", e.data!.id);
  row = (await admin.from("complaints").select("escalation_level").eq("id", e.data!.id).single()).data as never;
  ok("A10 extending the deadline resets escalation", row?.escalation_level === 0, row);

  // ===== B. Accountability score =====
  const dept = await admin.from("departments").insert({ name: `Score Dept ${T}`, city: A }).select("id").single();
  const now = Date.now();
  const rows = [
    { resolved: true, proof: true, onTime: true }, { resolved: true, proof: true, onTime: true },
    { resolved: true, proof: true, onTime: false }, { resolved: false, overdue: true }, { resolved: false, overdue: false },
  ];
  const ids: string[] = [];
  for (const [i, r] of rows.entries()) {
    const c = await mk(`Score sample ${i}`, 10.4 + i * 0.05, 10.2, "streetlight");
    ids.push(c.data!.id);
    const dueAt = new Date(now - (r.resolved ? 10 : r.overdue ? 1 : -50) * H);
    await admin.from("complaints").update({
      department_id: dept.data!.id, due_at: dueAt.toISOString(),
      status: r.resolved ? "resolved" : "pending",
      after_photo_url: r.resolved && r.proof ? "proof.jpg" : null,
      resolved_at: r.resolved ? new Date(dueAt.getTime() + (r.onTime ? -H : H)).toISOString() : null,
    }).eq("id", c.data!.id);
  }
  const sc = await fresh().rpc("department_scores" as never, { _city: A } as never);
  const mine = ((sc.data ?? []) as { department_id: string; score: number | null; total: number; open_overdue: number }[]).find((d) => d.department_id === dept.data!.id);
  // genuine 3/5=.6*50=30, on-time 2/3*30=20, overdue 1/5 -> .8*20=16 => 66
  ok("B1 public (signed-out) score matches hand calculation = 66", Number(mine?.score) === 66 && mine?.total === 5 && mine?.open_overdue === 1, [sc.error, mine]);
  await admin.from("complaints").delete().eq("id", ids[4]);
  const sc2 = await fresh().rpc("department_scores" as never, { _city: A } as never);
  const m2 = ((sc2.data ?? []) as { department_id: string; score: number | null }[]).find((d) => d.department_id === dept.data!.id);
  ok("B2 fewer than 5 complaints -> no score", m2 && m2.score === null, m2);

  // ===== C. Duplicate merging =====
  const p = await mk("Garbage heap not collected at bus stand", 10.5, 10.5);
  const d = await mk("Garbage heap at bus stand not collected", 10.5005, 10.5005);
  const far = await mk("Garbage heap at bus stand", 10.6, 10.6);
  const sim = await adA.c.rpc("find_similar_complaints" as never, { _complaint_id: d.data!.id } as never);
  const simIds = ((sim.data ?? []) as { id: string; similarity: number }[]);
  ok("C1 nearby similar report found with text similarity", simIds.some((s) => s.id === p.data!.id && s.similarity > 0.5), [sim.error, simIds]);
  ok("C2 report 10+ km away not suggested", !simIds.some((s) => s.id === far.data!.id));
  ok("C3 other-city admin cannot list duplicates", !!(await adB.c.rpc("find_similar_complaints" as never, { _complaint_id: d.data!.id } as never)).error);
  ok("C4 other-city admin cannot merge", !!(await adB.c.rpc("admin_merge_complaint" as never, { _duplicate: d.data!.id, _primary: p.data!.id } as never)).error);
  ok("C5 citizen cannot merge", !!(await cit.c.rpc("admin_merge_complaint" as never, { _duplicate: d.data!.id, _primary: p.data!.id } as never)).error);
  ok("C6 officer (moderator) cannot merge", !!(await modA.c.rpc("admin_merge_complaint" as never, { _duplicate: d.data!.id, _primary: p.data!.id } as never)).error);
  const m = await adA.c.rpc("admin_merge_complaint" as never, { _duplicate: d.data!.id, _primary: p.data!.id, _note: "same spot" } as never);
  const md = (await admin.from("complaints").select("merged_into").eq("id", d.data!.id).single()).data as { merged_into: string | null } | null;
  ok("C7 city admin merges; original row kept with link", !m.error && md?.merged_into === p.data!.id, [m.error, md]);
  const mn = await admin.from("user_notifications").select("id").eq("user_id", cit.id).eq("kind", "merge");
  ok("C8 reporter notified of merge", (mn.data ?? []).length === 1);
  ok("C9 merge audited", ((await admin.from("audit_logs").select("id").eq("action", "complaint_merged").eq("target_id", d.data!.id)).data ?? []).length === 1);
  ok("C10 cannot merge twice", !!(await adA.c.rpc("admin_merge_complaint" as never, { _duplicate: d.data!.id, _primary: far.data!.id } as never)).error);
  const cross = await mk("Garbage in city B", 10.5, 10.5, "garbage", B);
  ok("C11 cross-city merge blocked", !!(await adA.c.rpc("admin_merge_complaint" as never, { _duplicate: cross.data!.id, _primary: p.data!.id } as never)).error);
  const um = await adA.c.rpc("admin_unmerge_complaint" as never, { _duplicate: d.data!.id } as never);
  const ud = (await admin.from("complaints").select("merged_into").eq("id", d.data!.id).single()).data as { merged_into: string | null } | null;
  ok("C12 unmerge restores the complaint", !um.error && ud?.merged_into === null, [um.error, ud]);
} finally {
  for (const c of [A, B]) {
    await admin.from("complaints").delete().eq("city", c);
    await admin.from("departments").delete().eq("city", c);
  }
  await admin.from("user_roles").delete().in("user_id", made);
  for (const id of made) { await admin.from("user_notifications").delete().eq("user_id", id); await admin.auth.admin.deleteUser(id); }
  console.log(`\n${pass} passed, ${fail} failed`);
  await safety.release();
}
