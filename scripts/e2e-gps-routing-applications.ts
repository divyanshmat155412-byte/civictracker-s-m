// RUN ALONE: this test temporarily swaps the root ID; never run it alongside other e2e scripts.
// End-to-end: City Admin applications, GPS ward/zone detection, city routing, corrections.
// Uses temporary accounts and two temporary DEMO cities. Ward shapes below are invented
// demonstration squares, NOT official boundaries. Everything is deleted at the end.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
const url = process.env.SUPABASE_URL!, svc = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anon = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
const admin = createClient(url, svc, { auth: { persistSession: false } });
let pass = 0, fail = 0;
const ok = (n: string, c: unknown, d?: unknown) => { c ? pass++ : fail++; console.log(c ? "PASS" : "FAIL", n, c ? "" : JSON.stringify(d)?.slice(0, 300)); };
const T = Date.now(), made: string[] = [];
const PW = "Test-pass-12345!";
const fresh = () => createClient(url, anon, { auth: { persistSession: false } });
async function user(tag: string) {
  const email = `gps-${tag}-${T}@example.com`;
  const { data } = await admin.auth.admin.createUser({ email, password: PW, email_confirm: true });
  made.push(data.user!.id);
  const c = fresh();
  await c.auth.signInWithPassword({ email, password: PW });
  return { id: data.user!.id, email, c };
}
const A = `Demopur${T % 100000}`, B = `Demogarh${T % 100000}`;
const sq = (lat: number, lng: number, h = 0.005) => ({ type: "Polygon", coordinates: [[[lng - h, lat - h], [lng + h, lat - h], [lng + h, lat + h], [lng - h, lat + h], [lng - h, lat - h]]] });
const { data: cfg } = await admin.from("app_config").select("value").eq("key", "root_admin_user_id").single();
const realRoot = cfg?.value;
const cities: string[] = [];
try {
  // 1. registration + email verification
  const signEmail = `gps-signup-${T}@example.com`;
  // created unconfirmed (same state as a fresh sign-up; avoids sending a real email to a fake address)
  const su = await admin.auth.admin.createUser({ email: signEmail, password: PW, email_confirm: false });
  if (su.data.user) made.push(su.data.user.id);
  ok("1a new account starts unverified", !!su.data.user && !su.data.user.email_confirmed_at, su.error);
  const early = await fresh().auth.signInWithPassword({ email: signEmail, password: PW });
  ok("1b unverified account cannot sign in", !!early.error, early.data);
  await admin.auth.admin.updateUserById(su.data.user!.id, { email_confirm: true }); // = user clicks the link
  const verified = fresh();
  const late = await verified.auth.signInWithPassword({ email: signEmail, password: PW });
  ok("1c verified account signs in", !late.error, late.error);

  // 2. application with forged identity is rewritten to the real account
  const victim = await user("victim"), rej = await user("rejected"), cit = await user("citizen"), root = await user("tmproot");
  // forged: someone else's user_id + email + pre-approved status
  const app = await verified.from("admin_requests").insert({ user_id: victim.id, email: victim.email, full_name: "Applicant", requested_city: A, status: "approved" } as never).select("id,user_id,email,status").single();
  ok("2a forged identity is replaced by the signed-in account", !app.error && app.data?.user_id === su.data.user!.id && app.data?.email === signEmail, [app.error, app.data]);
  ok("2b forged 'approved' status forced back to pending", app.data?.status === "pending", app.data);
  const vic = await admin.from("admin_requests").select("id").eq("user_id", victim.id);
  ok("2c no application exists for the victim", (vic.data ?? []).length === 0, vic.data);
  const app2 = await rej.c.from("admin_requests").insert({ user_id: rej.id, email: rej.email, full_name: "R", requested_city: B }).select("id").single();

  // 3. visibility
  const seenByCitizen = await cit.c.from("admin_requests").select("id");
  ok("3a citizen sees no applications", (seenByCitizen.data ?? []).length === 0, seenByCitizen.data);
  const seenByOther = await rej.c.from("admin_requests").select("id");
  ok("3b applicant sees only own application", seenByOther.data?.length === 1 && seenByOther.data[0].id === app2.data?.id, seenByOther.data);
  const citDecide = await cit.c.rpc("root_decide_admin_request", { _request_id: app.data!.id, _approve: true, _city: A });
  ok("3c non-root cannot approve", !!citDecide.error);

  // temporary root swap (restored in finally)
  await admin.from("app_config").update({ value: root.id }).eq("key", "root_admin_user_id");
  const rootSees = await root.c.from("admin_requests").select("id").in("id", [app.data!.id, app2.data!.id]);
  ok("3d Root Super Admin sees both applications", rootSees.data?.length === 2, rootSees);

  // cities (needed before approval)
  for (const [name, lat] of [[A, 24.0], [B, 25.0]] as const) {
    const r = await root.c.from("cities").insert({ name, state: "Demo", municipal_body: `${name} Nagar Nigam (demo)`, center_lat: lat, center_lng: 76.0 }).select("name").single();
    cities.push(r.data?.name ?? name);
  }
  // 5. rejection first
  await root.c.rpc("root_decide_admin_request", { _request_id: app2.data!.id, _approve: false, _note: "Not verified" });
  const { data: rejRoles } = await admin.from("user_roles").select("role").eq("user_id", rej.id).in("role", ["admin", "moderator"]);
  ok("5a rejected applicant gets no admin role", (rejRoles ?? []).length === 0, rejRoles);
  const rejN = await rej.c.from("user_notifications").select("kind");
  ok("5b rejected applicant notified", rejN.data?.some((n) => n.kind === "rejected"), rejN);
  const pendingCan = await verified.rpc("admin_can_manage_city", { _user_id: su.data.user!.id, _city: A });
  ok("5c pending applicant has no city powers", pendingCan.data === false, pendingCan);

  // 4. approval with city assignment
  const dec = await root.c.rpc("root_decide_admin_request", { _request_id: app.data!.id, _approve: true, _city: A });
  ok("4a Root approves and assigns city", !dec.error, dec.error);
  const can = await verified.rpc("admin_can_manage_city", { _user_id: su.data.user!.id, _city: A });
  const canB = await verified.rpc("admin_can_manage_city", { _user_id: su.data.user!.id, _city: B });
  ok("4b approved applicant is City Admin of assigned city only", can.data === true && canB.data === false, [can, canB]);
  const apN = await verified.from("user_notifications").select("kind,body");
  ok("4c approved applicant notified", apN.data?.some((n) => n.kind === "approved"), apN);
  const caA = verified;
  const caB = await user("cityadminB");
  await admin.from("user_roles").insert({ user_id: caB.id, role: "admin", city: B, status: "active" });

  // city configuration: wards with boundaries (A) and centre-only (B), departments, routing
  const wa1 = await caA.from("wards").insert({ city: A, ward_number: 1, name: "North Demo", zone: "Zone N", center_lat: 24.005, center_lng: 76.0, radius_m: 600, boundary: sq(24.005, 76.0), is_demo: true, source: "Demonstration square" }).select("id").single();
  const wa2 = await caA.from("wards").insert({ city: A, ward_number: 2, name: "South Demo", zone: "Zone S", center_lat: 23.995, center_lng: 76.0, radius_m: 600, boundary: sq(23.995, 76.0), is_demo: true }).select("id").single();
  const wb1 = await caB.c.from("wards").insert({ city: B, ward_number: 1, name: "Centre Demo", zone: "Zone C", center_lat: 25.0, center_lng: 76.0, radius_m: 800, is_demo: true }).select("id").single();
  const wb2 = await caB.c.from("wards").insert({ city: B, ward_number: 2, name: "East Demo", zone: "Zone E", center_lat: 25.0, center_lng: 76.02, radius_m: 800, is_demo: true }).select("id").single();
  ok("C1 city admins add wards with GeoJSON boundary / centre", [wa1, wa2, wb1, wb2].every((r) => !r.error), [wa1.error, wb1.error]);
  const dA = await caA.from("departments").insert({ name: `Road Dept ${T}`, city: A }).select("id").single();
  const dB = await caB.c.from("departments").insert({ name: `Sadak Vibhag ${T}`, city: B }).select("id").single();
  const rA = await caA.from("city_category_routing").insert({ city: A, category: "broken-road", department_id: dA.data!.id, deadline_hours: 48 });
  const rB = await caB.c.from("city_category_routing").insert({ city: B, category: "broken-road", department_id: dB.data!.id, deadline_hours: 24 });
  ok("D1 each city configures its own routing + deadline", !rA.error && !rB.error, [rA.error, rB.error]);
  const rX = await caB.c.from("city_category_routing").insert({ city: A, category: "garbage", department_id: dB.data!.id });
  ok("D2 city admin cannot set routing for another city", !!rX.error);
  const rY = await caA.from("city_category_routing").insert({ city: A, category: "garbage", department_id: dB.data!.id });
  ok("D3 cannot route to another city's department", !!rY.error);
  const rZ = await caA.from("category_routing").update({ department_id: dA.data!.id }).eq("category", "broken-road").select("category");
  ok("D4 city admin cannot change shared routing", (rZ.data ?? []).length === 0, rZ);

  const file = (c: SupabaseClient, city: string, lat: number | null, lng: number | null, category = "broken-road") =>
    c.from("complaints").insert({ user_id: cit.id, title: "T", description: "Test", category, priority: "medium", location: "Demo", city, latitude: lat, longitude: lng, submitted_by: "T" }).select("id").single()
      .then(async (r) => (await admin.from("complaints").select("city,ward_id,zone,department_id,due_at,created_at,location_status,routing_status").eq("id", r.data!.id).single()).data!);
  const hrs = (r: { due_at: string; created_at: string }) => Math.round((+new Date(r.due_at) - +new Date(r.created_at)) / 3.6e6);

  // 6-9
  const c1 = await file(cit.c, A, 24.006, 76.001);
  ok("6a GPS inside ward boundary -> correct ward (A)", c1.ward_id === wa1.data!.id && c1.location_status === "boundary", c1);
  ok("7a zone assigned automatically", c1.zone === "Zone N", c1);
  ok("8a routed to city A's own department", c1.department_id === dA.data!.id && c1.routing_status === "city", c1);
  ok("9a city A deadline (48h)", hrs(c1) === 48, c1);
  const c2 = await file(cit.c, A, 23.994, 75.999);
  ok("6b second ward in city A", c2.ward_id === wa2.data!.id && c2.zone === "Zone S", c2);
  const c3 = await file(cit.c, B, 25.0005, 76.0195);
  ok("6c no boundary -> nearest centre fallback, labelled (B)", c3.ward_id === wb2.data!.id && c3.location_status === "nearest_centre" && c3.zone === "Zone E", c3);
  ok("8b routed to city B's own department, 24h deadline", c3.department_id === dB.data!.id && hrs(c3) === 24, c3);
  const c4 = await file(cit.c, B, 24.0055, 76.0005);
  ok("6d wrong city picked but GPS inside city A ward -> city detected as A", c4.city === A && c4.ward_id === wa1.data!.id, c4);

  // 12. fallbacks
  const c5 = await file(cit.c, A, null, null);
  ok("12a no GPS -> no ward, needs verification", c5.ward_id === null && c5.location_status === "needs_verification", c5);
  const c6 = await file(cit.c, B, 25.2, 76.3);
  ok("12b outside ward coverage -> not silently assigned", c6.ward_id === null && c6.location_status === "needs_verification", c6);
  const c7 = await file(cit.c, A, 24.006, 76.001, "garbage");
  ok("12c no city mapping -> shared fallback flagged (or manual)", ["shared_fallback", "manual_needed"].includes(c7.routing_status), c7);

  // 10. isolation + 11. correction
  const ids = await admin.from("complaints").select("id").eq("city", B).is("ward_id", null).limit(1).single();
  const xFix = await caA.rpc("admin_correct_complaint", { _complaint_id: ids.data!.id, _ward_id: wb1.data!.id, _department_id: null });
  ok("10a City A admin cannot correct city B complaint", !!xFix.error);
  const xWard = await caB.c.rpc("admin_correct_complaint", { _complaint_id: ids.data!.id, _ward_id: wa1.data!.id, _department_id: null });
  ok("10b cannot assign another city's ward", !!xWard.error);
  const citFix = await cit.c.from("complaints").update({ ward_id: wb1.data!.id }).eq("id", ids.data!.id).select("id");
  ok("10c citizen cannot change ward", !!citFix.error || (citFix.data ?? []).length === 0, citFix);
  const fix = await caB.c.rpc("admin_correct_complaint", { _complaint_id: ids.data!.id, _ward_id: wb1.data!.id, _department_id: dB.data!.id, _note: "Checked on site" });
  const after = (await admin.from("complaints").select("ward_id,zone,location_status").eq("id", ids.data!.id).single()).data;
  ok("11a City B admin corrects ward/zone", !fix.error && after?.ward_id === wb1.data!.id && after?.zone === "Zone C" && after?.location_status === "corrected", [fix.error, after]);
  const aud = await admin.from("audit_logs").select("id").eq("action", "complaint_assignment_corrected").eq("target_id", ids.data!.id);
  ok("11b correction written to audit log", (aud.data ?? []).length === 1, aud);
  const preview = await fresh().rpc("locate_point", { _lat: 24.006, _lng: 76.001, _city: null });
  ok("B6 complaint form can preview city/ward/zone from GPS", preview.data?.[0]?.ward_name === "North Demo" && preview.data?.[0]?.is_demo === true, preview);
} finally {
  if (realRoot) await admin.from("app_config").update({ value: realRoot }).eq("key", "root_admin_user_id");
  const { data: chk } = await admin.from("app_config").select("value").eq("key", "root_admin_user_id").single();
  console.log(chk?.value === realRoot ? "root admin restored" : "!!! ROOT NOT RESTORED");
  for (const c of cities) {
    await admin.from("complaints").delete().eq("city", c);
    await admin.from("city_category_routing").delete().eq("city", c);
    await admin.from("wards").delete().eq("city", c);
    await admin.from("departments").delete().eq("city", c);
    await admin.from("user_roles").delete().eq("city", c);
    await admin.from("cities").delete().eq("name", c);
  }
  for (const id of made) { await admin.from("complaints").delete().eq("user_id", id); await admin.auth.admin.deleteUser(id); }
  console.log(`\n${pass} passed, ${fail} failed`);
}
