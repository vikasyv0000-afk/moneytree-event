import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

function fmt(n: number | null | undefined) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n ?? 0);
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: events = [] } = useQuery({
    queryKey: ["events-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*");
      if (error) throw error;
      return data;
    },
  });

  const totalNetSales = events.reduce((s, e) => s + (e.net_sales ?? 0), 0);
  const totalRevenue = events.reduce((s, e) => s + (e.total_revenue ?? 0), 0);
  const totalExpenses = events.reduce((s, e) => s + (e.total_expenses ?? 0), 0);
  const totalPaid = events.reduce((s, e) => s + (e.total_paid ?? 0), 0);
  const totalOutstanding = events.reduce((s, e) => s + (e.outstanding ?? 0), 0);
  const ebitda = events.reduce((s, e) => s + (e.ebitda ?? 0), 0);
  const activeEvents = events.filter((e) => e.status === "active").length;
  const lockedEvents = events.filter((e) => e.status === "locked").length;

  const kpis = [
    { label: "Total Revenue", value: fmt(totalRevenue), icon: DollarSign, colorClass: "text-success", bgClass: "bg-success/10", filter: "" },
    { label: "Total Costs", value: fmt(totalExpenses), icon: TrendingDown, colorClass: "text-destructive", bgClass: "bg-destructive/10", filter: "" },
    { label: "EBITDA", value: fmt(ebitda), icon: TrendingUp, colorClass: ebitda >= 0 ? "text-success" : "text-destructive", bgClass: ebitda >= 0 ? "bg-success/10" : "bg-destructive/10", filter: "" },
    { label: "Outstanding", value: fmt(totalOutstanding), icon: Clock, colorClass: "text-warning", bgClass: "bg-warning/10", filter: "outstanding" },
    { label: "Paid", value: fmt(totalPaid), icon: CheckCircle, colorClass: "text-success", bgClass: "bg-success/10", filter: "paid" },
    { label: "Active / Locked", value: `${activeEvents} / ${lockedEvents}`, icon: AlertCircle, colorClass: "text-primary", bgClass: "bg-primary/10", filter: "status" },
  ];

  return (
    <div className="space-y-8 waffle-pattern min-h-full">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">BWC Event Management</h1>
        <p className="text-sm font-medium text-muted-foreground mt-1">Real-time event P&L overview</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <Card
              className={`rounded-2xl border-0 shadow-md transition-all duration-200 ${kpi.filter ? "cursor-pointer hover:shadow-lg hover:-translate-y-0.5" : ""}`}
              onClick={() => kpi.filter && navigate(`/events?filter=${kpi.filter}`)}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-bold text-muted-foreground">{kpi.label}</CardTitle>
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${kpi.bgClass}`}>
                  <kpi.icon className={`h-4 w-4 ${kpi.colorClass}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className={`font-mono text-2xl font-bold ${kpi.colorClass}`}>{kpi.value}</div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Recent Events Table */}
      <Card className="rounded-2xl border-0 shadow-md overflow-hidden">
        <CardHeader className="bg-primary/5">
          <CardTitle className="text-sm font-bold text-foreground">Recent Events</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left">
                  <th className="px-6 py-3.5 font-bold text-muted-foreground text-xs uppercase tracking-wider">Event</th>
                  <th className="px-6 py-3.5 font-bold text-muted-foreground text-xs uppercase tracking-wider">Client</th>
                  <th className="px-6 py-3.5 font-bold text-muted-foreground text-xs uppercase tracking-wider text-right">Revenue</th>
                  <th className="px-6 py-3.5 font-bold text-muted-foreground text-xs uppercase tracking-wider text-right">Profit</th>
                  <th className="px-6 py-3.5 font-bold text-muted-foreground text-xs uppercase tracking-wider text-right">Outstanding</th>
                  <th className="px-6 py-3.5 font-bold text-muted-foreground text-xs uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {events.slice(0, 10).map((e) => (
                  <tr key={e.id} className="border-b border-border/40 last:border-0 transition-colors hover:bg-primary/5">
                    <td className="px-6 py-3.5 font-semibold text-foreground">{e.event_name}</td>
                    <td className="px-6 py-3.5 text-muted-foreground">{e.client_name}</td>
                    <td className="px-6 py-3.5 text-right font-mono font-semibold">{fmt(e.total_revenue)}</td>
                    <td className={`px-6 py-3.5 text-right font-mono font-semibold ${(e.profit ?? 0) >= 0 ? "text-success" : "text-destructive"}`}>{fmt(e.profit)}</td>
                    <td className="px-6 py-3.5 text-right font-mono font-semibold text-warning">{fmt(e.outstanding)}</td>
                    <td className="px-6 py-3.5">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                        e.status === "locked"
                          ? "bg-amber-800/15 text-amber-800"
                          : e.status === "cancelled"
                            ? "bg-destructive/10 text-destructive"
                            : e.status === "active"
                              ? "bg-success/15 text-success"
                              : "bg-muted text-muted-foreground"
                      }`}>
                        {e.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {events.length === 0 && (
                  <tr><td colSpan={6} className="py-12 text-center text-muted-foreground font-medium">No events yet. Create your first event.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
