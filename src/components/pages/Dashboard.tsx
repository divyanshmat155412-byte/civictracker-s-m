import { useEffect } from "react";
import { motion } from "framer-motion";
import { BarChart3, Clock, CheckCircle, AlertTriangle, TrendingUp, MapPin, Timer, CalendarDays } from "lucide-react";
import Layout from "@/components/Layout";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, AreaChart, Area,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";

const STATUS_COLORS: Record<string, string> = {
  resolved: "hsl(142, 72%, 35%)",
  "in-progress": "hsl(200, 80%, 50%)",
  pending: "hsl(38, 92%, 50%)",
  escalated: "hsl(0, 72%, 51%)",
};

const CHART_PALETTE = [
  "hsl(30, 90%, 55%)", "hsl(200, 80%, 50%)", "hsl(142, 72%, 40%)",
  "hsl(280, 60%, 55%)", "hsl(0, 72%, 51%)", "hsl(170, 70%, 40%)",
  "hsl(45, 90%, 50%)", "hsl(320, 60%, 50%)",
];

const PRIORITY_COLORS: Record<string, string> = {
  high: "hsl(0, 72%, 51%)",
  medium: "hsl(38, 92%, 50%)",
  low: "hsl(142, 72%, 40%)",
};

const Dashboard = () => {
  const { t } = useLanguage();
  
  const isMobile = useIsMobile();

  const invalidateDashboard = useRealtimeInvalidate([["dashboard-all-complaints"]]);
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'complaints' }, () => {
        invalidateDashboard();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [invalidateDashboard]);

  const { data: allComplaints = [] } = useQuery({
    queryKey: ["dashboard-all-complaints"],
    queryFn: async () => {
      const { data } = await supabase
        .from("complaints")
        .select("id, category, status, location, priority, created_at, resolved_at, upvotes")
        .order("created_at", { ascending: true });
      return data || [];
    },
  });

  const total = allComplaints.length;
  const resolved = allComplaints.filter((c: any) => c.status === "resolved").length;
  const inProgress = allComplaints.filter((c: any) => c.status === "in-progress").length;
  const pending = allComplaints.filter((c: any) => c.status === "pending").length;
  const escalated = allComplaints.filter((c: any) => c.status === "escalated").length;

  const pieData = [
    { name: t("dashboard.resolved"), value: resolved, color: STATUS_COLORS["resolved"] },
    { name: t("dashboard.inProgress"), value: inProgress, color: STATUS_COLORS["in-progress"] },
    { name: t("dashboard.pending"), value: pending, color: STATUS_COLORS["pending"] },
    { name: t("dashboard.escalated"), value: escalated, color: STATUS_COLORS["escalated"] },
  ];

  const categoryMap: Record<string, number> = {};
  allComplaints.forEach((c: any) => { categoryMap[c.category] = (categoryMap[c.category] || 0) + 1; });
  const categoryData = Object.entries(categoryMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

  const areaMap: Record<string, number> = {};
  allComplaints.forEach((c: any) => {
    const area = c.location?.split(",")[0]?.trim() || "Unknown";
    areaMap[area] = (areaMap[area] || 0) + 1;
  });
  const areaData = Object.entries(areaMap)
    .map(([name, count]) => ({ name: name.length > 14 ? name.slice(0, 14) + "…" : name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const resolutionTimes = allComplaints
    .filter((c: any) => c.status === "resolved" && c.resolved_at)
    .map((c: any) => ({ category: c.category, days: Math.max(0, Math.round((new Date(c.resolved_at).getTime() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24))) }));

  const resTimeByCat: Record<string, { total: number; count: number }> = {};
  resolutionTimes.forEach((r) => {
    if (!resTimeByCat[r.category]) resTimeByCat[r.category] = { total: 0, count: 0 };
    resTimeByCat[r.category].total += r.days; resTimeByCat[r.category].count += 1;
  });
  const resolutionData = Object.entries(resTimeByCat).map(([name, v]) => ({ name, avgDays: Math.round(v.total / v.count) })).sort((a, b) => b.avgDays - a.avgDays);
  const avgResolutionDays = resolutionTimes.length > 0 ? Math.round(resolutionTimes.reduce((s, r) => s + r.days, 0) / resolutionTimes.length) : 0;

  const monthlyMap: Record<string, { total: number; resolved: number }> = {};
  allComplaints.forEach((c: any) => {
    const month = c.created_at.slice(0, 7);
    if (!monthlyMap[month]) monthlyMap[month] = { total: 0, resolved: 0 };
    monthlyMap[month].total += 1;
    if (c.status === "resolved") monthlyMap[month].resolved += 1;
  });
  const trendData = Object.entries(monthlyMap).sort(([a], [b]) => a.localeCompare(b)).map(([month, v]) => ({
    month: new Date(month + "-01").toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
    filed: v.total, resolved: v.resolved,
  }));

  const priorityMap: Record<string, number> = {};
  allComplaints.forEach((c: any) => { priorityMap[c.priority] = (priorityMap[c.priority] || 0) + 1; });
  const priorityData = Object.entries(priorityMap).map(([name, count]) => ({ name, count }));

  const stats = [
    { label: t("dashboard.totalComplaints"), value: total, icon: BarChart3, color: "text-primary" },
    { label: t("dashboard.resolved"), value: resolved, icon: CheckCircle, color: "text-green-500" },
    { label: t("dashboard.pending"), value: pending, icon: Clock, color: "text-amber-500" },
    { label: t("dashboard.escalated"), value: escalated, icon: AlertTriangle, color: "text-destructive" },
    { label: t("dashboard.avgResolution"), value: `${avgResolutionDays}d`, icon: Timer, color: "text-blue-500" },
    { label: t("dashboard.resolutionRate"), value: total > 0 ? `${Math.round((resolved / total) * 100)}%` : "0%", icon: TrendingUp, color: "text-green-600" },
  ];

  const chartHeight = isMobile ? 220 : 280;
  const pieOuterRadius = isMobile ? 70 : 100;
  const pieInnerRadius = isMobile ? 40 : 55;

  return (
    <Layout>
      <div className="container px-3 sm:px-6 py-6 md:py-12 max-w-full overflow-x-hidden">
        <h1 className="font-display text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-1">{t("dashboard.title")}</h1>
        <p className="text-muted-foreground text-sm mb-6 md:mb-8">{t("dashboard.subtitle")}</p>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 mb-8 md:mb-10">
          {stats.map((st, i) => (
            <motion.div key={st.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="bg-card rounded-xl border border-border p-3 sm:p-4 shadow-card">
              <st.icon className={`w-4 h-4 sm:w-5 sm:h-5 mb-1.5 sm:mb-2 ${st.color}`} />
              <div className="font-display font-bold text-lg sm:text-2xl text-foreground">{st.value}</div>
              <div className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 sm:mt-1 leading-tight">{st.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Row 1: Status Pie + Monthly Trend */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
          <ChartCard title={t("dashboard.complaintStatus")} delay={0}>
            {total > 0 ? (
              <>
                <div className="w-full overflow-hidden">
                  <ResponsiveContainer width="100%" height={chartHeight}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={pieInnerRadius} outerRadius={pieOuterRadius} dataKey="value" stroke="none">
                        {pieData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-2 sm:gap-3 mt-2 justify-center">
                  {pieData.map((d) => (
                    <div key={d.name} className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                      <span>{d.name} ({d.value})</span>
                    </div>
                  ))}
                </div>
              </>
            ) : <EmptyState label={t("dashboard.noData")} />}
          </ChartCard>

          <ChartCard title={t("dashboard.monthlyTrend")} icon={CalendarDays} delay={0.05}>
            {trendData.length > 0 ? (
              <div className="w-full overflow-hidden">
                <ResponsiveContainer width="100%" height={chartHeight}>
                  <AreaChart data={trendData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: isMobile ? 9 : 11 }} stroke="hsl(var(--muted-foreground))" interval={isMobile ? "preserveStartEnd" : 0} />
                    <YAxis tick={{ fontSize: isMobile ? 9 : 11 }} stroke="hsl(var(--muted-foreground))" width={30} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: isMobile ? 10 : 12 }} />
                    <Area type="monotone" dataKey="filed" stroke="hsl(30, 90%, 55%)" fill="hsl(30, 90%, 55%)" fillOpacity={0.15} name={t("dashboard.filed")} />
                    <Area type="monotone" dataKey="resolved" stroke="hsl(142, 72%, 40%)" fill="hsl(142, 72%, 40%)" fillOpacity={0.15} name={t("dashboard.resolved")} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : <EmptyState label={t("dashboard.noData")} />}
          </ChartCard>
        </div>

        {/* Row 2: By Category + By Area */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
          <ChartCard title={t("dashboard.byCategory")} delay={0.1}>
            {categoryData.length > 0 ? (
              <div className="w-full overflow-hidden">
                <ResponsiveContainer width="100%" height={Math.max(chartHeight, categoryData.length * 36)}>
                  <BarChart data={categoryData} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <XAxis type="number" tick={{ fontSize: isMobile ? 9 : 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: isMobile ? 9 : 11 }} stroke="hsl(var(--muted-foreground))" width={isMobile ? 70 : 100} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                      {categoryData.map((_, i) => <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <EmptyState label={t("dashboard.noData")} />}
          </ChartCard>

          <ChartCard title={t("dashboard.byArea")} icon={MapPin} delay={0.15}>
            {areaData.length > 0 ? (
              <div className="w-full overflow-hidden">
                <ResponsiveContainer width="100%" height={Math.max(chartHeight, areaData.length * 36)}>
                  <BarChart data={areaData} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <XAxis type="number" tick={{ fontSize: isMobile ? 9 : 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: isMobile ? 8 : 11 }} stroke="hsl(var(--muted-foreground))" width={isMobile ? 80 : 100} />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(200, 80%, 50%)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <EmptyState label={t("dashboard.noData")} />}
          </ChartCard>
        </div>

        {/* Row 3: Avg Resolution Time + By Priority */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <ChartCard title={t("dashboard.avgResTime")} icon={Timer} delay={0.2}>
            {resolutionData.length > 0 ? (
              <div className="w-full overflow-hidden">
                <ResponsiveContainer width="100%" height={Math.max(chartHeight, resolutionData.length * 36)}>
                  <BarChart data={resolutionData} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <XAxis type="number" tick={{ fontSize: isMobile ? 9 : 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: isMobile ? 9 : 11 }} stroke="hsl(var(--muted-foreground))" width={isMobile ? 70 : 100} />
                    <Tooltip formatter={(v: number) => `${v} days`} />
                    <Bar dataKey="avgDays" radius={[0, 6, 6, 0]}>
                      {resolutionData.map((_, i) => <Cell key={i} fill={CHART_PALETTE[(i + 2) % CHART_PALETTE.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <EmptyState label={t("dashboard.noResolved")} />}
          </ChartCard>

          <ChartCard title={t("dashboard.byPriority")} delay={0.25}>
            {priorityData.length > 0 ? (
              <>
                <div className="w-full overflow-hidden">
                  <ResponsiveContainer width="100%" height={chartHeight}>
                    <PieChart>
                      <Pie
                        data={priorityData}
                        cx="50%"
                        cy="50%"
                        outerRadius={pieOuterRadius}
                        dataKey="count"
                        nameKey="name"
                        label={isMobile ? false : ({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {priorityData.map((entry, i) => (
                          <Cell key={i} fill={PRIORITY_COLORS[entry.name] || CHART_PALETTE[i % CHART_PALETTE.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: isMobile ? 10 : 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {isMobile && (
                  <div className="flex flex-wrap gap-2 mt-2 justify-center">
                    {priorityData.map((d) => (
                      <div key={d.name} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: PRIORITY_COLORS[d.name] || CHART_PALETTE[0] }} />
                        <span className="capitalize">{d.name} ({d.count})</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : <EmptyState label={t("dashboard.noData")} />}
          </ChartCard>
        </div>
      </div>
    </Layout>
  );
};

const ChartCard = ({ title, icon: Icon, delay = 0, children }: { title: string; icon?: any; delay?: number; children: React.ReactNode }) => (
  <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay }} className="bg-card rounded-xl border border-border p-3 sm:p-5 shadow-card overflow-hidden">
    <div className="flex items-center gap-2 mb-3 sm:mb-4">
      {Icon && <Icon className="w-4 h-4 text-muted-foreground shrink-0" />}
      <h3 className="font-display font-semibold text-sm sm:text-base text-foreground">{title}</h3>
    </div>
    {children}
  </motion.div>
);

const EmptyState = ({ label }: { label: string }) => (
  <p className="text-center text-muted-foreground py-8 sm:py-12 text-xs sm:text-sm">{label}</p>
);

export default Dashboard;
