import { COMPLAINT_COLS, PROFILE_COLS, DEPARTMENT_COLS_PUBLIC } from "@/lib/db-columns";
import { motion } from "framer-motion";
import { User, Trophy, Medal, Star, Shield, FileText, Clock, TrendingUp, AlertCircle, Award, Lock, MapPin } from "lucide-react";
import SmsOptInCard from "@/components/SmsOptInCard";
import HomeCityCard from "@/components/HomeCityCard";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "@/lib/router-compat";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { STATUS_CONFIG, CATEGORY_CONFIG } from "@/lib/types";
import type { ComplaintStatus, ComplaintCategory } from "@/lib/types";
import { format } from "date-fns";
import { useEffect } from "react";

const BADGE_CONFIG: Record<string, { label: string; icon: typeof Trophy; color: string; minPoints: number }> = {
  bronze: { label: "Bronze", icon: Medal, color: "hsl(30, 60%, 50%)", minPoints: 0 },
  silver: { label: "Silver", icon: Medal, color: "hsl(0, 0%, 65%)", minPoints: 50 },
  gold: { label: "Gold", icon: Trophy, color: "hsl(45, 90%, 50%)", minPoints: 150 },
  platinum: { label: "Platinum", icon: Star, color: "hsl(200, 80%, 55%)", minPoints: 300 },
  diamond: { label: "Diamond", icon: Shield, color: "hsl(280, 70%, 60%)", minPoints: 500 },
};

const getBadgeForPoints = (points: number) => {
  if (points >= 500) return "diamond";
  if (points >= 300) return "platinum";
  if (points >= 150) return "gold";
  if (points >= 50) return "silver";
  return "bronze";
};

const getNextBadge = (current: string) => {
  const order = ["bronze", "silver", "gold", "platinum", "diamond"];
  const idx = order.indexOf(current);
  return idx < order.length - 1 ? order[idx + 1] : null;
};

