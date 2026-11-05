import { useState } from "react";
import { motion } from "framer-motion";
import { UserPlus, Check, X, Shield, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { isMainAdminEmail } from "@/lib/main-admin";


const AdminRequestsManager = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const isMainAdmin = isMainAdminEmail(user?.email);

  const { data: requests = [] } = useQuery({
    queryKey: ["admin-requests-all"],
    enabled: isMainAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const actionMutation = useMutation({
    mutationFn: async ({ requestId, userId, action }: { requestId: string; userId: string; action: "approved" | "rejected" }) => {
      // Update request status
      const { error: updateError } = await supabase
        .from("admin_requests")
        .update({ status: action, reviewed_by: user!.id, reviewed_at: new Date().toISOString() })
        .eq("id", requestId);
      if (updateError) throw updateError;

      // If approved, add admin role
      if (action === "approved") {
        const { error: roleError } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: "admin" });
        if (roleError) throw roleError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-requests-all"] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async ({ requestId, userId }: { requestId: string; userId: string }) => {
      // Remove admin role
      const { error: roleError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", "admin");
      if (roleError) throw roleError;

      // Delete the request
      const { error: deleteError } = await supabase
        .from("admin_requests")
        .delete()
        .eq("id", requestId);
      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-requests-all"] });
      setConfirmRemoveId(null);
    },
  });

  if (!isMainAdmin) return null;

  // Filter out main admin's own request from the list so other admins can't see/delete it
  const filteredRequests = requests.filter((r: any) => !isMainAdminEmail(r.email));
  const pendingRequests = filteredRequests.filter((r: any) => r.status === "pending");
  const pastRequests = filteredRequests.filter((r: any) => r.status !== "pending");

  return (
    <div className="mt-10">
      <div className="flex items-center gap-2 mb-4">
        <UserPlus className="w-5 h-5 text-secondary" />
        <h2 className="font-display text-xl font-bold text-foreground">Admin Access Requests</h2>
        {pendingRequests.length > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-xs font-semibold">
            {pendingRequests.length} pending
          </span>
        )}
      </div>

      {pendingRequests.length === 0 && pastRequests.length === 0 && (
        <p className="text-muted-foreground text-sm py-6 text-center">No admin requests yet.</p>
      )}

      {/* Pending */}
      {pendingRequests.length > 0 && (
        <div className="space-y-3 mb-6">
          {pendingRequests.map((r: any) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card rounded-xl border border-border p-4 shadow-card"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground">{r.full_name || "No name"}</p>
                  {r.reason && <p className="text-sm text-muted-foreground mt-1 italic">"{r.reason}"</p>}
                  <p className="text-xs text-muted-foreground mt-1">
                    Requested: {new Date(r.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => actionMutation.mutate({ requestId: r.id, userId: r.user_id, action: "approved" })}
                    disabled={actionMutation.isPending}
                    className="p-2 rounded-lg bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors"
                    title="Approve"
                  >
                    <Check className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => actionMutation.mutate({ requestId: r.id, userId: r.user_id, action: "rejected" })}
                    disabled={actionMutation.isPending}
                    className="p-2 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                    title="Reject"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Past requests */}
      {pastRequests.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Past Requests</h3>
          {pastRequests.map((r: any) => (
            <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 text-sm gap-2">
              <div className="flex-1 min-w-0">
                <span className="font-medium text-foreground">{r.full_name || "Citizen"}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  r.status === "approved" ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"
                }`}>
                  {r.status}
                </span>
                {r.status === "approved" && (
                  confirmRemoveId === r.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => removeMutation.mutate({ requestId: r.id, userId: r.user_id })}
                        disabled={removeMutation.isPending}
                        className="px-2 py-1 rounded text-xs font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
                      >
                        {removeMutation.isPending ? "Removing..." : "Confirm"}
                      </button>
                      <button
                        onClick={() => setConfirmRemoveId(null)}
                        className="px-2 py-1 rounded text-xs font-semibold bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmRemoveId(r.id)}
                      className="p-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                      title="Remove admin role"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminRequestsManager;
