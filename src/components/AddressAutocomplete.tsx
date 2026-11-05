import { useEffect, useRef, useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { forwardGeocode, type PlaceSuggestion } from "@/lib/forward-geocode";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onPick: (s: PlaceSuggestion) => void;
  placeholder?: string;
  required?: boolean;
}

const AddressAutocomplete = ({ value, onChange, onPick, placeholder, required }: Props) => {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<number | null>(null);
  const lastQueriedRef = useRef<string>("");

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const triggerSearch = (q: string) => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (q.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    debounceRef.current = window.setTimeout(async () => {
      lastQueriedRef.current = q;
      setLoading(true);
      const results = await forwardGeocode(q, controller.signal);
      setLoading(false);
      // Avoid stale results
      if (lastQueriedRef.current === q) {
        setSuggestions(results);
        setOpen(results.length > 0);
      }
    }, 400);
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          value={value}
          required={required}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v);
            triggerSearch(v);
          }}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder || "Search address or area..."}
          className="w-full rounded-lg border border-input bg-card pl-9 pr-9 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
        )}
      </div>
      {open && suggestions.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full max-h-64 overflow-auto rounded-lg border border-border bg-popover shadow-elevated">
          {suggestions.map((s, i) => (
            <li key={`${s.lat},${s.lng},${i}`}>
              <button
                type="button"
                onClick={() => {
                  onPick(s);
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors border-b border-border last:border-0"
              >
                <div className="font-medium text-foreground line-clamp-1">{s.short_name}</div>
                <div className="text-xs text-muted-foreground line-clamp-1">{s.display_name}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AddressAutocomplete;
