import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions, PERMISSION_BULK_UPDATE } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Download, Upload, CheckCircle2, AlertTriangle, Loader2, FileSpreadsheet } from "lucide-react";
import { INDIA_STATES } from "@/data/india-locations";

const CLEAR_TOKEN = "[CLEAR]";
const MAX_ROWS = 1000;

type FieldType = "text" | "date" | "enum";

interface FieldDef {
  header: string;
  column: string;
  type: FieldType;
  options?: string[];
}

const FIELDS: FieldDef[] = [
  { header: "ERP Invoice No", column: "erp_invoice_no", type: "text" },
];

const REF_HEADER = "Event Ref Code";

interface EventLite {
  id: string;
  event_ref_code: string | null;
  event_name: string;
  event_date: string;
  is_locked: boolean;
  [key: string]: unknown;
}

interface PreviewRow {
  rowNo: number;
  ref: string;
  event?: EventLite;
  changes: { header: string; column: string; from: string; to: string | null }[];
  errors: string[];
}

function excelSerialToDate(serial: number) {
  const utc = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(utc);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function parseDate(raw: string | number): string | null {
  if (typeof raw === "number") return excelSerialToDate(raw);
  const v = String(raw).trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(v);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

function displayValue(v: unknown) {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

export default function BulkUpdate({ onBack }: { onBack?: () => void }) {
  const { isSuperAdmin } = useAuth();
  const { hasPermission, loading: permLoading } = usePermissions();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<{ updated: number; skipped: number } | null>(null);

  const allowed = hasPermission(PERMISSION_BULK_UPDATE);

  const { data: events = [] } = useQuery({
    queryKey: ["events-bulk-source"],
    queryFn: async () => {
      const cols = ["id", "event_ref_code", "event_name", "event_date", "is_locked", ...FIELDS.map((f) => f.column)].join(",");
      const { data, error } = await supabase.from("events").select(cols).order("event_ref_code");
      if (error) throw error;
      return (data ?? []) as unknown as EventLite[];
    },
    enabled: allowed,
  });

  const byRef = useMemo(() => {
    const map = new Map<string, EventLite>();
    events.forEach((e) => {
      if (e.event_ref_code) map.set(e.event_ref_code.trim().toUpperCase(), e);
    });
    return map;
  }, [events]);

  if (permLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  }
  if (!allowed) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        You don't have access to Bulk Update. Ask a Super Admin to enable it for your account.
      </div>
    );
  }

  const downloadTemplate = (withData: boolean) => {
    const headers = [REF_HEADER, ...FIELDS.map((f) => f.header)];
    const data = withData
      ? events.map((e) => {
          const row: Record<string, string> = { [REF_HEADER]: e.event_ref_code ?? "" };
          FIELDS.forEach((f) => {
            const v = e[f.column];
            row[f.header] = v === null || v === undefined ? "" : String(v);
          });
          return row;
        })
      : [];
    const ws = XLSX.utils.json_to_sheet(data, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bulk Update");
    XLSX.writeFile(wb, withData ? "events-bulk-update-data.csv" : "events-bulk-update-template.csv", { bookType: "csv" });
  };

  const handleFile = async (file: File) => {
    setResult(null);
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, string | number>>(ws, { defval: "" });

      if (raw.length === 0) {
        toast.error("File is empty");
        setRows([]);
        return;
      }
      if (raw.length > MAX_ROWS) {
        toast.error(`Maximum ${MAX_ROWS} rows allowed per file`);
        setRows([]);
        return;
      }

      const headerKeys = Object.keys(raw[0]).map((h) => h.trim());
      if (!headerKeys.some((h) => h.toLowerCase() === REF_HEADER.toLowerCase())) {
        toast.error(`Column "${REF_HEADER}" is required`);
        setRows([]);
        return;
      }

      const norm = (r: Record<string, string | number>, header: string) => {
        const key = Object.keys(r).find((k) => k.trim().toLowerCase() === header.toLowerCase());
        return key ? r[key] : "";
      };

      const preview: PreviewRow[] = raw.map((r, i) => {
        const ref = String(norm(r, REF_HEADER) ?? "").trim();
        const out: PreviewRow = { rowNo: i + 2, ref, changes: [], errors: [] };
        if (!ref) {
          out.errors.push("Event Ref Code missing");
          return out;
        }
        const ev = byRef.get(ref.toUpperCase());
        if (!ev) {
          out.errors.push(`No event found with ref code ${ref}`);
          return out;
        }
        out.event = ev;
        if (ev.is_locked && !isSuperAdmin) {
          out.errors.push("Event is locked — only Super Admin can update");
          return out;
        }

        FIELDS.forEach((f) => {
          const rawVal = norm(r, f.header);
          const strVal = typeof rawVal === "number" ? rawVal : String(rawVal ?? "").trim();
          if (strVal === "") return;

          let next: string | null;
          if (String(strVal).trim().toUpperCase() === CLEAR_TOKEN) {
            next = f.type === "date" ? null : "";
          } else if (f.type === "date") {
            const d = parseDate(strVal);
            if (!d) {
              out.errors.push(`${f.header}: invalid date "${strVal}" (use DD-MM-YYYY or YYYY-MM-DD)`);
              return;
            }
            next = d;
          } else if (f.type === "enum") {
            const match = f.options?.find((o) => o.toLowerCase() === String(strVal).trim().toLowerCase());
            if (!match) {
              out.errors.push(`${f.header}: "${strVal}" is not an allowed value`);
              return;
            }
            next = match;
          } else {
            next = String(strVal).trim();
          }

          const current = ev[f.column];
          const currentStr = current === null || current === undefined ? "" : String(current);
          const nextStr = next === null ? "" : next;
          if (currentStr === nextStr) return;
          out.changes.push({ header: f.header, column: f.column, from: currentStr, to: next });
        });

        if (out.errors.length === 0 && out.changes.length === 0) {
          out.errors.push("No changes detected");
        }
        return out;
      });

      setRows(preview);
      const ok = preview.filter((p) => p.errors.length === 0).length;
      toast.success(`${preview.length} row(s) read — ${ok} ready to update`);
    } catch (e) {
      const err = e as Error;
      toast.error(err.message || "Could not read file");
      setRows([]);
    }
  };

  const validRows = rows.filter((r) => r.errors.length === 0 && r.event);
  const errorRows = rows.filter((r) => r.errors.length > 0);

  const applyChanges = async () => {
    if (validRows.length === 0) return;
    setApplying(true);
    let updated = 0;
    const failures: { ref: string; message: string }[] = [];

    const chunkSize = 25;
    for (let i = 0; i < validRows.length; i += chunkSize) {
      const chunk = validRows.slice(i, i + chunkSize);
      const results = await Promise.all(
        chunk.map(async (row) => {
          const payload: Record<string, string | null> = {};
          row.changes.forEach((c) => {
            payload[c.column] = c.to;
          });
          const { error } = await supabase.from("events").update(payload).eq("id", row.event!.id);
          return { row, error };
        }),
      );
      results.forEach(({ row, error }) => {
        if (error) failures.push({ ref: row.ref, message: error.message });
        else updated += 1;
      });
    }

    setApplying(false);
    setResult({ updated, skipped: errorRows.length + failures.length });
    qc.invalidateQueries({ queryKey: ["events"] });
    qc.invalidateQueries({ queryKey: ["events-dashboard"] });
    qc.invalidateQueries({ queryKey: ["events-bulk-source"] });

    if (failures.length > 0) {
      toast.error(`${updated} updated, ${failures.length} failed`);
      setRows((prev) =>
        prev.map((r) => {
          const f = failures.find((x) => x.ref === r.ref);
          return f ? { ...r, errors: [f.message] } : r;
        }),
      );
    } else {
      toast.success(`${updated} event(s) updated successfully`);
      setRows([]);
      setFileName("");
    }
  };

  const downloadErrors = () => {
    const data = errorRows.map((r) => ({ Row: r.rowNo, "Event Ref Code": r.ref, Errors: r.errors.join("; ") }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Errors");
    XLSX.writeFile(wb, "bulk-update-errors.csv", { bookType: "csv" });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Bulk Update Events</h1>
          <p className="text-sm font-medium text-muted-foreground">
            Upload a CSV to update multiple events at once — matched by Event Ref Code
          </p>
        </div>
        {onBack && (
          <Button variant="outline" className="rounded-xl font-semibold" onClick={onBack}>
            Back to Events
          </Button>
        )}
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">1. Get the template</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-xl" onClick={() => downloadTemplate(false)}>
            <Download className="mr-2 h-4 w-4" /> Blank template
          </Button>
          <Button variant="outline" className="rounded-xl" onClick={() => downloadTemplate(true)}>
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Template with current data ({events.length})
          </Button>
          <p className="w-full text-xs text-muted-foreground">
            Blank cell = no change. Type <span className="font-mono">{CLEAR_TOKEN}</span> to empty a field. Max {MAX_ROWS} rows.
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">2. Upload file</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
          <Button className="rounded-xl font-semibold" onClick={() => fileRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" /> Choose CSV / Excel file
          </Button>
          {fileName && <p className="text-sm text-muted-foreground">Selected: {fileName}</p>}
        </CardContent>
      </Card>

      {result && (
        <Card className="rounded-2xl border-emerald-500/40">
          <CardContent className="flex items-center gap-3 py-4">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            <p className="text-sm font-semibold">
              {result.updated} event(s) updated · {result.skipped} skipped
            </p>
          </CardContent>
        </Card>
      )}

      {rows.length > 0 && (
        <Card className="rounded-2xl">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">
              3. Preview <span className="ml-2 text-xs font-normal text-muted-foreground">{validRows.length} ready · {errorRows.length} with issues</span>
            </CardTitle>
            <div className="flex gap-2">
              {errorRows.length > 0 && (
                <Button variant="outline" size="sm" className="rounded-xl" onClick={downloadErrors}>
                  <Download className="mr-2 h-3.5 w-3.5" /> Errors
                </Button>
              )}
              <Button size="sm" className="rounded-xl font-semibold" disabled={validRows.length === 0 || applying} onClick={applyChanges}>
                {applying ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-2 h-3.5 w-3.5" />}
                Apply {validRows.length} update(s)
              </Button>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3">Row</th>
                  <th className="py-2 pr-3">Ref</th>
                  <th className="py-2 pr-3">Event</th>
                  <th className="py-2 pr-3">Changes</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.rowNo} className="border-b border-border/50 align-top">
                    <td className="py-2 pr-3 font-mono text-xs text-muted-foreground">{r.rowNo}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{r.ref || "—"}</td>
                    <td className="py-2 pr-3">
                      <p className="font-medium">{r.event?.event_name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{r.event?.event_date ?? ""}</p>
                    </td>
                    <td className="py-2 pr-3">
                      {r.changes.length === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <ul className="space-y-0.5">
                          {r.changes.map((c) => (
                            <li key={c.column} className="text-xs">
                              <span className="font-semibold">{c.header}:</span>{" "}
                              <span className="text-muted-foreground line-through">{displayValue(c.from)}</span>{" "}
                              <span className="text-emerald-600">→ {displayValue(c.to)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="py-2">
                      {r.errors.length === 0 ? (
                        <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15">Ready</Badge>
                      ) : (
                        <div className="flex items-start gap-1 text-xs text-amber-600">
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span>{r.errors.join("; ")}</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
