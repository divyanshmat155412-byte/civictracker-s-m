import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@/lib/router-compat";
import { GitMerge, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAdminCities } from "@/hooks/useAdminCities";

type C = { id: string; complaint_id: string; city: string; merged_into?: string | null };
type Sim = { id: string; complaint_id: string; title: string; status: string; distance_m: number; similarity: number; merged_into: string | null };

/** Admin-only: similar reports (same city + category, ≤300 m, ±7 days, ranked by text similarity) with reversible merge. */
export default function DuplicateMergePanel({ complaint }: { complaint: C }) {
  const qc = useQueryClient();
  const { cities, isAdmin } = useAdminCities();
  const canManage = isAdmin && (cities === null || cities.some((c) => c.toLowerCase() === complaint.city?.toLowerCase()));

  const { data: similar = [] } = useQuery({
    queryKey: ["similar", complaint.id],
    enabled: canManage,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("find_similar_complaints" as never, { _complaint_id: complaint.id } as never);
      if (error) throw error;
      return (data ?? []) as Sim[];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["complaint-detail"] });
    qc.invalidateQueries({ queryKey: ["similar"] });
  };
  const merge = async (primary: Sim) => {
    if (!confirm(`Link this complaint as a duplicate of #${primary.complaint_id}? The reporter is notified; you can undo it.`)) return;
    const { error } = await supabase.rpc("admin_merge_complaint" as never, { _duplicate: complaint.id, _primary: primary.id } as never);
    if (error) return toast.error(error.message);
    toast.success(`Merged into #${primary.complaint_id}`); refresh();
  };
  const unmerge = async () => {
    const { error } = await supabase.rpc("admin_unmerge_complaint" as never, { _duplicate: complaint.id } as never);
    if (error) return toast.error(error.message);
    toast.success("Unmerged"); refresh();
  };

  if (!canManage) return null;
  return (
    <div className="mt-6 rounded-xl border border-border p-4">
      <h3 className="font-semibold text-sm text-foreground flex items-center gap-2 mb-2"><GitMerge className="w-4 h-4" /> Possible duplicates</h3>
      {complaint.merged_into ? (
        <button onClick={unmerge} className="text-xs inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80">
          <Undo2 className="w-3.5 h-3.5" /> Undo merge
        </button>
      ) : similar.length === 0 ? (
        <p className="text-xs text-muted-foreground">No similar reports within 300 m and 7 days.</p>
      ) : (
        <ul className="space-y-2">
          {similar.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 text-xs">
              <Link to={`/complaints/${s.complaint_id}`} className="min-w-0 truncate hover:text-primary">
                #{s.complaint_id} · {s.title}
              </Link>
              <span className="shrink-0 text-muted-foreground">{Math.round(s.distance_m)} m · {Math.round(s.similarity * 100)}% text match</span>
              {!s.merged_into && (
                <button onClick={() => merge(s)} className="shrink-0 px-2 py-1 rounded-md bg-primary text-primary-foreground">Merge into</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
