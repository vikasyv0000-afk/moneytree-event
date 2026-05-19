import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Eye, Download, Search, Calendar as CalendarIcon } from "lucide-react";
import * as XLSX from "xlsx";
import EventDetail from "@/components/events/EventDetail";
import EventCreateForm from "@/components/events/EventCreateForm";
import { cn } from "@/lib/utils";

function fmt(n: number | null | undefined) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n ?? 0);
}

const CATEGORIES = [
  "College & School",
  "Special & Sporting",
  "Corporates",
  "Wedding & Catering",
  "Curations",
  "Private Party",
  "Society",
];

type TabKey = "all" | "outstanding" | "paid" | "active" | "locked";

export default function Events() {
  const { isSuperAdmin, isEventsUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>(
    (searchParams.get("filter") as TabKey) || "all",
  );
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const canCreate = isSuperAdmin || isEventsUser;

  useEffect(() => {
    const f = searchParams.get("filter") as TabKey | null;
    if (f) setActiveTab(f);
  }, [searchParams]);

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("event_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch creator profiles
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-min"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name, email");
      return data ?? [];
    },
  });
  const creatorMap = useMemo(() => {
    const m = new Map<string, string>();
    profiles.forEach((p: any) => m.set(p.user_id, p.full_name || p.email || "—"));
    return m;
  }, [profiles]);

  const counts = useMemo(() => {
    return {
      all: events.length,
      outstanding: events.filter((e) => (e.outstanding ?? 0) > 0).length,
      paid: events.filter((e) => (e.outstanding ?? 0) <= 0).length,
      active: events.filter((e) => e.status === "active").length,
      locked: events.filter((e) => e.status === "locked").length,
    };
  }, [events]);

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (activeTab === "outstanding" && (e.outstanding ?? 0) <= 0) return false;
      if (activeTab === "paid" && (e.outstanding ?? 0) > 0) return false;
      if (activeTab === "active" && e.status !== "active") return false;
      if (activeTab === "locked" && e.status !== "locked") return false;

      if (categoryFilter !== "all" && e.category !== categoryFilter) return false;
      if (paymentStatusFilter !== "all" && (e.payment_status ?? "") !== paymentStatusFilter)
        return false;

      if (dateFrom && e.event_date < dateFrom) return false;
      if (dateTo && e.event_date > dateTo) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          e.event_name?.toLowerCase().includes(q) ||
          (e.event_ref_code && e.event_ref_code.toLowerCase().includes(q)) ||
          (e.client_name && e.client_name.toLowerCase().includes(q)) ||
          (e.venue && e.venue.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [events, activeTab, categoryFilter, paymentStatusFilter, dateFrom, dateTo, search]);

  const exportToExcel = () => {
    if (filteredEvents.length === 0) {
      toast.error("No events to export");
      return;
    }
    const rows = filteredEvents.map((e) => ({
      "Event Ref Code": e.event_ref_code ?? "",
      "Event Name": e.event_name,
      "Event Date": e.event_date,
      "Client Name": e.client_name,
      "Venue": e.venue,
      "Category": e.category ?? "",
      "Net Sales": e.net_sales ?? 0,
      "Total Sales": e.total_sales ?? 0,
      "Total Cost": e.total_cost ?? 0,
      "EBITDA": e.ebitda ?? 0,
      "Total Payment Received": e.total_payment_received ?? 0,
      "Outstanding": e.outstanding ?? 0,
      "Payment Status": e.payment_status ?? "",
      "Status": e.status,
      "Created By": creatorMap.get(e.created_by ?? "") ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Events");
    XLSX.writeFile(wb, `Events_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Excel file downloaded!");
  };

  if (showCreate) {
    return <EventCreateForm onBack={() => setShowCreate(false)} />;
  }
  if (selectedEventId) {
    return <EventDetail eventId={selectedEventId} onBack={() => setSelectedEventId(null)} />;
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: "all", label: "All" },
    { key: "outstanding", label: "Outstanding" },
    { key: "paid", label: "Paid" },
    { key: "active", label: "Active" },
    { key: "locked", label: "Locked" },
  ];

  const onTabClick = (k: TabKey) => {
    setActiveTab(k);
    if (k === "all") {
      searchParams.delete("filter");
    } else {
      searchParams.set("filter", k);
    }
    setSearchParams(searchParams);
  };

  return (
    <div className="space-y-5 min-h-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Events</h1>
          <p className="text-sm font-medium text-muted-foreground">
            Manage events, revenue, expenses & payments
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-xl font-semibold" onClick={exportToExcel}>
            <Download className="mr-2 h-4 w-4" />
            Export Excel
          </Button>
          {canCreate && (
            <Button className="rounded-xl font-semibold" onClick={() => setShowCreate(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Event
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex flex-wrap gap-1">
          {tabs.map((t) => {
            const active = activeTab === t.key;
            const count = counts[t.key];
            return (
              <button
                key={t.key}
                onClick={() => onTabClick(t.key)}
                className={cn(
                  "relative px-4 py-2.5 text-sm font-semibold transition-colors",
                  "border-b-2 -mb-px",
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
                <span
                  className={cn(
                    "ml-2 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-bold",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4 rounded-xl border-0 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, code, client, venue..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 rounded-lg"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="rounded-lg">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
            <SelectTrigger className="rounded-lg">
              <SelectValue placeholder="Payment Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Payment Status</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Partial">Partial</SelectItem>
              <SelectItem value="Full Paid">Full Paid</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <CalendarIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="pl-8 rounded-lg text-xs"
              />
            </div>
            <span className="text-xs text-muted-foreground">to</span>
            <div className="relative flex-1">
              <CalendarIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="pl-8 rounded-lg text-xs"
              />
            </div>
          </div>
        </div>
        {(categoryFilter !== "all" ||
          paymentStatusFilter !== "all" ||
          dateFrom ||
          dateTo ||
          search) && (
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Showing {filteredEvents.length} of {events.length} events
            </span>
            <button
              onClick={() => {
                setSearch("");
                setCategoryFilter("all");
                setPaymentStatusFilter("all");
                setDateFrom("");
                setDateTo("");
              }}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}
      </Card>

      {/* Table */}
      <Card className="rounded-xl border-0 shadow-sm overflow-hidden">
        <div className="overflow-auto max-h-[calc(100vh-340px)]">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-bold text-xs uppercase tracking-wider">
                  Event
                </TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">
                  Client / Venue
                </TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">
                  Category
                </TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider text-right">
                  Revenue
                </TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider text-right">
                  Paid
                </TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider text-right">
                  Outstanding
                </TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider text-right">
                  Profit
                </TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">
                  Date
                </TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">
                  Status
                </TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">
                  Created By
                </TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider text-right">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEvents.map((event) => {
                const paymentStatus = event.payment_status || event.status;
                const badgeClass =
                  paymentStatus === "Full Paid"
                    ? "bg-success/15 text-success"
                    : paymentStatus === "Partial"
                      ? "bg-warning/15 text-warning"
                      : event.status === "locked"
                        ? "bg-amber-800/15 text-amber-800"
                        : event.status === "cancelled"
                          ? "bg-destructive/10 text-destructive"
                          : "bg-success/15 text-success";

                return (
                  <TableRow
                    key={event.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedEventId(event.id)}
                  >
                    <TableCell className="py-3">
                      <div className="font-semibold text-sm">{event.event_name}</div>
                      {event.event_ref_code && (
                        <div className="text-[11px] font-mono text-muted-foreground">
                          {event.event_ref_code}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="text-sm font-medium">{event.client_name}</div>
                      <div className="text-[11px] text-muted-foreground">{event.venue}</div>
                    </TableCell>
                    <TableCell className="py-3">
                      <span className="text-xs font-medium">{event.category ?? "—"}</span>
                    </TableCell>
                    <TableCell className="py-3 text-right font-mono text-sm font-semibold">
                      {fmt(event.total_revenue)}
                    </TableCell>
                    <TableCell className="py-3 text-right font-mono text-sm">
                      {fmt(event.total_paid)}
                    </TableCell>
                    <TableCell className="py-3 text-right font-mono text-sm font-semibold text-warning">
                      {fmt(event.outstanding)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "py-3 text-right font-mono text-sm font-semibold",
                        (event.profit ?? 0) >= 0 ? "text-success" : "text-destructive",
                      )}
                    >
                      {fmt(event.profit)}
                    </TableCell>
                    <TableCell className="py-3 text-xs whitespace-nowrap">
                      {event.event_date}
                    </TableCell>
                    <TableCell className="py-3">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap",
                          badgeClass,
                        )}
                      >
                        {paymentStatus || event.status}
                      </span>
                    </TableCell>
                    <TableCell className="py-3 text-xs text-muted-foreground">
                      {creatorMap.get(event.created_by ?? "") ?? "—"}
                    </TableCell>
                    <TableCell className="py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEventId(event.id);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredEvents.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={11}
                    className="py-12 text-center text-muted-foreground font-medium"
                  >
                    {search.trim() || categoryFilter !== "all" || paymentStatusFilter !== "all"
                      ? "No events match your filters."
                      : "No events yet."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
