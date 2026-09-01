import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useNavigate } from "react-router-dom";
import { usePermissions, PERMISSION_BULK_UPDATE } from "@/hooks/usePermissions";
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
import { logOutstandingMismatch, normalizeEventFinancials } from "@/lib/event-financials";

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
  "Kiosk",
];

type TabKey = "all" | "outstanding" | "paid" | "active" | "locked";

export default function Events() {
  const { isSuperAdmin, isEventsUser } = useAuth();
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();
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
      return (data ?? []).map((event) => normalizeEventFinancials(event));
    },
  });

  useEffect(() => {
    events.forEach((event) => logOutstandingMismatch("events-table", event));
  }, [events]);

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

  const formatCell = (value: unknown): string | number | boolean => {
    if (value === null || value === undefined) return "";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "object") {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }
    return value as string | number;
  };

  const autoFitColumns = (rows: Array<Record<string, unknown>>, headers?: string[]) => {
    if (rows.length === 0 && (!headers || headers.length === 0)) return [];
    const keys = headers ?? Object.keys(rows[0] ?? {});
    return keys.map((key) => {
      const maxLen = Math.max(
        key.length,
        ...rows.map((r) => {
          const v = r[key];
          return v === null || v === undefined ? 0 : String(v).length;
        }),
      );
      return { wch: Math.min(Math.max(maxLen + 2, 12), 40) };
    });
  };

  // Apply bold header + freeze + autofilter + number/date formats
  const styleSheet = (
    ws: XLSX.WorkSheet,
    headers: string[],
    currencyCols: string[] = [],
    dateCols: string[] = [],
    percentCols: string[] = [],
  ) => {
    const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
    // Header styling
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: 0, c: C });
      const cell = ws[addr];
      if (!cell) continue;
      cell.s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "1F4E78" } },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border: {
          top: { style: "thin", color: { rgb: "000000" } },
          bottom: { style: "thin", color: { rgb: "000000" } },
          left: { style: "thin", color: { rgb: "000000" } },
          right: { style: "thin", color: { rgb: "000000" } },
        },
      };
    }
    // Data cell formats
    const currencyIdx = new Set(currencyCols.map((h) => headers.indexOf(h)).filter((i) => i >= 0));
    const dateIdx = new Set(dateCols.map((h) => headers.indexOf(h)).filter((i) => i >= 0));
    const percentIdx = new Set(percentCols.map((h) => headers.indexOf(h)).filter((i) => i >= 0));
    for (let R = 1; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = ws[addr];
        if (!cell) continue;
        if (currencyIdx.has(C) && typeof cell.v === "number") {
          cell.z = '₹#,##0.00;[Red]-₹#,##0.00;"-"';
        } else if (percentIdx.has(C) && typeof cell.v === "number") {
          cell.z = "0.00%";
          cell.v = cell.v / 100;
        } else if (dateIdx.has(C) && cell.v) {
          cell.z = "dd-mmm-yyyy";
        }
        cell.s = {
          ...(cell.s || {}),
          alignment: { vertical: "center", wrapText: false },
          border: {
            top: { style: "hair", color: { rgb: "CCCCCC" } },
            bottom: { style: "hair", color: { rgb: "CCCCCC" } },
            left: { style: "hair", color: { rgb: "CCCCCC" } },
            right: { style: "hair", color: { rgb: "CCCCCC" } },
          },
        };
      }
    }
    (ws as any)["!freeze"] = { xSplit: 0, ySplit: 1 };
    ws["!autofilter"] = { ref: ws["!ref"] ?? "A1" };
  };

  const num = (v: any) => (v === null || v === undefined || v === "" ? 0 : Number(v) || 0);

  const exportToExcel = async () => {
    if (filteredEvents.length === 0) {
      toast.error("No events to export");
      return;
    }

    try {
      const eventIds = filteredEvents.map((e) => e.id);

      const [eventsRes, paymentsRes, fyRes] = await Promise.all([
        supabase.from("events").select("*").in("id", eventIds),
        supabase
          .from("payments")
          .select("*")
          .in("event_id", eventIds)
          .order("payment_date", { ascending: true }),
        supabase.from("financial_years").select("id, label"),
      ]);

      if (eventsRes.error) throw eventsRes.error;
      if (paymentsRes.error) throw paymentsRes.error;
      if (fyRes.error) throw fyRes.error;

      const fyMap = new Map<string, string>();
      (fyRes.data ?? []).forEach((fy: any) => fyMap.set(fy.id, fy.label));

      const paymentsByEvent = new Map<string, any[]>();
      (paymentsRes.data ?? []).forEach((p: any) => {
        const arr = paymentsByEvent.get(p.event_id) ?? [];
        arr.push(p);
        paymentsByEvent.set(p.event_id, arr);
      });

      const rawEvents = (eventsRes.data ?? []).sort((a: any, b: any) =>
        (a.event_ref_code ?? "").localeCompare(b.event_ref_code ?? ""),
      );

      const maxPayments = rawEvents.reduce(
        (max: number, e: any) => Math.max(max, (paymentsByEvent.get(e.id) ?? []).length),
        0,
      );

      // Fixed MIS column order (matches sample report)
      const baseHeaders = [
        "Event Ref. Code",
        "Event Name",
        "Event Date",
        "Month",
        "Financial Year",
        "Invoice Date",
        "Invoice Code",
        "ERP Invoice No.",
        "Posist Code",
        "Client Name",
        "Client Sub Name",
        "Referral Details",
        "Registration Status",
        "GST Exempted",
        "Venue",
        "Area",
        "City",
        "State",
        "Zone",
        "SPOC",
        "Category",
        "Total Waffwich Sold",
        "Total Premix Sold",
        "Total Crisps Sold",
        "Net Sales",
        "GST",
        "Total Sales",
        "COGS",
        "Other Consumables",
        "Wastages / Variance",
        "Manpower Cost",
        "Logistic Expense",
        "Staff Food Expense",
        "Local Purchase",
        "Rent / Commission",
        "Miscellaneous",
        "Total Cost",
        "EBITDA",
        "EBITDA %",
        "Profit",
        "Commission Paid From Sale",
        "Commission Amount",
        "Commission Rent With Invoice",
        "Commission Rent Without Invoice",
        "Paytm Commission",
        "Adjustment",
        "Advance Received",
        "Payment Mode",
        "Cash Deposit",
        "Cash Banking Date",
        "Online Payment",
        "UTR / QR Reference",
        "Total Payment Received",
        "Outstanding",
        "Payment Status",
        "Full Payment Received",
        "Finance Clearance",
        "Status",
        "Locked",
        "Event Team Remarks",
        "Additional Remarks",
        "Remark",
        "Created By",
        "Modified By",
        "Created At",
        "Updated At",
      ];

      const paymentHeaders: string[] = [];
      for (let i = 1; i <= maxPayments; i++) {
        paymentHeaders.push(
          `Payment ${i} Mode`,
          `Payment ${i} Amount`,
          `Payment ${i} Date`,
          `Payment ${i} UTR / Ref`,
          `Payment ${i} Remark`,
        );
      }
      const summaryHeaders = [...baseHeaders, "Payments Count", ...paymentHeaders];

      const currencyCols = [
        "Net Sales", "GST", "Total Sales",
        "COGS", "Other Consumables", "Wastages / Variance",
        "Manpower Cost", "Logistic Expense", "Staff Food Expense",
        "Local Purchase", "Rent / Commission", "Miscellaneous",
        "Total Cost", "EBITDA", "Profit",
        "Commission Amount", "Commission Rent With Invoice", "Commission Rent Without Invoice",
        "Paytm Commission", "Adjustment",
        "Cash Deposit", "Online Payment", "Total Payment Received", "Outstanding",
      ];
      const dateCols = ["Event Date", "Invoice Date", "Cash Banking Date", "Created At", "Updated At"];
      const percentCols = ["EBITDA %"];
      for (let i = 1; i <= maxPayments; i++) {
        currencyCols.push(`Payment ${i} Amount`);
        dateCols.push(`Payment ${i} Date`);
      }

      const summaryRows = rawEvents.map((e: any) => {
        const pays = paymentsByEvent.get(e.id) ?? [];
        const row: Record<string, any> = {
          "Event Ref. Code": e.event_ref_code ?? "",
          "Event Name": e.event_name ?? "",
          "Event Date": e.event_date ? new Date(e.event_date) : "",
          "Month": e.month?.trim() ?? "",
          "Financial Year": e.financial_year_id ? fyMap.get(e.financial_year_id) ?? "" : "",
          "Invoice Date": e.invoice_date ? new Date(e.invoice_date) : "",
          "Invoice Code": e.invoice_code ?? "",
          "ERP Invoice No.": e.erp_invoice_no ?? "",
          "Posist Code": e.posist_code ?? "",
          "Client Name": e.client_name ?? "",
          "Client Sub Name": e.client_sub_name ?? "",
          "Referral Details": e.referral_details ?? "",
          "Registration Status": e.registration_status ?? "",
          "GST Exempted": formatCell(e.gst_exempted),
          "Venue": e.venue ?? "",
          "Area": e.area ?? "",
          "City": e.city ?? "",
          "State": e.state ?? "",
          "Zone": e.zone ?? "",
          "SPOC": e.spoc ?? "",
          "Category": e.category ?? "",
          "Total Waffwich Sold": num(e.total_waffwich_sold),
          "Total Premix Sold": num(e.total_premix_sold),
          "Total Crisps Sold": num(e.total_crisps_sold),
          "Net Sales": num(e.net_sales),
          "GST": num(e.gst_amount),
          "Total Sales": num(e.total_sales),
          "COGS": num(e.cogs),
          "Other Consumables": num(e.other_consumables),
          "Wastages / Variance": num(e.wastages_variance),
          "Manpower Cost": num(e.manpower_cost),
          "Logistic Expense": num(e.logistic_expense),
          "Staff Food Expense": num(e.staff_food_expense),
          "Local Purchase": num(e.local_purchase),
          "Rent / Commission": num(e.rent_commission),
          "Miscellaneous": num(e.miscellaneous_expense),
          "Total Cost": num(e.total_cost),
          "EBITDA": num(e.ebitda),
          "EBITDA %": num(e.ebitda_percent),
          "Profit": num(e.ebitda),
          "Commission Paid From Sale": formatCell(e.commission_paid_from_sale),
          "Commission Amount": num(e.commission_amount),
          "Commission Rent With Invoice": num(e.commission_rent_with_invoice),
          "Commission Rent Without Invoice": num(e.commission_rent_without_invoice),
          "Paytm Commission": num(e.paytm_commission),
          "Adjustment": num(e.adjustment),
          "Advance Received": e.advance_received ?? "",
          "Payment Mode": e.payment_mode ?? "",
          "Cash Deposit": num(e.cash_deposit),
          "Cash Banking Date": e.cash_banking_date ? new Date(e.cash_banking_date) : "",
          "Online Payment": num(e.online_payment),
          "UTR / QR Reference": e.event_qr_reference ?? "",
          "Total Payment Received": num(e.total_payment_received),
          "Outstanding": num(e.outstanding),
          "Payment Status": e.payment_status ?? "",
          "Full Payment Received": formatCell(e.full_payment_received),
          "Finance Clearance": e.finance_clearance ?? "",
          "Status": e.status ?? "",
          "Locked": formatCell(e.is_locked),
          "Event Team Remarks": e.event_team_remarks ?? "",
          "Additional Remarks": e.additional_remarks ?? "",
          "Remark": e.remark ?? "",
          "Created By": creatorMap.get(e.created_by ?? "") ?? "",
          "Modified By": creatorMap.get(e.modified_by ?? "") ?? "",
          "Created At": e.created_at ? new Date(e.created_at) : "",
          "Updated At": e.updated_at ? new Date(e.updated_at) : "",
          "Payments Count": pays.length,
        };
        for (let i = 0; i < maxPayments; i++) {
          const p = pays[i];
          row[`Payment ${i + 1} Mode`] = p?.payment_method ?? "";
          row[`Payment ${i + 1} Amount`] = p ? num(p.amount) : "";
          row[`Payment ${i + 1} Date`] = p?.payment_date ? new Date(p.payment_date) : "";
          row[`Payment ${i + 1} UTR / Ref`] = p?.reference ?? "";
          row[`Payment ${i + 1} Remark`] = p?.remark ?? "";
        }
        return row;
      });

      const paymentRows: Array<Record<string, any>> = [];
      rawEvents.forEach((e: any) => {
        const pays = paymentsByEvent.get(e.id) ?? [];
        pays.forEach((p: any, idx: number) => {
          paymentRows.push({
            "Event Ref. Code": e.event_ref_code ?? "",
            "Event Name": e.event_name ?? "",
            "Event Date": e.event_date ? new Date(e.event_date) : "",
            "Client Name": e.client_name ?? "",
            "Payment No": idx + 1,
            "Payment Mode": p.payment_method ?? "",
            "Cash Deposit": num(p.cash_deposit),
            "Online Payment": num(p.online_payment),
            "Amount": num(p.amount),
            "Payment Date": p.payment_date ? new Date(p.payment_date) : "",
            "UTR / QR Reference": p.reference ?? "",
            "Remark": p.remark ?? "",
            "Recorded At": p.created_at ? new Date(p.created_at) : "",
          });
        });
      });

      const wb = XLSX.utils.book_new();

      const wsSummary = XLSX.utils.json_to_sheet(summaryRows, { header: summaryHeaders });
      wsSummary["!cols"] = autoFitColumns(summaryRows, summaryHeaders);
      styleSheet(wsSummary, summaryHeaders, currencyCols, dateCols, percentCols);
      XLSX.utils.book_append_sheet(wb, wsSummary, "Events Summary");

      if (paymentRows.length > 0) {
        const payHeaders = Object.keys(paymentRows[0]);
        const wsPay = XLSX.utils.json_to_sheet(paymentRows, { header: payHeaders });
        wsPay["!cols"] = autoFitColumns(paymentRows, payHeaders);
        styleSheet(
          wsPay,
          payHeaders,
          ["Cash Deposit", "Online Payment", "Amount"],
          ["Event Date", "Payment Date", "Recorded At"],
        );
        XLSX.utils.book_append_sheet(wb, wsPay, "Payment Details");
      }

      XLSX.writeFile(wb, `BWC_Events_MIS_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success(
        `Exported ${summaryRows.length} event(s) and ${paymentRows.length} payment(s)`,
      );
    } catch (err: any) {
      console.error("Export failed", err);
      toast.error(err.message || "Export failed");
    }
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
