import { useEffect, useState } from "react";
import { useParams, Link } from "@/lib/router-compat";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin, Clock, ThumbsUp, Camera, Building2, QrCode, X, Download, Printer } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import Layout from "@/components/Layout";
import CommentThread from "@/components/CommentThread";
import SocialShare from "@/components/SocialShare";
import SatisfactionRating from "@/components/SatisfactionRating";
import SLACountdown from "@/components/SLACountdown";
import SentimentBadge from "@/components/SentimentBadge";
import VerifyButton from "@/components/VerifyButton";
import BeforeAfterSlider from "@/components/BeforeAfterSlider";
import LiveTrackingMap from "@/components/LiveTrackingMap";
import PrintDownloadMenu from "@/components/PrintDownloadMenu";
import ComplaintAssignmentPanel from "@/components/ComplaintAssignmentPanel";
import { CATEGORY_CONFIG, STATUS_CONFIG, ComplaintCategory } from "@/lib/types";
import { supabase } from "@/integrations/supabase/client";
import { COMPLAINT_COLS, DEPARTMENT_COLS_PUBLIC } from "@/lib/db-columns";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const ComplaintDetail = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [qrOpen, setQrOpen] = useState(false);

  // Lookup by either UUID `id` or human-readable `complaint_id`
  const { data: complaint, isLoading } = useQuery({
    queryKey: ["complaint-detail", id],
    enabled: !!id,
    queryFn: async () => {
      // Try complaint_id first (e.g., "CT-12345"), then UUID
      const { data: byCode } = await supabase
        .from("complaints")
        .select(COMPLAINT_COLS)
        .eq("complaint_id", id!)
        .maybeSingle();
      if (byCode) return byCode;
      const { data } = await supabase
        .from("complaints")
        .select(COMPLAINT_COLS)
        .eq("id", id!)
        .maybeSingle();
      return data;
    },
  });

  const { data: timeline = [] } = useQuery({
    queryKey: ["complaint-timeline", complaint?.id],
    enabled: !!complaint?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("complaint_timeline")
        .select("*")
        .eq("complaint_id", complaint!.id)
        .order("created_at", { ascending: true });
      return data || [];
    },
  });

  const { data: department } = useQuery({
    queryKey: ["complaint-dept", complaint?.department_id],
    enabled: !!complaint?.department_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("departments")
        .select(DEPARTMENT_COLS_PUBLIC)
        .eq("id", complaint!.department_id!)
        .maybeSingle();
      return data;
    },
  });

  // Realtime updates for this complaint
  useEffect(() => {
    if (!complaint?.id) return;
    const ch = supabase
      .channel(`complaint-${complaint.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "complaints", filter: `id=eq.${complaint.id}` },
        () => queryClient.invalidateQueries({ queryKey: ["complaint-detail", id] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "complaint_timeline", filter: `complaint_id=eq.${complaint.id}` },
        () => queryClient.invalidateQueries({ queryKey: ["complaint-timeline", complaint.id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [complaint?.id, id, queryClient]);

  if (isLoading) {
    return (
      <Layout>
        <div className="container py-12 text-center text-muted-foreground">Loading complaint…</div>
      </Layout>
    );
  }

  if (!complaint) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <h1 className="font-display text-2xl font-bold text-foreground mb-2">Complaint not found</h1>
          <p className="text-muted-foreground mb-6">It may have been removed or the link is incorrect.</p>
          <Link to="/complaints" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold">
            <ArrowLeft className="w-4 h-4" /> Back to complaints
          </Link>
        </div>
      </Layout>
    );
  }

  const catConfig = CATEGORY_CONFIG[complaint.category as ComplaintCategory];
  const statusConfig = STATUS_CONFIG[complaint.status as keyof typeof STATUS_CONFIG];

  const formatDate = (s: string) =>
    new Date(s).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

  return (
    <Layout>
      <div className="container py-8 md:py-12 max-w-4xl">
        <Link to="/complaints" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to complaints
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-2xl border border-border p-6 md:p-8 shadow-card"
        >
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <span className="text-xs font-mono text-muted-foreground">#{complaint.complaint_id}</span>
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ backgroundColor: (statusConfig?.color || "") + "22", color: statusConfig?.color }}
            >
              {statusConfig?.label}
            </span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground font-medium">
              {catConfig?.label}
            </span>
            {(complaint.priority === "high" || complaint.priority === "emergency") && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-destructive/10 text-destructive">
                {complaint.priority === "emergency" ? "🚨 Emergency" : "⚠️ High"}
              </span>
            )}
            <SentimentBadge label={complaint.sentiment_label} />
            <SLACountdown category={complaint.category} createdAt={complaint.created_at} status={complaint.status} />
            {complaint.city && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary/15 text-secondary-foreground/80 font-medium">
                🌆 {complaint.city}
              </span>
            )}
            {(complaint as { zone?: string | null }).zone && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary/15 text-secondary-foreground/80 font-medium">
                🗺️ {(complaint as { zone?: string | null }).zone}
              </span>
            )}
            {(complaint as { due_at?: string | null }).due_at && complaint.status !== "resolved" && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-warning/15 text-warning font-medium">
                ⏰ Due {new Date((complaint as { due_at: string }).due_at).toLocaleDateString()}
              </span>
            )}
          </div>

          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-2">{complaint.title}</h1>

          {complaint.ai_summary && (
            <p className="text-sm mb-3 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10 text-foreground/80 italic flex items-start gap-2">
              <span className="text-primary font-semibold text-[10px] uppercase tracking-wider mt-0.5 shrink-0">AI</span>
              {complaint.ai_summary}
            </p>
          )}
          <p className="text-foreground/90 whitespace-pre-wrap leading-relaxed">{complaint.description}</p>

          <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{complaint.location}</span>
            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{formatDate(complaint.created_at)}</span>
            <span className="flex items-center gap-1"><ThumbsUp className="w-3.5 h-3.5" />{complaint.upvotes}</span>
            <VerifyButton complaintId={complaint.id} verificationCount={complaint.verification_count || 0} />
            <SocialShare title={complaint.title} complaintId={complaint.complaint_id} />
            <button
              onClick={() => setQrOpen(true)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
              title="Show QR code"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>QR code</span>
            </button>
            <PrintDownloadMenu complaint={complaint} />
            {department && (
              <span className="flex items-center gap-1 text-primary">
                <Building2 className="w-3.5 h-3.5" /> {department.name}
              </span>
            )}
          </div>

          <ComplaintAssignmentPanel complaint={complaint as never} />

          {complaint.photo_url && !complaint.after_photo_url && (
            <div className="mt-5 relative">
              <div className="rounded-xl overflow-hidden ring-2 ring-primary/20 shadow-lg">
                <img src={complaint.photo_url} alt={complaint.title} className="w-full max-h-[480px] object-cover" />
              </div>
              <span className="absolute top-3 left-3 flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider shadow-md">
                <Camera className="w-3 h-3" /> Reported photo
              </span>
            </div>
          )}

          {complaint.status === "resolved" && complaint.before_photo_url && complaint.after_photo_url && (
            <div className="mt-5">
              <BeforeAfterSlider
                beforeUrl={complaint.before_photo_url || complaint.photo_url || ""}
                afterUrl={complaint.after_photo_url}
                className="h-64 sm:h-80"
              />
            </div>
          )}

          {complaint.status === "in_progress" && <LiveTrackingMap complaintId={complaint.id} />}
          {complaint.status === "resolved" && <SatisfactionRating complaintId={complaint.id} />}
        </motion.div>

        {/* Timeline */}
        <div className="mt-8 bg-card rounded-2xl border border-border p-6 shadow-card">
          <h2 className="font-display text-lg font-bold text-foreground mb-4">Status timeline</h2>
          {timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">No timeline entries yet.</p>
          ) : (
            <ol className="relative border-l-2 border-border ml-2 space-y-5">
              {timeline.map((t: any) => {
                const sc = STATUS_CONFIG[t.status as keyof typeof STATUS_CONFIG];
                return (
                  <li key={t.id} className="ml-5">
                    <span
                      className="absolute -left-[9px] mt-1 w-4 h-4 rounded-full border-2 border-card"
                      style={{ backgroundColor: sc?.color || "hsl(var(--muted-foreground))" }}
                    />
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: (sc?.color || "") + "22", color: sc?.color }}
                      >
                        {sc?.label || t.status}
                      </span>
                      <span className="text-xs text-muted-foreground">{formatDate(t.created_at)}</span>
                    </div>
                    {t.note && <p className="text-sm text-foreground/80 mt-1">{t.note}</p>}
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {/* Comments */}
        <div className="mt-8 bg-card rounded-2xl border border-border p-6 shadow-card">
          <h2 className="font-display text-lg font-bold text-foreground mb-2">Discussion</h2>
          <CommentThread complaintId={complaint.id} />
        </div>
      </div>

      {/* QR code modal */}
      {qrOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
          onClick={() => setQrOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-card rounded-2xl border border-border shadow-elevated p-6 max-w-sm w-full relative"
          >
            <button
              onClick={() => setQrOpen(false)}
              className="absolute top-3 right-3 p-1.5 rounded-md text-muted-foreground hover:bg-muted"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="font-display text-lg font-bold text-foreground mb-1 text-center">
              Scan to open complaint
            </h3>
            <p className="text-xs text-muted-foreground text-center mb-4">
              Anyone can scan this code to view #{complaint.complaint_id}
            </p>
            <div className="flex justify-center">
              <div className="bg-white p-4 rounded-xl shadow-card">
                <QRCodeCanvas
                  id="complaint-qr-canvas"
                  value={`${window.location.origin}/complaints/${complaint.complaint_id}`}
                  size={220}
                  level="M"
                  includeMargin={false}
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground text-center mt-3 break-all">
              {`${window.location.origin}/complaints/${complaint.complaint_id}`}
            </p>
            <button
              onClick={() => {
                const canvas = document.getElementById("complaint-qr-canvas") as HTMLCanvasElement | null;
                if (!canvas) return;
                const link = document.createElement("a");
                link.download = `complaint-${complaint.complaint_id}-qr.png`;
                link.href = canvas.toDataURL("image/png");
                link.click();
              }}
              className="mt-4 w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
            >
              <Download className="w-4 h-4" /> Download PNG
            </button>
          </motion.div>
        </div>
      )}
    </Layout>
  );
};

export default ComplaintDetail;
