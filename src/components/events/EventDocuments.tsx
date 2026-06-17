import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Upload, Eye, Download, Trash2, FileText, Loader2 } from "lucide-react";
import { format } from "date-fns";

const ACCEPTED = ".pdf,.jpg,.jpeg,.png,.xlsx,.docx";
const MAX_BYTES = 20 * 1024 * 1024;
const DOC_TYPES = [
  "Client Invoice", "Vendor Invoice", "Logistics Invoice",
  "Manpower Invoice", "Rent Invoice", "Commission Invoice",
  "Payment Proof", "Other",
];

interface Props { eventId: string; }

export default function EventDocuments({ eventId }: Props) {
  const { user, isSuperAdmin } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState("Client Invoice");
  const [remarks, setRemarks] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: docs = [] } = useQuery({
    queryKey: ["event-documents", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_documents")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: uploaderNames = {} } = useQuery({
    queryKey: ["event-doc-uploaders", docs.map((d: any) => d.uploaded_by).join(",")],
    queryFn: async () => {
      const ids = Array.from(new Set(docs.map((d: any) => d.uploaded_by).filter(Boolean)));
      if (!ids.length) return {};
      const { data } = await supabase.from("profiles").select("user_id, full_name, email").in("user_id", ids);
      const map: Record<string, string> = {};
      (data ?? []).forEach((p: any) => { map[p.user_id] = p.full_name || p.email || "—"; });
      return map;
    },
    enabled: docs.length > 0,
  });

  const handleUpload = async () => {
    if (!file || !user) return;
    if (file.size > MAX_BYTES) { toast.error("File exceeds 20 MB limit"); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${eventId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("event-documents").upload(path, file, {
        contentType: file.type, upsert: false,
      });
      if (upErr) throw upErr;

      const { error: dbErr } = await supabase.from("event_documents").insert({
        event_id: eventId,
        file_name: file.name,
        storage_path: path,
        mime_type: file.type,
        file_size: file.size,
        document_type: docType,
        remarks: remarks || null,
        uploaded_by: user.id,
      });
      if (dbErr) throw dbErr;

      toast.success("Document uploaded");
      qc.invalidateQueries({ queryKey: ["event-documents", eventId] });
      setFile(null); setRemarks(""); setDocType("Client Invoice"); setOpen(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const view = async (doc: any) => {
    const { data, error } = await supabase.storage.from("event-documents").createSignedUrl(doc.storage_path, 300);
    if (error) { toast.error(error.message); return; }
    window.open(data.signedUrl, "_blank");
  };

  const download = async (doc: any) => {
    const { data, error } = await supabase.storage.from("event-documents").download(doc.storage_path);
    if (error) { toast.error(error.message); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url; a.download = doc.file_name;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const deleteMutation = useMutation({
    mutationFn: async (doc: any) => {
      await supabase.storage.from("event-documents").remove([doc.storage_path]);
      const { error } = await supabase.from("event_documents").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Document deleted");
      qc.invalidateQueries({ queryKey: ["event-documents", eventId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Invoices ({docs.length})
        </CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline"><Upload className="mr-2 h-4 w-4" />Upload Invoice</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Upload Invoice / Document</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">File (PDF, JPG, PNG, XLSX, DOCX — max 20 MB)</Label>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED}
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
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
              <Button variant="outline" onClick={() => setOpen(false)} disabled={uploading}>Cancel</Button>
              <Button onClick={handleUpload} disabled={!file || uploading}>
                {uploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading...</> : "Upload"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {docs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No invoices uploaded yet.</p>
        ) : (
          <div className="divide-y">
            {docs.map((doc: any) => {
              const canDelete = isSuperAdmin || doc.uploaded_by === user?.id;
              return (
                <div key={doc.id} className="flex items-center gap-3 py-2">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{doc.file_name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {doc.document_type} · {(uploaderNames as any)[doc.uploaded_by] || "—"} · {format(new Date(doc.created_at), "dd MMM yyyy")}
                      {doc.remarks ? ` · ${doc.remarks}` : ""}
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => view(doc)} title="View">
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => download(doc)} title="Download">
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  {canDelete && (
                    <Button
                      size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => {
                        if (window.confirm(`Delete "${doc.file_name}"?`)) deleteMutation.mutate(doc);
                      }}
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
