import { useUiText } from "@/hooks/useUiText";
import { invokeFunction } from "@/lib/invoke-function";
import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, MicOff, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  onStructured?: (data: { title: string; description: string; category: string; priority: string }) => void;
  language?: string;
  disabled?: boolean;
}

const LANG_OPTIONS = [
  { code: "en", label: "English", bcp: "en-US" },
  { code: "hi", label: "हिन्दी", bcp: "hi-IN" },
  { code: "mr", label: "मराठी", bcp: "mr-IN" },
  { code: "ta", label: "தமிழ்", bcp: "ta-IN" },
  { code: "bn", label: "বাংলা", bcp: "bn-IN" },
  { code: "te", label: "తెలుగు", bcp: "te-IN" },
  { code: "gu", label: "ગુજરાતી", bcp: "gu-IN" },
  { code: "pa", label: "ਪੰਜਾਬੀ", bcp: "pa-IN" },
];

const VoiceInput = ({ onTranscript, onStructured, language = "en", disabled }: VoiceInputProps) => {
  const tx = useUiText();
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedLang, setSelectedLang] = useState(language);
  const [showLangPicker, setShowLangPicker] = useState(false);
  useEffect(() => { setSelectedLang(language); }, [language]);
  const recognitionRef = useRef<any>(null);

  const processWithAI = async (rawText: string) => {
    if (!onStructured || selectedLang === "en") {
      onTranscript(rawText);
      return;
    }
    setIsProcessing(true);
    try {
      const { data, error } = await invokeFunction("voice-transcribe", {
        body: { text: rawText, sourceLanguage: selectedLang },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      onStructured(data);
      toast.success(tx("Voice processed & translated to English ✨"));
    } catch (e: any) {
      console.error("Voice AI error:", e);
      toast.error(e.message || "Could not process voice. Using raw text.");
      onTranscript(rawText);
    } finally {
      setIsProcessing(false);
    }
  };

  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error(tx("Speech recognition not supported in your browser."));
      return;
    }
    const langConfig = LANG_OPTIONS.find(l => l.code === selectedLang) || LANG_OPTIONS[0];
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = langConfig.bcp;

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setIsListening(false);
      processWithAI(transcript);
    };
    recognition.onerror = (e: any) => {
      console.error("Speech error:", e);
      setIsListening(false);
      toast.error(tx("Voice recognition failed. Try again."));
    };
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
  }, [selectedLang, onTranscript, onStructured]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const currentLang = LANG_OPTIONS.find(l => l.code === selectedLang) || LANG_OPTIONS[0];

  return (
    <div className="relative inline-flex items-center gap-1">
      <button
        type="button"
        onClick={isListening ? stopListening : startListening}
        disabled={disabled || isProcessing}
        className={`rounded-xl px-3 py-3 transition-colors disabled:opacity-50 ${
          isListening
            ? "bg-destructive text-destructive-foreground animate-pulse"
            : isProcessing
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
        }`}
        title={isListening ? tx("Stop recording") : `${tx("Voice")}: ${currentLang.label}`}
      >
        {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> :
          isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
      </button>

      <button
        type="button"
        onClick={() => setShowLangPicker(v => !v)}
        disabled={disabled}
        className="text-[10px] font-bold px-2 py-1 rounded-md bg-muted/50 hover:bg-muted text-muted-foreground border border-border"
        title={tx("Change language")}
      >
        {tx(currentLang.label)}
      </button>

      {showLangPicker && (
        <div className="absolute top-full mt-2 right-0 z-50 bg-popover border border-border rounded-lg shadow-lg p-1 min-w-[140px]">
          {LANG_OPTIONS.map(lang => (
            <button
              key={lang.code}
              type="button"
              onClick={() => { setSelectedLang(lang.code); setShowLangPicker(false); }}
              className={`w-full text-left px-2 py-1.5 text-xs rounded hover:bg-muted flex items-center gap-2 ${
                selectedLang === lang.code ? "bg-primary/10 text-primary font-semibold" : "text-foreground"
              }`}
            >
              {selectedLang !== "en" && lang.code !== "en" && <Sparkles className="w-3 h-3" />}
              {tx(lang.label)}
            </button>
          ))}
          <div className="text-[9px] text-muted-foreground px-2 py-1 border-t border-border mt-1">
            {tx(" Non-English uses AI translation ✨ ")}</div>
        </div>
      )}
    </div>
  );
};

export default VoiceInput;
