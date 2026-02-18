import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const canCreate = isSuperAdmin || isEventsUser;

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
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      e.event_name?.toLowerCase().includes(q) ||
      (e.event_ref_code && e.event_ref_code.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Events</h1>
          <p className="text-sm text-muted-foreground">Manage events, revenue, expenses & payments</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToExcel}><Download className="mr-2 h-4 w-4" />Export Excel</Button>
          {canCreate && (
            <Button onClick={() => setShowCreate(true)}><Plus className="mr-2 h-4 w-4" />New Event</Button>
          )}
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by event name or event code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredEvents.map((event) => {
          const paymentStatus = (event as any).payment_status || event.status;
          const badgeClass = paymentStatus === "Full Paid"
            ? "bg-emerald-500/15 text-emerald-400"
            : paymentStatus === "Partial"
              ? "bg-amber-500/15 text-amber-400"
              : event.status === "locked"
                ? "bg-primary/10 text-primary"
                : event.status === "cancelled"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-muted text-muted-foreground";

          return (
            <Card key={event.id} className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => setSelectedEventId(event.id)}>
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div>
                  <CardTitle className="text-base">{event.event_name}</CardTitle>
                  <p className="text-xs text-muted-foreground">{event.client_name} · {event.venue}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${badgeClass}`}>
                  {paymentStatus || event.status}
                </span>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Revenue</span>
                    <div className="font-mono font-semibold">{fmt(event.total_revenue)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Profit</span>
                    <div className={`font-mono font-semibold ${(event.profit ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmt(event.profit)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Paid</span>
                    <div className="font-mono font-semibold">{fmt(event.total_paid)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Outstanding</span>
                    <div className="font-mono font-semibold text-amber-400">{fmt(event.outstanding)}</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Eye className="h-3 w-3" />
                  {event.event_date}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filteredEvents.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground">
            {search.trim() ? "No events match your search." : "No events yet."}
          </div>
        )}
      </div>
    </div>
  );
}
