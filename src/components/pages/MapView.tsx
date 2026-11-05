import { useState, useRef, useEffect, useMemo } from "react";
import Layout from "@/components/Layout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { motion } from "framer-motion";
import { MapPin, Filter, Layers, BarChart3 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { CATEGORY_CONFIG, ComplaintCategory } from "@/lib/types";

const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  "in-progress": "#3b82f6",
  resolved: "#22c55e",
  escalated: "#ef4444",
};

const CATEGORY_COLORS: Record<string, string> = {
  garbage: "#f59e0b",
  waterlogging: "#3b82f6",
  "broken-road": "#ef4444",
  theft: "#dc2626",
  fire: "#ef4444",
  streetlight: "#f59e0b",
  drainage: "#3b82f6",
  encroachment: "#6b7280",
  noise: "#6b7280",
  other: "#6b7280",
};

const createIcon = (status: string) =>
  L.divIcon({
    className: "custom-marker",
    html: `<div style="width:28px;height:28px;border-radius:50%;background:${STATUS_COLORS[status] || "#888"};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
      <div style="width:8px;height:8px;border-radius:50%;background:white;opacity:0.8;"></div>
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });

const INDIA_CENTER: [number, number] = [22.5, 78.9];
const INDIA_ZOOM = 5;

type ViewMode = "markers" | "heatmap" | "clusters";

const MapView = () => {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("clusters");
  const [showAreaStats, setShowAreaStats] = useState(false);
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const clusterRef = useRef<any>(null);
  const heatLayerRef = useRef<any>(null);
  const { t } = useLanguage();

  const { data: complaints = [] } = useQuery({
    queryKey: ["map-complaints"],
    queryFn: async () => {
      const { data } = await supabase
        .from("complaints")
        .select("id, title, description, category, status, location, latitude, longitude, created_at, priority, upvotes, complaint_id")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    let result = complaints;
    if (statusFilter !== "all") result = result.filter((c: any) => c.status === statusFilter);
    if (categoryFilter !== "all") result = result.filter((c: any) => c.category === categoryFilter);
    return result;
  }, [complaints, statusFilter, categoryFilter]);

  const mappable = useMemo(() => {
    return filtered
      .map((c: any) => {
        let lat = typeof c.latitude === "number" ? c.latitude : parseFloat(String(c.latitude));
        let lng = typeof c.longitude === "number" ? c.longitude : parseFloat(String(c.longitude));
        if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && c.location) {
          const nums = String(c.location).match(/-?\d+(?:\.\d+)?/g);
          if (nums && nums.length >= 2) {
            const pLat = parseFloat(nums[0]);
            const pLng = parseFloat(nums[1]);
            if (pLat >= -90 && pLat <= 90 && pLng >= -180 && pLng <= 180) {
              lat = pLat;
              lng = pLng;
            }
          }
        }
        return { ...c, latitude: lat, longitude: lng };
      })
      .filter(
        (c: any) =>
          Number.isFinite(c.latitude) && Number.isFinite(c.longitude) &&
          c.latitude >= -90 && c.latitude <= 90 &&
          c.longitude >= -180 && c.longitude <= 180
      );
  }, [filtered]);

  // Area stats based on visible complaints
  const areaStats = useMemo(() => {
    const catCount: Record<string, number> = {};
    const statusCount: Record<string, number> = {};
    mappable.forEach((c: any) => {
      catCount[c.category] = (catCount[c.category] || 0) + 1;
      statusCount[c.status] = (statusCount[c.status] || 0) + 1;
    });
    return { catCount, statusCount, total: mappable.length };
  }, [mappable]);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    mapRef.current = L.map(mapContainerRef.current).setView(INDIA_CENTER, INDIA_ZOOM);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>',
    }).addTo(mapRef.current);
    markersRef.current = L.layerGroup().addTo(mapRef.current);
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Update layers based on viewMode
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear all layers
    if (markersRef.current) markersRef.current.clearLayers();
    if (clusterRef.current) {
      mapRef.current.removeLayer(clusterRef.current);
      clusterRef.current = null;
    }
    if (heatLayerRef.current) {
      mapRef.current.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }

    if (mappable.length === 0) return;

    if (viewMode === "heatmap") {
      const heatData = mappable.map((c: any) => [Number(c.latitude), Number(c.longitude), 1]);
      heatLayerRef.current = (L as any)
        .heatLayer(heatData, {
          radius: 30,
          blur: 20,
          maxZoom: 12,
          max: 5,
          gradient: { 0.2: "#22c55e", 0.4: "#f59e0b", 0.6: "#f97316", 0.8: "#ef4444", 1.0: "#dc2626" },
        })
        .addTo(mapRef.current);
    } else if (viewMode === "clusters") {
      clusterRef.current = (L as any).markerClusterGroup({
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        iconCreateFunction: (cluster: { getChildCount: () => number }) => {
          const count = cluster.getChildCount();
          let size = "small";
          let dim = 36;
          if (count >= 10) { size = "medium"; dim = 44; }
          if (count >= 50) { size = "large"; dim = 52; }
          return L.divIcon({
            html: `<div style="width:${dim}px;height:${dim}px;border-radius:50%;background:hsl(var(--primary));color:white;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:${dim > 44 ? 16 : 13}px;border:3px solid white;box-shadow:0 3px 12px rgba(0,0,0,0.3);">${count}</div>`,
            className: `marker-cluster marker-cluster-${size}`,
            iconSize: L.point(dim, dim),
          });
        },
      });

      mappable.forEach((c: any) => {
        const marker = L.marker([Number(c.latitude), Number(c.longitude)], { icon: createIcon(c.status) });
        marker.bindPopup(
          `<div style="min-width:220px;font-family:system-ui,sans-serif">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
              <span style="font-size:10px;font-family:monospace;color:#888">#${c.complaint_id}</span>
              <span style="font-size:10px;padding:1px 6px;border-radius:10px;color:white;background:${STATUS_COLORS[c.status] || "#888"}">${c.status}</span>
            </div>
            <h3 style="font-weight:700;font-size:14px;margin:0 0 4px;color:#111">${c.title}</h3>
            <p style="font-size:12px;color:#666;margin:0 0 8px;line-height:1.4">${(c.description || "").slice(0, 120)}${(c.description || "").length > 120 ? "..." : ""}</p>
            <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px">
              <span style="font-size:10px;padding:2px 8px;border:1px solid ${CATEGORY_COLORS[c.category] || "#ddd"};border-radius:10px;color:${CATEGORY_COLORS[c.category] || "#666"}">${c.category}</span>
              <span style="font-size:10px;padding:2px 8px;background:#f3f4f6;border-radius:10px">${c.priority} priority</span>
              ${c.upvotes > 0 ? `<span style="font-size:10px;padding:2px 8px;background:#f3f4f6;border-radius:10px">👍 ${c.upvotes}</span>` : ""}
            </div>
            <p style="font-size:10px;color:#999;margin:0">📍 ${c.location}</p>
          </div>`
        );
        clusterRef.current!.addLayer(marker);
      });

      mapRef.current.addLayer(clusterRef.current);
    } else {
      // Plain markers
      mappable.forEach((c: any) => {
        const marker = L.marker([Number(c.latitude), Number(c.longitude)], { icon: createIcon(c.status) });
        marker.bindPopup(
          `<div style="min-width:200px"><h3 style="font-weight:bold;font-size:14px;margin-bottom:4px">${c.title}</h3><p style="font-size:12px;color:#666;margin-bottom:8px">${(c.description || "").slice(0, 100)}</p><div style="display:flex;gap:4px;flex-wrap:wrap"><span style="font-size:10px;padding:2px 6px;border:1px solid #ddd;border-radius:4px">${c.category}</span><span style="font-size:10px;padding:2px 6px;border-radius:4px;color:white;background:${STATUS_COLORS[c.status] || "#888"}">${c.status}</span></div><p style="font-size:10px;color:#999;margin-top:6px">📍 ${c.location}</p></div>`
        );
        markersRef.current!.addLayer(marker);
      });
    }
  }, [mappable, viewMode]);

  // Fit bounds
  useEffect(() => {
    if (!mapRef.current) return;
    if (mappable.length === 0) {
      mapRef.current.setView(INDIA_CENTER, INDIA_ZOOM);
      return;
    }
    const bounds = L.latLngBounds(
      mappable.map((c: any) => [Number(c.latitude), Number(c.longitude)] as [number, number])
    );
    mapRef.current.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
  }, [mappable]);

  return (
    <Layout>
      <div className="container py-6 md:py-10">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="w-6 h-6 text-primary" />
            <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">{t("map.title")}</h1>
          </div>
          <p className="text-muted-foreground mb-5">{t("map.subtitle")}</p>
        </motion.div>

        {/* Controls */}
        <div className="space-y-3 mb-4">
          {/* Status filter */}
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground mr-1">Status:</span>
            {["all", "pending", "in-progress", "resolved", "escalated"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                  statusFilter === s
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                {s === "all" ? t("map.all") : s.charAt(0).toUpperCase() + s.slice(1)}
                {s !== "all" && (
                  <span className="inline-block w-2 h-2 rounded-full ml-1.5" style={{ backgroundColor: STATUS_COLORS[s] }} />
                )}
              </button>
            ))}
          </div>

          {/* Category filter */}
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground mr-1">Category:</span>
            <button
              onClick={() => setCategoryFilter("all")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                categoryFilter === "all"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              All
            </button>
            {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
              <button
                key={key}
                onClick={() => setCategoryFilter(key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                  categoryFilter === key
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                {config.label}
              </button>
            ))}
          </div>

          {/* View mode + area stats toggle */}
          <div className="flex flex-wrap items-center gap-2">
            <Layers className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground mr-1">View:</span>
            {(
              [
                { key: "clusters", label: "Clusters" },
                { key: "markers", label: "Markers" },
                { key: "heatmap", label: "Heatmap" },
              ] as { key: ViewMode; label: string }[]
            ).map((v) => (
              <button
                key={v.key}
                onClick={() => setViewMode(v.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                  viewMode === v.key
                    ? "bg-secondary text-secondary-foreground border-secondary"
                    : "bg-card text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                {v.label}
              </button>
            ))}

            <button
              onClick={() => setShowAreaStats(!showAreaStats)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border flex items-center gap-1.5 ml-auto ${
                showAreaStats
                  ? "bg-info text-info-foreground border-info"
                  : "bg-card text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Area Stats
            </button>
          </div>
        </div>

        {/* Area Stats Panel */}
        {showAreaStats && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 bg-card border border-border rounded-xl p-4"
          >
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              Area Statistics ({areaStats.total} complaints)
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {/* By Category */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">By Category</p>
                <div className="space-y-1.5">
                  {Object.entries(areaStats.catCount)
                    .sort(([, a], [, b]) => b - a)
                    .map(([cat, count]) => (
                      <div key={cat} className="flex items-center gap-2">
                        <div
                          className="h-2 rounded-full"
                          style={{
                            width: `${Math.max(12, (count / areaStats.total) * 100)}%`,
                            backgroundColor: CATEGORY_COLORS[cat] || "#888",
                          }}
                        />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {CATEGORY_CONFIG[cat as ComplaintCategory]?.label || cat} ({count})
                        </span>
                      </div>
                    ))}
                </div>
              </div>
              {/* By Status */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">By Status</p>
                <div className="space-y-1.5">
                  {Object.entries(areaStats.statusCount)
                    .sort(([, a], [, b]) => b - a)
                    .map(([status, count]) => (
                      <div key={status} className="flex items-center gap-2">
                        <div
                          className="h-2 rounded-full"
                          style={{
                            width: `${Math.max(12, (count / areaStats.total) * 100)}%`,
                            backgroundColor: STATUS_COLORS[status] || "#888",
                          }}
                        />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {status.charAt(0).toUpperCase() + status.slice(1)} ({count})
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Map info bar */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">
            {mappable.length} {t("map.complaintsOnMap")}
            {(statusFilter !== "all" || categoryFilter !== "all") && (
              <button
                onClick={() => { setStatusFilter("all"); setCategoryFilter("all"); }}
                className="ml-2 text-primary hover:underline"
              >
                Clear filters
              </button>
            )}
          </span>
          {viewMode === "heatmap" && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>{t("map.low")}</span>
              <div className="flex h-2.5 rounded-full overflow-hidden w-24">
                <div className="flex-1" style={{ background: "#22c55e" }} />
                <div className="flex-1" style={{ background: "#f59e0b" }} />
                <div className="flex-1" style={{ background: "#f97316" }} />
                <div className="flex-1" style={{ background: "#ef4444" }} />
                <div className="flex-1" style={{ background: "#dc2626" }} />
              </div>
              <span>{t("map.high")}</span>
            </div>
          )}
        </div>

        {/* Map */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl overflow-hidden border border-border shadow-card"
          style={{ height: "65vh", minHeight: 400 }}
        >
          <div ref={mapContainerRef} style={{ height: "100%", width: "100%" }} />
        </motion.div>

        {/* Legend */}
        {viewMode !== "heatmap" && (
          <div className="flex flex-wrap gap-4 mt-4 justify-center">
            {Object.entries(STATUS_COLORS).map(([status, color]) => (
              <div key={status} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-3 h-3 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: color }} />
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </div>
            ))}
          </div>
        )}

        {mappable.length === 0 && complaints.length > 0 && (
          <p className="text-center text-muted-foreground mt-6 text-sm">{t("map.noVisible")}</p>
        )}
      </div>
    </Layout>
  );
};

export default MapView;
