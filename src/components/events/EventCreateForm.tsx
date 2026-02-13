import { useState, useMemo, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ArrowLeft, Save, TrendingUp, TrendingDown, IndianRupee, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

function NumInput({ label, value, onChange, disabled }: { label: string; value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        min={0}
        step="0.01"
        value={value || ""}
        onChange={(e) => onChange(Math.max(0, parseFloat(e.target.value) || 0))}
        disabled={disabled}
        className="font-mono text-sm"
        placeholder="0"
      />
    </div>
  );
}

function DateField({ label, value, onChange }: { label: string; value: Date | undefined; onChange: (d: Date | undefined) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-sm", !value && "text-muted-foreground")}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? format(value, "dd MMM yyyy") : "Pick a date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={value} onSelect={onChange} initialFocus className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface EventFormData {
  event_ref_code: string;
  event_date: Date | undefined;
  invoice_date: Date | undefined;
  invoice_code: string;
  erp_invoice_no: string;
  posist_code: string;
  event_name: string;
  client_name: string;
  client_sub_name: string;
  referral_details: string;
  registration_status: string;
  gst_exempted: boolean;
  area: string;
  city: string;
  state: string;
  zone: string;
  venue: string;
  spoc: string;
  category: string;
  total_waffwich_sold: number;
  total_premix_sold: number;
  total_crisps_sold: number;
  net_sales: number;
  gst_amount: number;
  cogs: number;
  other_consumables: number;
  wastages_variance: number;
  manpower_cost: number;
  logistic_expense: number;
  staff_food_expense: number;
  local_purchase: number;
  rent_commission: number;
  miscellaneous_expense: number;
  payment_mode: string;
  cash_deposit: number;
  cash_banking_date: Date | undefined;
  online_payment: number;
  event_qr_reference: string;
  commission_paid_from_sale: boolean;
  commission_amount: number;
  commission_rent_with_invoice: number;
  commission_rent_without_invoice: number;
  adjustment: number;
  advance_received: string;
  full_payment_received: boolean;
  additional_remarks: string;
  event_team_remarks: string;
  finance_clearance: string;
}

const defaultForm: EventFormData = {
  event_ref_code: "", event_date: undefined, invoice_date: undefined, invoice_code: "", erp_invoice_no: "", posist_code: "",
  event_name: "", client_name: "", client_sub_name: "", referral_details: "", registration_status: "Not Registered", gst_exempted: false,
  area: "", city: "", state: "", zone: "", venue: "", spoc: "", category: "Corporate",
  total_waffwich_sold: 0, total_premix_sold: 0, total_crisps_sold: 0, net_sales: 0, gst_amount: 0,
  cogs: 0, other_consumables: 0, wastages_variance: 0, manpower_cost: 0, logistic_expense: 0, staff_food_expense: 0, local_purchase: 0, rent_commission: 0, miscellaneous_expense: 0,
  payment_mode: "Online", cash_deposit: 0, cash_banking_date: undefined, online_payment: 0, event_qr_reference: "",
  commission_paid_from_sale: false, commission_amount: 0, commission_rent_with_invoice: 0, commission_rent_without_invoice: 0, adjustment: 0,
  advance_received: "NA", full_payment_received: false, additional_remarks: "", event_team_remarks: "", finance_clearance: "Pending",
};

const CATEGORIES = ["Corporate", "Wedding", "Mall Activation", "Exhibition", "Private Event", "Other"];
const ZONES = ["North", "South", "East", "West", "Central"];

export default function EventCreateForm({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState<EventFormData>({ ...defaultForm });

  const set = useCallback(<K extends keyof EventFormData>(key: K, val: EventFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  }, []);

  const setNum = useCallback((key: keyof EventFormData, val: number) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  }, []);

  // Auto calculations
  const calc = useMemo(() => {
    const totalSales = form.net_sales + form.gst_amount;
    const totalCost = form.cogs + form.other_consumables + form.wastages_variance + form.manpower_cost + form.logistic_expense + form.staff_food_expense + form.local_purchase + form.rent_commission + form.miscellaneous_expense;
    const ebitda = totalSales - totalCost;
    const ebitdaPercent = totalSales > 0 ? (ebitda / totalSales) * 100 : 0;
    const totalPayment = form.cash_deposit + form.online_payment;
    const commissionAmt = form.commission_paid_from_sale ? form.commission_amount : 0;
    let outstanding = totalSales - totalPayment - commissionAmt - form.adjustment;
    if (form.full_payment_received) outstanding = 0;

    let paymentStatus: "Full Paid" | "Partial" | "Pending" = "Pending";
    if (form.full_payment_received) paymentStatus = "Full Paid";
    else if (form.advance_received === "Yes") paymentStatus = "Partial";

    const agingDays = form.event_date ? Math.floor((Date.now() - form.event_date.getTime()) / 86400000) : 0;
    let agingLabel = "Recent";
    if (agingDays > 30) agingLabel = "Overdue";
    else if (agingDays > 7) agingLabel = "Attention";

    return { totalSales, totalCost, ebitda, ebitdaPercent, totalPayment, outstanding, paymentStatus, agingDays, agingLabel };
  }, [form]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.event_name || !form.event_date || !form.client_name) {
        throw new Error("Event Name, Date, and Client Name are required");
      }
      const { error } = await supabase.from("events").insert({
        event_ref_code: form.event_ref_code || null,
        event_name: form.event_name,
        event_date: format(form.event_date, "yyyy-MM-dd"),
        invoice_date: form.invoice_date ? format(form.invoice_date, "yyyy-MM-dd") : null,
        invoice_code: form.invoice_code,
        erp_invoice_no: form.erp_invoice_no,
        posist_code: form.posist_code,
        client_name: form.client_name,
        client_sub_name: form.client_sub_name,
        referral_details: form.referral_details,
        registration_status: form.registration_status,
        gst_exempted: form.gst_exempted,
        area: form.area,
        city: form.city,
        state: form.state,
        zone: form.zone,
        venue: form.venue,
        spoc: form.spoc,
        category: form.category,
        total_waffwich_sold: form.total_waffwich_sold,
        total_premix_sold: form.total_premix_sold,
        total_crisps_sold: form.total_crisps_sold,
        net_sales: form.net_sales,
        gst_amount: form.gst_amount,
        cogs: form.cogs,
        other_consumables: form.other_consumables,
        wastages_variance: form.wastages_variance,
        manpower_cost: form.manpower_cost,
        logistic_expense: form.logistic_expense,
        staff_food_expense: form.staff_food_expense,
        local_purchase: form.local_purchase,
        rent_commission: form.rent_commission,
        miscellaneous_expense: form.miscellaneous_expense,
        payment_mode: form.payment_mode,
        cash_deposit: form.cash_deposit,
        cash_banking_date: form.cash_banking_date ? format(form.cash_banking_date, "yyyy-MM-dd") : null,
        online_payment: form.online_payment,
        event_qr_reference: form.event_qr_reference,
        commission_paid_from_sale: form.commission_paid_from_sale,
        commission_amount: form.commission_paid_from_sale ? form.commission_amount : 0,
        commission_rent_with_invoice: form.commission_rent_with_invoice,
        commission_rent_without_invoice: form.commission_rent_without_invoice,
        adjustment: form.adjustment,
        advance_received: form.advance_received,
        full_payment_received: form.full_payment_received,
        additional_remarks: form.additional_remarks,
        event_team_remarks: form.event_team_remarks,
        finance_clearance: form.finance_clearance,
        created_by: user?.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["events-dashboard"] });
      toast.success("Event created successfully");
      onBack();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const paymentBadge = calc.paymentStatus === "Full Paid"
    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
    : calc.paymentStatus === "Partial"
      ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
      : "bg-red-500/15 text-red-400 border-red-500/30";

  return (
    <div className="space-y-6 pb-32">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Create Event</h1>
            <p className="text-sm text-muted-foreground">Complete P&L data entry</p>
          </div>
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} size="lg">
          <Save className="mr-2 h-4 w-4" />{saveMutation.isPending ? "Saving..." : "Save Event"}
        </Button>
      </div>

      {/* Sticky Financial Summary */}
      <div className="sticky top-0 z-10 -mx-4 bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Card className="border-border/50">
            <CardContent className="p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Sales</p>
              <p className="font-mono text-lg font-bold">{fmt(calc.totalSales)}</p>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Cost</p>
              <p className="font-mono text-lg font-bold">{fmt(calc.totalCost)}</p>
            </CardContent>
          </Card>
          <Card className={cn("border-border/50", calc.ebitda >= 0 ? "border-emerald-500/30" : "border-red-500/30")}>
            <CardContent className="p-3">
              <div className="flex items-center gap-1">
                {calc.ebitda >= 0 ? <TrendingUp className="h-3 w-3 text-emerald-400" /> : <TrendingDown className="h-3 w-3 text-red-400" />}
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">EBITDA</p>
              </div>
              <p className={cn("font-mono text-lg font-bold", calc.ebitda >= 0 ? "text-emerald-400" : "text-red-400")}>{fmt(calc.ebitda)}</p>
              <p className={cn("text-xs font-mono", calc.ebitda >= 0 ? "text-emerald-400/70" : "text-red-400/70")}>{calc.ebitdaPercent.toFixed(1)}%</p>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Received</p>
              <p className="font-mono text-lg font-bold">{fmt(calc.totalPayment)}</p>
            </CardContent>
          </Card>
          <Card className={cn("border-border/50", calc.outstanding > 0 ? "border-amber-500/30" : "border-emerald-500/30")}>
            <CardContent className="p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Outstanding</p>
              <p className={cn("font-mono text-lg font-bold", calc.outstanding > 0 ? "text-amber-400" : "text-emerald-400")}>{fmt(calc.outstanding)}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Section 1: Basic Event Information */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Basic Event Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Event Ref Code</Label>
              <Input value={form.event_ref_code} onChange={(e) => set("event_ref_code", e.target.value)} placeholder="EVT-001" className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Event Name *</Label>
              <Input value={form.event_name} onChange={(e) => set("event_name", e.target.value)} required className="text-sm" />
            </div>
            <DateField label="Event Date *" value={form.event_date} onChange={(d) => set("event_date", d)} />
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Month</Label>
              <Input value={form.event_date ? format(form.event_date, "MMMM") : ""} disabled className="text-sm bg-muted/30" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Financial Year</Label>
              <Input value={form.event_date ? `FY ${format(form.event_date, "yyyy")}` : ""} disabled className="text-sm bg-muted/30" />
            </div>
            <DateField label="Invoice Date" value={form.invoice_date} onChange={(d) => set("invoice_date", d)} />
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Invoice Code</Label>
              <Input value={form.invoice_code} onChange={(e) => set("invoice_code", e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">ERP Invoice No.</Label>
              <Input value={form.erp_invoice_no} onChange={(e) => set("erp_invoice_no", e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Posist Code</Label>
              <Input value={form.posist_code} onChange={(e) => set("posist_code", e.target.value)} className="text-sm" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Client Information */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Client Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Client Name *</Label>
              <Input value={form.client_name} onChange={(e) => set("client_name", e.target.value)} required className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Client Sub Name</Label>
              <Input value={form.client_sub_name} onChange={(e) => set("client_sub_name", e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Referral Details</Label>
              <Input value={form.referral_details} onChange={(e) => set("referral_details", e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Registration Status</Label>
              <Select value={form.registration_status} onValueChange={(v) => set("registration_status", v)}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Registered">Registered</SelectItem>
                  <SelectItem value="Not Registered">Not Registered</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3 pt-5">
              <Switch checked={form.gst_exempted} onCheckedChange={(v) => set("gst_exempted", v)} />
              <Label className="text-sm">GST Exempted</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Location Details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Location Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Venue</Label>
              <Input value={form.venue} onChange={(e) => set("venue", e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Area</Label>
              <Input value={form.area} onChange={(e) => set("area", e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">City</Label>
              <Input value={form.city} onChange={(e) => set("city", e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">State</Label>
              <Input value={form.state} onChange={(e) => set("state", e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Zone</Label>
              <Select value={form.zone} onValueChange={(v) => set("zone", v)}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {ZONES.map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Event Management */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Event Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">SPOC</Label>
              <Input value={form.spoc} onChange={(e) => set("spoc", e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Category</Label>
              <Select value={form.category} onValueChange={(v) => set("category", v)}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 5: Sales */}
      <Card className="border-emerald-500/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-emerald-400">Sales</CardTitle>
            <div className="rounded-lg bg-emerald-500/10 px-4 py-2 font-mono text-lg font-bold text-emerald-400">
              Total: {fmt(calc.totalSales)}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
            <NumInput label="Total Waffwich Sold" value={form.total_waffwich_sold} onChange={(v) => setNum("total_waffwich_sold", v)} />
            <NumInput label="Total Premix Sold" value={form.total_premix_sold} onChange={(v) => setNum("total_premix_sold", v)} />
            <NumInput label="Total Crisps Sold" value={form.total_crisps_sold} onChange={(v) => setNum("total_crisps_sold", v)} />
            <NumInput label="Net Sales" value={form.net_sales} onChange={(v) => setNum("net_sales", v)} />
            <NumInput label="GST" value={form.gst_amount} onChange={(v) => setNum("gst_amount", v)} />
          </div>
        </CardContent>
      </Card>

      {/* Section 6: Expenses */}
      <Card className="border-red-500/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-red-400">Expenses</CardTitle>
            <div className="rounded-lg bg-red-500/10 px-4 py-2 font-mono text-lg font-bold text-red-400">
              Total: {fmt(calc.totalCost)}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
            <NumInput label="COGS" value={form.cogs} onChange={(v) => setNum("cogs", v)} />
            <NumInput label="Other Consumables" value={form.other_consumables} onChange={(v) => setNum("other_consumables", v)} />
            <NumInput label="Wastages / Variance" value={form.wastages_variance} onChange={(v) => setNum("wastages_variance", v)} />
            <NumInput label="Manpower Cost" value={form.manpower_cost} onChange={(v) => setNum("manpower_cost", v)} />
            <NumInput label="Logistic Expense" value={form.logistic_expense} onChange={(v) => setNum("logistic_expense", v)} />
            <NumInput label="Staff Food Expense" value={form.staff_food_expense} onChange={(v) => setNum("staff_food_expense", v)} />
            <NumInput label="Local Purchase" value={form.local_purchase} onChange={(v) => setNum("local_purchase", v)} />
            <NumInput label="Rent / Commission" value={form.rent_commission} onChange={(v) => setNum("rent_commission", v)} />
            <NumInput label="Miscellaneous" value={form.miscellaneous_expense} onChange={(v) => setNum("miscellaneous_expense", v)} />
          </div>
        </CardContent>
      </Card>

      {/* Section 7: Profitability KPI */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className={cn("border-2", calc.ebitda >= 0 ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5")}>
          <CardContent className="flex items-center gap-4 p-6">
            {calc.ebitda >= 0 ? <TrendingUp className="h-10 w-10 text-emerald-400" /> : <TrendingDown className="h-10 w-10 text-red-400" />}
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">EBITDA</p>
              <p className={cn("font-mono text-3xl font-bold", calc.ebitda >= 0 ? "text-emerald-400" : "text-red-400")}>{fmt(calc.ebitda)}</p>
              <p className="text-sm text-muted-foreground">{calc.ebitda >= 0 ? "Profit" : "Loss"}</p>
            </div>
          </CardContent>
        </Card>
        <Card className={cn("border-2", calc.ebitdaPercent >= 0 ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5")}>
          <CardContent className="flex items-center gap-4 p-6">
            <IndianRupee className={cn("h-10 w-10", calc.ebitdaPercent >= 0 ? "text-emerald-400" : "text-red-400")} />
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">EBITDA %</p>
              <p className={cn("font-mono text-3xl font-bold", calc.ebitdaPercent >= 0 ? "text-emerald-400" : "text-red-400")}>{calc.ebitdaPercent.toFixed(1)}%</p>
              <p className="text-sm text-muted-foreground">Margin</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Section 8: Banking & Collection */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Banking & Collection</CardTitle>
            <div className="rounded-lg bg-primary/10 px-4 py-2 font-mono text-lg font-bold text-primary">
              Received: {fmt(calc.totalPayment)}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Payment Mode</Label>
              <Select value={form.payment_mode} onValueChange={(v) => set("payment_mode", v)}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Online">Online</SelectItem>
                  <SelectItem value="Mixed">Mixed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <NumInput label="Cash Deposit" value={form.cash_deposit} onChange={(v) => setNum("cash_deposit", v)} />
            <DateField label="Cash Banking Date" value={form.cash_banking_date} onChange={(d) => set("cash_banking_date", d)} />
            <NumInput label="Online Payment" value={form.online_payment} onChange={(v) => setNum("online_payment", v)} />
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">QR / Bank Ref</Label>
              <Input value={form.event_qr_reference} onChange={(e) => set("event_qr_reference", e.target.value)} className="text-sm" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 9: Commission & Adjustments */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Commission & Adjustments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch checked={form.commission_paid_from_sale} onCheckedChange={(v) => set("commission_paid_from_sale", v)} />
            <Label className="text-sm">Commission Paid From Sale</Label>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {form.commission_paid_from_sale && (
              <NumInput label="Commission Amount" value={form.commission_amount} onChange={(v) => setNum("commission_amount", v)} />
            )}
            <NumInput label="Commission/Rent With Invoice" value={form.commission_rent_with_invoice} onChange={(v) => setNum("commission_rent_with_invoice", v)} />
            <NumInput label="Commission/Rent Without Invoice" value={form.commission_rent_without_invoice} onChange={(v) => setNum("commission_rent_without_invoice", v)} />
            <NumInput label="Adjustment" value={form.adjustment} onChange={(v) => setNum("adjustment", v)} />
          </div>
        </CardContent>
      </Card>

      {/* Section 10: Outstanding */}
      <Card className={cn("border-2", calc.outstanding <= 0 ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5")}>
        <CardContent className="flex items-center justify-between p-6">
          <div className="flex items-center gap-4">
            {calc.outstanding > 0 ? <AlertTriangle className="h-10 w-10 text-amber-400" /> : <TrendingUp className="h-10 w-10 text-emerald-400" />}
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Outstanding</p>
              <p className={cn("font-mono text-3xl font-bold", calc.outstanding > 0 ? "text-amber-400" : "text-emerald-400")}>{fmt(calc.outstanding)}</p>
              <p className="text-sm text-muted-foreground">{calc.outstanding <= 0 ? "Cleared" : "Pending"}</p>
            </div>
          </div>
          <span className={cn("rounded-full border px-3 py-1 text-xs font-semibold", paymentBadge)}>
            {calc.paymentStatus}
          </span>
        </CardContent>
      </Card>

      {/* Section 11: Payment Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Payment Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Advance Received</Label>
              <Select value={form.advance_received} onValueChange={(v) => set("advance_received", v)}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Yes">Yes</SelectItem>
                  <SelectItem value="No">No</SelectItem>
                  <SelectItem value="NA">N/A</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3 pt-5">
              <Switch checked={form.full_payment_received} onCheckedChange={(v) => set("full_payment_received", v)} />
              <Label className="text-sm">Full Payment Received</Label>
              {form.full_payment_received && <span className="text-xs text-amber-400">⚠ Event will be locked</span>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 12: Remarks & Finance */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Remarks & Finance Clearance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Additional Remarks</Label>
              <Textarea value={form.additional_remarks} onChange={(e) => set("additional_remarks", e.target.value)} rows={3} className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Event Team Remarks</Label>
              <Textarea value={form.event_team_remarks} onChange={(e) => set("event_team_remarks", e.target.value)} rows={3} className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Finance Clearance</Label>
              <Select value={form.finance_clearance} onValueChange={(v) => set("finance_clearance", v)}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bottom Save */}
      <div className="flex justify-end">
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} size="lg" className="px-8">
          <Save className="mr-2 h-4 w-4" />{saveMutation.isPending ? "Saving..." : "Save Event"}
        </Button>
      </div>
    </div>
  );
}
