import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  Share2,
  Printer,
  Clock,
  Camera,
  AlertTriangle,
  ListChecks,
  Info,
  Building2,
} from "lucide-react";
import Layout from "@/components/Layout";
import { Link, useSearchParams } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { useCities } from "@/hooks/useCities";
import { useUiText } from "@/hooks/useUiText";
import {
  MIN_SAMPLE,
  scoreGrade,
  summarizeAccountability,
  overdueBy,
  type ScorableComplaint,
} from "@/lib/accountability";

type DeptRow = {
  department_id: string;
  department_name: string;
  city: string | null;
  total: number;
  resolved_with_proof: number;
  resolved_on_time: number;
  open_overdue: number;
  avg_resolution_hours: number | null;
  score: number | null;
};

type ComplaintRow = ScorableComplaint & {
  id: string;
  complaint_id: string | null;
  title: string;
  category: string | null;
  city: string | null;
  department_id: string | null;
};

const SCORE_COLS =
  "id,complaint_id,title,category,status,city,department_id,due_at,resolved_at,created_at,after_photo_url,merged_into";

const pct = (n: number, d: number) => (d > 0 ? Math.round((100 * n) / d) : 0);

function ScoreRing({ score, size = 132 }: { score: number | null; size?: number }) {
  const tx = useUiText();
  const g = scoreGrade(score);
  const r = size / 2 - 10;
  const circ = 2 * Math.PI * r;
  const filled = score === null ? 0 : (circ * score) / 100;
  const stroke =
    g.key === "good"
      ? "hsl(var(--success))"
      : g.key === "fair"
        ? "hsl(var(--warning))"
        : g.key === "poor"
          ? "hsl(var(--destructive))"
          : "hsl(var(--muted-foreground))";
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={score === null ? tx("Not enough data") : `${score} / 100`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={10}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circ}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {score === null ? (
          <span className="text-xs text-muted-foreground px-3 leading-tight">
            {tx("Not enough data")}
          </span>
        ) : (
          <>
            <span className={`font-display text-4xl font-bold ${g.tone}`}>{score}</span>
            <span className="text-[11px] text-muted-foreground">/ 100</span>
          </>
        )}
      </div>
    </div>
  );
}

