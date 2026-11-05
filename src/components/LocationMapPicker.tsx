import { useState, useRef, useEffect } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, X } from "lucide-react";

interface LocationMapPickerProps {
  lat: string;
  lng: string;
  onSelect: (lat: string, lng: string) => void;
  onClose: () => void;
}

const INDIA_CENTER: [number, number] = [22.5, 78.9];

const LocationMapPicker = ({ lat, lng, onSelect, onClose }: LocationMapPickerProps) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [selectedLat, setSelectedLat] = useState(lat);
  const [selectedLng, setSelectedLng] = useState(lng);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const initialLat = parseFloat(lat) || INDIA_CENTER[0];
    const initialLng = parseFloat(lng) || INDIA_CENTER[1];
    const initialZoom = lat && lng ? 14 : 5;

    const map = L.map(mapContainerRef.current).setView([initialLat, initialLng], initialZoom);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>',
    }).addTo(map);

    const icon = L.divIcon({
      className: "custom-picker-marker",
      html: `<div style="width:32px;height:32px;border-radius:50%;background:hsl(var(--primary));border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
      </div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    if (lat && lng) {
      markerRef.current = L.marker([initialLat, initialLng], { icon }).addTo(map);
    }

    map.on("click", (e: L.LeafletMouseEvent) => {
      const { lat: clickLat, lng: clickLng } = e.latlng;
      setSelectedLat(clickLat.toFixed(6));
      setSelectedLng(clickLng.toFixed(6));

      if (markerRef.current) {
        markerRef.current.setLatLng([clickLat, clickLng]);
      } else {
        markerRef.current = L.marker([clickLat, clickLng], { icon }).addTo(map);
      }
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConfirm = () => {
    if (selectedLat && selectedLng) {
      onSelect(selectedLat, selectedLng);
    }
  };

  return (
    <div className="w-full max-w-full rounded-xl border border-border overflow-hidden bg-card shadow-card">
      <div className="flex items-center justify-between gap-2 px-2.5 sm:px-3 py-2 bg-muted/50 border-b border-border">
        <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-foreground min-w-0">
          <MapPin className="w-4 h-4 text-primary shrink-0" />
          <span className="truncate">Tap on the map to select location</span>
        </div>
        <button type="button" onClick={onClose} aria-label="Close map picker" className="p-1 rounded-md hover:bg-muted text-muted-foreground shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div ref={mapContainerRef} className="w-full h-[200px] sm:h-[300px]" />
      {selectedLat && selectedLng && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 sm:px-3 py-2 border-t border-border bg-muted/30">
          <span className="text-[10px] sm:text-xs text-muted-foreground font-mono break-all">
            {parseFloat(selectedLat).toFixed(4)}, {parseFloat(selectedLng).toFixed(4)}
          </span>
          <button
            type="button"
            onClick={handleConfirm}
            className="w-full sm:w-auto px-3 sm:px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            Confirm
          </button>
        </div>
      )}
    </div>
  );
};

export default LocationMapPicker;
