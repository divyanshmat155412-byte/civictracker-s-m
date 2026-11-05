import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Vote, Clock, CheckCircle2, BarChart3, Plus, Trash2 } from "lucide-react";
import Layout from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { Link } from "@/lib/router-compat";

const Polls = () => {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const queryClient = useQueryClient();

  useEffect(() => {
    const ch = supabase
      .channel("polls-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "poll_votes" }, () => {
        queryClient.invalidateQueries({ queryKey: ["polls-data"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [queryClient]);

  const { data, isLoading } = useQuery({
    queryKey: ["polls-data", user?.id],
    queryFn: async () => {
      const { data: polls } = await supabase.from("polls").select("*").order("created_at", { ascending: false });
      const { data: options } = await supabase.from("poll_options").select("*").order("display_order");

      // Aggregate vote counts via secure function (no per-user vote disclosure)
      const counts: Record<string, number> = {};
      if (polls) {
        for (const p of polls) {
          const { data: rows } = await supabase.rpc("get_poll_results", { _poll_id: p.id });
          (rows || []).forEach((r: any) => { counts[r.option_id] = Number(r.vote_count) || 0; });
        }
      }

      // Current user's own votes only
      let myVotes: any[] = [];
      if (user) {
        const { data: mv } = await supabase.from("poll_votes").select("poll_id, option_id").eq("user_id", user.id);
        myVotes = mv || [];
      }
      return { polls: polls || [], options: options || [], counts, myVotes };
    },
  });

  const handleVote = async (pollId: string, optionId: string) => {
    if (!user) {
      toast.error("Sign in to vote");
      return;
    }
    const { error } = await supabase.from("poll_votes").insert({
      poll_id: pollId, option_id: optionId, user_id: user.id,
    });
    if (error) {
      if (error.code === "23505") toast.error("You already voted on this poll");
      else toast.error(error.message);
    } else {
      toast.success("Vote recorded! 🗳️");
      queryClient.invalidateQueries({ queryKey: ["polls-data", user.id] });
    }
  };

  const handleDelete = async (pollId: string) => {
    if (!confirm("Delete this poll and all its votes? This cannot be undone.")) return;
    const { error } = await supabase.from("polls").delete().eq("id", pollId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Poll deleted");
      queryClient.invalidateQueries({ queryKey: ["polls-data", user?.id] });
    }
  };

  const polls = data?.polls || [];
  const options = data?.options || [];
  const counts = data?.counts || {};
  const myVotes = data?.myVotes || [];

  return (
    <Layout>
      <div className="container py-8 md:py-12 max-w-3xl overflow-x-hidden">
        <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-xl sm:text-2xl md:text-3xl font-bold flex items-center gap-2 break-words">
              <Vote className="w-6 h-6 md:w-7 md:h-7 text-primary shrink-0" /> <span className="break-words">Community Polls</span>
            </h1>
            <p className="text-muted-foreground mt-1 text-sm md:text-base">Voice your opinion on local civic issues.</p>
          </div>
          {isAdmin && (
            <Link to="/admin/polls" className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
              <Plus className="w-4 h-4" /> Create
            </Link>
          )}
        </div>

        {isLoading && <p className="text-muted-foreground mt-8 text-center">Loading polls...</p>}
        {!isLoading && polls.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Vote className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">No polls yet</p>
            <p className="text-sm">Check back soon — admins post new polls regularly.</p>
          </div>
        )}

        <div className="space-y-5 mt-6">
          {polls.map((poll: any, i: number) => {
            const pollOptions = options.filter((o: any) => o.poll_id === poll.id);
            const userVote = myVotes.find((v: any) => v.poll_id === poll.id) || null;
            const totalVotes = pollOptions.reduce((sum: number, o: any) => sum + (counts[o.id] || 0), 0);
            const ended = new Date(poll.ends_at) < new Date() || !poll.is_active;
            const showResults = !!userVote || ended;

            return (
              <motion.div
                key={poll.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-card rounded-xl border border-border p-4 md:p-5 shadow-card overflow-hidden"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h3 className="font-semibold text-foreground text-base md:text-lg flex-1 min-w-0 break-words">{poll.question}</h3>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {ended ? (
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        Ended
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" /> Live
                      </span>
                    )}
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleDelete(poll.id)}
                        aria-label="Delete poll"
                        className="p-1.5 rounded-md text-destructive hover:bg-destructive/10 transition-colors touch-manipulation"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {poll.description && <p className="text-sm text-muted-foreground mb-4">{poll.description}</p>}

                <div className="space-y-2">
                  {pollOptions.map((opt: any) => {
                    const optVotes = counts[opt.id] || 0;
                    const pct = totalVotes > 0 ? Math.round((optVotes / totalVotes) * 100) : 0;
                    const isMyVote = userVote?.option_id === opt.id;

                    if (showResults) {
                      return (
                        <div key={opt.id} className="relative overflow-hidden rounded-lg border border-border bg-muted/30">
                          <div
                            className={`absolute inset-y-0 left-0 ${isMyVote ? "bg-primary/20" : "bg-muted"}`}
                            style={{ width: `${pct}%`, transition: "width 0.5s" }}
                          />
                          <div className="relative flex items-center justify-between gap-2 px-3 py-2.5 text-sm">
                            <span className="flex items-center gap-2 font-medium text-foreground min-w-0 break-words">
                              {isMyVote && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                              <span className="break-words">{opt.option_text}</span>
                            </span>
                            <span className="font-bold text-foreground tabular-nums shrink-0">{pct}% <span className="text-xs text-muted-foreground font-normal">({optVotes})</span></span>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleVote(poll.id, opt.id)}
                        disabled={ended || !user}
                        className="w-full text-left px-3 py-3 rounded-lg border border-border bg-card hover:bg-muted hover:border-primary active:bg-muted text-sm font-medium text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation break-words"
                      >
                        {opt.option_text}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-3 mt-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><BarChart3 className="w-3 h-3" />{totalVotes} vote{totalVotes !== 1 ? "s" : ""}</span>
                  <span>•</span>
                  <span>Ends {new Date(poll.ends_at).toLocaleDateString()}</span>
                  {!user && !ended && <span className="text-primary ml-auto"><Link to="/auth">Sign in to vote</Link></span>}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
};

export default Polls;
