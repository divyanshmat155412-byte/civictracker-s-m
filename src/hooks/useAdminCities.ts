import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useIsRootAdmin } from "@/hooks/useIsRootAdmin";

/**
 * Returns the cities an admin manages.
 * - `null` => Platform Super Admin (all cities)
 * - `string[]` => only those cities
 * - `[]` => not an admin
 */
export const useAdminCities = () => {
  const { user } = useAuth();
  const { isMainAdmin, isLoading: rootLoading } = useIsRootAdmin();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-cities", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role, city, status")
        .eq("user_id", user!.id)
        .in("role", ["admin", "moderator"]);
      return (data || []).filter((r: any) => (r.status ?? "active") === "active");
    },
  });

  if (isMainAdmin) return { cities: null as string[] | null, isAdmin: true, isLoading: false };
  const cities = (data ?? []).map((r: any) => r.city).filter(Boolean) as string[];
  const isAdmin = (data ?? []).some((r: any) => r.role === "admin") && cities.length > 0;
  return { cities: isAdmin ? Array.from(new Set(cities)) : ([] as string[]), isAdmin, isLoading: isLoading || rootLoading };
};
