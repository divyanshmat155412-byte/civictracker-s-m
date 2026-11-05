// New-city onboarding test with temporary accounts and a temporary city.
import { createClient } from "@supabase/supabase-js";
const url = process.env.SUPABASE_URL!, svc = process.env.SUPABASE_SERVICE_ROLE_KEY!, anon = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
const admin = createClient(url, svc, { auth: { persistSession: false } });
import { acquireSafety } from "./_safety";
const safety = await acquireSafety("city-onboarding");
let pass = 0, fail = 0;
const ok = (n: string, c: unknown, d?: unknown) => { c ? pass++ : fail++; console.log(c ? "PASS" : "FAIL", n, c ? "" : JSON.stringify(d)?.slice(0, 300)); };
const T = Date.now(), made: string[] = [];
async function user(tag: string) {
  const email = `city-${tag}-${T}@example.com`;
  const { data } = await admin.auth.admin.createUser({ email, password: "Test-pass-12345!", email_confirm: true });
  made.push(data.user!.id);
  const c = createClient(url, anon, { auth: { persistSession: false } });
  await c.auth.signInWithPassword({ email, password: "Test-pass-12345!" });
  return { id: data.user!.id, email, c };
}
const CITY = `Testnagar${T % 100000}`;
const cit = await user("citizen"), ca = await user("cityadmin"), other = await user("ratlamadmin");

// 1. city profile (only Super Admin; service role stands in for the real Super Admin here)
const cHack = await ca.c.from("cities").insert({ name: CITY });
ok("1a City Admin / citizen cannot onboard a city", !!cHack.error);
const { data: city, error: cErr } = await admin.from("cities").insert({ name: CITY, state: "MP", municipal_body: "Testnagar Nagar Nigam", center_lat: 23.0, center_lng: 75.0 }).select().single();
ok("1b Super Admin onboards city profile", !cErr && city?.name === CITY, cErr);
const pubC = await createClient(url, anon).from("cities").select("name").eq("name", CITY);
ok("1c new city visible publicly for the city selector", pubC.data?.length === 1, pubC);

// 4. City Admin assignment via application -> approval
const app = await ca.c.from("admin_requests").insert({ user_id: ca.id, email: ca.email, full_name: "CA", requested_city: CITY }).select("id").single();
ok("4a applicant applies for the new city", !app.error, app.error);
await admin.from("user_roles").insert({ user_id: ca.id, role: "admin", city: CITY }); // = root approval
await admin.from("user_roles").insert({ user_id: other.id, role: "admin", city: "Ratlam" });
const { data: can } = await ca.c.rpc("admin_can_manage_city", { _user_id: ca.id, _city: CITY });
ok("4b City Admin scoped to the new city", can === true);

// 2. wards & zones
const w1 = await ca.c.from("wards").insert({ city: CITY, ward_number: 1, name: "Old Town", zone: "Zone North", center_lat: 23.01, center_lng: 75.0 }).select("id").single();
const w2 = await ca.c.from("wards").insert({ city: CITY, ward_number: 2, name: "Station Area", zone: "Zone South", center_lat: 22.99, center_lng: 75.0 }).select("id").single();
ok("2a City Admin adds wards & zones for new city", !w1.error && !w2.error, [w1.error, w2.error]);
const wX = await other.c.from("wards").insert({ city: CITY, ward_number: 3, name: "Intruder", zone: "Z", center_lat: 23, center_lng: 75 });
ok("2b another city's admin cannot add wards here", !!wX.error);

// 3. departments
const { data: pw } = await admin.from("departments").select("name").eq("id", (await admin.from("category_routing").select("department_id").eq("category", "broken-road").single()).data!.department_id).single();
const d1 = await ca.c.from("departments").insert({ name: pw!.name, city: CITY, head_name: "Local engineer" }).select("id").single();
ok("3a City Admin creates city-specific department", !d1.error, d1.error);
const dX = await other.c.from("departments").insert({ name: "Intruder dept", city: CITY });
ok("3b another city's admin cannot create departments here", !!dX.error);
const dG = await ca.c.from("departments").insert({ name: "Global hack" });
ok("3c City Admin cannot create shared (all-city) departments", !!dG.error);

// 5. isolated complaint data + automatic routing
const comp = await cit.c.from("complaints").insert({ user_id: cit.id, title: "Pothole", description: "Deep pothole", category: "broken-road", priority: "high", location: "Old Town", city: CITY, latitude: 23.011, longitude: 75.0, submitted_by: "T" }).select("id").single();
ok("5a citizen files complaint in new city", !comp.error, comp.error);
const { data: row } = await admin.from("complaints").select("department_id,ward_id,zone,due_at").eq("id", comp.data!.id).single();
ok("5b routed to the new city's own department", row?.department_id === d1.data?.id, row);
ok("5c ward + zone auto-detected from GPS", row?.ward_id === w1.data?.id && row?.zone === "Zone North", row);
ok("5d deadline set", !!row?.due_at);
const caEdit = await ca.c.from("complaints").update({ priority: "emergency" }).eq("id", comp.data!.id).select("id");
ok("5e City Admin manages new-city complaint", caEdit.data?.length === 1, caEdit);
const oEdit = await other.c.from("complaints").update({ priority: "low" }).eq("id", comp.data!.id).select("id");
ok("5f Ratlam admin cannot touch new-city complaint", (oEdit.data ?? []).length === 0, oEdit);
const logs = await other.c.from("audit_logs").select("id").eq("city", CITY);
ok("5g Ratlam admin cannot read new-city logs", (logs.data ?? []).length === 0);
const own = await ca.c.from("audit_logs").select("action").eq("city", CITY);
ok("5h City Admin sees own-city activity log", (own.data ?? []).length > 0, own);

// city profile editing and deactivation
const caProf = await ca.c.from("cities").update({ municipal_body: "Updated body" }).eq("id", city!.id).select("id");
ok("6a City Admin edits own city profile", caProf.data?.length === 1, caProf);
const rename = await admin.from("cities").update({ name: "Renamed" }).eq("id", city!.id);
ok("6b renaming a city (would orphan complaints) blocked", !!rename.error);
const oProf = await other.c.from("cities").update({ municipal_body: "x" }).eq("id", city!.id).select("id");
ok("6c other admin cannot edit this city profile", (oProf.data ?? []).length === 0);

// cleanup
await admin.from("complaints").delete().eq("id", comp.data!.id);
await admin.from("wards").delete().eq("city", CITY);
await admin.from("departments").delete().eq("city", CITY);
await admin.from("admin_requests").delete().eq("user_id", ca.id);
await admin.from("user_roles").delete().in("user_id", made);
await admin.from("cities").delete().eq("id", city!.id);
for (const id of made) await admin.auth.admin.deleteUser(id);
console.log(`\n${pass} passed, ${fail} failed`);
await safety.release();
