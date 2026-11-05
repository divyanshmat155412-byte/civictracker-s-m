import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { isMainAdminEmail } from "@/lib/main-admin";


export const useUserRole = () => {
  const { user } = useAuth();
  const isMainAdmin = isMainAdminEmail(user?.email);

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ["user-roles", user?.id],
    enabled: !!user && !isMainAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      return data?.map((r) => r.role) || [];
    },
  });

  const isAdmin = isMainAdmin || roles.includes("admin");
  const isModerator = isAdmin || roles.includes("moderator");

  return { isAdmin, isModerator, roles, isLoading, isMainAdmin };
};
