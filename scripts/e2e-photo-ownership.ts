// Verifies photo storage security, complaint ownership enforcement and anonymous privacy.
// Throw-away accounts only; never touches the real Super Admin or existing complaints/photos.
import { createClient } from "@supabase/supabase-js";
import { acquireSafety } from "./_safety";
const url = process.env.SUPABASE_URL!, svc = process.env.SUPABASE_SERVICE_ROLE_KEY!, anonKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
const APP = process.env.APP_URL || "http://localhost:8080";
const admin = createClient(url, svc, { auth: { persistSession: false } });
const pub = createClient(url, anonKey, { auth: { persistSession: false } });
const safety = await acquireSafety("photo-ownership");
let pass = 0, fail = 0;
const ok = (n: string, c: unknown, d?: unknown) => { c ? pass++ : fail++; console.log(c ? "PASS" : "FAIL", n, c ? "" : JSON.stringify(d)?.slice(0, 300)); };
const users: string[] = [], complaints: string[] = [], objects: string[] = []; const T = Date.now();
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);
const EXISTING = "e1882c5e-14f5-40c4-aa1c-f915c6b005cb/1793878583958.jpg"; // CT-14 photo, read-only
async function user(tag: string) {
  const email = `photo-${tag}-${T}@example.com`;
  const { data } = await admin.auth.admin.createUser({ email, password: "Test-pass-12345!", email_confirm: true });
  users.push(data.user!.id);
  const c = createClient(url, anonKey, { auth: { persistSession: false } });
  await c.auth.signInWithPassword({ email, password: "Test-pass-12345!" });
  return { id: data.user!.id, c };
}
const base = { description: "TEST record for security checks", category: "other", priority: "low", location: "TEST", city: "PhotoTestCity" };
try {
  const before = await admin.from("complaints").select("id", { count: "exact", head: true });
  const cit = await user("citizen"), other = await user("other"), staff = await user("staff");
  await admin.from("user_roles").insert({ user_id: staff.id, role: "admin", city: "PhotoTestCity" });

  // ---- Ownership
  const own = await cit.c.from("complaints").insert({ ...base, user_id: cit.id, title: "TEST own", submitted_by: "T" }).select("id").single();
  complaints.push(own.data!.id);
  const ownRow = await admin.from("complaints").select("user_id").eq("id", own.data!.id).single();
  ok("O1 normal complaint owned by filer", ownRow.data?.user_id === cit.id, ownRow);
  const spoof = await cit.c.from("complaints").insert({ ...base, user_id: other.id, title: "TEST spoof", submitted_by: "T" }).select("id").single();
  complaints.push(spoof.data!.id);
  const spoofRow = await admin.from("complaints").select("user_id").eq("id", spoof.data!.id).single();
  ok("O2 spoofed owner replaced by real filer", spoofRow.data?.user_id === cit.id, spoofRow);
  const audit = await admin.from("audit_logs").select("id").eq("action", "complaint_owner_spoof_blocked").eq("user_id", cit.id);
  ok("O3 spoof attempt written to audit log", (audit.data?.length ?? 0) >= 1, audit);
  const anonC = await cit.c.from("complaints").insert({ ...base, user_id: cit.id, title: "TEST anonymous", anonymous: true, submitted_by: "Real Name Here" }).select("id").single();
  complaints.push(anonC.data!.id);
  const anonRow = await admin.from("complaints").select("user_id, submitted_by").eq("id", anonC.data!.id).single();
  ok("O4 anonymous complaint still linked to filer privately", anonRow.data?.user_id === cit.id, anonRow);
  ok("O5 anonymous complaint shows 'Anonymous' as filer name", anonRow.data?.submitted_by === "Anonymous", anonRow);
  const wa = await pub.from("complaints").insert({ ...base, user_id: cit.id, title: "TEST whatsapp", source: "whatsapp", submitted_by: "WhatsApp test" }).select("id");
  ok("O6 WhatsApp-style signed-out insert still allowed", !wa.error, wa.error);
  const waRow = await admin.from("complaints").select("id, user_id").eq("title", "TEST whatsapp").eq("city", "PhotoTestCity").maybeSingle();
  if (waRow.data) complaints.push(waRow.data.id);
  ok("O7 signed-out insert cannot claim an account", waRow.data && waRow.data.user_id === null, waRow);
  const steal = await other.c.from("complaints").update({ user_id: other.id }).eq("id", own.data!.id).select("id");
  const stillOwn = await admin.from("complaints").select("user_id").eq("id", own.data!.id).single();
  ok("O8 another citizen cannot take over a complaint", stillOwn.data?.user_id === cit.id, steal);
  const selfMove = await cit.c.from("complaints").update({ user_id: other.id }).eq("id", own.data!.id).select("id");
  ok("O9 owner cannot transfer complaint to someone else", !!selfMove.error, selfMove);
  const mine = await cit.c.rpc("my_complaint_ids");
  const mineIds = (mine.data ?? []) as string[];
  ok("O10 'my complaints' lists own records", mineIds.includes(own.data!.id) && mineIds.includes(anonC.data!.id), mine);
  const otherMine = await other.c.rpc("my_complaint_ids");
  ok("O11 other citizen sees none of them", ((otherMine.data ?? []) as string[]).length === 0, otherMine);

  // ---- Anonymous privacy
  const pubId = await pub.from("complaints").select("user_id").eq("id", anonC.data!.id);
  ok("P1 signed-out visitor cannot read filer account id", !!pubId.error, pubId);
  const authId = await other.c.from("complaints").select("user_id").eq("id", anonC.data!.id);
  ok("P2 signed-in citizen cannot read filer account id", !!authId.error, authId);
  const pubStar = await pub.from("complaints").select("*").limit(1);
  ok("P3 select-all on complaints is refused (no hidden-column leak)", !!pubStar.error, pubStar.data);
  const pubList = await pub.from("complaints").select("id,complaint_id,title,status,submitted_by,anonymous").eq("id", anonC.data!.id).single();
  ok("P4 public tracking still shows the anonymous complaint", pubList.data?.status && pubList.data.submitted_by === "Anonymous", pubList);

  // ---- Storage
  const mine1 = `${cit.id}/test-${T}.jpg`;
  const up = await cit.c.storage.from("complaint-photos").upload(mine1, JPEG, { contentType: "image/jpeg" });
  if (!up.error) objects.push(mine1);
  ok("S1 citizen can upload a photo into own folder", !up.error, up.error);
  const intoOther = await cit.c.storage.from("complaint-photos").upload(`${other.id}/x-${T}.jpg`, JPEG, { contentType: "image/jpeg" });
  if (!intoOther.error) objects.push(`${other.id}/x-${T}.jpg`);
  ok("S2 cannot upload into another user's folder", !!intoOther.error, intoOther);
  const html = await cit.c.storage.from("complaint-photos").upload(`${cit.id}/evil-${T}.html`, new TextEncoder().encode("<script>1</script>"), { contentType: "text/html" });
  if (!html.error) objects.push(`${cit.id}/evil-${T}.html`);
  ok("S3 non-image file types rejected", !!html.error, html);
  const signedOut = await pub.storage.from("complaint-photos").upload(`anon-${T}.jpg`, JPEG, { contentType: "image/jpeg" });
  if (!signedOut.error) objects.push(`anon-${T}.jpg`);
  ok("S4 signed-out upload rejected", !!signedOut.error, signedOut);
  const overwrite = await other.c.storage.from("complaint-photos").upload(mine1, JPEG, { contentType: "image/jpeg", upsert: true });
  ok("S5 another user cannot overwrite a photo", !!overwrite.error, overwrite);
  const anonRead = await pub.storage.from("complaint-photos").download(EXISTING);
  ok("S6 signed-out direct storage read blocked", !!anonRead.error, anonRead.error);
  const crossRead = await other.c.storage.from("complaint-photos").download(mine1);
  ok("S7 another citizen cannot read my upload directly", !!crossRead.error, crossRead.error);
  const ownRead = await cit.c.storage.from("complaint-photos").download(mine1);
  ok("S8 owner can read own upload", !ownRead.error, ownRead.error);
  const staffRead = await staff.c.storage.from("complaint-photos").download(mine1);
  ok("S9 staff can read uploads", !staffRead.error, staffRead.error);
  const signedUrl = await pub.storage.from("complaint-photos").createSignedUrl(EXISTING, 60);
  ok("S10 signed-out user cannot mint a signed URL", !!signedUrl.error, signedUrl.data);

  // ---- Photo route (public tracking)
  const r1 = await fetch(`${APP}/api/public/photo/${EXISTING}`);
  ok("R1 existing CT-14 photo link still works", r1.status === 200 && (r1.headers.get("content-type") || "").startsWith("image/"), r1.status);
  const r2 = await fetch(`${APP}/api/public/photo/${mine1}`);
  ok("R2 unattached upload not served publicly", r2.status === 404, r2.status);
  await admin.from("complaints").update({ photo_url: `${APP}/api/public/photo/${mine1}` }).eq("id", own.data!.id);
  const r3 = await fetch(`${APP}/api/public/photo/${mine1}`);
  ok("R3 photo attached to a complaint is served", r3.status === 200, r3.status);
  const r4 = await fetch(`${APP}/api/public/photo/..%2F..%2Fetc%2Fpasswd`);
  ok("R4 path traversal rejected", r4.status === 404, r4.status);

  const after = await admin.from("complaints").select("id", { count: "exact", head: true });
  ok("D1 only test complaints were added", (after.count ?? 0) - (before.count ?? 0) === complaints.length, { before: before.count, after: after.count });
} finally {
  if (objects.length) await admin.storage.from("complaint-photos").remove(objects);
  if (complaints.length) await admin.from("complaints").delete().in("id", complaints);
  await admin.from("user_roles").delete().in("user_id", users);
  for (const id of users) await admin.auth.admin.deleteUser(id);
  console.log(`\n${pass} passed, ${fail} failed`);
  await safety.release();
}
