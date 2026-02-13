import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

function fmt(n: number | null | undefined) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n ?? 0);
}

export default function Dashboard() {
  const { data: events = [] } = useQuery({
    queryKey: ["events-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*");
      if (error) throw error;
      return data;
    },
  });

  const totalRevenue = events.reduce((s, e) => s + (e.total_revenue ?? 0), 0);
  const totalExpenses = events.reduce((s, e) => s + (e.total_expenses ?? 0), 0);
  const totalPaid = events.reduce((s, e) => s + (e.total_paid ?? 0), 0);
  const totalOutstanding = events.reduce((s, e) => s + (e.outstanding ?? 0), 0);
  const ebitda = totalRevenue - totalExpenses;
  const activeEvents = events.filter((e) => e.status === "active").length;
  const lockedEvents = events.filter((e) => e.status === "locked").length;

  const kpis = [
    { label: "Total Revenue", value: fmt(totalRevenue), icon: DollarSign, color: "text-primary" },
    { label: "Total Costs", value: fmt(totalExpenses), icon: TrendingDown, color: "text-destructive" },
    { label: "EBITDA", value: fmt(ebitda), icon: TrendingUp, color: ebitda >= 0 ? "text-primary" : "text-destructive" },
    { label: "Outstanding", value: fmt(totalOutstanding), icon: Clock, color: "text-warning" },
    { label: "Paid", value: fmt(totalPaid), icon: CheckCircle, color: "text-primary" },
    { label: "Active / Locked", value: `${activeEvents} / ${lockedEvents}`, icon: AlertCircle, color: "text-muted-foreground" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Financial Dashboard</h1>
        <p className="text-sm text-muted-foreground">Real-time event P&L overview</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.label}</CardTitle>
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              </CardHeader>
              <CardContent>
                <div className={`font-mono text-2xl font-bold ${kpi.color}`}>{kpi.value}</div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Recent Events Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Recent Events</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Event</th>
                  <th className="pb-2 font-medium">Client</th>
                  <th className="pb-2 font-medium text-right">Revenue</th>
                  <th className="pb-2 font-medium text-right">Profit</th>
                  <th className="pb-2 font-medium text-right">Outstanding</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {events.slice(0, 10).map((e) => (
                  <tr key={e.id} className="border-b last:border-0">
                    <td className="py-3 font-medium">{e.event_name}</td>
                    <td className="py-3 text-muted-foreground">{e.client_name}</td>
                    <td className="py-3 text-right font-mono">{fmt(e.total_revenue)}</td>
                    <td className={`py-3 text-right font-mono ${(e.profit ?? 0) >= 0 ? "text-primary" : "text-destructive"}`}>{fmt(e.profit)}</td>
                    <td className="py-3 text-right font-mono">{fmt(e.outstanding)}</td>
                    <td className="py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        e.status === "locked" ? "bg-primary/10 text-primary" : e.status === "cancelled" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
                      }`}>
                        {e.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {events.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No events yet. Create your first event.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
