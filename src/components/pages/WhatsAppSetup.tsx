import { invokeFunction } from "@/lib/invoke-function";
import { useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { ArrowLeft, MessageCircle, Send, Copy, CheckCircle2 } from "lucide-react";
import Layout from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";

const WhatsAppSetup = () => {
  const navigate = useNavigate();
  const { isAdmin, isLoading } = useUserRole();
  const [copied, setCopied] = useState(false);

  // Test simulator
  const [from, setFrom] = useState("");
  const [body, setBody] = useState("Garbage piling up near MG Road since 3 days. Please clear urgently.");
  const [latitude, setLatitude] = useState("23.3315");
  const [longitude, setLongitude] = useState("75.0367");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<any>(null);

  const webhookUrl = typeof window !== "undefined" ? `${window.location.origin}/api/public/fn/whatsapp-webhook` : "/api/public/fn/whatsapp-webhook";

  const copyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copied to clipboard");
  };

  const sendTest = async () => {
    setSending(true); setResult(null);
    try {
      const { data, error } = await invokeFunction("whatsapp-webhook", {
        body: {
          from, body,
          latitude: latitude ? parseFloat(latitude) : null,
          longitude: longitude ? parseFloat(longitude) : null,
        },
      });
      if (error) throw error;
      setResult(data);
      if (data?.complaint_id) toast.success(`Complaint ${data.complaint_id} created! 📨`);
    } catch (e: any) {
      toast.error(e.message);
      setResult({ error: e.message });
    } finally { setSending(false); }
  };

  if (isLoading) return <Layout><div className="container py-12 text-center text-muted-foreground">Loading...</div></Layout>;
  if (!isAdmin) return <Layout><div className="container py-12 text-center"><p className="text-destructive font-semibold">Admin access required.</p></div></Layout>;

  return (
    <Layout>
      <div className="container py-8 max-w-3xl">
        <button onClick={() => navigate("/admin")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Admin
        </button>

        <h1 className="font-display text-2xl font-bold mb-2 flex items-center gap-2">
          <MessageCircle className="w-6 h-6 text-accent" /> WhatsApp Integration
        </h1>
        <p className="text-muted-foreground text-sm mb-6">We will implement this soon. The test simulator below is for setup only; live WhatsApp delivery is not active.</p>

        {/* Webhook URL */}
        <div className="bg-card rounded-xl border border-border p-5 shadow-card mb-6">
          <h2 className="font-semibold mb-3">📡 Webhook URL</h2>
          <p className="text-xs text-muted-foreground mb-2">Paste this into your Twilio / Meta WhatsApp Business webhook config:</p>
          <div className="flex gap-2">
            <code className="flex-1 px-3 py-2 rounded-lg bg-muted text-xs font-mono break-all">{webhookUrl}</code>
            <button onClick={copyUrl} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1 shrink-0">
              {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Setup guide */}
        <div className="bg-card rounded-xl border border-border p-5 shadow-card mb-6">
          <h2 className="font-semibold mb-3">🚀 Setup Guide</h2>
          <ol className="space-y-3 text-sm text-foreground">
            <li className="flex gap-2"><span className="font-bold text-primary">1.</span><span>Sign up for <a href="https://www.twilio.com/whatsapp" target="_blank" rel="noopener" className="text-primary underline">Twilio WhatsApp Sandbox</a> (free for testing) or <a href="https://business.whatsapp.com/" target="_blank" rel="noopener" className="text-primary underline">Meta WhatsApp Business API</a>.</span></li>
            <li className="flex gap-2"><span className="font-bold text-primary">2.</span><span>In Twilio Console → Messaging → Settings → WhatsApp Sandbox, paste the webhook URL above into <strong>"When a message comes in"</strong>.</span></li>
            <li className="flex gap-2"><span className="font-bold text-primary">3.</span><span>Set HTTP method to <strong>POST</strong>.</span></li>
            <li className="flex gap-2"><span className="font-bold text-primary">4.</span><span>Citizens send <code className="bg-muted px-1 rounded text-xs">join your-sandbox-code</code> to the Twilio number to opt in.</span></li>
            <li className="flex gap-2"><span className="font-bold text-primary">5.</span><span>Then they can send complaint text + photo + location, and it'll auto-create a complaint here! 🎉</span></li>
          </ol>
        </div>

        {/* Tester */}
        <div className="bg-card rounded-xl border border-border p-5 shadow-card">
          <h2 className="font-semibold mb-3">🧪 Test Simulator</h2>
          <p className="text-xs text-muted-foreground mb-4">Try the webhook without setting up a real provider — simulate a WhatsApp message:</p>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-foreground">From (phone)</label>
              <input value={from} onChange={e => setFrom(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg border border-input bg-background text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground">Message body</label>
              <textarea value={body} onChange={e => setBody(e.target.value)} rows={3} className="w-full mt-1 px-3 py-2 rounded-lg border border-input bg-background text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-foreground">Latitude</label>
                <input value={latitude} onChange={e => setLatitude(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg border border-input bg-background text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground">Longitude</label>
                <input value={longitude} onChange={e => setLongitude(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg border border-input bg-background text-sm" />
              </div>
            </div>
            <button onClick={sendTest} disabled={sending} className="w-full py-2.5 rounded-lg bg-accent text-accent-foreground font-semibold flex items-center justify-center gap-1 disabled:opacity-50">
              <Send className="w-4 h-4" /> {sending ? "Sending..." : "Send Test Message"}
            </button>
            {result && (
              <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto">{JSON.stringify(result, null, 2)}</pre>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default WhatsAppSetup;
