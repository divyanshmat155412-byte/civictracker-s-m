import { useIsRootAdmin } from "@/hooks/useIsRootAdmin";
import { useAdminCities } from "@/hooks/useAdminCities";
import { useCities } from "@/hooks/useCities";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Building2, Trophy, Clock, CheckCircle2, AlertCircle, Plus, Sparkles, X, Search } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import Layout from "@/components/Layout";
import AccountabilityScores from "@/components/AccountabilityScores";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUserRole } from "@/hooks/useUserRole";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { useLanguage } from "@/contexts/LanguageContext";
import { matchesAnyField } from "@/lib/search";
import { cappedStagger } from "@/lib/perf";

interface DeptStat {
  id: string;
  name: string;
  description: string | null;
  head_name: string | null;
  total: number;
  resolved: number;
  pending: number;
  avgResolutionHours: number | null;
}

// Common Indian government civic departments seed list
const SEED_DEPARTMENTS: { name: string; description: string }[] = [
  { name: "Public Works Department (PWD)", description: "Roads, footpaths, public buildings, and infrastructure maintenance." },
  { name: "Municipal Corporation — Sanitation", description: "Garbage collection, street cleaning, and waste management." },
  { name: "Water Supply & Sewerage Board", description: "Drinking water supply, leakages, drainage, and sewer issues." },
  { name: "Electricity Department / DISCOM", description: "Power outages, faulty meters, street light failures, and billing." },
  { name: "Traffic Police", description: "Traffic congestion, illegal parking, signal failures, and road safety." },
  { name: "Health Department", description: "Public hygiene, mosquito control, vaccination drives, and health hazards." },
  { name: "Pollution Control Board", description: "Air, noise, and water pollution complaints; industrial violations." },
  { name: "Forest & Wildlife Department", description: "Tree cutting, encroachments, animal welfare, and green cover." },
  { name: "Urban Development Authority", description: "Encroachments, illegal construction, and town planning issues." },
  { name: "Fire & Emergency Services", description: "Fire safety violations, emergency response, and rescue operations." },
];

const deptSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120, "Name too long (max 120)"),
  description: z.string().trim().max(500, "Description too long (max 500)").optional(),
  head_name: z.string().trim().max(100, "Head name too long (max 100)").optional(),
  contact_email: z
    .string()
    .trim()
    .max(255, "Email too long")
    .email("Invalid email address")
    .optional()
    .or(z.literal("")),
});

