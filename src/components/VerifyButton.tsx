import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface VerifyButtonProps {
  complaintId: string;
  verificationCount: number;
}

const VerifyButton = ({ complaintId, verificationCount }: VerifyButtonProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: liveVerificationCount = verificationCount } = useQuery({
    queryKey: ["complaint-verification-count", complaintId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("complaints")
        .select("verification_count")
        .eq("id", complaintId)
        .maybeSingle();

      if (error) throw error;
      return data?.verification_count ?? verificationCount;
    },
    initialData: verificationCount,
  });

  const { data: hasVerified } = useQuery({
    queryKey: ["my-verification", complaintId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("complaint_verifications")
        .select("id")
        .eq("complaint_id", complaintId)
        .eq("user_id", user!.id)
        .maybeSingle();
      return !!data;
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async () => {
      if (hasVerified) {
        const { error } = await supabase
          .from("complaint_verifications")
          .delete()
          .eq("complaint_id", complaintId)
          .eq("user_id", user!.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("complaint_verifications").insert({
          complaint_id: complaintId, user_id: user!.id,
        });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-verification", complaintId] });
      queryClient.invalidateQueries({ queryKey: ["complaint-verification-count", complaintId] });
      queryClient.invalidateQueries({ queryKey: ["recent-complaints"] });
      queryClient.invalidateQueries({ queryKey: ["all-complaints"] });
      queryClient.invalidateQueries({ queryKey: ["complaint-detail"] });
      toast.success(hasVerified ? "Verification removed" : "Complaint verified!");
    },
    onError: () => toast.error("Verification update failed"),
  });

  if (!user) return null;

  return (
    <button
      onClick={(e) => { e.stopPropagation(); verifyMutation.mutate(); }}
      disabled={verifyMutation.isPending}
      className={`group/verify relative flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-full border transition-all duration-300 overflow-hidden ${
        hasVerified
          ? "bg-gradient-to-r from-emerald-500/15 to-teal-500/15 text-emerald-600 border-emerald-500/30 shadow-sm shadow-emerald-500/10"
          : "bg-muted/40 text-muted-foreground border-border/60 hover:border-emerald-500/30 hover:text-emerald-600 hover:bg-emerald-500/5"
      } disabled:opacity-60 active:scale-95`}
    >
      <span
        className={`relative flex items-center justify-center w-4 h-4 sm:w-4.5 sm:h-4.5 rounded-full transition-all duration-300 ${
          hasVerified
            ? "bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-500/30"
            : "bg-transparent group-hover/verify:bg-gradient-to-br group-hover/verify:from-emerald-500 group-hover/verify:to-teal-500 group-hover/verify:text-white group-hover/verify:scale-110"
        }`}
      >
        {verifyMutation.isPending ? (
          <Loader2 className="w-2.5 h-2.5 animate-spin" />
        ) : (
          <CheckCircle2 className="w-2.5 h-2.5" />
        )}
      </span>
      <span className="tabular-nums">{liveVerificationCount}</span>
      <span className="hidden sm:inline">Verified</span>
    </button>
  );
};

export default VerifyButton;
