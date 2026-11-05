/**
 * Department Accountability Score — mirrors public.department_scores() in the database.
 * 50% genuine resolution rate (resolved WITH after-photo proof)
 * 30% on-time share of those proof-backed resolutions
 * 20% (1 - share of complaints currently overdue)
 * Fewer than MIN_SAMPLE complaints => null ("Not enough data").
 */
export const MIN_SAMPLE = 5;

export function accountabilityScore(i: { total: number; resolvedWithProof: number; resolvedOnTime: number; openOverdue: number }): number | null {
  if (i.total < MIN_SAMPLE) return null;
  const genuine = i.resolvedWithProof / i.total;
  const onTime = i.resolvedWithProof === 0 ? 0 : i.resolvedOnTime / i.resolvedWithProof;
  const notOverdue = 1 - i.openOverdue / i.total;
  return Math.round(100 * (0.5 * genuine + 0.3 * onTime + 0.2 * notOverdue));
}

export const ESCALATION_LABEL: Record<number, string> = {
  1: "Escalated L1 · Officers",
  2: "Escalated L2 · City Admin",
  3: "Escalated L3 · Super Admin",
};
