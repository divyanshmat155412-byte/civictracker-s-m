/**
 * Department Accountability Score — mirrors public.department_scores() in the database.
 * 50% genuine resolution rate (resolved WITH after-photo proof)
 * 30% on-time share of those proof-backed resolutions
 * 20% (1 - share of complaints currently overdue)
 * Fewer than MIN_SAMPLE complaints => null ("Not enough data").
 */
export const MIN_SAMPLE = 5;

export function accountabilityScore(i: {
  total: number;
  resolvedWithProof: number;
  resolvedOnTime: number;
  openOverdue: number;
}): number | null {
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

export type ScoreGrade = { key: "good" | "fair" | "poor" | "na"; label: string; tone: string };

/** Plain-language grade shown next to a score on the public scorecard. */
export function scoreGrade(score: number | null | undefined): ScoreGrade {
  if (score === null || score === undefined || Number.isNaN(score))
    return { key: "na", label: "Not enough data", tone: "text-muted-foreground" };
  if (score >= 75) return { key: "good", label: "On track", tone: "text-success" };
  if (score >= 50) return { key: "fair", label: "Needs improvement", tone: "text-warning" };
  return { key: "poor", label: "Falling behind", tone: "text-destructive" };
}

export type ScorableComplaint = {
  status: string | null;
  after_photo_url: string | null;
  due_at: string | null;
  resolved_at: string | null;
  created_at: string | null;
  merged_into?: string | null;
};

export type AccountabilityTotals = {
  total: number;
  resolvedWithProof: number;
  resolvedOnTime: number;
  openOverdue: number;
  avgResolutionHours: number | null;
  score: number | null;
};

/**
 * City-level totals using the same rules as public.department_scores():
 * merged duplicates excluded, "fixed" only counts resolutions with an after-photo,
 * on time = resolved on or before the deadline (or no deadline), overdue = open past the deadline.
 */
export function summarizeAccountability(
  rows: ScorableComplaint[],
  now: Date = new Date(),
): AccountabilityTotals {
  const live = rows.filter((r) => !r.merged_into);
  let resolvedWithProof = 0,
    resolvedOnTime = 0,
    openOverdue = 0,
    hours = 0,
    resolvedCount = 0;
  for (const r of live) {
    const resolved = r.status === "resolved";
    if (resolved && r.after_photo_url && r.after_photo_url.trim() !== "") {
      resolvedWithProof++;
      if (!r.due_at || (r.resolved_at && new Date(r.resolved_at) <= new Date(r.due_at)))
        resolvedOnTime++;
    }
    if (!resolved && r.due_at && new Date(r.due_at) < now) openOverdue++;
    if (resolved && r.resolved_at && r.created_at) {
      hours += (new Date(r.resolved_at).getTime() - new Date(r.created_at).getTime()) / 3_600_000;
      resolvedCount++;
    }
  }
  const total = live.length;
  return {
    total,
    resolvedWithProof,
    resolvedOnTime,
    openOverdue,
    avgResolutionHours: resolvedCount ? Math.round((hours / resolvedCount) * 10) / 10 : null,
    score: accountabilityScore({ total, resolvedWithProof, resolvedOnTime, openOverdue }),
  };
}

/** Human-friendly "overdue by" text, e.g. "3 h" or "2 days". */
export function overdueBy(
  dueAt: string,
  now: Date = new Date(),
): { value: number; unit: "hours" | "days" } {
  const h = Math.max(0, (now.getTime() - new Date(dueAt).getTime()) / 3_600_000);
  return h < 48
    ? { value: Math.max(1, Math.round(h)), unit: "hours" }
    : { value: Math.round(h / 24), unit: "days" };
}
