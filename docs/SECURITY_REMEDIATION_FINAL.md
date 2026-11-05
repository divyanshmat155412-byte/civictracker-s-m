# Civic Tracker — Security Remediation & Deployment-Readiness Report

Date: 2026-11-05 · Status: **NOT PUBLISHED** (awaiting owner approval)

## 1. Home-city save failure — FIXED & VERIFIED
- Root cause: `set_my_home_city()` used `\p{L}`, which PostgreSQL regex does not support, so every save errored.
- Fix: same function signature/behaviour, regex replaced with a PostgreSQL-compatible pattern (first char a letter, no digits/control chars/HTML/symbols). Hindi names with vowel signs (रतलाम, नई दिल्ली) and `St. John's-Wood` accepted; `x1<script>` and `Indore<b>` rejected (verified by SQL).
- No profile or complaint data touched. Scan-fix check #12 "home-city RPC still works" now PASS.

## 2. Public data review
| Data | Public today | Sensitive fields | Verdict |
|---|---|---|---|
| Complaints | Yes (tracking) | `whatsapp_number` — **not readable** by anon (column grant denied) | OK. `user_id`/`submitted_by` readable; for anonymous complaints this could link a report to an account. 0 anonymous complaints exist now. **Recommended (not applied):** mask in a view or trigger — needs product decision. |
| Timeline | Yes | Notes + `updated_by` user id | Acceptable for tracking; `updated_by` exposes staff UUIDs only. |
| Comments | Yes | `user_id`, `user_name` | Intended public discussion. |
| Profiles / leaderboard | Yes | `phone_number`, `sms_opt_in` **denied** to anon | OK. `user_id` public. |
| Workers | Yes | `phone`, `user_id` **denied** to anon | OK (name/department only). |
| Assignments | Yes | worker ↔ complaint link | Low risk; could be restricted to staff later. |
| Notifications (broadcast) | Yes | Generic complaint titles only | OK. Personal notifications live in `user_notifications` (owner-only). |
| Worker live locations | Admin only | — | OK. |

## 3. Contact emails
All 8 department emails are role-based (`publicworks@civic.gov`, `water@civic.gov`, …). No personal addresses. Note: `civic.gov` is a **placeholder domain**, not a real Ratlam Municipal Corporation address — replace before real launch. `cities` table has no rows/emails.

## 4. Photo storage — REVIEWED, NO CHANGE
- Bucket `complaint-photos` is already **private**; photos are served through `/api/public/photo/…`.
- Remaining issue: a storage read policy allows anyone to read objects in that bucket via the storage API, and any signed-in user can upload. 2 objects exist.
- Proposed plan (not executed): (1) add signed-URL generation in the photo route with short expiry; (2) restrict read policy to staff + owner; (3) restrict upload path to `auth.uid()/…`. Rollback: re-create the current policy (SQL saved in this report's appendix request). Requires owner approval because it can break existing photo links.

## 5. Complaint ownership — REVIEWED, NO CHANGE
- Web complaints: CT-14 and CT-142 are linked to their account; CT-29 has no owner (legacy).
- Insert policy only checks "signed in", so a client could set another `user_id`. Recommended: trigger forcing `user_id := auth.uid()` for authenticated non-WhatsApp inserts. WhatsApp (anon, `source='whatsapp'`) and anonymous flag preserved. Not applied — needs approval. Existing ownership untouched.

## 6. Browser tests of escaping fixes — PASS (real Chromium)
Malicious text (`<img onerror>`, `<script>`) was injected into the complaint list *in the browser only* (network interception, no database writes).
- **Map popup:** first run FAILED — script executed. Root cause: the preview was serving an old bundle because the previous security change had broken the build (`api-guard` sat in a server-only folder imported by route files). Fixed by moving the helper to `src/lib/api-guard.ts`. Re-test: tag shown as text, 0 injected images, no execution → **PASS**.
- **PDF export:** 0 images, 0 scripts, no execution → **PASS**.
- **CSV export:** `=HYPERLINK`, `+`, `-`, `@` cells prefixed with `'` → **PASS**.
- Evidence: `CivicTrackerSubmission/security_evidence/Map_Popup_Escaped.png`, `PDF_Export_Escaped.png`.

## 7–8. Test results (sequential, with Super Admin safety lock)
| Suite | Result |
|---|---|
| Scan-fix checks | 31 PASS / 0 FAIL (previous failure fixed) |
| Security | 45/45 PASS |
| Complaint lifecycle | 23/23 PASS |
| AI / innovation | 25/25 PASS |
| City onboarding | 21/21 PASS |
| GPS routing | 34 PASS / 0 FAIL / 4 SKIP |
| Unit tests | 16/16 PASS |

## 9. Integrity
- Super Admin ID `4169471f-…3a23` unchanged; roles admin:ALL + moderator:ALL active; no other city-less admin.
- Complaints 3 (CT-14, CT-29, CT-142), photos 2, profiles 5 — unchanged. Audit log grew (append-only) from test runs; test cleanup deleted only test-created records ("E2E …" titles).

## 10. Remaining risks before launch
1. Storage read/upload policies (Section 4) — open.
2. Complaint `user_id` spoofing on insert (Section 5) — open.
3. Anonymous complaints reveal `user_id`/`submitted_by` publicly (Section 2) — open.
4. 50+ SECURITY DEFINER linter warnings — reviewed earlier, not urgent.
5. Placeholder department emails.
6. Real microphone/camera, paid SMS/WhatsApp — not tested.

**Verdict:** Ready for an MVP/hackathon demo deployment. **Not** claimed fully secure or production-ready until items 1–3 are approved and fixed.

## Changed files this round
- Database: `set_my_home_city()` regex fix (non-destructive, same signature).
- `src/lib/server/api-guard.ts` → `src/lib/api-guard.ts` (fixes broken client build); import paths in 10 files under `src/routes/api/public/fn/`.
