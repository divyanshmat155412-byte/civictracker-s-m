import { PROFILE_COLS } from "@/lib/db-columns";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Gift, Star, ShoppingBag, Loader2, Check, Trophy, Sparkles,
  ArrowRight, MessageSquare, ThumbsUp, Award, Coins, PartyPopper, Search,
} from "lucide-react";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNavigate } from "@/lib/router-compat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { matchesAnyField } from "@/lib/search";
import { cappedStagger } from "@/lib/perf";

const RewardsStore = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmReward, setConfirmReward] = useState<any | null>(null);
  const [celebration, setCelebration] = useState(false);
  const [search, setSearch] = useState("");

  const EARN_METHODS = [
    { icon: MessageSquare, title: t("rewards.earn.file.title"), points: "+10 pts", desc: t("rewards.earn.file.desc") },
    { icon: ThumbsUp, title: t("rewards.earn.upvote.title"), points: "+2 pts", desc: t("rewards.earn.upvote.desc") },
    { icon: Award, title: t("rewards.earn.badge.title"), points: t("rewards.earn.badge.points"), desc: t("rewards.earn.badge.desc") },
  ];

  const STEPS = [
    { n: 1, title: t("rewards.step1.title"), desc: t("rewards.step1.desc") },
    { n: 2, title: t("rewards.step2.title"), desc: t("rewards.step2.desc") },
    { n: 3, title: t("rewards.step3.title"), desc: t("rewards.step3.desc") },
    { n: 4, title: t("rewards.step4.title"), desc: t("rewards.step4.desc") },
  ];

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select(PROFILE_COLS).eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  const { data: rewards = [] } = useQuery({
    queryKey: ["rewards"],
    queryFn: async () => {
      const { data } = await supabase.from("rewards").select("*").eq("available", true).order("points_cost", { ascending: true });
      return data || [];
    },
  });

  const { data: myRedemptions = [] } = useQuery({
    queryKey: ["my-redemptions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("reward_redemptions").select("*, rewards(title, icon)").eq("user_id", user!.id).order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Real-time: profile points, rewards catalog, and own redemptions sync live
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("rewards-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: `user_id=eq.${user.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["my-profile", user.id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "rewards" }, () => {
        queryClient.invalidateQueries({ queryKey: ["rewards"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "reward_redemptions", filter: `user_id=eq.${user.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["my-redemptions", user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  const redeemMutation = useMutation({
    mutationFn: async (reward: any) => {
      if (!user) throw new Error(t("rewards.notLoggedIn"));
      // Atomic server-side check: deducts points and creates redemption in one transaction.
      // Prevents overspending when multiple redeems fire before realtime balance updates arrive.
      const { data, error } = await supabase.rpc("redeem_reward", { _reward_id: reward.id });
      if (error) throw new Error(error.message.replace(/^.*Insufficient points.*$/i, t("rewards.notEnoughErr")));
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      queryClient.invalidateQueries({ queryKey: ["my-redemptions"] });
      setConfirmReward(null);
      setCelebration(true);
      setTimeout(() => setCelebration(false), 2400);
      toast.success(t("rewards.redeemedToast"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!user) {
    return (
      <Layout>
        <div className="container py-20 text-center">
          <Gift className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="font-display text-2xl font-bold mb-2">{t("rewards.title")}</h1>
          <p className="text-muted-foreground mb-4">{t("rewards.signInPrompt")}</p>
          <button onClick={() => navigate("/auth")} className="px-6 py-3 rounded-lg gradient-accent text-accent-foreground font-semibold">{t("common.signIn")}</button>
        </div>
      </Layout>
    );
  }

  const points = profile?.green_points ?? 0;
  const nextReward = rewards.find((r: any) => r.points_cost > points);
  const progressPct = nextReward ? Math.min(100, Math.round((points / nextReward.points_cost) * 100)) : 100;
  // Unicode-aware filter so Hindi (Devanagari) reward titles/descriptions match.
  const visibleRewards = rewards.filter((r: any) => matchesAnyField([r.title, r.description], search));

  return (
    <Layout>
      <div className="container py-6 md:py-10 max-w-5xl">
        {/* Hero / Balance */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-2">
            <ShoppingBag className="w-7 h-7 text-primary" />
            <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">{t("rewards.title")}</h1>
          </div>
          <p className="text-muted-foreground text-sm mb-5">
            {t("rewards.subtitle")}
          </p>

          <div className="relative overflow-hidden rounded-2xl gradient-hero p-5 md:p-7 text-primary-foreground shadow-elevated mb-8">
            <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
            <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wider opacity-80 mb-1">{t("rewards.yourBalance")}</p>
                <div className="flex items-end gap-2">
                  <span className="font-display text-4xl md:text-5xl font-bold leading-none">{points}</span>
                  <span className="text-sm opacity-80 pb-1">{t("rewards.greenPoints")}</span>
                </div>
                {nextReward && (
                  <p className="text-xs opacity-80 mt-2">
                    {nextReward.points_cost - points} {t("rewards.moreToUnlock")} <strong>{nextReward.title}</strong>
                  </p>
                )}
              </div>
              <div className="md:w-64">
                <div className="flex items-center justify-between text-[11px] opacity-80 mb-1">
                  <span>{t("rewards.progress")}</span><span>{progressPct}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/20 overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${progressPct}%` }} transition={{ duration: 0.8 }} className="h-full bg-white" />
                </div>
                <div className="flex items-center gap-1.5 mt-2 text-xs opacity-90">
                  <Trophy className="w-3.5 h-3.5" />
                  <span>{t("rewards.badge")}: <strong className="capitalize">{profile?.badge_level ?? "bronze"}</strong></span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* How Green Points work */}
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-8">
          <h2 className="font-display text-lg md:text-xl font-bold text-foreground mb-3 flex items-center gap-2">
            <Coins className="w-5 h-5 text-secondary" /> {t("rewards.howWorks")}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {EARN_METHODS.map((m, i) => (
              <Card key={i} className="border-border">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <m.icon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm text-foreground">{m.title}</h3>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary/15 text-secondary">{m.points}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{m.desc}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.section>

        {/* Step-by-step redeem flow */}
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mb-8">
          <h2 className="font-display text-lg md:text-xl font-bold text-foreground mb-3 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-secondary" /> {t("rewards.howRedeem")}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {STEPS.map((s) => (
              <div key={s.n} className="relative bg-card border border-border rounded-xl p-4">
                <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold mb-2">{s.n}</div>
                <h3 className="font-semibold text-sm text-foreground">{s.title}</h3>
                <p className="text-xs text-muted-foreground mt-1">{s.desc}</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Available rewards */}
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-lg md:text-xl font-bold text-foreground flex items-center gap-2">
              <Gift className="w-5 h-5 text-secondary" /> {t("rewards.available")}
            </h2>
            <span className="text-xs text-muted-foreground">{rewards.length} {rewards.length === 1 ? t("rewards.item") : t("rewards.items")}</span>
          </div>
          {rewards.length === 0 ? (
            <div className="text-center py-12 rounded-2xl border border-dashed border-border bg-card/50 text-sm text-muted-foreground">
              {t("rewards.noneYet")}
            </div>
          ) : (
            <>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("rewards.search")}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-input bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              {visibleRewards.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">{t("common.noResults")}</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {visibleRewards.map((reward: any, i: number) => {
                    const canAfford = points >= reward.points_cost;
                    return (
                      <motion.div key={reward.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: cappedStagger(i, 0.05) }}>
                        <Card className={`h-full ${canAfford ? "hover:shadow-elevated hover:-translate-y-0.5" : "opacity-70"} transition-all`}>
                          <CardContent className="p-5 text-center flex flex-col h-full">
                            <div className="text-4xl mb-3">{reward.icon}</div>
                            <h3 className="font-bold text-foreground mb-1">{reward.title}</h3>
                            <p className="text-xs text-muted-foreground mb-4 flex-1">{reward.description}</p>
                            <div className="flex items-center justify-center gap-1 mb-3">
                              <Star className="w-4 h-4 text-primary" />
                              <span className="font-bold text-primary">{reward.points_cost}</span>
                              <span className="text-xs text-muted-foreground">{t("rewards.points")}</span>
                            </div>
                            <button
                              onClick={() => setConfirmReward(reward)}
                              disabled={!canAfford || redeemMutation.isPending}
                              className="w-full py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed gradient-accent text-accent-foreground inline-flex items-center justify-center gap-1.5"
                            >
                              {canAfford ? (<>{t("rewards.redeem")} <ArrowRight className="w-3.5 h-3.5" /></>) : t("rewards.notEnough")}
                            </button>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </motion.section>

        {/* My redemptions */}
        {myRedemptions.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary" /> {t("rewards.myRedemptions")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {myRedemptions.map((r: any) => (
                    <div key={r.id} className="flex items-center gap-3 p-2 rounded-lg border border-border">
                      <span className="text-xl">{r.rewards?.icon || "🎁"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{r.rewards?.title}</p>
                        <p className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</p>
                      </div>
                      <span className="text-xs font-medium text-muted-foreground shrink-0">-{r.points_spent} pts</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${r.status === "pending" ? "bg-yellow-500/10 text-yellow-600" : "bg-green-500/10 text-green-600"}`}>
                        {r.status}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>

      {/* Confirm redemption dialog */}
      <AlertDialog open={!!confirmReward} onOpenChange={(open) => !open && setConfirmReward(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <span className="text-2xl">{confirmReward?.icon}</span> {t("rewards.redeemQ")} {confirmReward?.title}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 pt-1">
                <p>{confirmReward?.description}</p>
                <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">{t("rewards.currentBalance")}</span><strong>{points} pts</strong></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">{t("rewards.cost")}</span><strong className="text-destructive">-{confirmReward?.points_cost ?? 0} pts</strong></div>
                  <div className="border-t border-border my-2" />
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">{t("rewards.afterRedeem")}</span><strong>{Math.max(0, points - (confirmReward?.points_cost ?? 0))} pts</strong></div>
                </div>
                <p className="text-xs text-muted-foreground">{t("rewards.deductNote")}</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={redeemMutation.isPending}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); if (confirmReward) redeemMutation.mutate(confirmReward); }}
              disabled={redeemMutation.isPending}
              className="gradient-accent text-accent-foreground"
            >
              {redeemMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t("rewards.confirmRedeem")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Celebration overlay */}
      <AnimatePresence>
        {celebration && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm pointer-events-none"
          >
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
              className="bg-card border border-border shadow-elevated rounded-2xl px-8 py-6 text-center"
            >
              <PartyPopper className="w-12 h-12 text-secondary mx-auto mb-2" />
              <h3 className="font-display text-xl font-bold text-foreground">{t("rewards.redeemedTitle")}</h3>
              <p className="text-sm text-muted-foreground mt-1">{t("rewards.pointsUpdated")}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
};

export default RewardsStore;