const Profile = () => {
  const { user, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [authLoading, user, navigate]);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(PROFILE_COLS)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: complaints = [], isLoading: complaintsLoading } = useQuery({
    queryKey: ["my-complaints", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("complaints")
        .select(COMPLAINT_COLS)
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: timeline = [] } = useQuery({
    queryKey: ["my-timeline", user?.id],
    enabled: !!user && complaints.length > 0,
    queryFn: async () => {
      const ids = complaints.map((c) => c.id);
      const { data, error } = await supabase
        .from("complaint_timeline")
        .select("*")
        .in("complaint_id", ids)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  // Fetch all achievements + user's unlocked ones
  const { data: allAchievements = [] } = useQuery({
    queryKey: ["achievements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("achievements")
        .select("*")
        .order("threshold_value", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: userAchievements = [] } = useQuery({
    queryKey: ["user-achievements", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_achievements")
        .select("*")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data;
    },
  });

  if (authLoading || !user) {
    return (
      <Layout>
        <div className="flex justify-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </Layout>
    );
  }

  const greenPoints = profile?.green_points ?? 0;
  const badge = getBadgeForPoints(greenPoints);
  const badgeConfig = BADGE_CONFIG[badge];
  const BadgeIcon = badgeConfig.icon;
  const nextBadge = getNextBadge(badge);
  const nextConfig = nextBadge ? BADGE_CONFIG[nextBadge] : null;
  const progress = nextConfig
    ? ((greenPoints - badgeConfig.minPoints) / (nextConfig.minPoints - badgeConfig.minPoints)) * 100
    : 100;

  const resolvedCount = complaints.filter((c) => c.status === "resolved").length;
  const pendingCount = complaints.filter((c) => c.status === "pending").length;

  return (
    <Layout>
      <div className="container py-8 md:py-12 max-w-4xl">
        {/* Profile Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="mb-6 overflow-hidden">
            <div className="h-24 gradient-hero" />
            <CardContent className="relative pt-0 pb-6 px-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 -mt-10">
                <Avatar className="w-20 h-20 border-4 border-card shadow-lg">
                  <AvatarImage src={profile?.avatar_url || ""} />
                  <AvatarFallback className="text-2xl font-bold bg-primary text-primary-foreground">
                    {(profile?.full_name || user.email || "U")[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl font-bold text-foreground truncate">
                    {profile?.full_name || user.email?.split("@")[0] || "Citizen"}
                  </h1>
                  {(profile as { home_city?: string | null } | null)?.home_city ? (
                    <p className="text-xs font-medium mt-0.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                      <MapPin className="w-3 h-3" /> {(profile as { home_city?: string | null }).home_city}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-0.5 italic">No home city set</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Member since {format(new Date(profile?.created_at || user.created_at), "MMM yyyy")}
                  </p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-card shadow-sm">
                  <BadgeIcon className="w-5 h-5" style={{ color: badgeConfig.color }} />
                  <span className="font-bold text-sm" style={{ color: badgeConfig.color }}>
                    {badgeConfig.label}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Stats Grid */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Green Points", value: greenPoints, icon: TrendingUp, color: "text-primary" },
            { label: "Complaints", value: complaints.length, icon: FileText, color: "text-accent" },
            { label: "Resolved", value: resolvedCount, icon: Star, color: "text-green-500" },
            { label: "Pending", value: pendingCount, icon: Clock, color: "text-yellow-500" },
          ].map((stat) => (
            <Card key={stat.label} className="text-center p-4">
              <stat.icon className={`w-5 h-5 mx-auto mb-1 ${stat.color}`} />
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </Card>
          ))}
        </motion.div>

        {/* SMS Notifications opt-in */}
        <SmsOptInCard profile={profile} userId={user.id} />

        {/* Home City */}
        <HomeCityCard
          userId={user.id}
          initialCity={(profile as { home_city?: string | null } | null)?.home_city}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["my-profile", user.id] });
            queryClient.invalidateQueries({ queryKey: ["my-profile-header", user.id] });
          }}
        />

        {/* Badge Progress */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" /> Badge Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 mb-2">
                <BadgeIcon className="w-5 h-5" style={{ color: badgeConfig.color }} />
                <span className="text-sm font-medium" style={{ color: badgeConfig.color }}>{badgeConfig.label}</span>
                {nextConfig && (
                  <>
                    <span className="text-xs text-muted-foreground">→</span>
                    <span className="text-sm font-medium" style={{ color: nextConfig.color }}>{nextConfig.label}</span>
                  </>
                )}
              </div>
              <Progress value={Math.min(progress, 100)} className="h-2.5 mb-1" />
              <p className="text-xs text-muted-foreground">
                {nextConfig
                  ? `${greenPoints} / ${nextConfig.minPoints} points to ${nextConfig.label}`
                  : "Maximum badge achieved! 🎉"}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Achievements */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Award className="w-4 h-4 text-primary" /> Achievements ({userAchievements.length}/{allAchievements.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {allAchievements.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Loading achievements...</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {allAchievements.map((ach: any) => {
                    const unlocked = userAchievements.some((ua: any) => ua.achievement_id === ach.id);
                    return (
                      <div key={ach.id}
                        className={`relative rounded-xl border p-3 text-center transition-all ${
                          unlocked
                            ? "border-primary/40 bg-primary/5 shadow-sm"
                            : "border-border bg-muted/30 opacity-50"
                        }`}>
                        <div className="text-2xl mb-1">{ach.icon}</div>
                        <p className={`text-xs font-semibold ${unlocked ? "text-foreground" : "text-muted-foreground"}`}>
                          {ach.title}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{ach.description}</p>
                        {!unlocked && (
                          <Lock className="absolute top-2 right-2 w-3 h-3 text-muted-foreground" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* My Complaints */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" /> My Complaints ({complaints.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {complaintsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
                </div>
              ) : complaints.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No complaints submitted yet</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                  {complaints.map((c) => {
                    const statusConf = STATUS_CONFIG[c.status as ComplaintStatus];
                    const catConf = CATEGORY_CONFIG[c.category as ComplaintCategory];
                    return (
                      <div key={c.id} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors">
                        <div className="shrink-0 mt-0.5">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                            style={{ backgroundColor: statusConf?.color + "20", color: statusConf?.color }}>
                            {c.complaint_id?.replace("CT-", "") || "#"}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-foreground truncate">{c.title}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0"
                              style={{ borderColor: statusConf?.color, color: statusConf?.color }}>
                              {statusConf?.label || c.status}
                            </Badge>
                            {catConf && (
                              <span className="text-[10px] text-muted-foreground">{catConf.label}</span>
                            )}
                            <span className="text-[10px] text-muted-foreground">
                              {format(new Date(c.created_at), "dd MMM yyyy")}
                            </span>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">↑{c.upvotes}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Activity Timeline */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" /> Activity History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No activity yet</p>
              ) : (
                <div className="relative space-y-0">
                  <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />
                  {timeline.map((entry, i) => {
                    const statusConf = STATUS_CONFIG[entry.status as ComplaintStatus];
                    return (
                      <div key={entry.id} className="relative flex items-start gap-3 py-2.5">
                        <div className="relative z-10 w-[30px] flex justify-center">
                          <div className="w-2.5 h-2.5 rounded-full mt-1.5"
                            style={{ backgroundColor: statusConf?.color || "hsl(var(--muted-foreground))" }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground">
                            Status changed to{" "}
                            <span className="font-semibold" style={{ color: statusConf?.color }}>
                              {statusConf?.label || entry.status}
                            </span>
                          </p>
                          {entry.note && (
                            <p className="text-xs text-muted-foreground mt-0.5">{entry.note}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {format(new Date(entry.created_at), "dd MMM yyyy, hh:mm a")}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </Layout>
  );
};

export default Profile;
