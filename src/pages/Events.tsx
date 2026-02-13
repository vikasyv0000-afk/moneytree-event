import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Eye } from "lucide-react";
import EventDetail from "@/components/events/EventDetail";
import EventCreateForm from "@/components/events/EventCreateForm";

function fmt(n: number | null | undefined) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n ?? 0);
}

export default function Events() {
  const { isSuperAdmin, isEventsUser } = useAuth();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const canCreate = isSuperAdmin || isEventsUser;

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").order("event_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (showCreate) {
    return <EventCreateForm onBack={() => setShowCreate(false)} />;
  }

  if (selectedEventId) {
    return <EventDetail eventId={selectedEventId} onBack={() => setSelectedEventId(null)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Events</h1>
          <p className="text-sm text-muted-foreground">Manage events, revenue, expenses & payments</p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowCreate(true)}><Plus className="mr-2 h-4 w-4" />New Event</Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {events.map((event) => {
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
        {events.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground">No events yet.</div>
        )}
      </div>
    </div>
  );
}
