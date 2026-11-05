# Civic Tracker — Security Retest Report

Run 2026-11-05 ~17:05–17:15 UTC against the preview build and the shared live database. All suites ran one at a time with the Super Admin safety lock; every suite ended "SAFETY OK: Super Admin ID and roles unchanged". Only temporary test accounts/records were created and each suite removed only its own records.

## Live endpoint probes (curl, no sign-in)

| Probe | Expected | Result |
|-------|----------|--------|
| POST whatsapp-webhook, no credentials | 401 | 401 PASS |
| POST whatsapp-webhook, wrong token | 401 | 401 PASS |
| POST whatsapp-webhook, public key as bearer | 401 | 401 PASS |
| GET whatsapp-webhook | handler not run | app page returned, no write PASS |
| POST civic-chat, no sign-in | 401 | 401 PASS |
| Photo route path traversal `..%2f..%2fetc%2fpasswd` | 404 | 404 PASS |

## Suites

| Suite | Result |
|-------|--------|
| Unit tests (vitest, 8 files) | 29 passed / 0 failed (before the 10 new webhook checks were counted in a rerun; see below) |
| Security (`e2e-security`) | 45 / 45 PASS |
| Scan fixes (`e2e-scan-fixes`) | 31 / 31 PASS |
| Photo, ownership, anonymity (`e2e-photo-ownership`) | 42 / 42 PASS |
| Complaint lifecycle (`e2e-civic-flow`) | 23 / 23 PASS |
| AI / innovation (`e2e-innovation`) | 25 / 25 PASS |
| City onboarding (`e2e-city-onboarding`) | 21 / 21 PASS |
| GPS routing (`e2e-gps-routing-applications`) | 34 PASS / 0 FAIL / 4 SKIP (root-only steps, need an isolated copy) |

## NOT TESTED this round

- Staff using the WhatsApp simulator after the change (would create a live record; covered by unit test of the staff path only).
- Password reset, Google sign-in, session expiry (auth settings were out of scope; not exercised).
- Real Twilio/Meta webhook delivery (no credentials).
- Real SMS/WhatsApp sending (forbidden).
- Generic error message path at runtime (requires forcing a server fault; code-reviewed only).
