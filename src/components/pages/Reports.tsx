import { invokeFunction } from "@/lib/invoke-function";
import { useState } from "react";
import { motion } from "framer-motion";
import { FileText, Download, TrendingUp, AlertTriangle, CheckCircle, Clock, Loader2, BarChart3, MapPin, Sparkles } from "lucide-react";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { useLanguage } from "@/contexts/LanguageContext";
import { isMainAdminEmail } from "@/lib/main-admin";

interface ReportData {
  period: string;
  generatedAt: string;
  since: string;
  summary: {
    total: number;
    resolved: number;
    pending: number;
    inProgress: number;
    escalated: number;
    resolutionRate: number;
    avgResolutionDays: number;
  };
  categoryBreakdown: Record<string, number>;
  priorityBreakdown: Record<string, number>;
  topAreas: { name: string; count: number }[];
  aiInsights: string;
  recentComplaints: any[];
}

const Reports = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<"weekly" | "monthly">("weekly");
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState<ReportData | null>(null);

  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin-reports", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (isMainAdminEmail(user?.email)) return true;
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id).eq("role", "admin").maybeSingle();
      return !!data;
    },
  });

  const generateReport = async () => {
    setGenerating(true);
    try {
      const { data, error } = await invokeFunction("generate-admin-report", {
        body: { period },
      });
      if (error) throw error;
      setReport(data);
    } catch (err: any) {
      console.error("Report generation error:", err);
    } finally {
      setGenerating(false);
    }
  };

  if (!user) {
    return (
      <Layout>
        <div className="container py-20 text-center">
          <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">{t("reports.signInRequired")}</h1>
          <button onClick={() => navigate("/auth")} className="px-6 py-3 rounded-lg gradient-accent text-accent-foreground font-semibold">{t("common.signIn")}</button>
        </div>
      </Layout>
    );
  }

  if (isAdmin === false) {
    return (
      <Layout>
        <div className="container py-20 text-center">
          <FileText className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">{t("reports.adminOnly")}</h1>
          <p className="text-muted-foreground">{t("reports.adminOnlyDesc")}</p>
        </div>
      </Layout>
    );
  }

  const priorityColors: Record<string, string> = {
    emergency: "#dc2626", high: "#ef4444", medium: "#f59e0b", low: "#22c55e",
  };

  return (
    <Layout>
      <div className="container py-8 md:py-12 max-w-5xl">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl gradient-hero flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">{t("reports.title")}</h1>
              <p className="text-muted-foreground text-sm">{t("reports.subtitle")}</p>
            </div>
          </div>

          {/* Period selector */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex bg-muted rounded-lg p-1">
              {(["weekly", "monthly"] as const).map((p) => (
                <button key={p} onClick={() => { setPeriod(p); setReport(null); }}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${period === p ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                  {p === "weekly" ? t("reports.weekly") : t("reports.monthly")}
                </button>
              ))}
            </div>
            <button onClick={generateReport} disabled={generating}
              className="px-5 py-2 rounded-lg gradient-accent text-accent-foreground font-semibold flex items-center gap-2 disabled:opacity-50">
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {generating ? t("reports.generating") : t("reports.generate")}
            </button>
          </div>
        </motion.div>

        {report && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: t("reports.total"), value: report.summary.total, icon: FileText, color: "text-primary" },
                { label: t("reports.resolved"), value: report.summary.resolved, icon: CheckCircle, color: "text-green-500" },
                { label: t("reports.pending"), value: report.summary.pending, icon: Clock, color: "text-yellow-500" },
                { label: t("reports.escalated"), value: report.summary.escalated, icon: AlertTriangle, color: "text-red-500" },
              ].map((stat) => (
                <div key={stat.label} className="bg-card rounded-xl border border-border p-4 shadow-card">
                  <stat.icon className={`w-5 h-5 ${stat.color} mb-2`} />
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Resolution stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-card rounded-xl border border-border p-5 shadow-card">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-foreground">{t("reports.resolutionRate")}</h3>
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-bold text-foreground">{report.summary.resolutionRate}%</span>
                  <span className="text-sm text-muted-foreground mb-1">{t("reports.complaintsResolved")}</span>
                </div>
                <div className="mt-3 h-3 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${report.summary.resolutionRate}%` }} />
                </div>
              </div>
              <div className="bg-card rounded-xl border border-border p-5 shadow-card">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-foreground">{t("reports.avgResolutionTime")}</h3>
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-bold text-foreground">{report.summary.avgResolutionDays}</span>
                  <span className="text-sm text-muted-foreground mb-1">{t("reports.daysAverage")}</span>
                </div>
              </div>
            </div>

            {/* Category & Priority */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-card rounded-xl border border-border p-5 shadow-card">
                <h3 className="font-semibold text-foreground mb-3">{t("reports.byCategory")}</h3>
                <div className="space-y-2">
                  {Object.entries(report.categoryBreakdown)
                    .sort((a, b) => b[1] - a[1])
                    .map(([cat, count]) => (
                      <div key={cat} className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground capitalize">{cat}</span>
                        <div className="flex items-center gap-2">
                          <div className="h-2 bg-primary/20 rounded-full w-20">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${(count / report.summary.total) * 100}%` }} />
                          </div>
                          <span className="text-sm font-medium text-foreground w-8 text-right">{count}</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
              <div className="bg-card rounded-xl border border-border p-5 shadow-card">
                <h3 className="font-semibold text-foreground mb-3">{t("reports.byPriority")}</h3>
                <div className="space-y-2">
                  {Object.entries(report.priorityBreakdown)
                    .sort((a, b) => b[1] - a[1])
                    .map(([priority, count]) => (
                      <div key={priority} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: priorityColors[priority] || "#888" }} />
                          <span className="text-sm text-muted-foreground capitalize">{priority}</span>
                        </div>
                        <span className="text-sm font-medium text-foreground">{count}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            {/* Top Areas */}
            {report.topAreas.length > 0 && (
              <div className="bg-card rounded-xl border border-border p-5 shadow-card">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-foreground">{t("reports.topAreas")}</h3>
                </div>
                <div className="space-y-2">
                  {report.topAreas.map((area, i) => (
                    <div key={area.name} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-primary w-5">#{i + 1}</span>
                      <span className="text-sm text-foreground flex-1 truncate">{area.name}</span>
                      <span className="text-sm font-medium text-muted-foreground">{area.count} {t("reports.complaints")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Insights */}
            {report.aiInsights && (
              <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl border border-primary/20 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-foreground">{t("reports.aiInsights")}</h3>
                </div>
                <div className="text-sm text-foreground/80 leading-relaxed prose prose-sm max-w-none">
                  <ReactMarkdown>{report.aiInsights}</ReactMarkdown>
                </div>
              </div>
            )}

            {/* Recent complaints */}
            {report.recentComplaints.length > 0 && (
              <div className="bg-card rounded-xl border border-border p-5 shadow-card">
                <h3 className="font-semibold text-foreground mb-3">{t("reports.recentComplaints")}</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {report.recentComplaints.map((c: any) => (
                    <div key={c.id} className="flex items-center gap-3 text-sm p-2 rounded-lg hover:bg-muted/50">
                      <span className="font-mono text-xs text-muted-foreground">#{c.complaint_id || c.id.slice(0, 6)}</span>
                      <span className="flex-1 truncate text-foreground">{c.title}</span>
                      <span className="text-xs capitalize px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{c.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-center text-xs text-muted-foreground">
              {t("reports.generatedAt")} {new Date(report.generatedAt).toLocaleString()} • {t("reports.dataSince")} {new Date(report.since).toLocaleDateString()}
            </p>
          </motion.div>
        )}

        {!report && !generating && (
          <div className="text-center py-16">
            <FileText className="w-16 h-16 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-muted-foreground">{t("reports.selectPeriod")}</p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Reports;
