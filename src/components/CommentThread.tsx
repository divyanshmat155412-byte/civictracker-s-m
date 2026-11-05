import { useState, useEffect } from "react";
import { MessageCircle, Send, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

interface Comment {
  id: string;
  user_name: string;
  content: string;
  created_at: string;
  user_id: string;
}

const CommentThread = ({ complaintId }: { complaintId: string }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { t } = useLanguage();

  const fetchComments = async () => {
    const { data } = await supabase
      .from("complaint_comments")
      .select("*")
      .eq("complaint_id", complaintId)
      .order("created_at", { ascending: true });
    if (data) setComments(data);
  };

  useEffect(() => {
    if (!open) return;
    fetchComments();
    const channel = supabase
      .channel(`comments-${complaintId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "complaint_comments", filter: `complaint_id=eq.${complaintId}` }, () => fetchComments())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [open, complaintId]);

  const handleSubmit = async () => {
    if (!newComment.trim() || !user) return;
    setLoading(true);
    await supabase.from("complaint_comments").insert({
      complaint_id: complaintId,
      user_id: user.id,
      user_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
      content: newComment.trim(),
    });
    setNewComment("");
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("complaint_comments").delete().eq("id", id);
    setComments((prev) => prev.filter((c) => c.id !== id));
  };

  const timeAgo = (d: string) => {
    const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
    return `${Math.floor(mins / 1440)}d ago`;
  };

  return (
    <div className="mt-3">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
        <MessageCircle className="w-3.5 h-3.5" />
        <span>{comments.length > 0 ? `${comments.length} comments` : "Comment"}</span>
      </button>

      {open && (
        <div className="mt-2 rounded-lg border border-border bg-muted/30 p-3 space-y-2">
          {comments.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">No comments yet. Be the first!</p>
          )}
          <div className="max-h-48 overflow-y-auto space-y-2">
            {comments.map((c) => (
              <div key={c.id} className="flex items-start gap-2 text-xs">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px] shrink-0">
                  {c.user_name[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{c.user_name}</span>
                    <span className="text-muted-foreground">{timeAgo(c.created_at)}</span>
                  </div>
                  <p className="text-foreground/80 break-words">{c.content}</p>
                </div>
                {user?.id === c.user_id && (
                  <button onClick={() => handleDelete(c.id)} className="text-muted-foreground hover:text-destructive shrink-0">
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {user ? (
            <div className="flex gap-2 pt-1">
              <input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="Write a comment..."
                maxLength={500}
                className="flex-1 text-xs px-3 py-1.5 rounded-md border border-input bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button onClick={handleSubmit} disabled={loading || !newComment.trim()} className="p-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center">Login to comment</p>
          )}
        </div>
      )}
    </div>
  );
};

export default CommentThread;
