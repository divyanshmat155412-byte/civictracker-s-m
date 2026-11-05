import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Asks the backend whether the signed-in account is the Platform Super Admin.
 * The answer comes from the server (internal user ID), never from email or local storage.
 * This only controls what the UI shows — every sensitive action is re-checked in the database.
 */
export const useIsRootAdmin = () => {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["is-root-admin", user?.id],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_main_admin");
      if (error) return false;
      return !!data;
    },
  });
  return { isMainAdmin: !!user && !!data, isLoading: !!user && isLoading };
};
