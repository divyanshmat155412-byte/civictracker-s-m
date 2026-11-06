# Final authorized security remediation — 6 November 2026

## Verdict
Approved D1–D4 and three public-table remediations implemented and tested. **Not published. GitHub synchronization is unverified/blocked on the managed Git connection.** No Git commit/push command was run; Lovable manages commits automatically. No second repository created.

## Exact fixes
- D1: only nonempty bounded user messages accepted; assistant/system messages removed server-side and excluded by UI. Assistant responses remain visible locally. Two-turn real chatbot verified; previous assistant wording is not replayed to the model, so follow-ups that rely only on an assistant's exact words may lose context.
- D2: verified-account worker opt-in request, same-city caller authorization and request matching; root target forbidden; existing linked worker cannot be reassigned. Direct worker user_id writes revoked; linked-worker city changes rejected. Existing workers SELECT policies retained.
- D3: 10 points per qualifying complaint, **50 complaint-earned points per user per UTC calendar day**. Normalized identical text hashes lifetime-deduplicated; same-user same-category GPS reports within 300m/7d do not earn another reward. Filing remains allowed after cap. Private immutable-to-clients event ledger, per-user transactional advisory lock; redemption never resets allowance.
- D4: non-self upvotes earn recipient 2 points, **20 upvote-earned points per recipient per UTC day**. Lifetime complaint/voter dedup prevents delete/revote rewards; concurrent requests serialized. Polls never awarded points and their vote/result functionality is preserved. Caps mitigate farming but do not establish unique-human identity or prevent multi-account Sybil abuse.
- Profiles: anonymous private-column grants revoked; authenticated profile reads owner-only; bounded public leaderboard RPC exposes only id/full_name/avatar_url/badge/points/complaint count. Phone/SMS remain private. Public profile ID is not an Auth user ID.
- Worker assignments: anonymous raw reads revoked; City Admin/assigned-worker reads retained. Complaint-specific public RPC exposes status/display name/GPS only, not assignment/worker IDs. Public tracking refreshes every five seconds; no worker-location policy changed.
- Notifications: only null-complaint announcement/broadcast types public; complaint-specific alerts owner/city staff only via fixed-search-path helper. Session cache cleared/gated by audience; stale realtime callbacks rejected; read markers account-scoped. user_notifications ownership untouched.
- Achievements and workers public-read behavior/policies not changed or dismissed. The two scanner alerts remain active as requested.

## Applied migrations (shared Preview/Live database)
1. `0022_deep_security_rewards_and_public_access.sql`: requests, private reward ledger, triggers/functions/grants, public projections and scoped policies.
2. `0023_explicit_private_security_table_grants.sql`: explicitly revoke platform-default client ledger/request write grants.
3. `0024_private_notification_authorization_helper.sql`: narrow authorization helper avoids revoked complaint-owner column SELECT failure.
4. `0025_worker_link_city_consistency.sql`: prevents linked-worker city mutation bypass.

All four applied immediately to the **shared Live database**; generated types refreshed automatically. New tables have RLS, explicit service privileges, and no Auth foreign keys for stored user IDs. New security-definer functions have fixed search_path and explicit execution grants. Existing data was not backfilled or rewritten. Original 22 migration files remain; total now **26**.

The first 0022 attempt failed on an ambiguous uuid/text policy reference and was fully rolled back by the tool; corrected migration applied. Notification regression initially 36 pass/3 fail exposed missing private-column SELECT authorization; 0024 fixed it and final rerun passed. No failed attempt is counted as a passing run.

## Sequential test results
| Suite | PASS | FAIL | SKIP |
|---|---:|---:|---:|
| Final unit tests | 44 | 0 | 0 |
| D1–D4 + public access | 40 | 0 | 0 |
| Security | 40 | 0 | 5 |
| Scan-fix | 31 | 0 | 0 |
| Photo / ownership / anonymity | 42 | 0 | 0 |
| Complaint lifecycle | 23 | 0 | 0 |
| AI / innovation | 25 | 0 | 0 |
| City onboarding | 21 | 0 | 0 |
| GPS routing/applications | 34 | 0 | 4 |
| AI rolling limit + WhatsApp | 52 | 0 | 0 |

