import { useEffect, useRef, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
import { Flame, Filter, MapPin } from "lucide-react";
import Layout from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useCities } from "@/hooks/useCities";
import { CATEGORY_CONFIG, ComplaintCategory } from "@/lib/types";

type RangeKey = "24h" | "7d" | "30d" | "all";

const RANGE_HOURS: Record<RangeKey, number | null> = {
  "24h": 24,
  "7d": 24 * 7,
  "30d": 24 * 30,
  all: null,
};

const HeatLayer = ({ points }: { points: [number, number, number][] }) => {
  const { cities: CITIES } = useCities();
  const map = useMap();
  const layerRef = useRef<any>(null);

  useEffect(() => {
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }
    if (points.length === 0) return;
    // @ts-ignore - leaflet.heat extends L
    layerRef.current = L.heatLayer(points, {
      radius: 28,
      blur: 22,
      maxZoom: 17,
      gradient: {
        0.2: "#3b82f6",
        0.4: "#22c55e",
        0.6: "#eab308",
        0.8: "#f97316",
        1.0: "#ef4444",
      },
    }).addTo(map);

    // Fit bounds to all points
    const bounds = L.latLngBounds(points.map((p) => [p[0], p[1]] as [number, number]));
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });

    return () => {
      if (layerRef.current) map.removeLayer(layerRef.current);
    };
  }, [points, map]);

  return null;
};

const Heatmap = () => {
  const [range, setRange] = useState<RangeKey>("7d");
  const [city, setCity] = useState<string>("all");
  const [category, setCategory] = useState<ComplaintCategory | "all">("all");

  const { data: complaints = [], isLoading } = useQuery({
    queryKey: ["heatmap-complaints", range, city, category],
    queryFn: async () => {
      let q = supabase
        .from("complaints")
        .select("id, latitude, longitude, category, city, created_at, location, priority")
        .not("latitude", "is", null)
        .not("longitude", "is", null);

      const hours = RANGE_HOURS[range];
      if (hours) {
        const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
        q = q.gte("created_at", since);
      }
      if (city !== "all") q = q.eq("city", city);
      if (category !== "all") q = q.eq("category", category);

      const { data, error } = await q.limit(2000);
      if (error) throw error;
      return data || [];
    },
  });

  const heatPoints = useMemo<[number, number, number][]>(() => {
    return (complaints as any[])
      .filter((c) => c.latitude != null && c.longitude != null)
      .map((c) => {
        const intensity =
          c.priority === "emergency" ? 1.0 :
          c.priority === "high" ? 0.8 :
          c.priority === "medium" ? 0.5 : 0.3;
        return [c.latitude as number, c.longitude as number, intensity];
      });
  }, [complaints]);

  // Top hotspot areas
  const topAreas = useMemo(() => {
    const counts = new Map<string, number>();
    (complaints as any[]).forEach((c) => {
      const key = (c.location || "Unknown").split(",")[0].trim();
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [complaints]);

  const center: [number, number] = useMemo(() => {
    if (heatPoints.length === 0) return [22.9734, 78.6569]; // India center
    const lat = heatPoints.reduce((s, p) => s + p[0], 0) / heatPoints.length;
    const lng = heatPoints.reduce((s, p) => s + p[1], 0) / heatPoints.length;
    return [lat, lng];
  }, [heatPoints]);

  return (
    <Layout>
      <div className="container py-8 md:py-12">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
              <Flame className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Complaint Heatmap</h1>
              <p className="text-sm text-muted-foreground">Identify civic hotspots over time and across cities</p>
            </div>
          </div>
        </motion.div>

        {/* Filters */}
        <div className="bg-card rounded-xl border border-border p-4 mb-4 shadow-card">
          <div className="flex items-center gap-2 mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <Filter className="w-3.5 h-3.5" /> Filters
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Time range</label>
              <div className="flex gap-1 flex-wrap">
                {(["24h", "7d", "30d", "all"] as RangeKey[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      range === r ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/70"
                    }`}
                  >
                    {r === "24h" ? "Last 24h" : r === "7d" ? "Last 7 days" : r === "30d" ? "Last 30 days" : "All time"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">City</label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">All cities</option>
                {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">All categories</option>
                {Object.entries(CATEGORY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">Hotspots</div>
            <div className="text-2xl font-display font-bold text-foreground">{heatPoints.length}</div>
            <div className="text-xs text-muted-foreground">complaints with location</div>
          </div>
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">Range</div>
            <div className="text-2xl font-display font-bold text-foreground">
              {range === "24h" ? "24h" : range === "7d" ? "7d" : range === "30d" ? "30d" : "All"}
            </div>
            <div className="text-xs text-muted-foreground">{city === "all" ? "All cities" : city}</div>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 col-span-2 md:col-span-1">
            <div className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1 flex items-center gap-1">
              <MapPin className="w-3 h-3" /> Worst area
            </div>
            <div className="text-base font-display font-bold text-foreground truncate">
              {topAreas[0]?.[0] || "—"}
            </div>
            <div className="text-xs text-muted-foreground">{topAreas[0]?.[1] || 0} reports</div>
          </div>
        </div>

        {/* Map */}
        <div className="rounded-xl overflow-hidden border border-border shadow-card mb-4" style={{ height: "60vh", minHeight: 420 }}>
          <MapContainer center={center} zoom={5} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <HeatLayer points={heatPoints} />
          </MapContainer>
        </div>

        {/* Top hotspots list */}
        {topAreas.length > 0 && (
          <div className="bg-card rounded-xl border border-border p-4 shadow-card">
            <h3 className="font-display font-bold text-foreground mb-3 flex items-center gap-2">
              <Flame className="w-4 h-4 text-destructive" /> Top hotspot areas
            </h3>
            <div className="space-y-2">
              {topAreas.map(([area, count], i) => (
                <div key={area} className="flex items-center justify-between p-2 rounded-lg bg-muted/40">
                  <div className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      i === 0 ? "bg-destructive text-destructive-foreground" :
                      i === 1 ? "bg-warning/80 text-warning-foreground" :
                      "bg-muted text-foreground"
                    }`}>{i + 1}</span>
                    <span className="text-sm font-medium text-foreground">{area}</span>
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground">{count} reports</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {isLoading && <p className="text-center text-muted-foreground mt-4 text-sm">Loading hotspots…</p>}
      </div>
    </Layout>
  );
};

export default Heatmap;
