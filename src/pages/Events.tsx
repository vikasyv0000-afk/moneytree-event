import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Eye } from "lucide-react";
import EventDetail from "@/components/events/EventDetail";

function fmt(n: number | null | undefined) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n ?? 0);
}

export default function Events() {
  const { user, isSuperAdmin, isEventsUser } = useAuth();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [form, setForm] = useState({ event_name: "", event_date: "", client_name: "", venue: "" });
  const canCreate = isSuperAdmin || isEventsUser;

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").order("event_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("events").insert({
        event_name: form.event_name,
        event_date: form.event_date,
        client_name: form.client_name,
        venue: form.venue,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["events-dashboard"] });
      setCreateOpen(false);
      setForm({ event_name: "", event_date: "", client_name: "", venue: "" });
      toast.success("Event created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

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
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />New Event</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Event</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
                <div className="space-y-2">
                  <Label>Event Name</Label>
                  <Input value={form.event_name} onChange={(e) => setForm({ ...form, event_name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Event Date</Label>
                  <Input type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Client</Label>
                  <Input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Venue</Label>
                  <Input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} />
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>Create</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {events.map((event) => (
          <Card key={event.id} className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => setSelectedEventId(event.id)}>
            <CardHeader className="flex flex-row items-start justify-between pb-2">
              <div>
                <CardTitle className="text-base">{event.event_name}</CardTitle>
                <p className="text-xs text-muted-foreground">{event.client_name} · {event.venue}</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
                event.status === "locked" ? "bg-primary/10 text-primary" : event.status === "cancelled" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
              }`}>
                {event.status}
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
                  <div className={`font-mono font-semibold ${(event.profit ?? 0) >= 0 ? "text-primary" : "text-destructive"}`}>{fmt(event.profit)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Paid</span>
                  <div className="font-mono font-semibold">{fmt(event.total_paid)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Outstanding</span>
                  <div className="font-mono font-semibold text-warning">{fmt(event.outstanding)}</div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Eye className="h-3 w-3" />
                {event.event_date}
              </div>
            </CardContent>
          </Card>
        ))}
        {events.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground">No events yet.</div>
        )}
      </div>
    </div>
  );
}
