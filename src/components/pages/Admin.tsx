import { validatePhotoFile } from "@/lib/image-validate";
import { useUiText } from "@/hooks/useUiText";
import { photoUrlFor } from "@/lib/photo-url";
import { COMPLAINT_COLS, PROFILE_COLS, DEPARTMENT_COLS_PUBLIC } from "@/lib/db-columns";
import { useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { motion } from "framer-motion";
import { Shield, CheckCircle, MapPin, Upload, X, Trash2, Printer } from "lucide-react";
import { toast } from "sonner";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CATEGORY_CONFIG, ComplaintCategory, STATUS_CONFIG, ComplaintStatus } from "@/lib/types";
import AdminRequestForm from "@/components/AdminRequestForm";
import AdminRequestsManager from "@/components/AdminRequestsManager";
import { useAdminCities } from "@/hooks/useAdminCities";
import { useCities } from "@/hooks/useCities";
import { useIsRootAdmin } from "@/hooks/useIsRootAdmin";

const Admin = () => {
  const tx = useUiText();
  const { cities: CITIES } = useCities();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [selectedComplaint, setSelectedComplaint] = useState<any>(null);
  const [newStatus, setNewStatus] = useState<ComplaintStatus>("in-progress");
  const [note, setNote] = useState("");
  const [afterPhoto, setAfterPhoto] = useState<File | null>(null);
  const [afterPhotoPreview, setAfterPhotoPreview] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());
  const selectAllVisible = (visibleIds: string[]) => setSelectedIds(new Set(visibleIds));
  const printSelectedPosters = () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds).join(",");
    window.open(`/admin/posters?ids=${encodeURIComponent(ids)}&autoprint=1`, "_blank");
  };

  const { isMainAdmin } = useIsRootAdmin();

  const { data: hasAdminRole, isLoading: roleLoading } = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user && !isMainAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id).eq("role", "admin").eq("status", "active").limit(1).maybeSingle();
      return !!data;
    },
  });

  const isAdmin = isMainAdmin || hasAdminRole;

  const { cities: assignedCities } = useAdminCities();

  // Cities that actually appear in complaints/profiles (so newly-set citizen home cities show up)
  const { data: knownCities = [] } = useQuery({
    queryKey: ["admin-known-cities"],
    enabled: isAdmin === true,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_known_cities");
      if (error) throw error;
      return (data ?? [])
        .map((r: any) => ({
          city: (r?.city ?? "").trim(),
          source: (r?.source ?? "") as "profiles" | "complaints" | "both" | "",
        }))
        .filter((r) => r.city);
    },
    staleTime: 30_000,
  });

  // Merge with assigned cities; "assigned" = admin manages it but no data yet.
  const cityOptions = (() => {
    const sourceMap = new Map<string, "profiles" | "complaints" | "both" | "assigned">();
    for (const k of knownCities) sourceMap.set(k.city, (k.source || "assigned") as any);
    const base = assignedCities ?? CITIES.slice();
    for (const c of base as string[]) {
      if (!sourceMap.has(c)) sourceMap.set(c, "assigned");
    }
    return Array.from(sourceMap.entries())
      .map(([city, source]) => ({ city, source }))
      .sort((a, b) => a.city.localeCompare(b.city));
  })();

  const sourceLabel = (s: string) =>
    s === "both" ? "profiles + complaints"
    : s === "profiles" ? "profiles only"
    : s === "complaints" ? "complaints only"
    : "assigned (no data yet)";

  const { data: complaints = [] } = useQuery({
    queryKey: ["admin-complaints", statusFilter, cityFilter, assignedCities],
    enabled: isAdmin === true,
    queryFn: async () => {
      let query = supabase.from("complaints").select(COMPLAINT_COLS).order("created_at", { ascending: false });
      if (statusFilter === "escalated") query = query.or("status.eq.escalated,and(escalation_level.gt.0,status.neq.resolved)");
      else if (statusFilter !== "all") query = query.eq("status", statusFilter);
      // Apply admin city scoping (null = super admin, sees all)
      if (assignedCities && assignedCities.length > 0) {
        query = query.in("city", assignedCities);
      }
      if (cityFilter !== "all") query = query.eq("city", cityFilter);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedComplaint || !user) return;
      let afterPhotoUrl: string | null = null;
      if (afterPhoto) {
        const checked = await validatePhotoFile(afterPhoto);
        if ("error" in checked) throw new Error(checked.error);
        const filePath = `${user.id}/after-${Date.now()}.${checked.ext}`;
        const { error: uploadError } = await supabase.storage.from("complaint-photos").upload(filePath, afterPhoto, { contentType: checked.mime });
        if (!uploadError) {
          afterPhotoUrl = photoUrlFor(filePath);
        }
      }
      const updates: any = { status: newStatus, updated_at: new Date().toISOString() };
      if (newStatus === "resolved") updates.resolved_at = new Date().toISOString();
      if (afterPhotoUrl) {
        updates.after_photo_url = afterPhotoUrl;
        // Set before_photo_url from original photo if not already set
        if (selectedComplaint.photo_url && !selectedComplaint.before_photo_url) {
          updates.before_photo_url = selectedComplaint.photo_url;
        }
      }
      const { error } = await supabase.from("complaints").update(updates).eq("id", selectedComplaint.id);
      if (error) throw error;
      await supabase.from("complaint_timeline").insert({
        complaint_id: selectedComplaint.id, status: newStatus,
        note: note || `Status changed to ${newStatus}`, updated_by: user.id,
      });
      // Insert notification for status change
      await supabase.from("notifications").insert({
        title: `Complaint #${selectedComplaint.complaint_id} Updated`,
        body: `Status changed to "${newStatus}"${note ? ` — ${note}` : ""}`,
        complaint_id: selectedComplaint.id,
        type: "complaint_update",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-complaints"] });
      setSelectedComplaint(null); setNote(""); setNewStatus("in-progress"); setAfterPhoto(null); setAfterPhotoPreview(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (complaintId: string) => {
      const { error } = await supabase.from("complaints").delete().eq("id", complaintId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-complaints"] });
      setConfirmDeleteId(null);
      toast.success(tx("Complaint deleted successfully"));
    },
    onError: (error: any) => {
      toast.error(tx("Delete failed:") + " " + tx(error?.message || "Unknown error"));
      setConfirmDeleteId(null);
    },
  });

  if (!user) {
    return (
      <Layout><div className="container py-20 text-center">
        <Shield className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h1 className="font-display text-2xl font-bold text-foreground mb-2">{t("admin.accessRequired")}</h1>
        <p className="text-muted-foreground mb-4">{t("admin.signInAccess")}</p>
        <button onClick={() => navigate("/auth")} className="px-6 py-3 rounded-lg gradient-accent text-accent-foreground font-semibold">{t("nav.signIn")}</button>
      </div></Layout>
    );
  }

  if (roleLoading && !isMainAdmin) {
    return (<Layout><div className="container py-20 text-center"><div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" /></div></Layout>);
  }

  if (!isAdmin) {
    return (
      <Layout><div className="container py-20 text-center">
        <Shield className="w-16 h-16 text-destructive mx-auto mb-4" />
        <h1 className="font-display text-2xl font-bold text-foreground mb-2">{t("admin.officialsOnly")}</h1>
        <p className="text-muted-foreground">{t("admin.officialsDesc")}</p>
        <AdminRequestForm />
      </div></Layout>
    );
  }

  const statusCounts = {
    all: complaints.length,
    pending: complaints.filter((c: any) => c.status === "pending").length,
    "in-progress": complaints.filter((c: any) => c.status === "in-progress").length,
    resolved: complaints.filter((c: any) => c.status === "resolved").length,
    escalated: complaints.filter((c: any) => c.status === "escalated" || ((c.escalation_level ?? 0) > 0 && c.status !== "resolved")).length,
  };

  return (
    <Layout>
      <div className="container py-8 md:py-12">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl gradient-hero flex items-center justify-center">
            <Shield className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">{t("admin.panel")}</h1>
            <p className="text-muted-foreground text-sm">{t("admin.manageComplaints")}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-6">
          {isMainAdmin && (
            <>
              <button onClick={() => navigate("/admin/root")} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-2">
                {tx(" 👑 Super Admin Dashboard ")}</button>
              <button onClick={() => navigate("/admin/users")} className="px-3 py-2 rounded-lg bg-card border border-border hover:border-primary text-sm font-medium text-foreground flex items-center gap-2">
                {tx(" 👥 Users & Roles ")}</button>
            </>
          )}
          <button onClick={() => navigate("/admin/wards")} className="px-3 py-2 rounded-lg bg-card border border-border hover:border-primary text-sm font-medium text-foreground flex items-center gap-2">
            {tx(" 🗺️ Wards & Zones ")}</button>
          <button onClick={() => navigate("/admin/polls")} className="px-3 py-2 rounded-lg bg-card border border-border hover:border-primary text-sm font-medium text-foreground flex items-center gap-2">
            {tx(" 🗳️ Manage Polls ")}</button>
          <button onClick={() => navigate("/admin/workers")} className="px-3 py-2 rounded-lg bg-card border border-border hover:border-primary text-sm font-medium text-foreground flex items-center gap-2">
            {tx(" 🚚 Workers & Tracking ")}</button>
          <button onClick={() => navigate("/admin/whatsapp")} className="px-3 py-2 rounded-lg bg-card border border-border hover:border-primary text-sm font-medium text-foreground flex items-center gap-2">
            {tx(" 💬 WhatsApp Setup ")}</button>
          <button onClick={() => navigate("/admin/sms")} className="px-3 py-2 rounded-lg bg-card border border-border hover:border-primary text-sm font-medium text-foreground flex items-center gap-2">
            {tx(" 📲 SMS Notifications ")}</button>
          <button onClick={() => navigate("/heatmap")} className="px-3 py-2 rounded-lg bg-card border border-border hover:border-primary text-sm font-medium text-foreground flex items-center gap-2">
            {tx(" 🔥 Heatmap ")}</button>
        </div>

        {assignedCities && assignedCities.length > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm flex items-center gap-2">
            <span className="text-primary font-semibold">{tx("🌆 City scope:")}</span>
            <span className="text-foreground">{tx("You manage ")}{assignedCities.join(", ")}</span>
          </div>
        )}
        {!assignedCities && (
          <div className="mb-4 p-3 rounded-lg bg-accent/10 border border-accent/30 text-sm flex items-center gap-2">
            <span className="text-accent font-semibold">{tx("👑 Super-admin:")}</span>
            <span className="text-foreground">{tx("You can see complaints from all cities")}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="rounded-lg border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">{tx("All cities ")}{assignedCities ? "" : "(you manage)"}</option>
            {cityOptions.map(({ city, source }) => (
              <option key={city} value={city}>{city} — {sourceLabel(source)}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {(["all", "pending", "in-progress", "resolved", "escalated"] as const).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${statusFilter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
              {s === "all" ? t("map.all") : tx(STATUS_CONFIG[s as ComplaintStatus]?.label || s)} ({statusCounts[s] ?? 0})
            </button>
          ))}
        </div>

        {/* Bulk-selection bar */}
        <div className="mb-3 flex items-center justify-between gap-3 flex-wrap p-3 rounded-lg bg-muted/40 border border-border">
          <div className="flex items-center gap-3 text-sm">
            <button
              type="button"
              onClick={() => {
                const visibleIds = complaints.map((c: any) => c.id);
                if (selectedIds.size === visibleIds.length && visibleIds.length > 0) clearSelection();
                else selectAllVisible(visibleIds);
              }}
              className="text-xs font-medium text-foreground hover:text-primary"
            >
              {selectedIds.size === complaints.length && complaints.length > 0 ? tx("Clear all") : tx("Select all visible")}
            </button>
            <span className="text-xs text-muted-foreground">
              {selectedIds.size} {tx(" selected ")}</span>
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <button
                type="button"
                onClick={clearSelection}
                className="text-xs px-2 py-1 rounded-md text-muted-foreground hover:text-foreground"
              >
                {tx(" Clear ")}</button>
            )}
            <button
              type="button"
              onClick={printSelectedPosters}
              disabled={selectedIds.size === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
              title={tx("Open multi-page printable PDF for selected complaints")}
            >
              <Printer className="w-3.5 h-3.5" />
              {tx(" Print posters (")}{selectedIds.size})
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {complaints.map((c: any) => {
            const catConfig = CATEGORY_CONFIG[c.category as ComplaintCategory];
            const sConfig = STATUS_CONFIG[c.status as ComplaintStatus];
            const checked = selectedIds.has(c.id);
            return (
              <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className={`bg-card rounded-xl border p-4 md:p-5 shadow-card cursor-pointer hover:shadow-elevated transition-shadow ${checked ? "border-primary ring-1 ring-primary/30" : "border-border"}`}
                onClick={() => { setSelectedComplaint(c); setNewStatus(c.status); }}>
                <div className="flex items-start justify-between gap-3">
                  <label
                    className="pt-1 shrink-0 cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSelect(c.id)}
                      className="w-4 h-4 rounded border-input text-primary focus:ring-2 focus:ring-ring cursor-pointer"
                      aria-label={`Select complaint ${c.complaint_id}`}
                    />
                  </label>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-mono text-muted-foreground">#{c.complaint_id}</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: (sConfig?.color || "") + "18", color: sConfig?.color }}>{tx(sConfig?.label)}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{tx(catConfig?.label)}</span>
                      {c.priority === "emergency" && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">🚨 {t("common.emergency")}</span>}
                    </div>
                    <h3 className="font-semibold text-foreground">{c.title}</h3>
                    <p className="text-muted-foreground text-sm mt-1 line-clamp-1">{c.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {c.location}</span>
                      <span>{tx("By: ")}{c.submitted_by}</span>
                      {c.anonymous && (
                        <button type="button" className="underline hover:text-foreground" onClick={async (e) => {
                          e.stopPropagation();
                          const reason = window.prompt(tx("Why do you need this citizen's identity? (recorded in the audit log, min 10 characters)"));
                          if (!reason) return;
                          const { data, error } = await supabase.rpc("reveal_anonymous_complainant", { _complaint_id: c.id, _reason: reason });
                          if (error) { toast.error(error.message); return; }
                          const r = data as { has_account: boolean; full_name: string | null; account_id: string | null };
                          toast.info(r.has_account ? `${r.full_name || tx("Unnamed account")} (${r.account_id})` : tx("Filed without an account"), { duration: 15000 });
                        }}>{tx("Reveal identity")}</button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {c.photo_url && <img src={c.photo_url} alt="" className="w-16 h-16 rounded-lg object-cover" />}
                    {confirmDeleteId === c.id ? (
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => deleteMutation.mutate(c.id)}
                          disabled={deleteMutation.isPending}
                          className="px-2 py-1 rounded text-xs font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
                        >
                          {deleteMutation.isPending ? tx("Deleting...") : tx("Confirm")}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-1 rounded text-xs font-semibold bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                        >
                          {tx(" Cancel ")}</button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(c.id); }}
                        className="p-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                        title={tx("Delete complaint")}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
          {complaints.length === 0 && (
            <div className="text-center py-12 text-muted-foreground"><p className="text-lg font-medium">{t("admin.noComplaints")}</p></div>
          )}
        </div>

        <AdminRequestsManager />
      </div>

      {selectedComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 backdrop-blur-sm p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card rounded-2xl border border-border shadow-elevated max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl font-bold text-foreground">
                {t("admin.updateComplaint")} #{selectedComplaint.complaint_id}
              </h2>
              <button onClick={() => setSelectedComplaint(null)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground"><X className="w-5 h-5" /></button>
            </div>

            <div className="mb-4 p-3 rounded-lg bg-muted/50">
              <h3 className="font-semibold text-foreground text-sm">{selectedComplaint.title}</h3>
              <p className="text-muted-foreground text-xs mt-1">{selectedComplaint.description}</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">{t("admin.updateStatus")}</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["pending", "in-progress", "resolved", "escalated"] as ComplaintStatus[]).map((s) => {
                    const sc = STATUS_CONFIG[s];
                    return (
                      <button key={s} type="button" onClick={() => setNewStatus(s)}
                        className={`p-3 rounded-lg border text-sm font-medium transition-all ${newStatus === s ? "border-secondary bg-secondary/10 text-foreground shadow-card" : "border-border bg-card text-muted-foreground hover:border-secondary/50"}`}>
                        {tx(sc.label)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">{t("admin.adminNote")}</label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={t("admin.notePlaceholder")} className="w-full rounded-lg border border-input bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
              </div>

              {newStatus === "resolved" && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">{t("admin.resolutionPhoto")}</label>
                  <input type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) { setAfterPhoto(file); setAfterPhotoPreview(URL.createObjectURL(file)); } }} className="hidden" id="after-photo-input" />
                  {afterPhotoPreview ? (
                    <div className="relative rounded-lg overflow-hidden border border-border">
                      <img src={afterPhotoPreview} alt={tx("After")} className="w-full h-32 object-cover" />
                      <button type="button" onClick={() => { setAfterPhoto(null); setAfterPhotoPreview(null); }} className="absolute top-2 right-2 p-1 rounded-full bg-destructive text-destructive-foreground"><X className="w-3 h-3" /></button>
                    </div>
                  ) : (
                    <label htmlFor="after-photo-input" className="block w-full border-2 border-dashed border-border rounded-lg p-6 text-center text-muted-foreground hover:border-secondary cursor-pointer transition-colors">
                      <Upload className="w-6 h-6 mx-auto mb-1" />
                      <span className="text-sm">{t("admin.uploadResolution")}</span>
                    </label>
                  )}
                </div>
              )}

              <button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}
                className="w-full py-3 rounded-lg gradient-accent text-accent-foreground font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                <CheckCircle className="w-5 h-5" />
                {updateMutation.isPending ? t("admin.updating") : t("admin.updateComplaint")}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </Layout>
  );
};

export default Admin;
