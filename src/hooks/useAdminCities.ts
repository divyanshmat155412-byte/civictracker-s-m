import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { isMainAdminEmail } from "@/lib/main-admin";


/**
 * Returns the cities an admin manages.
 * - `null` => super-admin (all cities)
 * - `string[]` => only those cities
 * - `[]` => not an admin
 */
export const useAdminCities = () => {
  const { user } = useAuth();
  const isMainAdmin = isMainAdminEmail(user?.email);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-cities", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role, city")
        .eq("user_id", user!.id)
        .eq("role", "admin");
      return data || [];
    },
  });

  if (isMainAdmin) return { cities: null as string[] | null, isAdmin: true, isLoading: false };
  if (!data || data.length === 0) return { cities: [] as string[], isAdmin: false, isLoading };

  const cities = data.map((r: any) => r.city).filter(Boolean) as string[];
  // If admin row has no city assigned -> super-admin
  if (cities.length === 0) return { cities: null, isAdmin: true, isLoading };
  return { cities, isAdmin: true, isLoading };
};
