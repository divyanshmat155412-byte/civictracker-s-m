# Civic Tracker — Security Remediation Report

Audit date 2026-11-05 (UTC). No database schema, access rule, authentication setting, storage permission, role or production record was changed in this round. Nothing was published.

## SA-01 / SA-02 / SA-04 — WhatsApp intake locked down (source code)

- New `src/lib/whatsapp-guard.ts`:
  - `authorizeWebhook()` allows a request only when it carries the shared token in `x-webhook-token` (or `?token=`) matching the `WHATSAPP_WEBHOOK_SECRET` secret (min. 16 chars, constant-time compare), **or** the caller is signed-in staff (admin/officer, checked server-side through `has_role`). With no secret configured, only staff can use it (the in-app simulator keeps working).
  - `cleanWhatsAppInput()` keeps only digits/`+` in the phone (max 20), caps text at 2,000 characters and strips control characters, accepts photo links only over https from `api.twilio.com` / `lookaside.fbsbx.com`, and drops non-numeric or out-of-range coordinates.
- `whatsapp-webhook.ts`: rejects non-POST (405), checks the caller before any privileged write or AI call, cleans input, returns a generic error message, GET handler removed.
- **External setup when a real provider is connected:** add secret `WHATSAPP_WEBHOOK_SECRET` and configure the provider URL as `…/api/public/fn/whatsapp-webhook?token=<secret>`. Twilio/Meta signature verification can be added when real credentials exist.
- Rollback: restore the previous file version from history.

## SA-03 — Generic error messages (source code)

All `/api/public/fn/*` 500 responses now return "Request could not be completed. Please try again." (or a similar fixed sentence). Details stay in server logs only. Rate-limit (429) and credit (402) messages are unchanged.

## SA-05 — Proposed, NOT applied (needs your approval)

Removes the database rule that lets anyone with the public key insert "WhatsApp" complaints directly. The webhook uses the privileged server key and does not need it.

```sql
DROP POLICY IF EXISTS "WhatsApp webhook can insert complaints" ON public.complaints;
```
Impact: none on the app's own flows; one test (O6, "signed-out insert still allowed") would be changed to expect rejection. Rollback:
```sql
CREATE POLICY "WhatsApp webhook can insert complaints" ON public.complaints
  FOR INSERT TO anon WITH CHECK (source = 'whatsapp');
```

## SA-06 — Proposed, NOT applied

Add a small `api_usage` table (user_id, endpoint, window_start, count) and a SECURITY DEFINER `bump_api_usage(endpoint, limit)` function called at the start of each AI endpoint, e.g. 30 requests per 10 minutes per user. Requires a new table, so it awaits approval.

## SA-07 / SA-08 — Optional hardening (changes the leaderboard)

- Hide `complaints_count` from the public and show only points/badge.
- `REVOKE SELECT (user_id, city) ON public.workers FROM authenticated;` and give staff a function for those columns.

## Tests added

`src/lib/whatsapp-guard.test.ts` — 10 checks (unknown caller, wrong token, header token, staff caller, no-secret fallback, phone cleaning, foreign photo host, Twilio host, bad coordinates, length cap).
