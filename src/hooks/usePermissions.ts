import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const PERMISSION_BULK_UPDATE = "bulk_update_events";

export function usePermissions() {
  const { user, isSuperAdmin, loading } = useAuth();

  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ["user-permissions", user?.id],
    queryFn: async () => {
      if (!user) return [] as string[];
      const { data, error } = await supabase
        .from("user_permissions")
        .select("permission")
        .eq("user_id", user.id);
      if (error) throw error;
      return (data ?? []).map((p) => p.permission);
    },
    enabled: !!user,
  });

  const hasPermission = (permission: string) => isSuperAdmin || permissions.includes(permission);

  return { permissions, hasPermission, loading: loading || isLoading };
}
