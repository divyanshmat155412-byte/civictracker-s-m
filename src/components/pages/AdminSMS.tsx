import { useUiText } from "@/hooks/useUiText";
import { invokeFunction } from "@/lib/invoke-function";
import { useState } from "react";
import { motion } from "framer-motion";
import { MessageSquare, Send, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { format } from "date-fns";

const AdminSMS = () => {
  const tx = useUiText();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const queryClient = useQueryClient();

  const [phone, setPhone] = useState("+91");
  const [body, setBody] = useState("");
  const [complaintId, setComplaintId] = useState("");
  const [sending, setSending] = useState(false);

  const { data: logs = [] } = useQuery({
    queryKey: ["sms-logs"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from("sms_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  const { data: complaints = [] } = useQuery({
    queryKey: ["sms-complaint-options"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase.rpc("list_complaints_for_admin_sms");
      return data || [];
    },
  });

  if (loading || roleLoading) return <Layout><div className="container py-12">{tx("Loading...")}</div></Layout>;
  if (!user) { navigate("/auth"); return null; }
  if (!isAdmin) return <Layout><div className="container py-12 text-center text-muted-foreground">{tx("Admins only")}</div></Layout>;

  const sendSms = async () => {
    if (!phone || !body) {
      toast.error(tx("Phone and message are required"));
      return;
    }
    setSending(true);
    try {
      const { data, error } = await invokeFunction("send-sms", {
        body: { to: phone.trim(), body: body.trim(), complaint_id: complaintId || undefined },
      });
      if (error) throw error;
      if (data?.simulated) {
        toast.success(tx("📲 SMS simulated (no Twilio configured) — saved to log"));
      } else {
        toast.success(tx("✅ SMS sent via Twilio"));
      }
      setBody("");
      queryClient.invalidateQueries({ queryKey: ["sms-logs"] });
    } catch (e: any) {
      console.error("SMS send error:", e);
      toast.error(e?.message || "Failed to send SMS");
    } finally {
      setSending(false);
    }
  };

  const useTemplate = (text: string) => setBody(text);
  const selected = complaints.find((c: any) => c.id === complaintId);

  return (
    <Layout>
      <div className="container py-8 md:py-12 max-w-4xl">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">{tx("SMS Notifications")}</h1>
              <p className="text-sm text-muted-foreground">{tx("Send updates to citizens with low/no internet")}</p>
            </div>
          </div>
        </motion.div>

        <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 mb-6 flex gap-3">
          <AlertCircle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-foreground mb-1">{tx("Simulated mode")}</p>
            <p className="text-muted-foreground text-xs">
              {tx(" SMS is logged to the database but no real message is sent. To enable real delivery, connect ")}<strong>Twilio</strong> {tx(" and set ")}<code className="px-1 py-0.5 rounded bg-muted">TWILIO_FROM_NUMBER</code> {tx(" as a secret. ")}</p>
          </div>
        </div>

        {/* Compose */}
        <div className="bg-card rounded-xl border border-border p-5 shadow-card mb-6">
          <h2 className="font-display font-bold text-foreground mb-4">{tx("Compose message")}</h2>

          <div className="grid gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">{tx("Linked complaint (optional)")}</label>
              <select
                value={complaintId}
                onChange={(e) => {
                  setComplaintId(e.target.value);
                  const c = complaints.find((x: any) => x.id === e.target.value);
                  if (c?.whatsapp_number) setPhone(c.whatsapp_number);
                }}
                className="w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">{tx("— None —")}</option>
                {complaints.map((c: any) => (
                  <option key={c.id} value={c.id}>#{c.complaint_id} · {c.title}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">{tx("Recipient phone (E.164)")}</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={tx("Enter recipient phone")}
                className="w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">{tx("Message (")}{body.length}/480)</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value.slice(0, 480))}
                rows={4}
                placeholder={tx("Your complaint #CT-12 has been assigned to a worker...")}
                className="w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
              <div className="flex flex-wrap gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => useTemplate(`Civic Tracker: Aapki complaint ${selected ? "#" + selected.complaint_id : ""} register ho gayi hai. Hum jaldi action lenge. Dhanyavaad.`)}
                  className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground hover:bg-muted/70"
                >{tx("Template: Registered")}</button>
                <button
                  type="button"
                  onClick={() => useTemplate(`Civic Tracker: Aapki complaint ${selected ? "#" + selected.complaint_id : ""} ab IN PROGRESS hai. Worker bheja gaya hai.`)}
                  className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground hover:bg-muted/70"
                >{tx("In progress")}</button>
                <button
                  type="button"
                  onClick={() => useTemplate(`Civic Tracker: Aapki complaint ${selected ? "#" + selected.complaint_id : ""} RESOLVED ho gayi hai. Feedback dein - Dhanyavaad!`)}
                  className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground hover:bg-muted/70"
                >{tx("Resolved")}</button>
              </div>
            </div>

            <button
              onClick={sendSms}
              disabled={sending || !phone || !body}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
               {sending ? tx("Sending...") : tx("Send / simulate SMS")}
            </button>
          </div>
        </div>

        {/* Logs */}
        <div className="bg-card rounded-xl border border-border p-5 shadow-card">
          <h2 className="font-display font-bold text-foreground mb-4">{tx("Recent SMS log (")}{logs.length})</h2>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{tx("No SMS sent yet.")}</p>
          ) : (
            <div className="space-y-2">
              {logs.map((log: any) => (
                <div key={log.id} className="p-3 rounded-lg border border-border bg-background/50">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-semibold text-foreground">{log.phone_number}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        log.status === "sent" ? "bg-success/15 text-success" :
                        log.status === "simulated" ? "bg-muted text-muted-foreground" :
                        "bg-destructive/15 text-destructive"
                      }`}>
                        {log.status === "sent" && <CheckCircle2 className="w-2.5 h-2.5 inline mr-0.5" />}
                        {tx(log.status)} · {log.provider}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">{format(new Date(log.created_at), "MMM d, HH:mm")}</span>
                  </div>
                  <p className="text-sm text-foreground/80">{log.body}</p>
                  {log.error && <p className="text-xs text-destructive mt-1">⚠️ {log.error}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default AdminSMS;
