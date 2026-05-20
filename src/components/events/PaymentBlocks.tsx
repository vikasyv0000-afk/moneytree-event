import { useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Trash2, CalendarIcon } from "lucide-react";
import { format, isToday, isFuture } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface PaymentEntry {
  id?: string;
  payment_mode: string;
  cash_deposit: number;
  online_payment: number;
  banking_date: Date | undefined;
  bank_ref: string;
  remark: string;
}

export const emptyPayment = (): PaymentEntry => ({
  payment_mode: "Online",
  cash_deposit: 0,
  online_payment: 0,
  banking_date: new Date(),
  bank_ref: "",
  remark: "",
});

const PAYMENT_MODES = ["Cash", "Online", "Mixed", "Paytm", "NEFT / Bank Transfer", "Cheque"];

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

function NumField({ label, value, onChange, disabled }: { label: string; value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number" min={0} step="0.01"
        value={value || ""}
        onChange={(e) => onChange(Math.max(0, parseFloat(e.target.value) || 0))}
        disabled={disabled}
        className="font-mono text-sm"
        placeholder="0"
      />
    </div>
  );
}

interface Props {
  payments: PaymentEntry[];
  onChange: (next: PaymentEntry[]) => void;
  disabled?: boolean;
  totalSales: number;
}

export default function PaymentBlocks({ payments, onChange, disabled, totalSales }: Props) {
  const update = useCallback((idx: number, patch: Partial<PaymentEntry>) => {
    onChange(payments.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  }, [payments, onChange]);

  const add = () => onChange([...payments, emptyPayment()]);
  const remove = (idx: number) => onChange(payments.filter((_, i) => i !== idx));

  const totalReceived = payments.reduce((s, p) => s + (p.cash_deposit || 0) + (p.online_payment || 0), 0);
  const outstanding = Math.max(0, totalSales - totalReceived);

  const badgeFor = (d: Date | undefined) => {
    if (!d) return null;
    if (isToday(d)) return <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-500">Today</span>;
    if (isFuture(d)) return <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold text-sky-500">Upcoming</span>;
    return <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">Past</span>;
  };

  return (
    <div className="space-y-4">
      <AnimatePresence initial={false}>
        {payments.map((p, idx) => (
          <motion.div
            key={p.id ?? `new-${idx}`}
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.2 }}
            className="rounded-xl border border-border/60 bg-card/40 p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold">Payment #{idx + 1}</h4>
                {badgeFor(p.banking_date)}
              </div>
              {!disabled && (
                <Button type="button" variant="outline" size="sm" onClick={() => remove(idx)} className="text-destructive hover:bg-destructive/10">
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove
                </Button>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Payment Mode</Label>
                <Select value={p.payment_mode} onValueChange={(v) => update(idx, { payment_mode: v })} disabled={disabled}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <NumField label="Cash Deposit" value={p.cash_deposit} onChange={(v) => update(idx, { cash_deposit: v })} disabled={disabled} />
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Cash Banking Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" disabled={disabled} className={cn("w-full justify-start text-left font-normal text-sm", !p.banking_date && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {p.banking_date ? format(p.banking_date, "dd MMM yyyy") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={p.banking_date} onSelect={(d) => update(idx, { banking_date: d })} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <NumField label="Online Payment" value={p.online_payment} onChange={(v) => update(idx, { online_payment: v })} disabled={disabled} />
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">QR / Bank Ref</Label>
                <Input value={p.bank_ref} onChange={(e) => update(idx, { bank_ref: e.target.value })} disabled={disabled} className="text-sm" />
              </div>
              <div className="md:col-span-2 lg:col-span-5 space-y-1.5">
                <Label className="text-xs text-muted-foreground">Remark</Label>
                <Input value={p.remark} onChange={(e) => update(idx, { remark: e.target.value })} disabled={disabled} className="text-sm" placeholder="Enter remark" />
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {payments.length === 0 && (
        <div className="rounded-xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
          No payments recorded yet.
        </div>
      )}

      {!disabled && (
        <Button type="button" variant="outline" onClick={add} className="w-full border-dashed">
          <Plus className="mr-2 h-4 w-4" /> Add Payment
        </Button>
      )}

      <div className="grid gap-3 rounded-xl border border-border/60 bg-muted/30 p-4 sm:grid-cols-4">
        <Summary label="Total Sales" value={fmt(totalSales)} />
        <Summary label="Total Received" value={fmt(totalReceived)} accent="text-emerald-500" />
        <Summary label="Outstanding" value={fmt(outstanding)} accent={outstanding > 0 ? "text-amber-500" : "text-emerald-500"} />
        <Summary label="Payments" value={`${payments.length}`} sub="Transactions" />
      </div>
      <p className="text-xs text-muted-foreground">Outstanding = Total Sales − Total Received (before commission &amp; adjustments)</p>
    </div>
  );
}

function Summary({ label, value, accent, sub }: { label: string; value: string; accent?: string; sub?: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("font-mono text-lg font-bold", accent)}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
