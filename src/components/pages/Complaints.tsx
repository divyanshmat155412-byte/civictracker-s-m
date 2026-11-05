import { useUiText } from "@/hooks/useUiText";
import { COMPLAINT_COLS, PROFILE_COLS, DEPARTMENT_COLS_PUBLIC } from "@/lib/db-columns";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "@/lib/router-compat";
import { Search, MapPin, Clock, ThumbsUp, MoreHorizontal, Trash2, Droplets, AlertTriangle, ShieldAlert, Flame, Lightbulb, Pipette, Building, Volume2, Camera, ExternalLink } from "lucide-react";
import BeforeAfterSlider from "@/components/BeforeAfterSlider";
import CommentThread from "@/components/CommentThread";
import SocialShare from "@/components/SocialShare";
import SatisfactionRating from "@/components/SatisfactionRating";
import SLACountdown from "@/components/SLACountdown";
import SentimentBadge from "@/components/SentimentBadge";
import VerifyButton from "@/components/VerifyButton";
import ExportButtons from "@/components/ExportButtons";
import LiveTrackingMap from "@/components/LiveTrackingMap";
import Layout from "@/components/Layout";
import { CATEGORY_CONFIG, STATUS_CONFIG, ComplaintCategory, ComplaintStatus } from "@/lib/types";
import { useCities } from "@/hooks/useCities";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { matchesAnyField } from "@/lib/search";
import { cappedStagger } from "@/lib/perf";

const ICON_MAP: Record<string, React.ElementType> = {
  Trash2, Droplets, AlertTriangle, ShieldAlert, Flame, Lightbulb, Pipette, Building, Volume2, MoreHorizontal,
};

