import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Shows which city / ward / zone the GPS point will be filed under (same logic the server uses). */
export default function WardPreview({ lat, lng, city }: { lat: number | null; lng: number | null; city?: string }) {
  const ok = lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng);
  const { data } = useQuery({
    queryKey: ["locate-point", lat?.toFixed(5), lng?.toFixed(5), city],
    enabled: ok,
    queryFn: async () => {
      const { data } = await supabase.rpc("locate_point", { _lat: lat!, _lng: lng!, _city: city ?? undefined });
      return data?.[0] ?? null;
    },
  });
  if (!ok || !data) return null;
  if (!data.ward_id) {
    return (
      <p className="text-xs mt-2 text-muted-foreground">
        ⚠️ This spot is outside the configured wards. Your complaint will be sent and the city team will confirm the ward.
      </p>
    );
  }
  return (
    <p className="text-xs mt-2 text-foreground">
      🗺️ {data.city} · Ward {data.ward_number} {data.ward_name} · {data.zone}
      <span className="text-muted-foreground">
        {data.method === "nearest_centre" ? " (nearest ward centre — approximate)" : " (inside ward boundary)"}
        {data.is_demo ? " · demo ward data" : ""}
      </span>
    </p>
  );
}
