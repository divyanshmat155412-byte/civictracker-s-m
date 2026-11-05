import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { deleteMyAccount } from "@/lib/account.functions";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy & Account — Civic Tracker" },
      { name: "description", content: "How Civic Tracker handles your data, and how to delete your account." },
      { property: "og:title", content: "Privacy & Account — Civic Tracker" },
      { property: "og:description", content: "How Civic Tracker handles your data, and how to delete your account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const hi = language === "hi";
  const del = useServerFn(deleteMyAccount);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const onDelete = async () => {
    setBusy(true);
    try {
      await del();
      await supabase.auth.signOut();
      toast.success(hi ? "आपका खाता हटा दिया गया है।" : "Your account has been deleted.");
      window.location.href = "/";
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto max-w-3xl px-4 py-10 space-y-8">
        <h1 className="text-3xl font-bold text-foreground">{hi ? "गोपनीयता नीति" : "Privacy notice"}</h1>
        <section className="space-y-3 text-muted-foreground">
          <p>{hi ? "हम केवल वही जानकारी लेते हैं जो शिकायत हल करने के लिए ज़रूरी है:" : "We only collect what is needed to resolve your complaint:"}</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>{hi ? "ईमेल और नाम — लॉगिन और सूचना के लिए।" : "Email and name — for login and status updates."}</li>
            <li>{hi ? "फ़ोटो, स्थान (GPS) और विवरण — शिकायत सार्वजनिक रूप से ट्रैक करने के लिए।" : "Photo, GPS location and description — shown on the public complaint page so anyone can track it."}</li>
            <li>{hi ? "फ़ोन नंबर — केवल अगर आप SMS चुनते हैं; यह कभी सार्वजनिक नहीं होता।" : "Phone number — only if you opt in to SMS; never shown publicly."}</li>
          </ul>
          <p>{hi ? "आप शिकायत 'गुमनाम' दर्ज कर सकते हैं। अधिकारी केवल अपने शहर का डेटा देख सकते हैं।" : "You can report anonymously. Officers only see data for the cities they are authorised for; field workers only see their own assignments."}</p>
          <p>{hi ? "डेटा संग्रह: खाता हटाने पर आपकी निजी जानकारी तुरंत मिटा दी जाती है। शिकायतें नागरिक जवाबदेही के लिए गुमनाम रूप में रहती हैं।" : "Retention: when you delete your account, your personal data is erased immediately. Complaints remain as anonymous public records so repairs stay accountable."}</p>
          <p>{hi ? "AI केवल शिकायत के पाठ और फ़ोटो का सारांश बनाने के लिए उपयोग होता है; AI विफल होने पर भी शिकायत दर्ज होती है।" : "AI is used only to summarise and categorise complaint text and photos; reporting always works even if AI is unavailable."}</p>
        </section>

        <section className="rounded-xl border border-destructive/40 bg-card p-6 space-y-4">
          <h2 className="text-xl font-semibold text-foreground">{hi ? "खाता हटाएं" : "Delete my account"}</h2>
          {!user ? (
            <p className="text-muted-foreground">
              <Link to="/auth" className="text-primary underline">{hi ? "साइन इन करें" : "Sign in"}</Link>{" "}
              {hi ? "खाता हटाने के लिए।" : "to delete your account."}
            </p>
          ) : (
            <>
              <p className="text-muted-foreground">
                {hi ? "यह स्थायी है। पुष्टि के लिए DELETE लिखें।" : "This is permanent. Type DELETE to confirm."}
              </p>
              <input
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground"
                placeholder="DELETE"
                aria-label="Type DELETE to confirm"
              />
              <button
                onClick={onDelete}
                disabled={confirm !== "DELETE" || busy}
                className="rounded-lg bg-destructive px-4 py-2 font-medium text-destructive-foreground disabled:opacity-50"
              >
                {busy ? "…" : hi ? "मेरा खाता स्थायी रूप से हटाएं" : "Permanently delete my account"}
              </button>
            </>
          )}
        </section>
      </div>
    </Layout>
  );
}
