import { useUiText } from "@/hooks/useUiText";
import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Truck, MapPin, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

// Fix default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const workerIcon = L.divIcon({
  className: "",
  html: `<div style="background:hsl(var(--primary));width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);"><svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M3 17h2v2h2v-2h10v2h2v-2h2v-6l-3-3h-3V5H3v12zM7 14h2v2H7v-2zm10 0h2v2h-2v-2z"/></svg></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const targetIcon = L.divIcon({
  className: "",
  html: `<div style="background:hsl(var(--destructive));width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);"><svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

interface Props {
  complaintId: string;
}

const LiveTrackingMap = ({ complaintId }: Props) => {
  const tx = useUiText();
  const [workerLocation, setWorkerLocation] = useState<{ lat: number; lng: number } | null>(null);

  const { data: assignment } = useQuery({
    queryKey: ["assignment", complaintId],
    queryFn: async () => {
      const { data } = await supabase
        .rpc("public_complaint_assignment", { _complaint_id: complaintId })
        .maybeSingle();
      return data;
    },
    refetchInterval: 5000,
  });

  useEffect(() => {
    setWorkerLocation(assignment?.worker_latitude != null && assignment.worker_longitude != null
      ? { lat: assignment.worker_latitude, lng: assignment.worker_longitude } : null);
  }, [assignment?.worker_latitude, assignment?.worker_longitude]);

  if (!assignment) return null;

  const target = assignment;
  if (!target?.latitude || !target?.longitude) {
    return (
      <div className="mt-3 p-3 rounded-lg bg-muted border border-border text-xs text-muted-foreground">
        {tx(" Worker assigned but complaint has no GPS coordinates. ")}</div>
    );
  }

  // Distance calc
  let distanceText = "";
  let etaText = "";
  if (workerLocation) {
    const R = 6371;
    const dLat = (target.latitude - workerLocation.lat) * Math.PI / 180;
    const dLng = (target.longitude - workerLocation.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(workerLocation.lat * Math.PI/180) * Math.cos(target.latitude * Math.PI/180) * Math.sin(dLng/2)**2;
    const km = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    distanceText = km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
    const minutes = Math.max(1, Math.round(km * 3)); // ~20km/h
    etaText = minutes < 60 ? `~${minutes} min` : `~${Math.round(minutes/60)} hr`;
  }

  const center: [number, number] = workerLocation
    ? [(workerLocation.lat + target.latitude) / 2, (workerLocation.lng + target.longitude) / 2]
    : [target.latitude, target.longitude];

  return (
    <div className="mt-3 rounded-xl overflow-hidden border border-border bg-card">
      <div className="px-3 py-2 bg-primary/5 border-b border-border flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-sm">
          <Truck className="w-4 h-4 text-primary" />
          <span className="font-semibold text-foreground">{assignment.worker_name || tx("Worker")}</span>
          <span className="text-xs text-muted-foreground capitalize">{assignment.status.replace("_", " ")}</span>
        </div>
        {workerLocation && (
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-foreground"><MapPin className="w-3 h-3" />{distanceText} {tx(" away")}</span>
            <span className="flex items-center gap-1 text-primary font-semibold"><Clock className="w-3 h-3" />{etaText}</span>
          </div>
        )}
      </div>
      <div className="h-56">
        <MapContainer center={center} zoom={14} className="w-full h-full" scrollWheelZoom={false}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OSM" />
          <Marker position={[target.latitude, target.longitude]} icon={targetIcon}>
            <Popup>{tx("Complaint location")}<br/>{target.location}</Popup>
          </Marker>
          {workerLocation && (
            <>
              <Marker position={[workerLocation.lat, workerLocation.lng]} icon={workerIcon}>
                <Popup>{assignment.worker_name || tx("Worker")} {tx(" en route")}</Popup>
              </Marker>
              <Polyline
                positions={[[workerLocation.lat, workerLocation.lng], [target.latitude, target.longitude]]}
                pathOptions={{ color: "hsl(var(--primary))", dashArray: "8,8", weight: 3 }}
              />
            </>
          )}
        </MapContainer>
      </div>
    </div>
  );
};

export default LiveTrackingMap;
