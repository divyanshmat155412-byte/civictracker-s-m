import { useEffect, useRef, useState } from "react";
import { MapPin, Check, Loader2, Sparkles, ArrowRight, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";

interface Props {
  userId: string;
  initialCity: string | null | undefined;
  onSaved?: (city: string) => void;
}

const DISMISS_KEY = "home_city_onboarding_dismissed";

// Letters (Latin + extended), spaces, hyphens, apostrophes, dots — 2 to 80 chars after trim.
const citySchema = z
  .string()
  .trim()
  .min(2, { message: "City must be at least 2 characters" })
  .max(80, { message: "City must be 80 characters or fewer" })
  .regex(/^[\p{L}][\p{L}\s.'-]*$/u, {
    message: "City can only contain letters, spaces, hyphens, apostrophes, and dots",
  });

const HomeCityCard = ({ userId, initialCity, onSaved }: Props) => {
  const [city, setCity] = useState<string>(initialCity || "");
  const [saving, setSaving] = useState(false);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const isMissing = !(initialCity || "").trim();
  const showOnboarding = isMissing && !dismissed;

  // If the user clears their city later, ensure banner can come back this session.
  useEffect(() => {
    if (!isMissing && typeof window !== "undefined") {
      sessionStorage.removeItem(DISMISS_KEY);
    }
  }, [isMissing]);

  useEffect(() => {
    setCity(initialCity || "");
  }, [initialCity]);

  const focusInput = () => {
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => inputRef.current?.focus(), 300);
  };

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  const save = async () => {
    const parsed = citySchema.safeParse(city);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid city name");
      inputRef.current?.focus();
      return;
    }
    const value = parsed.data;
    setSaving(true);
    const { data, error } = await supabase.rpc("set_my_home_city", { _city: value });
    setSaving(false);
    if (error) {
      const msg = error.message || "";
      if (/letters|2 to 80|required/i.test(msg)) {
        toast.error(msg);
      } else if (error.code === "23514") {
        toast.error("That city name isn't valid. Please use 2–80 letters.");
      } else {
        toast.error("Could not update your city");
      }
      return;
    }
    const saved = (typeof data === "string" ? data : "")?.trim();
    if (saved !== value) {
      toast.error("Could not update your city");
      return;
    }
    toast.success(`Home city set to ${value}`);
    setCity(saved);
    sessionStorage.removeItem(DISMISS_KEY);
    onSaved?.(saved);
  };

  return (
    <>
      {showOnboarding && (
        <div className="mb-4 rounded-xl border-2 border-dashed border-primary/40 bg-gradient-to-br from-primary/10 via-accent/5 to-transparent p-4 sm:p-5 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 relative">
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            className="absolute top-2 right-2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="shrink-0 w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0 pr-6">
            <h3 className="font-semibold text-foreground text-sm sm:text-base">Welcome! Set your home city</h3>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Tell us where you live so your complaints reach the right city admin automatically.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={focusInput}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg gradient-accent text-accent-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                Set home city <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={dismiss}
                className="inline-flex items-center px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      )}
      <Card className="mb-6" ref={cardRef}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" /> Home City
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-2">
            New complaints you submit will be tagged with this city and routed to that city's admin.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              ref={inputRef}
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Enter your city"
              maxLength={80}
              className="flex-1 min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              onClick={save}
              disabled={saving || !city.trim() || city.trim() === (initialCity || "").trim()}
              className="shrink-0 px-4 py-2 rounded-lg gradient-accent text-accent-foreground text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5">
            2–80 characters. Letters, spaces, hyphens, apostrophes, and dots only.
          </p>
        </CardContent>
      </Card>
    </>
  );
};

export default HomeCityCard;