const Departments = () => {
  const queryClient = useQueryClient();
  const { isAdmin } = useUserRole();
  const { t } = useLanguage();
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", description: "", head_name: "", contact_email: "" });
  const [deptCity, setDeptCity] = useState("");
  const { isMainAdmin } = useIsRootAdmin();
  const { cities: adminCities } = useAdminCities();
  const { cities: allCities } = useCities();
  const cityChoices = isMainAdmin ? allCities : (adminCities ?? []);

  const { data: stats = [], isLoading } = useQuery<DeptStat[]>({
    queryKey: ["dept-leaderboard"],
    queryFn: async () => {
      const [{ data: depts }, { data: complaints }] = await Promise.all([
        supabase.from("departments").select("id,name,description,head_name,created_at,city"),
        supabase.from("complaints").select("department_id, status, created_at, resolved_at"),
      ]);
      if (!depts) return [];

      return depts.map((d: any) => {
        const own = (complaints || []).filter((c: any) => c.department_id === d.id);
        const resolved = own.filter((c: any) => c.status === "resolved" && c.resolved_at);
        const pending = own.filter((c: any) => c.status !== "resolved").length;
        const avgMs =
          resolved.length > 0
            ? resolved.reduce(
                (sum: number, c: any) =>
                  sum + (new Date(c.resolved_at).getTime() - new Date(c.created_at).getTime()),
                0,
              ) / resolved.length
            : null;
        return {
          id: d.id,
          name: d.city ? `${d.name} (${d.city})` : d.name,
          description: d.description,
          head_name: d.head_name,
          total: own.length,
          resolved: resolved.length,
          pending,
          avgResolutionHours: avgMs !== null ? Math.round(avgMs / 3_600_000) : null,
        } as DeptStat;
      });
    },
  });

  // Real-time sync: refresh leaderboard whenever departments or complaints change
  const invalidateDepts = useRealtimeInvalidate([["dept-leaderboard"]]);
  useEffect(() => {
    const channel = supabase
      .channel("departments-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "departments" }, () => {
        invalidateDepts();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "complaints" }, () => {
        invalidateDepts();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [invalidateDepts]);

  const createMutation = useMutation({
    mutationFn: async (input: z.infer<typeof deptSchema>) => {
      const payload: any = {
        name: input.name,
        description: input.description || null,
        head_name: input.head_name || null,
        contact_email: input.contact_email ? input.contact_email : null,
        city: deptCity || (isMainAdmin ? null : cityChoices[0] ?? null),
      };
      const { error } = await supabase.from("departments").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dept-leaderboard"] });
      setForm({ name: "", description: "", head_name: "", contact_email: "" });
      setCreateOpen(false);
      toast.success(t("dept.created"));
    },
    onError: (err: any) => toast.error(err?.message || t("dept.createFailed")),
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      const { data: existing } = await supabase.from("departments").select("name");
      const existingNames = new Set((existing || []).map((d: any) => d.name.toLowerCase()));
      const toInsert = SEED_DEPARTMENTS.filter(
        (s) => !existingNames.has(s.name.toLowerCase()),
      );
      if (toInsert.length === 0) return 0;
      const { error } = await supabase.from("departments").insert(toInsert);
      if (error) throw error;
      return toInsert.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["dept-leaderboard"] });
      if (count === 0) toast.info(t("dept.allExist"));
      else toast.success(`${count} ${t("dept.departmentsAdded")}`);
    },
    onError: (err: any) => toast.error(err?.message || t("dept.seedFailed")),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = deptSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    createMutation.mutate(parsed.data);
  };

  // Rank: most resolved first, then fastest avg, then most total
  const ranked = [...stats].sort((a, b) => {
    if (b.resolved !== a.resolved) return b.resolved - a.resolved;
    const aTime = a.avgResolutionHours ?? Number.MAX_SAFE_INTEGER;
    const bTime = b.avgResolutionHours ?? Number.MAX_SAFE_INTEGER;
    if (aTime !== bTime) return aTime - bTime;
    return b.total - a.total;
  });

  // Unicode-aware filter so Hindi (Devanagari) department names/descriptions match.
  const visible = ranked.filter((d) => matchesAnyField([d.name, d.description, d.head_name], search));

  const formatHours = (h: number | null) => {
    if (h === null) return "—";
    if (h < 24) return `${h}h`;
    return `${Math.round((h / 24) * 10) / 10}d`;
  };

  const medal = (i: number) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`);

  return (
    <Layout>
      <div className="container py-8 md:py-12 max-w-5xl">
        <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-primary" />
            </div>
            <div>
               <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">{t("dept.title")} <span className="inline-block align-middle text-xs font-medium px-2 py-0.5 rounded bg-secondary/15 text-secondary">{t("dept.inProgress")}</span></h1>
              <p className="text-muted-foreground text-sm">
                {t("dept.subtitle")}
              </p>
            </div>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => seedMutation.mutate()}
                disabled={seedMutation.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                title={t("dept.seedTooltip")}
              >
                <Sparkles className="w-3.5 h-3.5" />
                {seedMutation.isPending ? t("dept.adding") : t("dept.seedCommon")}
              </button>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                <Plus className="w-3.5 h-3.5" /> {t("dept.new")}
              </button>
            </div>
          )}
        </div>

        <AccountabilityScores />

        {isLoading && (
          <div className="text-center py-12 text-muted-foreground">{t("dept.loading")}</div>
        )}

        {!isLoading && ranked.length > 0 && (
          <div className="relative mt-6 mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("dept.search")}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-input bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        )}

        {!isLoading && ranked.length === 0 && (
          <div className="text-center py-16 px-6 rounded-2xl border border-dashed border-border bg-card/50">
            <Building2 className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
            <p className="font-display text-lg font-semibold text-foreground">{t("dept.noneYet")}</p>
            <p className="text-sm text-muted-foreground mt-1 mb-5 max-w-sm mx-auto">
              {isAdmin
                ? t("dept.emptyAdmin")
                : t("dept.emptyUser")}
            </p>
            {isAdmin && (
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => seedMutation.mutate()}
                  disabled={seedMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  <Sparkles className="w-4 h-4" />
                  {seedMutation.isPending ? t("dept.adding") : t("dept.add10")}
                </button>
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  <Plus className="w-4 h-4" /> {t("dept.custom")}
                </button>
              </div>
            )}
          </div>
        )}

        {!isLoading && ranked.length > 0 && visible.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">{t("common.noResults")}</div>
        )}

        <div className="grid gap-3 mt-6">
          {visible.map((d, i) => {
            const rate = d.total > 0 ? Math.round((d.resolved / d.total) * 100) : 0;
            return (
              <motion.div
                key={d.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: cappedStagger(i) }}
                className="bg-card rounded-xl border border-border p-4 md:p-5 shadow-card flex items-center gap-4"
              >
                <div className="text-2xl md:text-3xl font-bold w-12 text-center shrink-0">{medal(i)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-semibold text-foreground">{d.name}</h2>
                    {d.head_name && (
                      <span className="text-xs text-muted-foreground">· {d.head_name}</span>
                    )}
                  </div>
                  {d.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{d.description}</p>
                  )}
                  <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-success transition-all"
                      style={{ width: `${rate}%` }}
                    />
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-5 text-xs shrink-0">
                  <div className="text-center">
                    <div className="flex items-center gap-1 text-success font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {d.resolved}
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{t("dept.resolved")}</div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center gap-1 text-warning font-semibold">
                      <AlertCircle className="w-3.5 h-3.5" /> {d.pending}
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{t("dept.open")}</div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center gap-1 text-foreground font-semibold">
                      <Clock className="w-3.5 h-3.5" /> {formatHours(d.avgResolutionHours)}
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{t("dept.avg")}</div>
                  </div>
                </div>
                <div className="sm:hidden text-right text-xs shrink-0">
                  <div className="text-success font-semibold">{d.resolved} ✓</div>
                  <div className="text-muted-foreground">{formatHours(d.avgResolutionHours)} {t("dept.avg")}</div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Create department modal */}
      {createOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
          onClick={() => setCreateOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-card rounded-2xl border border-border shadow-elevated p-6 max-w-md w-full"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold text-foreground">{t("dept.new")}</h2>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="p-1.5 rounded-md text-muted-foreground hover:bg-muted"
                aria-label={t("common.close")}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">{t("dept.name")} *</label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={t("dept.namePlaceholder")}
                  className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">{t("dept.description")}</label>
                <textarea
                  rows={2}
                  maxLength={500}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder={t("dept.descPlaceholder")}
                  className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">City</label>
                <select value={deptCity} onChange={(e) => setDeptCity(e.target.value)}
                  className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm">
                  {isMainAdmin && <option value="">All cities (shared)</option>}
                  {!isMainAdmin && <option value="">Choose city…</option>}
                  {cityChoices.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">{t("dept.headName")}</label>
                  <input
                    type="text"
                    maxLength={100}
                    value={form.head_name}
                    onChange={(e) => setForm({ ...form, head_name: e.target.value })}
                    placeholder={t("dept.optional")}
                    className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">{t("dept.contactEmail")}</label>
                  <input
                    type="email"
                    maxLength={255}
                    value={form.contact_email}
                    onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                    placeholder="Enter contact email"
                    className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="w-full mt-2 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {createMutation.isPending ? t("dept.creating") : t("dept.create")}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </Layout>
  );
};

export default Departments;
