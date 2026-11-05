import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCities } from "@/hooks/useCities";
import { MIN_SAMPLE } from "@/lib/accountability";

type Row = {
  department_id: string; department_name: string; city: string | null; total: number;
  resolved_with_proof: number; resolved_on_time: number; open_overdue: number;
  avg_resolution_hours: number | null; score: number | null;
};

const tone = (s: number) => (s >= 75 ? "text-success" : s >= 50 ? "text-warning" : "text-destructive");

export default function AccountabilityScores() {
  const { cities } = useCities();
  const [city, setCity] = useState<string>("");
  const [showHow, setShowHow] = useState(false);
  const { data = [], isLoading } = useQuery({
    queryKey: ["dept-scores", city],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("department_scores" as never, { _city: city || null } as never);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  return (
    <section className="mb-8 rounded-2xl border border-border bg-card p-4 md:p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <h2 className="font-display text-lg font-bold text-foreground">Public Accountability Score</h2>
        </div>
        <div className="flex items-center gap-2">
          <select value={city} onChange={(e) => setCity(e.target.value)}
            className="text-xs rounded-lg border border-input bg-background px-2 py-1.5" aria-label="City">
            <option value="">All cities</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button type="button" onClick={() => setShowHow((v) => !v)}
            className="text-xs inline-flex items-center gap-1 text-muted-foreground hover:text-primary">
            <Info className="w-3.5 h-3.5" /> How it's calculated
          </button>
        </div>
      </div>
      {showHow && (
        <p className="text-xs text-muted-foreground mb-3 rounded-lg bg-muted p-3">
          Score out of 100 = 50% genuine resolutions (only complaints closed <b>with an after-repair photo</b>) + 30% of those closed
          before the deadline + 20% for having few overdue open complaints. Merged duplicates are excluded. Departments with fewer
          than {MIN_SAMPLE} complaints show "Not enough data" so small samples don't look unfair.
        </p>
      )}
      {isLoading ? <p className="text-sm text-muted-foreground">Loading scores…</p> : (
        <div className="grid gap-2 sm:grid-cols-2">
          {data.filter((r) => r.total > 0).map((r) => (
            <div key={r.department_id} className="rounded-xl border border-border p-3 flex items-center gap-3">
              <div className="w-14 text-center shrink-0">
                {r.score === null
                  ? <span className="text-[10px] leading-tight text-muted-foreground">Not enough data</span>
                  : <span className={`font-display text-2xl font-bold ${tone(Number(r.score))}`}>{Number(r.score)}</span>}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{r.department_name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {r.total} total · {r.resolved_with_proof} fixed with proof · {r.open_overdue} overdue
                  {r.avg_resolution_hours !== null && <> · avg {Number(r.avg_resolution_hours)}h</>}
                </p>
              </div>
            </div>
          ))}
          {data.filter((r) => r.total > 0).length === 0 && (
            <p className="text-sm text-muted-foreground">No complaints routed to departments yet{city ? ` in ${city}` : ""}.</p>
          )}
        </div>
      )}
    </section>
  );
}
