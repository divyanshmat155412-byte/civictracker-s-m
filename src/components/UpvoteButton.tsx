import { useUiText } from "@/hooks/useUiText";
import { ThumbsUp, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNavigate } from "@/lib/router-compat";

interface UpvoteButtonProps {
  complaintId: string;
  upvotes: number;
}

const UpvoteButton = ({ complaintId, upvotes }: UpvoteButtonProps) => {
  const tx = useUiText();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: hasUpvoted } = useQuery({
    queryKey: ["my-upvote", complaintId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("complaint_upvotes")
        .select("id")
        .eq("complaint_id", complaintId)
        .eq("user_id", user!.id)
        .maybeSingle();
      return !!data;
    },
  });

  const upvoteMutation = useMutation({
    mutationFn: async () => {
      if (hasUpvoted) {
        await supabase.from("complaint_upvotes").delete()
          .eq("complaint_id", complaintId).eq("user_id", user!.id);
        await supabase.from("complaints").update({ upvotes: Math.max(0, upvotes - 1) }).eq("id", complaintId);
      } else {
        await supabase.from("complaint_upvotes").insert({
          complaint_id: complaintId, user_id: user!.id,
        });
        await supabase.from("complaints").update({ upvotes: upvotes + 1 }).eq("id", complaintId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-upvote", complaintId] });
      queryClient.invalidateQueries({ queryKey: ["recent-complaints"] });
      queryClient.invalidateQueries({ queryKey: ["all-complaints"] });
      toast.success(hasUpvoted ? "Like removed" : "Liked!");
    },
    onError: () => toast.error(tx("Action failed")),
  });

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!user) {
      toast.error(tx("Please sign in to like"));
      navigate("/auth");
      return;
    }
    upvoteMutation.mutate();
  };

  return (
    <button
      onClick={handleClick}
      disabled={upvoteMutation.isPending}
      className={`group/like relative flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-full border transition-all duration-300 overflow-hidden ${
        hasUpvoted
          ? "bg-gradient-to-r from-pink-500/15 to-rose-500/15 text-pink-600 border-pink-500/30 shadow-sm shadow-pink-500/10"
          : "bg-muted/40 text-muted-foreground border-border/60 hover:border-pink-500/30 hover:text-pink-600 hover:bg-pink-500/5"
      } disabled:opacity-60 active:scale-95`}
    >
      <span
        className={`relative flex items-center justify-center w-4 h-4 sm:w-4.5 sm:h-4.5 rounded-full transition-all duration-300 ${
          hasUpvoted
            ? "bg-gradient-to-br from-pink-500 to-rose-500 text-white shadow-md shadow-pink-500/30"
            : "bg-transparent group-hover/like:bg-gradient-to-br group-hover/like:from-pink-500 group-hover/like:to-rose-500 group-hover/like:text-white group-hover/like:scale-110"
        }`}
      >
        {upvoteMutation.isPending ? (
          <Loader2 className="w-2.5 h-2.5 animate-spin" />
        ) : (
          <ThumbsUp className={`w-2.5 h-2.5 ${hasUpvoted ? "fill-current" : ""}`} />
        )}
      </span>
      <span className="tabular-nums">{upvotes}</span>
      <span className="hidden sm:inline">{tx("Like")}{upvotes !== 1 ? "s" : ""}</span>
    </button>
  );
};

export default UpvoteButton;
