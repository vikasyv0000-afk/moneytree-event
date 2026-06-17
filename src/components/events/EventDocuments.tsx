import { useState, useRef, useEffect } from "react";
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
import { Upload, Eye, Download, Trash2, FileText, Loader2, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { format } from "date-fns";

const ACCEPTED = ".pdf,.jpg,.jpeg,.png,.xlsx,.docx";
const MAX_BYTES = 20 * 1024 * 1024;
const DOC_TYPES = [
  "Client Invoice", "Vendor Invoice", "Logistics Invoice",
  "Manpower Invoice", "Rent Invoice", "Commission Invoice",
  "Payment Proof", "Other",
];

interface Props { eventId: string; }

interface PreviewState {
  blobUrl: string;
  fileName: string;
  kind: "pdf" | "image" | "other";
}

export default function EventDocuments({ eventId }: Props) {
  const { user, isSuperAdmin } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState("Client Invoice");
  const [remarks, setRemarks] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    return () => {
      if (preview?.blobUrl) URL.revokeObjectURL(preview.blobUrl);
    };
  }, [preview?.blobUrl]);

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
    setPreviewLoading(true);
    try {
      const { data, error } = await supabase.storage.from("event-documents").download(doc.storage_path);
      if (error) throw error;
      const ext = (doc.file_name.split(".").pop() || "").toLowerCase();
      const mime = doc.mime_type || "";
      let kind: PreviewState["kind"] = "other";
      if (mime.includes("pdf") || ext === "pdf") kind = "pdf";
      else if (mime.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) kind = "image";

      const typedBlob = kind === "pdf" && !mime
        ? new Blob([data], { type: "application/pdf" })
        : data;
      const blobUrl = URL.createObjectURL(typedBlob);
      setZoom(1);
      setPreview({ blobUrl, fileName: doc.file_name, kind });
    } catch (e: any) {
      toast.error(e.message || "Failed to load preview");
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    if (preview?.blobUrl) URL.revokeObjectURL(preview.blobUrl);
    setPreview(null);
    setZoom(1);
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
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => view(doc)} title="View" disabled={previewLoading}>
                    {previewLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
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

      <Dialog open={!!preview} onOpenChange={(o) => { if (!o) closePreview(); }}>
        <DialogContent className="max-w-6xl w-[95vw] h-[90vh] p-0 flex flex-col gap-0">
          <DialogHeader className="px-4 py-3 border-b flex-row items-center justify-between space-y-0">
            <DialogTitle className="text-sm font-medium truncate pr-8">{preview?.fileName}</DialogTitle>
            {preview && preview.kind !== "pdf" && (
              <div className="flex items-center gap-1 mr-8">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))} title="Zoom out">
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
                <span className="text-xs w-12 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom((z) => Math.min(5, z + 0.25))} title="Zoom in">
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom(1)} title="Fit">
                  <Maximize2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </DialogHeader>
          <div className="flex-1 overflow-auto bg-muted/30">
            {preview?.kind === "pdf" && (
              <iframe src={preview.blobUrl} title={preview.fileName} className="w-full h-full border-0" />
            )}
            {preview?.kind === "image" && (
              <div className="min-h-full min-w-full flex items-center justify-center p-4">
                <img
                  src={preview.blobUrl}
                  alt={preview.fileName}
                  style={{ transform: `scale(${zoom})`, transformOrigin: "center center", transition: "transform 0.15s" }}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            )}
            {preview?.kind === "other" && (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
                <FileText className="h-10 w-10" />
                <p>Preview not supported for this file type.</p>
                <Button variant="outline" size="sm" onClick={() => {
                  const a = document.createElement("a");
                  a.href = preview.blobUrl; a.download = preview.fileName;
                  document.body.appendChild(a); a.click(); document.body.removeChild(a);
                }}>
                  <Download className="mr-2 h-4 w-4" />Download
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
