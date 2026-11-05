# Civic Tracker — Root Super Admin & Security Report (prototype round)
Automated test: `bun ./scripts/e2e-security.ts` (45 checks, temporary accounts, real database). Regression: `bun ./scripts/e2e-civic-flow.ts` (21 checks).
Results 2026-11-05: 45/45 PASS security, 21/21 PASS regression. Super Admin dashboard UI: NOT TESTED in a browser as the real account.
Roles: Platform Super Admin (one, by internal ID) > City Admin (admin + city) > Officer (moderator + city) > Field Worker > Citizen.
See scripts/e2e-security.ts for test IDs A–L.