function Bar({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div>
      <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
        <span>{label}</span>
        <span className="font-semibold text-foreground">{value}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden" title={hint}>
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <Icon className="w-4 h-4 text-primary mb-1" />
      <p className="font-display text-xl font-bold text-foreground">{value}</p>
      <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export default function Scorecard() {
  const tx = useUiText();
  const { cities } = useCities();
  const [params, setParams] = useSearchParams();
  const city = params.get("city") ?? "";
  const [copied, setCopied] = useState(false);

  const setCity = (c: string) => setParams(c ? { city: c } : {});

  const { data: depts = [], isLoading: deptLoading } = useQuery({
    queryKey: ["scorecard-depts", city],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "department_scores" as never,
        { _city: city || null } as never,
      );
      if (error) throw error;
      return (data ?? []) as DeptRow[];
    },
  });

  const { data: complaints = [], isLoading: cLoading } = useQuery({
    queryKey: ["scorecard-complaints"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("complaints")
        .select(SCORE_COLS)
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as unknown as ComplaintRow[];
    },
  });

  const deptName = useMemo(() => {
    const m = new Map<string, string>();
    depts.forEach((d) => m.set(d.department_id, d.department_name));
    return m;
  }, [depts]);

  const scoped = useMemo(
    () => complaints.filter((c) => !city || (c.city ?? "").toLowerCase() === city.toLowerCase()),
    [complaints, city],
  );
  const summary = useMemo(() => summarizeAccountability(scoped), [scoped]);
  const grade = scoreGrade(summary.score);

  const now = new Date();
  const overdue = useMemo(
    () =>
      scoped
        .filter(
          (c) => !c.merged_into && c.status !== "resolved" && c.due_at && new Date(c.due_at) < now,
        )
        .sort((a, b) => new Date(a.due_at!).getTime() - new Date(b.due_at!).getTime())
        .slice(0, 10),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scoped],
  );

  const cityRows = useMemo(() => {
    if (city) return [];
    const by = new Map<string, ComplaintRow[]>();
    complaints.forEach((c) => {
      const k = c.city?.trim() || "";
      if (!k) return;
      by.set(k, [...(by.get(k) ?? []), c]);
    });
    return Array.from(by.entries())
      .map(([name, rows]) => ({ name, ...summarizeAccountability(rows) }))
      .filter((r) => r.total > 0)
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || b.total - a.total);
  }, [complaints, city]);

  const rankedDepts = depts.filter((d) => d.total > 0);
  const loading = deptLoading || cLoading;

  const share = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const text = `${tx("City Accountability Scorecard")}${city ? ` · ${tx(city)}` : ""}: ${summary.score ?? "—"}/100`;
    try {
      if (navigator.share) {
        await navigator.share({ title: tx("City Accountability Scorecard"), text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* user cancelled */
    }
  };

  return (
    <Layout>
      <div className="container py-8 md:py-12 max-w-5xl">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-start justify-between gap-3 flex-wrap mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="w-7 h-7 text-primary" />
                <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
                  {tx("City Accountability Scorecard")}
                </h1>
              </div>
              <p className="text-sm text-muted-foreground max-w-2xl">
                {tx(
                  "A public, proof-based report card: how genuinely and how fast each department fixes citizen complaints.",
                )}
              </p>
            </div>
            <div className="flex items-center gap-2 print:hidden">
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                aria-label={tx("City")}
                className="text-sm rounded-lg border border-input bg-background px-3 py-2"
              >
                <option value="">{tx("All cities")}</option>
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {tx(c)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={share}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
              >
                <Share2 className="w-4 h-4" /> {copied ? tx("Link copied") : tx("Share")}
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
              >
                <Printer className="w-4 h-4" /> {tx("Print")}
              </button>
            </div>
          </div>
        </motion.div>

        {loading ? (
          <p className="text-sm text-muted-foreground">{tx("Loading scores…")}</p>
        ) : (
          <>
            {/* Overall */}
            <section className="rounded-2xl border border-border bg-card p-5 mb-6 flex flex-col md:flex-row gap-6 items-center">
              <ScoreRing score={summary.score} />
              <div className="flex-1 w-full">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {city ? tx(city) : tx("All cities")}
                </p>
                <p className={`font-display text-xl font-bold mb-3 ${grade.tone}`}>
                  {tx(grade.label)}
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                  <Stat
                    icon={ListChecks}
                    label={tx("Complaints counted")}
                    value={String(summary.total)}
                    sub={tx("duplicates excluded")}
                  />
                  <Stat
                    icon={Camera}
                    label={tx("Fixed with photo proof")}
                    value={`${pct(summary.resolvedWithProof, summary.total)}%`}
                    sub={`${summary.resolvedWithProof} / ${summary.total}`}
                  />
                  <Stat
                    icon={Clock}
                    label={tx("Fixed before deadline")}
                    value={`${pct(summary.resolvedOnTime, summary.resolvedWithProof)}%`}
                    sub={
                      summary.avgResolutionHours !== null
                        ? `${tx("avg")} ${summary.avgResolutionHours} ${tx("hours")}`
                        : undefined
                    }
                  />
                  <Stat
                    icon={AlertTriangle}
                    label={tx("Overdue right now")}
                    value={String(summary.openOverdue)}
                  />
                </div>
                <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground flex gap-2">
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    {tx(
                      "Score = 50% fixed with an after-repair photo + 30% of those fixed before the deadline + 20% for few overdue open complaints. Fewer than",
                    )}{" "}
                    {MIN_SAMPLE} {tx('complaints shows "Not enough data".')}
                  </span>
                </div>
              </div>
            </section>

            {/* Departments */}
            <section className="mb-6">
              <h2 className="font-display text-lg font-bold text-foreground mb-3 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                {tx("Department ranking")}
              </h2>
              {rankedDepts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {tx("No complaints routed to departments yet")}
                  {city ? ` · ${tx(city)}` : ""}.
                </p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {rankedDepts.map((d, i) => {
                    const g = scoreGrade(d.score === null ? null : Number(d.score));
                    return (
                      <div
                        key={d.department_id}
                        className="rounded-xl border border-border bg-card p-4"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <span className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-foreground shrink-0">
                            {i + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-foreground truncate">
                              {tx(d.department_name)}
                            </p>
                            <p className={`text-xs ${g.tone}`}>{tx(g.label)}</p>
                          </div>
                          <span className={`font-display text-2xl font-bold ${g.tone}`}>
                            {d.score === null ? "—" : Number(d.score)}
                          </span>
                        </div>
                        <div className="space-y-2">
                          <Bar
                            label={tx("Fixed with photo proof")}
                            value={pct(d.resolved_with_proof, d.total)}
                            hint="50%"
                          />
                          <Bar
                            label={tx("Fixed before deadline")}
                            value={pct(d.resolved_on_time, d.resolved_with_proof)}
                            hint="30%"
                          />
                          <Bar
                            label={tx("Not overdue")}
                            value={100 - pct(d.open_overdue, d.total)}
                            hint="20%"
                          />
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-2">
                          {d.total} {tx("complaints")} · {d.open_overdue} {tx("overdue")}
                          {d.avg_resolution_hours !== null && (
                            <>
                              {" "}
                              · {tx("avg")} {Number(d.avg_resolution_hours)} {tx("hours")}
                            </>
                          )}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Cities */}
            {!city && cityRows.length > 1 && (
              <section className="mb-6">
                <h2 className="font-display text-lg font-bold text-foreground mb-3">
                  {tx("City comparison")}
                </h2>
                <div className="rounded-xl border border-border bg-card divide-y divide-border">
                  {cityRows.map((r) => {
                    const g = scoreGrade(r.score);
                    return (
                      <button
                        key={r.name}
                        type="button"
                        onClick={() => setCity(r.name)}
                        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted"
                      >
                        <span className="font-medium text-foreground">{tx(r.name)}</span>
                        <span className="text-xs text-muted-foreground">
                          {r.total} {tx("complaints")} · {r.openOverdue} {tx("overdue")}
                        </span>
                        <span className={`font-display font-bold ${g.tone}`}>{r.score ?? "—"}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Overdue */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                {tx("Overdue right now")}
              </h2>
              {overdue.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {tx("No open complaint is past its deadline.")}
                </p>
              ) : (
                <ul className="rounded-xl border border-border bg-card divide-y divide-border">
                  {overdue.map((c) => {
                    const o = overdueBy(c.due_at!);
                    return (
                      <li key={c.id}>
                        <Link
                          to={`/complaints/${c.complaint_id ?? c.id}`}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-muted"
                        >
                          <span className="text-xs font-mono text-muted-foreground shrink-0">
                            #{c.complaint_id}
                          </span>
                          <span className="flex-1 min-w-0 truncate text-sm text-foreground">
                            {c.title}
                          </span>
                          <span className="hidden sm:inline text-xs text-muted-foreground truncate max-w-[10rem]">
                            {c.department_id ? tx(deptName.get(c.department_id) ?? "") : ""}
                          </span>
                          <span className="text-xs font-semibold text-destructive shrink-0">
                            {o.value} {tx(o.unit)} {tx("late")}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </Layout>
  );
}
