# Resolve the two public-read findings

## Verified findings
Both findings use scanner `lov_pgscan`, category `RLS_EXPOSURE`, persisted severity `error` (Critical). The scanner flags unrestricted `USING (true)` SELECT policies, not a verified exposure of every column.

| Finding ID | Table and policy | Actual exposure |
|---|---|---|
| `lov_db_rls_tautology_permissive_v1_1b01eef6c2947e95` | `public.user_achievements`; `User achievements are publicly viewable`; SELECT to PUBLIC, `USING (true)` | Signed-out request returned 220 rows with `id,user_id,achievement_id,unlocked_at`. These include 137 distinct account identifiers. 219 rows reference accounts no longer present; no history will be deleted. No email/phone columns exist here, but identifiers and badge timestamps are unnecessarily public. |
| `lov_db_rls_tautology_permissive_v1_dc8df5f3e1cd84b8` | `public.workers`; `Workers publicly viewable`; SELECT to PUBLIC, `USING (true)` | Signed-out request returned one worker's `id,name,department_id,is_active,created_at`. Requests for `phone,user_id,city` each failed with 401 / `42501`: these private columns are already protected. Authenticated grants include `user_id,city`, so the unrestricted policy also unnecessarily exposes those across signed-in accounts. |

## Smallest effective changes
- Achievements: retain all history and the awarding trigger; restrict raw achievement rows to their authenticated owner. The public achievement catalog and leaderboard badge levels remain unchanged. The existing Profile query already uses the signed-in owner's ID; no application rewrite is needed.
- Workers: keep existing public-safe column grants, but show only active workers to anonymous visitors. Signed-in raw worker reads become limited to the linked worker or authorized city staff. Existing admin management policy remains unchanged. Public complaint assignment tracking uses its existing narrow SECURITY DEFINER RPC and does not require raw worker access.
- Do not alter notifications, assignments, reward history, account linking, unrelated policies, or any stored records.

## Exact proposed migration (not applied)
```sql
DROP POLICY "User achievements are publicly viewable"
  ON public.user_achievements;
REVOKE SELECT ON public.user_achievements FROM PUBLIC, anon;
GRANT SELECT ON public.user_achievements TO authenticated;
CREATE POLICY "Users read own achievement history"
  ON public.user_achievements FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY "Workers publicly viewable" ON public.workers;
CREATE POLICY "Anonymous visitors read active public worker fields"
  ON public.workers FOR SELECT TO anon
  USING (is_active = true);
CREATE POLICY "Workers and authorized city staff read worker records"
  ON public.workers FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.admin_can_manage_city((SELECT auth.uid()), city)
  );
```
Existing column-level worker grants remain intact: anonymous visitors still cannot select phone, account ID or city. Existing city-admin worker management policy remains intact; no SECURITY DEFINER function is added or widened. Service-role privileges and achievement-trigger execution are unchanged.

## Immediate shared Live database impact
Applying this migration immediately changes Preview and Live reads, without publishing. Public raw achievement history will no longer be readable; the authenticated owner's Profile history and public leaderboard remain available. Inactive workers disappear from anonymous raw lists, and unrelated signed-in accounts lose raw worker access. Public tracking continues through `public_complaint_assignment`; older published raw assignment tracking was already incompatible with previous approved restrictions and is not repaired by this migration. No records, root roles, photos or reward balances are rewritten. No deployment or deliberate GitHub push will be performed; Lovable's existing automatic Git synchronization may still propagate approved file changes.

## Verification after approval
1. Capture fresh integrity digests/counts; use exclusive-lock safety for every integration script and temporary accounts only, never the root.
2. Assert signed-out achievement denial, owner-only achievement reads, cross-account denial, private worker-column denial, active-only public workers, owner/city-admin access and cross-city denial.
3. Test existing leaderboard, public tracking, admin assignment joins, worker job reads, badges, notifications and reward awarding; run security, scan-fix, photo/ownership, lifecycle, innovation, onboarding and GPS regressions sequentially, plus units. Keep PASS/FAIL/SKIP separate.
4. Recheck all existing records and photo metadata, run the security recheck, and mark only these exact findings fixed after verified results. Provide rollback SQL without executing it.

## Completed read-only checks
- Units: **44 PASS / 0 FAIL / 0 SKIP** (some existing React act warnings).
- Public access probes: **5/5 produced the expected diagnostic responses**; these prove the current exposure, not a fix.
- Before/after digests identical for CT-14, CT-142, CT-29, root configuration/account/roles, all current users/profiles and photo metadata.
- Current baseline: **7 users, 7 profiles, 3 complaints, 2 photos, 1 worker, 220 achievement rows**. Account counts increased since the previous task; this task did not create accounts.
- Write-dependent regression suites and post-fix security checks: **NOT RUN, pending approval**, not counted as passes or skips.

## Remaining risks and boundaries
Public worker display names and internal worker/department row IDs remain intentionally public for existing dependencies; they are not Auth account IDs. Public assignment GPS remains governed by the previously approved tracking RPC. Photo metadata was checked, not a new byte-for-byte photo download. The two findings remain active and are not yet fixed. No migration, security dismissal, publication, Git push or stored-data change has occurred during this review.
