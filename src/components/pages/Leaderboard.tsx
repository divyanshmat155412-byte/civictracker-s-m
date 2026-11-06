import { useUiText } from "@/hooks/useUiText";
import { COMPLAINT_COLS, PROFILE_COLS, DEPARTMENT_COLS_PUBLIC } from "@/lib/db-columns";
import { motion } from "framer-motion";
import { Trophy, Medal, Star, Shield, TrendingUp, Users } from "lucide-react";
import Layout from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";

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

const Leaderboard = () => {
  const tx = useUiText();
  const { t } = useLanguage();

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["leaderboard-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("public_leaderboard");
      if (error) throw error;
      return data;
    },
  });

  const topThree = profiles.slice(0, 3);
  const rest = profiles.slice(3);

  return (
    <Layout>
      <div className="container py-8 md:py-12 max-w-4xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-2">
            <Trophy className="w-7 h-7 text-yellow-500" />
            <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
              {t("leaderboard.title")}
            </h1>
          </div>
          <p className="text-muted-foreground text-sm mb-8">{t("leaderboard.subtitle")}</p>
        </motion.div>

        {/* Badge Progression Info */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-card rounded-xl border border-border p-4 mb-8 shadow-card">
          <h3 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> {t("leaderboard.badgeProgression")}
          </h3>
          <div className="flex flex-wrap gap-3">
            {Object.entries(BADGE_CONFIG).map(([key, config]) => {
              const Icon = config.icon;
              return (
                <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Icon className="w-4 h-4" style={{ color: config.color }} />
                  <span className="font-medium" style={{ color: config.color }}>{tx(config.label)}</span>
                  <span>({config.minPoints}{tx("+ pts)")}</span>
                </div>
              );
            })}
          </div>
        </motion.div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : profiles.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg font-medium">{t("leaderboard.noData")}</p>
          </div>
        ) : (
          <>
            {/* Top 3 Podium */}
            {topThree.length > 0 && (
              <div className="grid grid-cols-3 gap-3 mb-8">
                {[1, 0, 2].map((podiumIdx) => {
                  const profile = topThree[podiumIdx];
                  if (!profile) return <div key={podiumIdx} />;
                  const rank = podiumIdx + 1;
                  const badge = getBadgeForPoints(profile.green_points);
                  const badgeConfig = BADGE_CONFIG[badge];
                  const Icon = badgeConfig.icon;
                  const isFirst = rank === 1;
                  return (
                    <motion.div key={profile.id}
                      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 + podiumIdx * 0.1 }}
                      className={`bg-card rounded-xl border border-border p-4 text-center shadow-card ${isFirst ? "ring-2 ring-yellow-400/50 -mt-4" : ""}`}>
                      <div className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center font-bold text-lg mb-2 ${
                        rank === 1 ? "bg-yellow-400/20 text-yellow-500" :
                        rank === 2 ? "bg-gray-300/20 text-gray-400" :
                        "bg-amber-600/20 text-amber-600"
                      }`}>
                        {rank}
                      </div>
                      <div className="w-12 h-12 mx-auto rounded-full bg-muted flex items-center justify-center mb-2">
                        {profile.avatar_url ? (
                          <img src={profile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <span className="text-lg font-bold text-muted-foreground">
                            {(profile.full_name || "?")[0]?.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <p className="font-semibold text-foreground text-sm truncate">{profile.full_name || tx("Citizen")}</p>
                      <div className="flex items-center justify-center gap-1 mt-1">
                        <Icon className="w-3.5 h-3.5" style={{ color: badgeConfig.color }} />
                        <span className="text-xs font-medium" style={{ color: badgeConfig.color }}>{tx(badgeConfig.label)}</span>
                      </div>
                      <p className="text-lg font-bold text-primary mt-1">{profile.green_points}</p>
                      <p className="text-[10px] text-muted-foreground">{tx("Green Points")}</p>
                      <p className="text-xs text-muted-foreground mt-1">{profile.complaints_count} {tx(" complaints")}</p>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Rest of leaderboard */}
            <div className="space-y-2">
              {rest.map((profile: any, i: number) => {
                const rank = i + 4;
                const badge = getBadgeForPoints(profile.green_points);
                const badgeConfig = BADGE_CONFIG[badge];
                const Icon = badgeConfig.icon;
                const nextBadge = getNextBadge(badge);
                const nextConfig = nextBadge ? BADGE_CONFIG[nextBadge] : null;
                const progress = nextConfig
                  ? ((profile.green_points - badgeConfig.minPoints) / (nextConfig.minPoints - badgeConfig.minPoints)) * 100
                  : 100;

                return (
                  <motion.div key={profile.id}
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * i }}
                    className="bg-card rounded-lg border border-border p-3 flex items-center gap-3 shadow-card">
                    <span className="w-8 text-center font-bold text-muted-foreground text-sm">{rank}</span>
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                      {profile.avatar_url ? (
                        <img src={profile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <span className="text-sm font-bold text-muted-foreground">
                          {(profile.full_name || "?")[0]?.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground text-sm truncate">{profile.full_name || tx("Citizen")}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Icon className="w-3 h-3" style={{ color: badgeConfig.color }} />
                        <span className="text-[10px] font-medium" style={{ color: badgeConfig.color }}>{tx(badgeConfig.label)}</span>
                        {nextConfig && (
                          <div className="flex-1 max-w-[80px] h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(progress, 100)}%`, backgroundColor: nextConfig.color }} />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-primary text-sm">{profile.green_points}</p>
                      <p className="text-[10px] text-muted-foreground">{profile.complaints_count} {tx(" complaints")}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default Leaderboard;
