# Civic Tracker — Security Findings Investigation (5 Nov 2026)

These fixes are in the preview only. Nothing has been published.

The scanner listed 21 code findings. They group into 10 underlying issues (S1–S10). Each issue was checked against the code and the live database. All 10 were genuine.

## Summary

| # | Issue | Severity | Affected | Fix | Verified |
|---|---|---|---|---|---|
| S1 | Signed-out callers could change any complaint's sentiment or AI summary, and AI could raise its priority. The service key skipped all access rules. | Critical | `api/public/fn/analyze-sentiment`, `generate-summary` → `complaints` | GET removed; sign-in required; owner (summary: within 15 min of filing) or city staff only; priority taken from database, not from request | Tests 1–3 PASS |
| S2 | Signed-out callers could run the paid AI features (chat, image, voice ×2, predictions, sentiment, summaries) | Critical | `civic-chat`, `analyze-image`, `voice-stt`, `voice-transcribe`, `predict-trends`, … | Shared `getCaller()` checks the session token; the publishable key is not accepted as a sign-in | Tests 1–2 PASS (20 checks) |
| S3 | Anyone could create paid admin reports | Critical | `generate-admin-report` | Requires an active admin or officer role | Test 4 PASS |
| S4 | Anyone could move a field worker's tracked location | Critical | `simulate-worker-movement` → `worker_locations` | Requires staff who manage both the complaint's city and the worker's city | Tests 5–6 PASS |
| S5 | Any admin could text any phone number | Critical | `send-sms` → `sms_log`, Twilio | A complaint in the admin's city is required. The number must be that citizen's WhatsApp number or their opted-in profile phone. | Tests 7–8 PASS |
| S6 | Signed-in users could give themselves reward points, then spend them | Critical | `public.profiles` UPDATE policy + `redeem_reward` | Column-level permissions: citizens can edit only name, avatar, home city and updated_at. Points, badge and complaint count are changed only by system triggers and RPCs. No data changed. | Tests 9–11, 13 PASS |
| S7 | Complaint text could run script in the map popups | Critical | `MapView.tsx` (both popup templates) | All values HTML-escaped | Code check; build OK |
| S8 | Complaint text could run script in PDF exports | Critical | `lib/export-utils.ts` | Title, headers and cells escaped | Code check |
| S9 | Spreadsheet formulas could be injected into CSV exports | Warning | `lib/export-utils.ts` | Cells starting with `= + - @` are made inert | Code check |
| S10 | Chat callers could add their own system instructions. The city name could also inject extra filters into the department lookup. | Warning | `civic-chat`, `ComplaintAssignmentPanel.tsx`, `WardConfigTools.tsx` | Chat keeps only user/assistant turns, with size limits. The city value is quoted and cleaned. | Test 1 PASS; code check |

**Tests:**
- New suite (`scripts/e2e-scan-fixes.ts`): 30 PASS, 1 FAIL.
- Existing suites: security 45/45, civic-flow 23/23, innovation 25/25, unit tests 16/16.
- The Super Admin safety snapshot was unchanged after every run.
- Temporary accounts and test complaints were deleted afterwards.

## Remaining risks (not changed; need your decision)

- **Old bug (fails test 12):** `set_my_home_city` errors with "invalid regular expression". PostgreSQL does not support `\p{L}`. This bug was already there; the S6 change did not cause it. Fixing it means changing a database function, so I need your approval.
- **Public read rules (scanner "info/error"):** complaints, timeline, comments, ratings, upvotes, polls, wards, routing, achievements, notifications, user_achievements, worker_assignments and profiles are readable by anyone. This looks intentional for public tracking and the leaderboard. Private columns (phone numbers, worker user_id/city, WhatsApp) are already hidden column by column. Tightening these rules would break public pages.
- **Contact emails:** `cities.contact_email` and `departments.contact_email` are public. These look like official contact addresses. Please confirm they are not personal.
- **Photo storage:** the read rule is `complaint-photos public read`, and uploads are not tied to the owner's folder. Photos are served through `/api/public/photo/`. Tying uploads to owner folders needs an upload-path change and a check of existing photos, so it was deferred.
- **Complaint insert rule:** this rule only checks that someone is signed in; it does not check `user_id`. Tightening it needs care because of anonymous complaints and WhatsApp complaints. Deferred.
- **Feature change:** AI chat, predictions, voice and photo analysis now need a signed-in user. Signed-out visitors see a "please sign in" message.
- **SMS change:** admins must now pick a complaint before sending an SMS.
