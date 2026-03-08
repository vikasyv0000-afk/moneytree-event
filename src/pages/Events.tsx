import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Eye, Download, Search } from "lucide-react";
import * as XLSX from "xlsx";
import EventDetail from "@/components/events/EventDetail";
import EventCreateForm from "@/components/events/EventCreateForm";

function fmt(n: number | null | undefined) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n ?? 0);
}

export default function Events() {
  const { isSuperAdmin, isEventsUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>(searchParams.get("filter") || "");
  const canCreate = isSuperAdmin || isEventsUser;

  useEffect(() => {
    const f = searchParams.get("filter");
    if (f) setActiveFilter(f);
  }, [searchParams]);

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").order("event_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const exportToExcel = () => {
    if (events.length === 0) {
      toast.error("No events to export");
      return;
    }
    const rows = events.map((e) => ({
      "Event Ref Code": e.event_ref_code ?? "",
      "Event Name": e.event_name,
      "Event Date": e.event_date,
      "Month": e.month ?? "",
      "Client Name": e.client_name,
      "Client Sub Name": e.client_sub_name ?? "",
      "Venue": e.venue,
      "City": e.city ?? "",
      "State": e.state ?? "",
      "Zone": e.zone ?? "",
      "Area": e.area ?? "",
      "Category": e.category ?? "",
      "SPOC": e.spoc ?? "",
      "Net Sales": e.net_sales ?? 0,
      "GST Amount": e.gst_amount ?? 0,
      "Total Sales": e.total_sales ?? 0,
      "COGS": e.cogs ?? 0,
      "Other Consumables": e.other_consumables ?? 0,
      "Wastages/Variance": e.wastages_variance ?? 0,
      "Manpower Cost": e.manpower_cost ?? 0,
      "Logistic Expense": e.logistic_expense ?? 0,
      "Staff Food Expense": e.staff_food_expense ?? 0,
      "Local Purchase": e.local_purchase ?? 0,
      "Rent/Commission": e.rent_commission ?? 0,
      "Miscellaneous": e.miscellaneous_expense ?? 0,
      "Total Cost": e.total_cost ?? 0,
      "EBITDA": e.ebitda ?? 0,
      "EBITDA %": e.ebitda_percent ?? 0,
      "Cash Deposit": e.cash_deposit ?? 0,
      "Online Payment": e.online_payment ?? 0,
      "Total Payment Received": e.total_payment_received ?? 0,
      "Commission Amount": e.commission_amount ?? 0,
      "Adjustment": e.adjustment ?? 0,
      "Outstanding": e.outstanding ?? 0,
      "Payment Status": e.payment_status ?? "",
      "Advance Received": e.advance_received ?? "",
      "Full Payment Received": e.full_payment_received ? "Yes" : "No",
      "Payment Mode": e.payment_mode ?? "",
      "Registration Status": e.registration_status ?? "",
      "Finance Clearance": e.finance_clearance ?? "",
      "Invoice Code": e.invoice_code ?? "",
      "ERP Invoice No": e.erp_invoice_no ?? "",
      "Posist Code": e.posist_code ?? "",
      "Status": e.status,
      "Referral Details": e.referral_details ?? "",
      "Additional Remarks": e.additional_remarks ?? "",
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

  const filteredEvents = events.filter((e) => {
    if (activeFilter === "outstanding") {
      if ((e.outstanding ?? 0) <= 0) return false;
    } else if (activeFilter === "paid") {
      if ((e.outstanding ?? 0) > 0) return false;
    } else if (activeFilter === "active") {
      if (e.status !== "active") return false;
    } else if (activeFilter === "locked") {
      if (e.status !== "locked") return false;
    } else if (activeFilter === "status") {
      if (e.status !== "active" && e.status !== "locked") return false;
    }
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      e.event_name?.toLowerCase().includes(q) ||
      (e.event_ref_code && e.event_ref_code.toLowerCase().includes(q))
    );
  });

  const clearFilter = () => {
    setActiveFilter("");
    setSearchParams({});
  };

  const filterLabels: Record<string, string> = {
    outstanding: "Outstanding Payments",
    paid: "Fully Paid",
    status: "Active & Locked",
    active: "Active Only",
    locked: "Locked Only",
  };

  return (
    <div className="space-y-6 waffle-pattern min-h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Events</h1>
          <p className="text-sm font-medium text-muted-foreground">Manage events, revenue, expenses & payments</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-xl font-semibold" onClick={exportToExcel}><Download className="mr-2 h-4 w-4" />Export Excel</Button>
          {canCreate && (
            <Button className="rounded-xl font-semibold" onClick={() => setShowCreate(true)}><Plus className="mr-2 h-4 w-4" />New Event</Button>
          )}
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by event name or event code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 rounded-xl"
        />
      </div>
      {activeFilter && (
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Filtered by:</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-3 py-1 text-xs font-bold text-primary">
            {filterLabels[activeFilter] || activeFilter}
            <button onClick={clearFilter} className="ml-1 hover:opacity-70">✕</button>
          </span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredEvents.map((event) => {
          const paymentStatus = (event as any).payment_status || event.status;
          const badgeClass = paymentStatus === "Full Paid"
            ? "bg-success/15 text-success"
            : paymentStatus === "Partial"
              ? "bg-warning/15 text-warning"
              : event.status === "locked"
                ? "bg-amber-800/15 text-amber-800"
                : event.status === "cancelled"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-success/15 text-success";

          return (
            <Card key={event.id} className="cursor-pointer rounded-2xl border-0 shadow-md transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5" onClick={() => setSelectedEventId(event.id)}>
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div>
                  <CardTitle className="text-base font-bold">{event.event_name}</CardTitle>
                  <p className="text-xs font-medium text-muted-foreground">{event.client_name} · {event.venue}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${badgeClass}`}>
                  {paymentStatus || event.status}
                </span>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground font-medium">Revenue</span>
                    <div className="font-mono font-bold">{fmt(event.total_revenue)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-medium">Profit</span>
                    <div className={`font-mono font-bold ${(event.profit ?? 0) >= 0 ? "text-success" : "text-destructive"}`}>{fmt(event.profit)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-medium">Paid</span>
                    <div className="font-mono font-bold">{fmt(event.total_paid)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-medium">Outstanding</span>
                    <div className="font-mono font-bold text-warning">{fmt(event.outstanding)}</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground font-medium">
                  <Eye className="h-3 w-3" />
                  {event.event_date}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filteredEvents.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground font-medium">
            {search.trim() ? "No events match your search." : "No events yet."}
          </div>
        )}
      </div>
    </div>
  );
}
