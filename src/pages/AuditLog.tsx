import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Navigate } from "react-router-dom";

export default function AuditLog() {
  const { isSuperAdmin } = useAuth();

  const { data: logs = [] } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: isSuperAdmin,
  });

  if (!isSuperAdmin) return <Navigate to="/" replace />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
        <p className="text-sm text-muted-foreground">Track all changes across the system</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Recent Activity</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Time</th>
                  <th className="pb-2 font-medium">Action</th>
                  <th className="pb-2 font-medium">Table</th>
                  <th className="pb-2 font-medium">Record</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b last:border-0">
                    <td className="py-2 font-mono text-xs text-muted-foreground">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="py-2">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                        log.action === "INSERT" ? "bg-primary/10 text-primary" : log.action === "DELETE" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2 font-mono text-xs">{log.table_name}</td>
                    <td className="py-2 font-mono text-xs text-muted-foreground">{log.record_id?.slice(0, 8)}...</td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">No audit logs yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
