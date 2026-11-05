import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useIsRootAdmin } from "@/hooks/useIsRootAdmin";

export const useUserRole = () => {
  const { user } = useAuth();
  const { isMainAdmin, isLoading: rootLoading } = useIsRootAdmin();

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ["user-roles", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role, status")
        .eq("user_id", user!.id);
      return (data ?? []).filter((r: any) => (r.status ?? "active") === "active").map((r) => r.role);
    },
  });

  const isAdmin = isMainAdmin || roles.includes("admin");
  const isModerator = isAdmin || roles.includes("moderator");

  return { isAdmin, isModerator, roles, isLoading: isLoading || rootLoading, isMainAdmin };
};
