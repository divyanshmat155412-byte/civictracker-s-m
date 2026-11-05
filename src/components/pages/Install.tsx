import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Download, Smartphone, Share, Check, Monitor, ArrowDown } from "lucide-react";
import Layout from "@/components/Layout";
import { useLanguage } from "@/contexts/LanguageContext";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const Install = () => {
  const { language } = useLanguage();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    // Detect iOS
    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setIsInstalled(true));

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    setDeferredPrompt(null);
  };

  const isHindi = language === "hi";

  return (
    <Layout>
      <div className="container py-12 md:py-20 max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Smartphone className="w-10 h-10 text-primary" />
          </div>
          <h1 className="font-display text-2xl md:text-4xl font-bold text-foreground mb-3">
            {isHindi ? "अपने फ़ोन पर इंस्टॉल करें" : "Install on Your Phone"}
          </h1>
          <p className="text-muted-foreground text-lg">
            {isHindi
              ? "Civic Tracker को ऐप की तरह इंस्टॉल करें — तेज़, आसान, और हमेशा एक टैप दूर।"
              : "Get Civic Tracker as an app — fast, easy, always one tap away."}
          </p>
        </motion.div>

        {isInstalled ? (
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-success/10 border border-success/30 rounded-2xl p-8 text-center">
            <Check className="w-12 h-12 text-success mx-auto mb-3" />
            <h2 className="text-xl font-bold text-foreground mb-2">
              {isHindi ? "✅ पहले से इंस्टॉल है!" : "✅ Already Installed!"}
            </h2>
            <p className="text-muted-foreground">
              {isHindi ? "आप ऐप अपने होम स्क्रीन से खोल सकते हैं।" : "You can open the app from your home screen."}
            </p>
          </motion.div>
        ) : deferredPrompt ? (
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
            <button
              onClick={handleInstall}
              className="inline-flex items-center gap-3 px-8 py-4 rounded-xl gradient-accent text-accent-foreground font-bold text-lg shadow-elevated hover:scale-105 transition-transform"
            >
              <Download className="w-6 h-6" />
              {isHindi ? "अभी इंस्टॉल करें" : "Install Now"}
            </button>
          </motion.div>
        ) : (
          <div className="space-y-6">
            {/* Android Instructions */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card border border-border rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <Monitor className="w-5 h-5 text-success" />
                </div>
                <h2 className="font-bold text-foreground text-lg">
                  {isHindi ? "Android / Chrome" : "Android / Chrome"}
                </h2>
              </div>
              <ol className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                  {isHindi ? "Chrome में इस वेबसाइट को खोलें" : "Open this website in Chrome"}
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                  {isHindi ? "⋮ मेनू (ऊपर दाईं ओर) पर टैप करें" : "Tap the ⋮ menu (top right)"}
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                  {isHindi ? "\"होम स्क्रीन पर जोड़ें\" चुनें" : 'Select "Add to Home Screen"'}
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">4</span>
                  {isHindi ? "\"जोड़ें\" पर टैप करें — बस हो गया! 🎉" : 'Tap "Add" — done! 🎉'}
                </li>
              </ol>
            </motion.div>

            {/* iOS Instructions */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card border border-border rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center">
                  <Share className="w-5 h-5 text-info" />
                </div>
                <h2 className="font-bold text-foreground text-lg">
                  {isHindi ? "iPhone / Safari" : "iPhone / Safari"}
                </h2>
              </div>
              <ol className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                  {isHindi ? "Safari में इस वेबसाइट को खोलें" : "Open this website in Safari"}
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                  {isHindi ? "Share बटन (⬆) पर टैप करें" : "Tap the Share button (⬆)"}
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                  {isHindi ? "नीचे स्क्रॉल करें और \"Add to Home Screen\" चुनें" : 'Scroll down and select "Add to Home Screen"'}
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">4</span>
                  {isHindi ? "\"Add\" पर टैप करें — बस! 🎉" : 'Tap "Add" — you\'re set! 🎉'}
                </li>
              </ol>
            </motion.div>

            {/* Benefits */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-primary/5 border border-primary/10 rounded-2xl p-6">
              <h3 className="font-bold text-foreground mb-3">
                {isHindi ? "ऐप इंस्टॉल करने के फायदे:" : "Benefits of installing:"}
              </h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {(isHindi
                  ? ["⚡ तेज़ लोडिंग — ऐप जैसा अनुभव", "📱 होम स्क्रीन से एक टैप में खोलें", "🔔 Full-screen अनुभव, कोई ब्राउज़र बार नहीं", "💾 कम डेटा खर्च"]
                  : ["⚡ Faster loading — app-like experience", "📱 One-tap access from home screen", "🔔 Full-screen experience, no browser bar", "💾 Uses less data"]
                ).map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </motion.div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Install;