**Skipped separately:** Security D5/E1/E2/E3/E4 target real root/config mutations and were deliberately removed from shared-Live testing. GPS four root-only approval/list/notification cases require isolation. No skips counted as passes; no overall combined score.

Real browser: temporary sign-in, worker opt-in request submitted and read back as success, real two-turn chatbot with exclusively user-role payload, desktop and 390px leaderboard. Zero browser runtime errors. Latest observed automatic application build: OK. Existing regressions use placeholder proof URLs in some completion tests, not a new real camera repair workflow. Mic/camera/provider messaging and published enforcement not retested. Some React test act warnings accompany passing notification cache tests.

Test safety: exclusive lock plus complete root-account/role digest and all pre-existing complaint/profile digests. Security scripts no longer attempt any real-root mutations; audit mutation probes target temporary actors' rows only. Innovation escalation uses a safe historical clock predating every protected deadline. Newly created no-FK ledger rows cleaned by exact IDs, not global cleanup. Audit rows generated by tests are retained (tamper-proof); complaint ID sequence advances, neither is existing user content modification.

## Integrity evidence
Before and after: **users 5 → 5; profiles 5 → 5; photos 2 → 2; complaints 3 → 3**.
- Root ID unchanged; complete root roles and root account digest unchanged. Root was never used to sign in or test.
- **CT-14, CT-142, CT-29**: complete row digests unchanged, including status, owner, timestamps and proof links.
- Every existing user and profile unchanged according to saved baseline comparison; protected complaint rows and photo metadata unchanged.
No existing photos edited/deleted. Temporary IDs only cleaned after verification.

## GitHub and credential verification
Read-only checkout inspection found only Lovable-internal remotes, no GitHub URL. GitHub connection/status is managed by Lovable settings and not observable from this sandbox. `git ls-remote origin HEAD` returned `2169f08941da8cee60ee4d75222bf0de11c00842` — this is an internal remote, **not evidence of GitHub push**. Local commit evolves automatically; final report includes last observed local hash. No stateful git commands were used.

Read-only secret review scanned 445 tracked paths at that checkpoint, 207 reachable commits, 1,811 reachable objects / 913 historical blobs: **zero confirmed actual secrets** by pattern scan. Public .env configuration is not a private credential; .env remains previously tracked despite ignore rules, and cannot be untracked through agent Git commands. .env.example placeholders retained. .gitignore contains .env, .env.local and .env.*.local; the attempted broader .env.* rule was refused because the file is platform-read-only, so no change was applied. Remote/pruned/unavailable history was not inspected; pattern scans cannot prove absence of all secret formats.

Last observed local commit before documentation finalization: `2ef4b8ecc5f558581965533b72baf52bda5e265c` (450 tracked files at that checkpoint). This is not the final GitHub commit; automatic documentation commits can advance it.

**Required next step:** open **Project settings → Git**, inspect the connected repository link and status; if disconnected, connect GitHub there (creates a repository only if no existing connection). If connected, use its status/re-check and inspect the repository latest commit against the reported local commit. Repository URL and latest GitHub commit remain **unverified**. Do not publish to resolve this.

## Rollback and limitations
Full emergency rollback SQL: `docs/D1_D4_PUBLIC_ACCESS_ROLLBACK.sql`. It restores prior weaker policies/functions without deleting existing records or new ledger history; run only after explicit authorization. Restore corresponding presentation through Lovable version history. No rollback applied.

**Live compatibility:** because shared database restrictions are immediate while Live code remains old, the old Live leaderboard projection includes now-revoked columns and public raw assignment tracking can stop displaying data until the compatible code is explicitly published. Public complaint rows/timeline/proof and intended broadcasts remain readable. This trade-off follows the authorized immediate privacy fixes and no-publish restriction; we cannot claim uninterrupted old-Live leaderboard/tracking compatibility. Private notifications are intentionally no longer global.

Linter: 68 generic notices (4 private RLS-with-no-policy, 17 publicly callable and 47 signed-in security-definer notices). Private ledgers intentionally have no client policies; safe public projection RPCs intentionally callable. Not a security certification and unrelated functions/findings untouched. Upvote badge recalculation remains pre-existing behavior and was not expanded outside the approved scope.