const Complaints = () => {
  const tx = useUiText();
  const { cities: CITIES } = useCities();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<ComplaintCategory | "all">("all");
  const [statusFilter, setStatusFilter] = useState<ComplaintStatus | "all">("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [wardFilter, setWardFilter] = useState<string>("all");
  const { data: wardList = [] } = useQuery({
    queryKey: ["wards-filter", cityFilter],
    enabled: cityFilter !== "all",
    queryFn: async () => (await supabase.from("wards").select("id,ward_number,name,zone").eq("city", cityFilter).order("ward_number")).data ?? [],
  });
  const { t } = useLanguage();
  const { user } = useAuth();
  

  const { data: myProfile } = useQuery({
    queryKey: ["my-profile-header", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("home_city").eq("user_id", user!.id).maybeSingle();
      return data as { home_city: string | null } | null;
    },
  });

  const invalidateComplaints = useRealtimeInvalidate([["all-complaints"]]);
  useEffect(() => {
    const channel = supabase
      .channel('complaints-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'complaints' }, () => {
        invalidateComplaints();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [invalidateComplaints]);

  const { data: complaints = [] } = useQuery({
    queryKey: ["all-complaints", categoryFilter, statusFilter, cityFilter, wardFilter],
    queryFn: async () => {
      let query = supabase.from("complaints").select(COMPLAINT_COLS).order("created_at", { ascending: false });
      if (categoryFilter !== "all") query = query.eq("category", categoryFilter);
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      if (cityFilter !== "all") query = query.eq("city", cityFilter);
      if (cityFilter !== "all" && wardFilter !== "all") query = query.eq("ward_id", wardFilter);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data } = await supabase.from("departments").select(DEPARTMENT_COLS_PUBLIC);
      return data || [];
    },
  });

  const filtered = complaints.filter((c: any) =>
    // Unicode-aware so Hindi (Devanagari), English, and mixed queries all match.
    matchesAnyField([c.title, c.description, c.location, c.complaint_id], search),
  );

  const exportData = filtered.map((c: any) => ({
    id: c.complaint_id, title: c.title, category: c.category, status: c.status,
    priority: c.priority, location: c.location, submitted_by: c.submitted_by,
    upvotes: c.upvotes, created_at: c.created_at, sentiment: c.sentiment_label || "N/A",
  }));

  const timeAgo = (dateStr: string) => {
    const hours = Math.floor((Date.now() - new Date(dateStr).getTime()) / 3600000);
    if (hours < 1) return t("common.justNow");
    if (hours < 24) return `${hours}${t("common.hAgo")}`;
    return `${Math.floor(hours / 24)}${t("common.dAgo")}`;
  };

  const getDeptName = (deptId: string | null) => {
    if (!deptId) return null;
    return departments.find((d: any) => d.id === deptId)?.name;
  };

  return (
    <Layout>
      <div className="container py-8 md:py-12">
        <div className="flex items-center justify-between mb-2">
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">{t("complaints.title")}</h1>
          <ExportButtons data={exportData} filename="complaints-export" title={tx("Civic Tracker - Complaints Report")} />
        </div>
        <div className="flex items-center gap-2 flex-wrap mb-6">
          <p className="text-muted-foreground">{t("complaints.subtitle")}</p>
          {user && myProfile?.home_city && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-semibold">
              <MapPin className="w-3 h-3" /> {tx(" Routed to ")}{myProfile.home_city}
            </span>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("complaints.search")} className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-input bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as any)} className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="all">{t("complaints.allCategories")}</option>
            {Object.entries(CATEGORY_CONFIG).map(([k, v]) => <option key={k} value={k}>{tx(v.label)}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="all">{t("complaints.allStatuses")}</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{tx(v.label)}</option>)}
          </select>
          <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="all">{tx("All cities")}</option>
            {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {cityFilter !== "all" && wardList.length > 0 && (
            <select value={wardFilter} onChange={(e) => setWardFilter(e.target.value)} aria-label={tx("Ward")} className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="all">{tx("All wards")}</option>
              {wardList.map((w) => <option key={w.id} value={w.id}>{tx("Ward ")}{w.ward_number} · {w.name} ({w.zone})</option>)}
            </select>
          )}
        </div>

        <p className="text-sm text-muted-foreground mb-4">{filtered.length} {t("complaints.complaint")}{filtered.length !== 1 ? "s" : ""} {t("complaints.found")}</p>

        <div className="grid gap-4">
          {filtered.map((c: any, i: number) => {
            const catConfig = CATEGORY_CONFIG[c.category as ComplaintCategory];
            const statusConfig = STATUS_CONFIG[c.status as keyof typeof STATUS_CONFIG];
            const Icon = ICON_MAP[catConfig?.icon] || MoreHorizontal;
            const deptName = getDeptName(c.department_id);
            return (
              <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: cappedStagger(i) }} className="bg-card rounded-xl border border-border p-4 md:p-5 shadow-card">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: (catConfig?.color || "") + "18" }}>
                    <Icon className="w-5 h-5" style={{ color: catConfig?.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-mono text-muted-foreground">#{c.complaint_id}</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: (statusConfig?.color || "") + "18", color: statusConfig?.color }}>{tx(statusConfig?.label)}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">{tx(catConfig?.label)}</span>
                      {(c.priority === "high" || c.priority === "emergency") && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
                          {c.priority === "emergency" ? `🚨 ${t("common.emergency")}` : `⚠️ ${t("common.high")}`}
                        </span>
                      )}
                      <SentimentBadge label={c.sentiment_label} />
                      <SLACountdown category={c.category} createdAt={c.created_at} status={c.status} />
                      {deptName && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">🏢 {deptName}</span>
                      )}
                      {c.source === "whatsapp" && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/15 text-accent font-medium">{tx("💬 WhatsApp")}</span>
                      )}
                    </div>
                    <Link to={`/complaints/${c.complaint_id}`} className="group inline-flex items-center gap-1.5 hover:text-primary transition-colors">
                      <h3 className="font-semibold text-foreground text-sm md:text-base group-hover:text-primary transition-colors">{c.title}</h3>
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                    {c.ai_summary ? (
                      <p className="text-xs md:text-sm mt-1 px-2.5 py-1.5 rounded-lg bg-primary/5 border border-primary/10 text-foreground/80 italic flex items-start gap-1.5">
                        <span className="text-primary font-semibold text-[10px] uppercase tracking-wider mt-0.5 shrink-0">{tx("AI")}</span>
                        {c.ai_summary}
                      </p>
                    ) : (
                      <p className="text-muted-foreground text-xs md:text-sm mt-1">{c.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{c.location}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{timeAgo(c.created_at)}</span>
                      <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3" />{c.upvotes}</span>
                      <VerifyButton complaintId={c.id} verificationCount={c.verification_count || 0} />
                      {c.anonymous && <span className="italic">{t("common.anonymous")}</span>}
                      <SocialShare title={c.title} complaintId={c.complaint_id} />
                    </div>
                  </div>
                  {c.photo_url && (
                    <div className="relative group shrink-0 hidden sm:block">
                      <div className="w-20 h-20 rounded-xl overflow-hidden ring-2 ring-primary/20 shadow-lg group-hover:ring-primary/40 transition-all duration-300 group-hover:shadow-xl group-hover:scale-105">
                        <img src={c.photo_url} alt={tx("Complaint photo")} className="w-full h-full object-cover" />
                      </div>
                      <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider shadow-md whitespace-nowrap">
                        <Camera className="w-2.5 h-2.5" /> {tx(" Photo ")}</span>
                    </div>
                  )}
                </div>
                {c.photo_url && (
                  <div className="sm:hidden mt-3 relative group">
                    <div className="w-full h-40 rounded-xl overflow-hidden ring-2 ring-primary/20 shadow-lg">
                      <img src={c.photo_url} alt={tx("Complaint photo")} className="w-full h-full object-cover" />
                    </div>
                  </div>
                )}
                {c.status === "resolved" && c.before_photo_url && c.after_photo_url && (
                  <div className="mt-3">
                    <BeforeAfterSlider beforeUrl={c.before_photo_url || c.photo_url} afterUrl={c.after_photo_url} className="h-48 sm:h-56" />
                  </div>
                )}
                {c.status === "resolved" && <SatisfactionRating complaintId={c.id} />}
                {c.status === "in_progress" && <LiveTrackingMap complaintId={c.id} />}
                <CommentThread complaintId={c.id} />
              </motion.div>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg font-medium">{t("complaints.noFound")}</p>
              <p className="text-sm">{t("complaints.adjustFilters")}</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Complaints;
