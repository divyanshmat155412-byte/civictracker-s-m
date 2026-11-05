import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CITIES } from "@/lib/cities";

export type CityProfile = {
  id: string; name: string; state: string | null; municipal_body: string | null;
  center_lat: number | null; center_lng: number | null; contact_email: string | null; is_active: boolean;
};

/** Built-in cities + every active city onboarded by the Super Admin (no code change needed). */
export const useCities = () => {
  const { data: profiles = [] } = useQuery({
    queryKey: ["cities"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("cities").select("*").order("name");
      return (data ?? []) as CityProfile[];
    },
  });
  const inactive = new Set(profiles.filter((p) => !p.is_active).map((p) => p.name.toLowerCase()));
  const names = Array.from(new Set<string>([
    ...CITIES,
    ...profiles.filter((p) => p.is_active).map((p) => p.name),
  ])).filter((n) => !inactive.has(n.toLowerCase()) || (CITIES as readonly string[]).includes(n));
  return { cities: names, profiles };
};
