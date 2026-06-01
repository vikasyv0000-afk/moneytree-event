import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { format, startOfMonth, endOfMonth, subMonths, parseISO, isAfter, isBefore, isEqual } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { TrendingUp, TrendingDown, DollarSign, Wallet, Clock, AlertTriangle, CheckCircle, Lock, Activity, Percent, Users as UsersIcon, CalendarIcon, RotateCcw, Trophy, ThumbsDown } from "lucide-react";
import { motion } from "framer-motion";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { normalizeEventFinancials } from "@/lib/event-financials";
import { cn } from "@/lib/utils";

const STANDARD_CATEGORIES = ["Corporate", "College/School", "Society", "Wedding", "Others"];

function fmt(n: number | null | undefined) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n ?? 0);
}
function pct(n: number) {
  return `${(Math.round(n * 10) / 10).toFixed(1)}%`;
}

type DatePreset = "this_month" | "prev_month" | "fy" | "custom" | "open_month";

function resolveDateRange(
  preset: DatePreset,
  customFrom?: string,
  customTo?: string,
  openMonth?: string,
): { from?: Date; to?: Date } {
  const now = new Date();
  if (preset === "this_month") return { from: startOfMonth(now), to: endOfMonth(now) };
  if (preset === "prev_month") {
    const prev = subMonths(now, 1);
    return { from: startOfMonth(prev), to: endOfMonth(prev) };
  }
  if (preset === "fy") {
    // Indian FY: April → March
    const month = now.getMonth();
    const fyStartYear = month >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    return { from: new Date(fyStartYear, 3, 1), to: new Date(fyStartYear + 1, 2, 31) };
  }
  if (preset === "open_month" && openMonth) {
    const [y, m] = openMonth.split("-").map(Number);
    if (y && m) {
      const d = new Date(y, m - 1, 1);
      return { from: startOfMonth(d), to: endOfMonth(d) };
    }
  }
  if (preset === "custom") {
    return {
      from: customFrom ? parseISO(customFrom) : undefined,
      to: customTo ? parseISO(customTo) : undefined,
    };
  }
  return {};
}

function bucketCategory(cat: string | null | undefined): string {
  if (!cat) return "Others";
  const c = cat.toLowerCase();
  if (c.includes("corporate")) return "Corporate";
  if (c.includes("college") || c.includes("school")) return "College/School";
  if (c.includes("society")) return "Society";
  if (c.includes("wedding")) return "Wedding";
  return "Others";
}

