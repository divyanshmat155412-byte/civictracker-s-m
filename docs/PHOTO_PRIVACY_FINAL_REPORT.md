# Civic Tracker — Photo Upload, Anonymous Privacy & Photo Verification (Final Round)

Date: 2026-11-05 · Environment: preview build + shared live database · Nothing published.

## 1. Changes

| # | Area | Change | Files / objects |
|---|------|--------|-----------------|
| 1 | Storage | `complaint-photos` bucket limit set to **5 MB** (existing photos are 107 KB and 379 KB — unaffected) | bucket setting |
| 2 | Upload (browser) | Every upload (citizen form, City Admin after-photo, Field Worker after-photo) checks the **real file bytes** (JPEG/PNG/WebP/GIF/HEIC magic numbers) and size before upload; extension and content-type now come from the detected type, never the file name | `src/lib/image-validate.ts`, `Index.tsx`, `Admin.tsx`, `routes/worker.tsx` |
| 3 | Photo serving | `/api/public/photo/…` now reads the file, verifies its real bytes are an allowed image and sets the content type from those bytes; anything else → 404 (so a disguised file uploaded directly to the API can never be served) | `src/routes/api/public/photo.$.ts` |
| 4 | Anonymous privacy | New `reveal_anonymous_complainant(complaint, reason)` function: only the **active City Admin of that complaint's city** or the **Platform Super Admin**; reason of 10–500 chars required; only for anonymous complaints; returns account ID + profile name only (no email/phone); writes `anonymous_identity_revealed` audit row with who, complaint and reason | migration `0018_anonymous_identity_reveal.sql` |
| 5 | Admin UI | "Reveal identity" link on anonymous complaints in the admin list (asks for reason, shows result in a temporary message) | `Admin.tsx` |
| 6 | Tests | 3 unit tests; 12 new live checks added to `scripts/e2e-photo-ownership.ts` | `src/lib/image-validate.test.ts` |

No RLS policy weakened; no data changed; Super Admin untouched. Public tracking, notifications and APIs still show "Anonymous" (identity column remains unreadable to anon/authenticated).

## 2. Rollback

```sql
DROP FUNCTION public.reveal_anonymous_complainant(uuid, text);
```
Bucket limit: set back via storage settings (remove bucket file-size limit). Code: revert the six files above. No data migration to undo.

## 3. Results (all sequential, Super Admin safety lock, temporary accounts only)

| Suite | Result |
|---|---|
| Photo / ownership / anonymity / upload / identity reveal | **42 PASS / 0 FAIL** |
| Security | 45 / 45 PASS |
| Complaint lifecycle (incl. worker after-photo proof) | 23 / 23 PASS |
| Earlier scan fixes | 31 / 31 PASS |
| GPS routing | 34 PASS / 0 FAIL / 4 SKIP |
| City onboarding | 21 / 21 PASS |
| AI / escalation / merge (innovation) | 25 / 25 PASS |
| Unit tests | 19 / 19 PASS |

Key new checks: over-5 MB upload rejected (U1); HTML renamed `.jpg` never served even when attached to a complaint (U2); served type from bytes (U3); citizen, signed-out visitor, officer, and other-city City Admin cannot reveal (A1–A4); missing reason / non-anonymous refused (A5–A6); correct City Admin can reveal (A7); audit row records who + why (A8); public still sees "Anonymous" (A9).

## 4. Browser verification (real Chromium, desktop 1280 + mobile 390)

| Check | Result |
|---|---|
| CT-14 tracking: complaint photo, before, after images load | PASS (3/3 both sizes) |
| CT-14 poster photo | PASS (both sizes) |
| CT-142 photos | NOT APPLICABLE — CT-142 has no photo attached |
| Direct storage URL for CT-14 photo | Blocked (400) — PASS |
| Photo link for CT-14 through new code | 200 image/jpeg — PASS |
| Unattached file through photo link | 404 — PASS |

Note: stored photo links point to the live domain, which still runs the old code; the browser test redirected those requests to the preview's new code. Live behaviour is confirmed only after publishing.

Screenshots: `CivicTrackerSubmission/security_evidence_v3/`.

## 5. Data integrity after all runs

Root ID `4169471f…` unchanged, roles admin:ALL + moderator:ALL active. 3 complaints (CT-14, CT-142, CT-29), 2 photos, 5 profiles, 5 users. Audit rows only grew (1102). All complaint deletions in the run window were test-suite fixtures.

## 6. NOT TESTED / PARTIAL

- In-browser upload rejection message with a real camera photo (covered by unit + API tests only) — PARTIAL.
- "Reveal identity" button clicked in a browser (function fully tested via API) — PARTIAL.
- PDF export photo rendering — not re-tested this round (PDF earlier verified for safe text only).
- Live-site photo links with new code — pending publish.
- Server-side byte check at upload time is not possible in storage rules; protection is: private bucket + browser check + serve-time check. A crafted file can be stored by its owner but never served.

## 7. Verdict

All three security items are fixed and verified in preview. Ready to publish; after publishing, re-open CT-14 and a poster on the live site to confirm.
