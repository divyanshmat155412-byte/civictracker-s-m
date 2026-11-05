# SA-05 / SA-06 Remediation Report — 5 Nov 2026

Preview and Live share one database; changes applied after explicit written approval. Not published.

## Database migration
`drizzle/migrations/0020_sa05_sa06_whatsapp_policy_and_ai_rate_limit.sql`

| Object | Change |
|---|---|
| Policy `"WhatsApp webhook can insert complaints"` on `public.complaints` | **Dropped** (SA-05) |
| `public.api_usage` (user_id, endpoint, window_start, request_count, updated_at) | **Created**; RLS on, no policies; only `service_role` granted |
| `public._consume_ai_quota(uuid,text,timestamptz,int,int)` | **Created**; SECURITY DEFINER, `search_path=public`, execute = service_role only |
| `public.consume_ai_quota(text)` | **Created**; SECURITY DEFINER, uses `auth.uid()`, fixed 30 / 600s; execute = authenticated + service_role (not anon) |

No other policy, role, auth, storage or record was changed.

Original SA-05 policy:
```sql
CREATE POLICY "WhatsApp webhook can insert complaints" ON public.complaints
  AS PERMISSIVE FOR INSERT TO anon WITH CHECK (source = 'whatsapp'::text);
```

Rollback:
```sql
DROP FUNCTION IF EXISTS public.consume_ai_quota(text);
DROP FUNCTION IF EXISTS public._consume_ai_quota(uuid, text, timestamptz, integer, integer);
DROP TABLE IF EXISTS public.api_usage;
CREATE POLICY "WhatsApp webhook can insert complaints" ON public.complaints
  AS PERMISSIVE FOR INSERT TO anon WITH CHECK (source = 'whatsapp'::text);
```
Code rollback: remove `enforceAiQuota` calls (two lines per endpoint).

## Design (SA-06)
- One shared quota: 30 AI requests per signed-in user per fixed 10-minute window, across all 8 endpoints; per-endpoint rows kept for monitoring.
- Per-user/window advisory lock makes check-and-increment atomic (no concurrent overshoot).
- Enforced right after sign-in/staff checks, before any AI call. Over limit → HTTP 429, `Retry-After` header, message "Please try again in about N minutes".
- Note: requests rejected later for bad input still count (prevents probing).

## Files
- Modified: `src/lib/api-guard.ts` (`enforceAiQuota`), 8 endpoints in `src/routes/api/public/fn/` (civic-chat, analyze-image, voice-stt, voice-transcribe, generate-summary, analyze-sentiment, predict-trends, generate-admin-report), `whatsapp-webhook.ts` (pre-existing bug fix: AI category list did not match the database, so every AI-categorised WhatsApp message failed with HTTP 500; now uses allowed categories and validates them), `scripts/e2e-photo-ownership.ts` (O6/O7 now expect signed-out WhatsApp inserts to be refused).
- New: `scripts/e2e-rate-limit.ts`, this report.

## Tests (sequential, Super Admin safety lock, temporary accounts)
| Suite | Result |
|---|---|
| New SA-05/SA-06 suite | 42 PASS / 0 FAIL (first run 39/3: webhook category bug + test typo, both fixed) |
| Security | 45/45 |
| Scan fixes | 31/31 |
| Photo / ownership / anonymity | 42/42 |
| Complaint lifecycle | 23/23 |
| AI / innovation | 25/25 |
| City onboarding | 21/21 |
| GPS routing / applications | 34 PASS / 0 FAIL / 4 SKIP (skips are not passes) |
| Unit tests | 29/29 |

New-suite coverage: signed-out WhatsApp/other inserts refused with public key; webhook 401 without token and with citizen session; staff simulator creates a WhatsApp complaint via server; citizen and anonymous filing work; City Admin update works; users cannot read/write usage or call the internal function; 30 allowed / 31st refused; renaming endpoint doesn't bypass; counters exact; users independent; 50 concurrent requests → exactly 30 total; window reset (synthetic clock) and 10-minute production window; all 8 endpoints 401 signed-out and 429 over limit (no AI spent); one real chat call below limit returns 200 and is counted once.

AI cost: ~2 cheap calls in the new suite (1 chat, 1 WhatsApp extraction) plus the existing suites' usual calls. No SMS/WhatsApp messages sent.

## Integrity (after)
Root `4169471f-…3a23` unchanged; roles admin:ALL + moderator:ALL active. Complaints CT-14, CT-142, CT-29 with unchanged `updated_at`; 5 users, 5 profiles, 2 photos. Test records deleted by exact ID; one orphan usage counter from a deleted test account removed.

## Limitations
- Live site gets the AI limit only after publishing (database part is live, endpoint code is not).
- WhatsApp category fix is also live only after publishing; until then, live WhatsApp intake fails when the AI picks a category.
- Real Twilio/Meta webhook token path not tested end-to-end (no provider configured); token logic covered by unit tests.
- Older suites don't clear `api_usage` for their temporary accounts; leftover rows are harmless (no user) and can be removed by ID.
- No browser screenshots captured for this round; evidence is test output.
- Fixed windows allow up to 60 requests across a window boundary.
