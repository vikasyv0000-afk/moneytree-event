import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Upload, Trash2, FileText } from "lucide-react";

const ACCEPTED = ".pdf,.jpg,.jpeg,.png,.xlsx,.docx";
const MAX_BYTES = 20 * 1024 * 1024;
const DOC_TYPES = [
  "Client Invoice", "Vendor Invoice", "Logistics Invoice",
  "Manpower Invoice", "Rent Invoice", "Commission Invoice",
  "Payment Proof", "Other",
];

export interface PendingDoc {
  id: string;
  file: File;
  document_type: string;
  remarks: string;
}

interface Props {
  pending: PendingDoc[];
  onChange: (next: PendingDoc[]) => void;
}

export default function PendingDocuments({ pending, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState("Client Invoice");
  const [remarks, setRemarks] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const add = () => {
    if (!file) return;
    if (file.size > MAX_BYTES) { toast.error("File exceeds 20 MB limit"); return; }
    onChange([
      ...pending,
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, file, document_type: docType, remarks },
    ]);
    setFile(null); setRemarks(""); setDocType("Client Invoice");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setOpen(false);
    toast.success("Invoice queued — will upload on save");
  };

  const remove = (id: string) => onChange(pending.filter((p) => p.id !== id));

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Invoices ({pending.length} pending)
        </CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline"><Upload className="mr-2 h-4 w-4" />Upload Invoice</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Queue Invoice / Document</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">File (PDF, JPG, PNG, XLSX, DOCX — max 20 MB)</Label>
                <Input ref={fileInputRef} type="file" accept={ACCEPTED}
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Document Type</Label>
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DOC_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Remarks (optional)</Label>
                <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Notes..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={add} disabled={!file}>Add to Queue</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No invoices queued. Files added here will upload when you save the event.
          </p>
        ) : (
          <div className="divide-y">
            {pending.map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-2">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{p.file.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {p.document_type} · {(p.file.size / 1024).toFixed(1)} KB
                    {p.remarks ? ` · ${p.remarks}` : ""} · Pending upload
                  </div>
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => remove(p.id)} title="Remove">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
