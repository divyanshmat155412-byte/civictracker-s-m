import { useState } from "react";
import { UserPlus, Check, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useIsRootAdmin } from "@/hooks/useIsRootAdmin";
import { useCities } from "@/hooks/useCities";

/** Private approval inbox — visible and usable only by the Platform Super Admin (enforced in the database). */
const AdminRequestsManager = () => {
  const { cities: CITIES } = useCities();
  const queryClient = useQueryClient();
  const { isMainAdmin } = useIsRootAdmin();
  const [cityFor, setCityFor] = useState<Record<string, string>>({});

  const { data: requests = [] } = useQuery({
    queryKey: ["admin-requests-all"],
    enabled: isMainAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("admin_requests").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const decide = useMutation({
    mutationFn: async ({ id, approve, city }: { id: string; approve: boolean; city?: string }) => {
      const { error } = await supabase.rpc("root_decide_admin_request" as any, {
        _request_id: id, _approve: approve, _city: city || null,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.approve ? "Approved — City Admin access granted" : "Application rejected");
      queryClient.invalidateQueries({ queryKey: ["admin-requests-all"] });
      queryClient.invalidateQueries({ queryKey: ["role-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["root-overview"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  if (!isMainAdmin) return null;
  const pending = requests.filter((r: any) => r.status === "pending");
  const past = requests.filter((r: any) => r.status !== "pending");

  return (
    <div className="mt-10">
      <div className="flex items-center gap-2 mb-4">
        <UserPlus className="w-5 h-5 text-secondary" />
        <h2 className="font-display text-xl font-bold text-foreground">City Admin Applications</h2>
        {pending.length > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-xs font-semibold">{pending.length} pending</span>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-3">Normal workflow: people apply from their own verified account; you assign the city when approving. The applicant is notified either way.</p>
      {requests.length === 0 && <p className="text-muted-foreground text-sm py-6 text-center">No applications yet.</p>}

      <div className="space-y-3 mb-6">
        {pending.map((r: any) => {
          const city = cityFor[r.id] ?? r.requested_city ?? "";
          return (
            <div key={r.id} className="bg-card rounded-xl border border-border p-4 shadow-card">
              <p className="font-semibold text-foreground">{r.full_name || "No name"}</p>
              <p className="text-xs text-muted-foreground">{r.email}</p>
              {r.reason && <p className="text-sm text-muted-foreground mt-1 italic">"{r.reason}"</p>}
              <p className="text-xs text-muted-foreground mt-1">
                Requested city: <b>{r.requested_city || "—"}</b> · {new Date(r.created_at).toLocaleDateString()}
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <select value={city} onChange={(e) => setCityFor((s) => ({ ...s, [r.id]: e.target.value }))}
                  className="rounded-lg border border-input bg-card px-3 py-2 text-sm">
                  <option value="">Assign city…</option>
                  {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <button disabled={decide.isPending || !city} onClick={() => decide.mutate({ id: r.id, approve: true, city })}
                  className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-1 disabled:opacity-50">
                  <Check className="w-4 h-4" /> Approve
                </button>
                <button disabled={decide.isPending} onClick={() => decide.mutate({ id: r.id, approve: false })}
                  className="px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-sm font-semibold flex items-center gap-1">
                  <X className="w-4 h-4" /> Reject
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {past.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Application history</h3>
          {past.map((r: any) => (
            <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 text-sm gap-2">
              <span className="font-medium text-foreground">{r.full_name || "Citizen"} · {r.requested_city || "—"}</span>
              <span className="text-xs text-muted-foreground">
                <b className={r.status === "approved" ? "text-primary" : "text-destructive"}>{r.status}</b>
                {r.reviewed_at && ` · ${new Date(r.reviewed_at).toLocaleDateString()}`}
              </span>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">To suspend or remove an approved City Admin, use Manage Users & Roles.</p>
        </div>
      )}
    </div>
  );
};

export default AdminRequestsManager;
