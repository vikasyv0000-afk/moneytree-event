import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Lock } from "lucide-react";

function fmt(n: number | null | undefined) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n ?? 0);
}

interface Props {
  eventId: string;
  onBack: () => void;
}

export default function EventDetail({ eventId, onBack }: Props) {
  const { isSuperAdmin, isEventsUser, isFinanceUser } = useAuth();
  const qc = useQueryClient();
  const canEditEvent = isSuperAdmin || isEventsUser;
  const canManagePayments = isSuperAdmin || isFinanceUser;

  const { data: event } = useQuery({
    queryKey: ["event", eventId],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").eq("id", eventId).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: revenueItems = [] } = useQuery({
    queryKey: ["revenue", eventId],
    queryFn: async () => {
      const { data, error } = await supabase.from("revenue_items").select("*").eq("event_id", eventId);
      if (error) throw error;
      return data;
    },
  });

  const { data: expenseItems = [] } = useQuery({
    queryKey: ["expenses", eventId],
    queryFn: async () => {
      const { data, error } = await supabase.from("expense_items").select("*").eq("event_id", eventId);
      if (error) throw error;
      return data;
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["payments", eventId],
    queryFn: async () => {
      const { data, error } = await supabase.from("payments").select("*").eq("event_id", eventId);
      if (error) throw error;
      return data;
    },
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["event", eventId] });
    qc.invalidateQueries({ queryKey: ["revenue", eventId] });
    qc.invalidateQueries({ queryKey: ["expenses", eventId] });
    qc.invalidateQueries({ queryKey: ["payments", eventId] });
    qc.invalidateQueries({ queryKey: ["events"] });
    qc.invalidateQueries({ queryKey: ["events-dashboard"] });
  };

  // Revenue
  const [revDesc, setRevDesc] = useState("");
  const [revAmt, setRevAmt] = useState("");
  const addRevenue = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("revenue_items").insert({ event_id: eventId, description: revDesc, amount: parseFloat(revAmt) });
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); setRevDesc(""); setRevAmt(""); toast.success("Revenue added"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteRevenue = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("revenue_items").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { invalidateAll(); toast.success("Deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  // Expenses
  const [expDesc, setExpDesc] = useState("");
  const [expAmt, setExpAmt] = useState("");
  const [expCat, setExpCat] = useState("general");
  const addExpense = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("expense_items").insert({ event_id: eventId, description: expDesc, amount: parseFloat(expAmt), category: expCat });
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); setExpDesc(""); setExpAmt(""); setExpCat("general"); toast.success("Expense added"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteExpense = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("expense_items").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { invalidateAll(); toast.success("Deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  // Payments
  const [payAmt, setPayAmt] = useState("");
  const [payDate, setPayDate] = useState("");
  const [payMethod, setPayMethod] = useState("bank_transfer");
  const [payRef, setPayRef] = useState("");
  const addPayment = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("payments").insert({ event_id: eventId, amount: parseFloat(payAmt), payment_date: payDate, payment_method: payMethod, reference: payRef });
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); setPayAmt(""); setPayDate(""); setPayRef(""); toast.success("Payment recorded"); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!event) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;

  const isLocked = event.is_locked;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{event.event_name}</h1>
            {isLocked && <Lock className="h-4 w-4 text-primary" />}
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${event.status === "locked" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{event.status}</span>
          </div>
          <p className="text-sm text-muted-foreground">{event.client_name} · {event.venue} · {event.event_date}</p>
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Revenue</div><div className="font-mono text-lg font-bold">{fmt(event.total_revenue)}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Expenses</div><div className="font-mono text-lg font-bold text-destructive">{fmt(event.total_expenses)}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Profit</div><div className={`font-mono text-lg font-bold ${(event.profit ?? 0) >= 0 ? "text-primary" : "text-destructive"}`}>{fmt(event.profit)}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Outstanding</div><div className="font-mono text-lg font-bold text-warning">{fmt(event.outstanding)}</div></CardContent></Card>
      </div>

      <Tabs defaultValue="revenue">
        <TabsList>
          <TabsTrigger value="revenue">Revenue ({revenueItems.length})</TabsTrigger>
          <TabsTrigger value="expenses">Expenses ({expenseItems.length})</TabsTrigger>
          <TabsTrigger value="payments">Payments ({payments.length})</TabsTrigger>
        </TabsList>

        {/* Revenue Tab */}
        <TabsContent value="revenue">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Revenue Items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {canEditEvent && !isLocked && (
                <form onSubmit={(e) => { e.preventDefault(); addRevenue.mutate(); }} className="flex gap-2">
                  <Input placeholder="Description" value={revDesc} onChange={(e) => setRevDesc(e.target.value)} required className="flex-1" />
                  <Input type="number" step="0.01" placeholder="Amount" value={revAmt} onChange={(e) => setRevAmt(e.target.value)} required className="w-32" />
                  <Button type="submit" size="icon" disabled={addRevenue.isPending}><Plus className="h-4 w-4" /></Button>
                </form>
              )}
              {revenueItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded border px-3 py-2">
                  <span className="text-sm">{item.description}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium">{fmt(item.amount)}</span>
                    {canEditEvent && !isLocked && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteRevenue.mutate(item.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                    )}
                  </div>
                </div>
              ))}
              {revenueItems.length === 0 && <p className="text-center text-sm text-muted-foreground">No revenue items</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Expenses Tab */}
        <TabsContent value="expenses">
          <Card>
            <CardHeader><CardTitle className="text-sm">Expense Items</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {canEditEvent && !isLocked && (
                <form onSubmit={(e) => { e.preventDefault(); addExpense.mutate(); }} className="flex gap-2">
                  <Input placeholder="Category" value={expCat} onChange={(e) => setExpCat(e.target.value)} className="w-28" />
                  <Input placeholder="Description" value={expDesc} onChange={(e) => setExpDesc(e.target.value)} required className="flex-1" />
                  <Input type="number" step="0.01" placeholder="Amount" value={expAmt} onChange={(e) => setExpAmt(e.target.value)} required className="w-32" />
                  <Button type="submit" size="icon" disabled={addExpense.isPending}><Plus className="h-4 w-4" /></Button>
                </form>
              )}
              {expenseItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded border px-3 py-2">
                  <div>
                    <span className="text-sm">{item.description}</span>
                    <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{item.category}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium text-destructive">{fmt(item.amount)}</span>
                    {canEditEvent && !isLocked && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteExpense.mutate(item.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                    )}
                  </div>
                </div>
              ))}
              {expenseItems.length === 0 && <p className="text-center text-sm text-muted-foreground">No expense items</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments">
          <Card>
            <CardHeader><CardTitle className="text-sm">Payments</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {canManagePayments && !isLocked && (
                <form onSubmit={(e) => { e.preventDefault(); addPayment.mutate(); }} className="flex flex-wrap gap-2">
                  <Input type="number" step="0.01" placeholder="Amount" value={payAmt} onChange={(e) => setPayAmt(e.target.value)} required className="w-32" />
                  <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} required className="w-40" />
                  <Input placeholder="Method" value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="w-32" />
                  <Input placeholder="Reference" value={payRef} onChange={(e) => setPayRef(e.target.value)} className="flex-1" />
                  <Button type="submit" disabled={addPayment.isPending}><Plus className="mr-1 h-4 w-4" />Record</Button>
                </form>
              )}
              {payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded border px-3 py-2">
                  <div className="text-sm">
                    <span className="font-mono font-medium text-primary">{fmt(p.amount)}</span>
                    <span className="ml-2 text-muted-foreground">{p.payment_date}</span>
                    <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{p.payment_method}</span>
                    {p.reference && <span className="ml-2 text-xs text-muted-foreground">Ref: {p.reference}</span>}
                  </div>
                </div>
              ))}
              {payments.length === 0 && <p className="text-center text-sm text-muted-foreground">No payments recorded</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