export default function MisDashboard() {
  const [params, setParams] = useSearchParams();

  const preset = (params.get("preset") as DatePreset) || "fy";
  const customFrom = params.get("from") || "";
  const customTo = params.get("to") || "";
  const openMonth = params.get("month") || format(new Date(), "yyyy-MM");
  const fZone = params.get("zone") || "";
  const fState = params.get("state") || "";
  const fCity = params.get("city") || "";
  const fCategory = params.get("category") || "";
  const fClient = params.get("client") || "";
  const fSpoc = params.get("spoc") || "";

  const setParam = (key: string, val: string) => {
    const next = new URLSearchParams(params);
    if (val) next.set(key, val);
    else next.delete(key);
    setParams(next, { replace: true });
  };
  const resetAll = () => setParams(new URLSearchParams(), { replace: true });

  const dateRange = useMemo(
    () => resolveDateRange(preset, customFrom, customTo, openMonth),
    [preset, customFrom, customTo, openMonth],
  );

  // Server-side filtered fetch (uses indexed columns where possible)
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["mis-events", preset, customFrom, customTo, openMonth, fZone, fState, fCity, fCategory, fClient, fSpoc],
    queryFn: async () => {
      let q = supabase.from("events").select("*");
      if (dateRange.from) q = q.gte("event_date", format(dateRange.from, "yyyy-MM-dd"));
      if (dateRange.to) q = q.lte("event_date", format(dateRange.to, "yyyy-MM-dd"));
      if (fZone) q = q.eq("zone", fZone);
      if (fState) q = q.eq("state", fState);
      if (fCity) q = q.eq("city", fCity);
      if (fCategory) q = q.eq("category", fCategory);
      if (fClient) q = q.eq("client_name", fClient);
      if (fSpoc) q = q.eq("spoc", fSpoc);
      const { data, error } = await q.order("event_date", { ascending: false }).limit(5000);
      if (error) throw error;
      // Single source of truth: same normalize used everywhere
      return (data ?? []).map((e) => normalizeEventFinancials(e));
    },
    staleTime: 30_000,
  });

  // Unfiltered list for filter options (small, cached)
  const { data: allEvents = [] } = useQuery({
    queryKey: ["mis-filter-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("zone,state,city,category,client_name,spoc")
        .limit(5000);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });

  const filterOptions = useMemo(() => {
    const u = (key: keyof (typeof allEvents)[number]) =>
      Array.from(new Set(allEvents.map((e) => (e as any)[key]).filter(Boolean))).sort();
    return {
      zones: u("zone"),
      states: u("state"),
      cities: u("city"),
      categories: u("category"),
      clients: u("client_name"),
      spocs: u("spoc"),
    };
  }, [allEvents]);

  // ---- Aggregations (single source = normalizeEventFinancials) ----
  const agg = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in7 = new Date(today);
    in7.setDate(in7.getDate() + 7);

    let netSales = 0,
      totalRevenue = 0,
      totalCost = 0,
      ebitda = 0,
      received = 0,
      outstanding = 0,
      manpower = 0,
      logistics = 0;
    let active = 0,
      locked = 0,
      fullPaid = 0,
      lossMaking = 0;
    let overdueAmt = 0;
    const overdueClients = new Set<string>();
    const outstandingClients = new Set<string>();

    for (const e of events) {
      netSales += e.net_sales ?? 0;
      totalRevenue += e.total_revenue ?? 0;
      totalCost += e.total_expenses ?? 0;
      ebitda += e.ebitda ?? 0;
      received += e.total_paid ?? 0;
      outstanding += e.outstanding ?? 0;
      manpower += e.manpower_cost ?? 0;
      logistics += e.logistic_expense ?? 0;
      if (e.status === "active") active++;
      if (e.status === "locked") locked++;
      if (e.full_payment_received) fullPaid++;
      if ((e.ebitda ?? 0) < 0) lossMaking++;
      if ((e.outstanding ?? 0) > 0) {
        outstandingClients.add(e.client_name ?? "");
        const due = (e as any).expected_payment_date ? parseISO((e as any).expected_payment_date) : null;
        if (due && isBefore(due, today)) {
          overdueAmt += e.outstanding ?? 0;
          overdueClients.add(e.client_name ?? "");
        }
      }
    }

    const ebitdaPct = netSales > 0 ? (ebitda / netSales) * 100 : 0;
    const collectionPct = totalRevenue > 0 ? (received / totalRevenue) * 100 : 0;
    const costPct = netSales > 0 ? (totalCost / netSales) * 100 : 0;
    const outstandingPct = totalRevenue > 0 ? (outstanding / totalRevenue) * 100 : 0;
    const manpowerPct = totalRevenue > 0 ? (manpower / totalRevenue) * 100 : 0;
    const logisticsPct = totalRevenue > 0 ? (logistics / totalRevenue) * 100 : 0;

    return {
      netSales,
      totalRevenue,
      totalCost,
      ebitda,
      ebitdaPct,
      received,
      outstanding,
      collectionPct,
      costPct,
      outstandingPct,
      manpower,
      manpowerPct,
      logistics,
      logisticsPct,
      active,
      locked,
      fullPaid,
      lossMaking,
      overdueAmt,
      overdueClients: overdueClients.size,
      outstandingClients: outstandingClients.size,
      eventCount: events.length,
    };
  }, [events]);

  // ---- Monthly trend (Revenue / Cost / EBITDA) ----
  const trend = useMemo(() => {
    const map = new Map<string, { key: string; label: string; revenue: number; cost: number; ebitda: number }>();
    for (const e of events) {
      if (!e.event_date) continue;
      const d = parseISO(e.event_date as unknown as string);
      const key = format(d, "yyyy-MM");
      const label = format(d, "MMM yy");
      const row = map.get(key) ?? { key, label, revenue: 0, cost: 0, ebitda: 0 };
      row.revenue += e.total_revenue ?? 0;
      row.cost += e.total_expenses ?? 0;
      row.ebitda += e.ebitda ?? 0;
      map.set(key, row);
    }
    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [events]);

  // ---- Zone breakdown ----
  const zoneRows = useMemo(() => {
    const map = new Map<string, { zone: string; events: number; revenue: number; cost: number; ebitda: number; outstanding: number }>();
    for (const e of events) {
      const zone = e.zone || "Unassigned";
      const row = map.get(zone) ?? { zone, events: 0, revenue: 0, cost: 0, ebitda: 0, outstanding: 0 };
      row.events++;
      row.revenue += e.total_revenue ?? 0;
      row.cost += e.total_expenses ?? 0;
      row.ebitda += e.ebitda ?? 0;
      row.outstanding += e.outstanding ?? 0;
      map.set(zone, row);
    }
    return Array.from(map.values())
      .map((r) => ({ ...r, ebitdaPct: r.revenue > 0 ? (r.ebitda / r.revenue) * 100 : 0 }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [events]);

  const zoneHighlights = useMemo(() => {
    if (zoneRows.length === 0) return { best: null, worst: null, highestOutstanding: null };
    const sortedEbitda = [...zoneRows].sort((a, b) => b.ebitda - a.ebitda);
    const sortedOutstanding = [...zoneRows].sort((a, b) => b.outstanding - a.outstanding);
    return {
      best: sortedEbitda[0],
      worst: sortedEbitda[sortedEbitda.length - 1],
      highestOutstanding: sortedOutstanding[0],
    };
  }, [zoneRows]);

  // ---- Category breakdown (bucketed into 5 standard buckets) ----
  const categoryRows = useMemo(() => {
    const map = new Map<string, { category: string; events: number; revenue: number; ebitda: number; outstanding: number }>();
    for (const cat of STANDARD_CATEGORIES) map.set(cat, { category: cat, events: 0, revenue: 0, ebitda: 0, outstanding: 0 });
    for (const e of events) {
      const cat = bucketCategory(e.category);
      const row = map.get(cat)!;
      row.events++;
      row.revenue += e.total_revenue ?? 0;
      row.ebitda += e.ebitda ?? 0;
      row.outstanding += e.outstanding ?? 0;
    }
    return Array.from(map.values()).map((r) => ({ ...r, ebitdaPct: r.revenue > 0 ? (r.ebitda / r.revenue) * 100 : 0 }));
  }, [events]);

  const CATEGORY_COLORS = ["hsl(var(--primary))", "hsl(var(--success))", "hsl(var(--warning))", "hsl(var(--destructive))", "hsl(var(--muted-foreground))"];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">MIS Dashboard</h1>
          <p className="text-sm font-medium text-muted-foreground mt-1">
            CFO / Management view • {agg.eventCount} event{agg.eventCount === 1 ? "" : "s"} in selection
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={resetAll}>
          <RotateCcw className="mr-2 h-3.5 w-3.5" /> Reset Filters
        </Button>
      </div>

      {/* ===== Global Filter Bar ===== */}
      <Card className="rounded-2xl border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Date Range</Label>
              <Select value={preset} onValueChange={(v) => setParam("preset", v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="this_month">Current Month</SelectItem>
                  <SelectItem value="prev_month">Previous Month</SelectItem>
                  <SelectItem value="fy">Financial Year</SelectItem>
                  <SelectItem value="open_month">Open Month</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {preset === "open_month" && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Month</Label>
                <Input type="month" value={openMonth} onChange={(e) => setParam("month", e.target.value)} className="h-9 text-sm" />
              </div>
            )}

            {preset === "custom" && (
              <>
                <DateInput label="From" value={customFrom} onChange={(v) => setParam("from", v)} />
                <DateInput label="To" value={customTo} onChange={(v) => setParam("to", v)} />
              </>
            )}

            <FilterSelect label="Zone" value={fZone} onChange={(v) => setParam("zone", v)} options={filterOptions.zones} />
            <FilterSelect label="State" value={fState} onChange={(v) => setParam("state", v)} options={filterOptions.states} />
            <FilterSelect label="City" value={fCity} onChange={(v) => setParam("city", v)} options={filterOptions.cities} />
            <FilterSelect label="Category" value={fCategory} onChange={(v) => setParam("category", v)} options={filterOptions.categories} />
            <FilterSelect label="Client" value={fClient} onChange={(v) => setParam("client", v)} options={filterOptions.clients} />
            <FilterSelect label="SPOC" value={fSpoc} onChange={(v) => setParam("spoc", v)} options={filterOptions.spocs} />
          </div>
        </CardContent>
      </Card>

      {/* ===== Section: Collection Dashboard (top priority) ===== */}
      <SectionHeader title="Collection Dashboard" subtitle="Daily monitoring — collections drive cash flow" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Total Sales" value={fmt(agg.totalRevenue)} icon={DollarSign} tone="default" />
        <Kpi label="Total Received" value={fmt(agg.received)} icon={CheckCircle} tone="success" />
        <Kpi label="Outstanding" value={fmt(agg.outstanding)} icon={Clock} tone="warning" />
        <Kpi label="Collection %" value={pct(agg.collectionPct)} icon={Percent} tone={agg.collectionPct >= 80 ? "success" : agg.collectionPct >= 50 ? "warning" : "destructive"} />
        <Kpi label="Overdue Amount" value={fmt(agg.overdueAmt)} icon={AlertTriangle} tone={agg.overdueAmt > 0 ? "destructive" : "success"} />
        <Kpi label="Overdue Clients" value={String(agg.overdueClients)} icon={UsersIcon} tone={agg.overdueClients > 0 ? "destructive" : "success"} />
      </div>

      {/* ===== Section 1: Executive Summary ===== */}
      <SectionHeader title="Executive Summary" subtitle="MIS standard: EBITDA = Net Sales − Total Cost" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <Kpi label="Total Net Sales" value={fmt(agg.netSales)} icon={DollarSign} tone="default" />
        <Kpi label="Total Revenue (incl GST)" value={fmt(agg.totalRevenue)} icon={DollarSign} tone="default" />
        <Kpi label="Total Cost" value={fmt(agg.totalCost)} icon={TrendingDown} tone="destructive" />
        <Kpi label="EBITDA" value={fmt(agg.ebitda)} icon={TrendingUp} tone={agg.ebitda >= 0 ? "success" : "destructive"} />
        <Kpi label="EBITDA %" value={pct(agg.ebitdaPct)} icon={Percent} tone={agg.ebitdaPct >= 20 ? "success" : agg.ebitdaPct >= 0 ? "warning" : "destructive"} />
        <Kpi label="Total Received" value={fmt(agg.received)} icon={Wallet} tone="success" />
        <Kpi label="Outstanding" value={fmt(agg.outstanding)} icon={Clock} tone="warning" />
        <Kpi label="Active / Locked" value={`${agg.active} / ${agg.locked}`} icon={Activity} tone="default" />
      </div>

      {/* ===== Section 11: Financial Ratios ===== */}
      <SectionHeader title="Financial Ratios" subtitle="Derived from the same MIS source of truth" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="EBITDA %" value={pct(agg.ebitdaPct)} icon={Percent} tone={agg.ebitdaPct >= 20 ? "success" : agg.ebitdaPct >= 0 ? "warning" : "destructive"} hint="EBITDA / Net Sales" />
        <Kpi label="Cost to Revenue %" value={pct(agg.costPct)} icon={TrendingDown} tone={agg.costPct <= 70 ? "success" : agg.costPct <= 90 ? "warning" : "destructive"} hint="Total Cost / Net Sales" />
        <Kpi label="Collection %" value={pct(agg.collectionPct)} icon={CheckCircle} tone={agg.collectionPct >= 80 ? "success" : "warning"} hint="Received / Total Sales" />
        <Kpi label="Outstanding %" value={pct(agg.outstandingPct)} icon={Clock} tone={agg.outstandingPct <= 10 ? "success" : agg.outstandingPct <= 25 ? "warning" : "destructive"} hint="Outstanding / Total Sales" />
      </div>

      {/* ===== Section 2: Revenue vs Cost vs EBITDA Trend ===== */}
      <SectionHeader title="Revenue vs Cost vs EBITDA — Monthly Trend" subtitle="Month-wise business trend across the selected period" />
      <Card className="rounded-2xl border-0 shadow-sm">
        <CardContent className="pt-6">
          {trend.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No events in the selected range.</div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={trend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => fmt(v)}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2.5} name="Revenue" dot={{ r: 3 }} />
                <Line type="monotone" dataKey="cost" stroke="hsl(var(--destructive))" strokeWidth={2.5} name="Cost" dot={{ r: 3 }} />
                <Line type="monotone" dataKey="ebitda" stroke="hsl(var(--success))" strokeWidth={2.5} name="EBITDA" dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ===== Section 3: Zone-wise Performance ===== */}
      <SectionHeader title="Zone-wise Performance" subtitle="Compare revenue, cost, profitability and collection by zone" />
      <div className="grid gap-4 sm:grid-cols-3">
        <ZoneHighlightCard label="Best Performing" zone={zoneHighlights.best} icon={Trophy} tone="success" />
        <ZoneHighlightCard label="Worst Performing" zone={zoneHighlights.worst} icon={ThumbsDown} tone="destructive" />
        <ZoneHighlightCard label="Highest Outstanding" zone={zoneHighlights.highestOutstanding} icon={AlertTriangle} tone="warning" metric="outstanding" />
      </div>
      <Card className="rounded-2xl border-0 shadow-sm">
        <CardContent className="pt-6 space-y-6">
          {zoneRows.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No zone data available.</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={zoneRows} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="zone" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => fmt(v)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" name="Revenue" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="cost" fill="hsl(var(--destructive))" name="Cost" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="ebitda" fill="hsl(var(--success))" name="EBITDA" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Zone</TableHead>
                      <TableHead className="text-right">Events</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead className="text-right">EBITDA</TableHead>
                      <TableHead className="text-right">EBITDA %</TableHead>
                      <TableHead className="text-right">Outstanding</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {zoneRows.map((r) => (
                      <TableRow key={r.zone}>
                        <TableCell className="font-semibold">{r.zone}</TableCell>
                        <TableCell className="text-right font-mono">{r.events}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(r.revenue)}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(r.cost)}</TableCell>
                        <TableCell className={cn("text-right font-mono font-semibold", r.ebitda >= 0 ? "text-success" : "text-destructive")}>{fmt(r.ebitda)}</TableCell>
                        <TableCell className={cn("text-right font-mono", r.ebitdaPct >= 0 ? "text-success" : "text-destructive")}>{pct(r.ebitdaPct)}</TableCell>
                        <TableCell className="text-right font-mono text-warning">{fmt(r.outstanding)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ===== Section 4: Category-wise Performance ===== */}
      <SectionHeader title="Category-wise Performance" subtitle="Standard buckets: Corporate, College/School, Society, Wedding, Others" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-muted-foreground">Revenue by Category</CardTitle></CardHeader>
          <CardContent>
            {categoryRows.every((r) => r.revenue === 0) ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No revenue in any category.</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={categoryRows.filter((r) => r.revenue > 0)} dataKey="revenue" nameKey="category" outerRadius={90} label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`}>
                    {categoryRows.filter((r) => r.revenue > 0).map((_, i) => <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-muted-foreground">Breakdown</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Events</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">EBITDA</TableHead>
                  <TableHead className="text-right">EBITDA %</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categoryRows.map((r) => (
                  <TableRow key={r.category}>
                    <TableCell className="font-semibold">{r.category}</TableCell>
                    <TableCell className="text-right font-mono">{r.events}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(r.revenue)}</TableCell>
                    <TableCell className={cn("text-right font-mono", r.ebitda >= 0 ? "text-success" : "text-destructive")}>{fmt(r.ebitda)}</TableCell>
                    <TableCell className={cn("text-right font-mono", r.ebitdaPct >= 0 ? "text-success" : "text-destructive")}>{pct(r.ebitdaPct)}</TableCell>
                    <TableCell className="text-right font-mono text-warning">{fmt(r.outstanding)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* ===== Section 10: Event Health ===== */}
      <SectionHeader title="Event Health" subtitle="Status summary across the selected events" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Active" value={String(agg.active)} icon={Activity} tone="default" />
        <Kpi label="Locked" value={String(agg.locked)} icon={Lock} tone="warning" />
        <Kpi label="Fully Paid" value={String(agg.fullPaid)} icon={CheckCircle} tone="success" />
        <Kpi label="Outstanding" value={String(agg.outstandingClients)} icon={Clock} tone="warning" hint="distinct clients" />
        <Kpi label="Loss Making" value={String(agg.lossMaking)} icon={AlertTriangle} tone="destructive" />
      </div>

      {/* ===== Status footer ===== */}
      <Card className="rounded-2xl border-0 shadow-sm bg-muted/30">
        <CardContent className="p-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><Lock className="h-3 w-3" /> Locked: <strong className="text-foreground">{agg.locked}</strong></span>
          <span className="inline-flex items-center gap-1.5"><CheckCircle className="h-3 w-3" /> Full Paid: <strong className="text-foreground">{agg.fullPaid}</strong></span>
          <span className="inline-flex items-center gap-1.5"><Activity className="h-3 w-3" /> Active: <strong className="text-foreground">{agg.active}</strong></span>
          <span className="inline-flex items-center gap-1.5"><AlertTriangle className="h-3 w-3" /> Loss Making: <strong className="text-foreground">{agg.lossMaking}</strong></span>
          <span className="inline-flex items-center gap-1.5"><UsersIcon className="h-3 w-3" /> Outstanding Clients: <strong className="text-foreground">{agg.outstandingClients}</strong></span>
          {isLoading && <span className="ml-auto animate-pulse">Loading…</span>}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center pt-4">
        Phases 1 & 2 of MIS Dashboard live. Up next: outstanding aging, payment advice, salary & logistics dashboards, profitability tables, and PDF/Excel export.
      </p>
    </div>
  );
}

/* ---------- small presentational components ---------- */

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="pt-2">
      <h2 className="text-lg font-bold text-foreground">{title}</h2>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  tone,
  hint,
}: {
  label: string;
  value: string;
  icon: any;
  tone: "default" | "success" | "warning" | "destructive";
  hint?: string;
}) {
  const toneCls =
    tone === "success"
      ? "text-success bg-success/10"
      : tone === "warning"
        ? "text-warning bg-warning/10"
        : tone === "destructive"
          ? "text-destructive bg-destructive/10"
          : "text-primary bg-primary/10";
  const valueCls =
    tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="rounded-2xl border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{label}</CardTitle>
          <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", toneCls)}>
            <Icon className="h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent>
          <div className={cn("font-mono text-xl font-bold", valueCls)}>{value}</div>
          {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value || "__all__"} onValueChange={(v) => onChange(v === "__all__" ? "" : v)}>
        <SelectTrigger className="h-9 text-sm"><SelectValue placeholder={`All ${label.toLowerCase()}s`} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All</SelectItem>
          {options.map((o) => (
            <SelectItem key={o} value={o}>{o}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("h-9 w-full justify-start text-left text-sm font-normal", !value && "text-muted-foreground")}>
            <CalendarIcon className="mr-2 h-3.5 w-3.5" />
            {value ? format(parseISO(value), "dd MMM yyyy") : "Pick a date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value ? parseISO(value) : undefined}
            onSelect={(d) => onChange(d ? format(d, "yyyy-MM-dd") : "")}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
