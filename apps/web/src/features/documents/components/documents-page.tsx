"use client";

import { useCallback, useEffect, useState } from "react";
import {
  FileText,
  FileSpreadsheet,
  FileImage,
  File,
  UploadCloud,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  Lock,
  ShieldCheck,
  AlertCircle,
  Trash2,
  Filter,
  Search,
  RefreshCw,
  Plus,
  Eye,
  FileCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface DocumentItem {
  id: string;
  tenantId: string;
  ownerService: string;
  ownerId?: string | null;
  category: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  checksumSha256: string;
  uploaderUserId: string;
  uploaderEmail?: string;
  visibility: string;
  verificationStatus: "pending" | "verified" | "rejected" | "quarantined";
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  verificationNotes?: string | null;
  retentionClass: string;
  version: number;
  createdAt: string;
}

interface DocumentStats {
  totalDocs: number;
  pendingVerification: number;
  legalHoldCount: number;
  totalSizeBytes: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getFileIcon(mime: string) {
  if (mime.includes("pdf")) return <FileText className="w-4 h-4 text-rose-500" />;
  if (mime.includes("image")) return <FileImage className="w-4 h-4 text-blue-500" />;
  if (mime.includes("sheet") || mime.includes("csv"))
    return <FileSpreadsheet className="w-4 h-4 text-emerald-500" />;
  return <File className="w-4 h-4 text-primary" />;
}

export function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [stats, setStats] = useState<DocumentStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Modals
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadCategory, setUploadCategory] = useState("general");
  const [uploadOwnerService, setUploadOwnerService] = useState("hrms");
  const [uploadVisibility, setUploadVisibility] = useState("internal");
  const [uploadRetention, setUploadRetention] = useState("standard");
  const [uploading, setUploading] = useState(false);

  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [selectedDocForVerify, setSelectedDocForVerify] = useState<DocumentItem | null>(null);
  const [verifyStatus, setVerifyStatus] = useState<"verified" | "rejected">("verified");
  const [verifyNotes, setVerifyNotes] = useState("");
  const [verifying, setVerifying] = useState(false);

  // Notification Banner
  const [banner, setBanner] = useState<{ text: string; isError?: boolean } | null>(null);

  const showBanner = (text: string, isError = false) => {
    setBanner({ text, isError });
    setTimeout(() => setBanner(null), 4000);
  };

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      if (statusFilter !== "all") params.set("verificationStatus", statusFilter);

      const res = await fetch(`/api/documents?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load documents");
      const data = await res.json();
      setDocuments(data.documents || []);
      setStats(data.stats || null);
    } catch (e: any) {
      showBanner(e.message, true);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, statusFilter]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Handle Upload
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      showBanner("Please select a file to upload", true);
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("category", uploadCategory);
      formData.append("ownerService", uploadOwnerService);
      formData.append("visibility", uploadVisibility);
      formData.append("retentionClass", uploadRetention);

      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to upload document");
      }

      setIsUploadModalOpen(false);
      setSelectedFile(null);
      showBanner("Document uploaded securely with SHA-256 integrity verification.");
      fetchDocuments();
    } catch (e: any) {
      showBanner(e.message, true);
    } finally {
      setUploading(false);
    }
  };

  // Handle Download via Signed URL
  const handleDownload = async (doc: DocumentItem) => {
    try {
      const res = await fetch(`/api/documents/${doc.id}/signed-url`);
      if (!res.ok) throw new Error("Failed to generate signed download link");
      const { downloadUrl } = await res.json();
      window.open(downloadUrl, "_blank");
    } catch (e: any) {
      showBanner(e.message, true);
    }
  };

  // Handle Verification
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDocForVerify) return;
    setVerifying(true);
    try {
      const res = await fetch(`/api/documents/${selectedDocForVerify.id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: verifyStatus, notes: verifyNotes }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to verify document");
      }
      setIsVerifyModalOpen(false);
      setSelectedDocForVerify(null);
      setVerifyNotes("");
      showBanner(`Document marked as ${verifyStatus.toUpperCase()} with audit trail.`);
      fetchDocuments();
    } catch (e: any) {
      showBanner(e.message, true);
    } finally {
      setVerifying(false);
    }
  };

  // Handle Delete
  const handleDelete = async (doc: DocumentItem) => {
    if (!confirm(`Are you sure you want to delete ${doc.fileName}?`)) return;
    try {
      const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to delete document");
      }
      showBanner("Document archived successfully.");
      fetchDocuments();
    } catch (e: any) {
      showBanner(e.message, true);
    }
  };

  const filteredDocs = documents.filter((d) =>
    searchTerm.trim()
      ? d.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.category.toLowerCase().includes(searchTerm.toLowerCase())
      : true
  );

  return (
    <div className="page-stack">
      {/* Banner */}
      {banner && (
        <div
          className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
            banner.isError
              ? "bg-red-500/10 text-red-600 border border-red-500/20"
              : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
          }`}
        >
          {banner.isError ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>{banner.text}</span>
        </div>
      )}

      {/* Header */}
      <header className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Documents & Secure File Storage</h1>
            <Badge variant="outline" className="text-xs">
              document.read · Module 14
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Centralized metadata repository, short-lived signed URLs, SHA-256 integrity, and compliance verification.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setIsUploadModalOpen(true)}
            className="flex items-center gap-1.5"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload Document</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchDocuments}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </Button>
        </div>
      </header>

      {/* KPI Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="panel p-4 space-y-1">
            <span className="text-xs text-muted-foreground">Total Documents</span>
            <div className="text-2xl font-bold">{stats.totalDocs}</div>
            <div className="text-[11px] text-muted-foreground">Encrypted in tenant storage</div>
          </div>

          <div className="panel p-4 space-y-1">
            <span className="text-xs text-muted-foreground">Storage Used</span>
            <div className="text-2xl font-bold">{formatBytes(stats.totalSizeBytes)}</div>
            <div className="text-[11px] text-muted-foreground">Across all attachments</div>
          </div>

          <div className="panel p-4 space-y-1">
            <span className="text-xs text-muted-foreground">Pending Verification</span>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {stats.pendingVerification}
            </div>
            <div className="text-[11px] text-muted-foreground">Requires auditor review</div>
          </div>

          <div className="panel p-4 space-y-1">
            <span className="text-xs text-muted-foreground">Legal Hold Protection</span>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {stats.legalHoldCount}
            </div>
            <div className="text-[11px] text-muted-foreground">Locked against deletion</div>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="panel p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by file name or category…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-background border border-input rounded-md pl-9 pr-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-background border border-input rounded-md px-3 py-1.5 text-sm"
          >
            <option value="all">All Categories</option>
            <option value="contract">Contracts & Agreements</option>
            <option value="resume">Candidate Resumes</option>
            <option value="identification">Government IDs</option>
            <option value="tax_form">Tax & Financial Forms</option>
            <option value="invoice_attachment">Invoice Attachments</option>
            <option value="policy">Company Policies</option>
            <option value="general">General</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-background border border-input rounded-md px-3 py-1.5 text-sm"
          >
            <option value="all">All Statuses</option>
            <option value="verified">Verified Only</option>
            <option value="pending">Pending Verification</option>
            <option value="rejected">Rejected Only</option>
          </select>
        </div>

        <div className="text-xs text-muted-foreground">
          Showing {filteredDocs.length} of {documents.length} documents
        </div>
      </div>

      {/* Data Table */}
      <div className="panel overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Loading documents…</div>
        ) : filteredDocs.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No documents found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th className="text-left">File Name</th>
                  <th className="text-left">Category / Service</th>
                  <th className="text-left">Size</th>
                  <th className="text-left">Uploader</th>
                  <th className="text-left">Verification</th>
                  <th className="text-left">Retention</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocs.map((doc) => (
                  <tr key={doc.id} className="border-b border-border/40 hover:bg-secondary/20 text-xs">
                    <td>
                      <div className="flex items-center gap-2">
                        {getFileIcon(doc.mimeType)}
                        <div>
                          <span className="font-semibold text-foreground block">{doc.fileName}</span>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            SHA: {doc.checksumSha256.slice(0, 12)}…
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {doc.category}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground block mt-0.5">
                        {doc.ownerService}
                      </span>
                    </td>
                    <td className="font-mono">{formatBytes(doc.fileSizeBytes)}</td>
                    <td>
                      <span className="font-medium text-foreground">{doc.uploaderEmail || "admin"}</span>
                      <span className="text-[10px] text-muted-foreground block">
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td>
                      {doc.verificationStatus === "verified" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" />
                          Verified
                        </span>
                      ) : doc.verificationStatus === "rejected" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400">
                          <XCircle className="w-3 h-3" />
                          Rejected
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400">
                          <Clock className="w-3 h-3" />
                          Pending
                        </span>
                      )}
                    </td>
                    <td>
                      {doc.retentionClass === "legal_hold" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-500/10 text-purple-600 border border-purple-500/20">
                          <Lock className="w-3 h-3" />
                          Legal Hold
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-[11px] capitalize">
                          {doc.retentionClass}
                        </span>
                      )}
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(doc)}
                          className="h-7 text-xs px-2"
                          title="Download via Expiring Signed URL"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedDocForVerify(doc);
                            setVerifyStatus(doc.verificationStatus === "verified" ? "verified" : "verified");
                            setVerifyNotes(doc.verificationNotes || "");
                            setIsVerifyModalOpen(true);
                          }}
                          className="h-7 text-xs px-2 text-primary"
                          title="Verify or Reject"
                        >
                          <FileCheck className="w-3.5 h-3.5" />
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(doc)}
                          className="h-7 text-xs px-2 text-red-500 hover:text-red-600"
                          title="Archive Document"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Upload Document */}
      <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Secure Document</DialogTitle>
            <DialogDescription>
              Files are checked for SHA-256 integrity and strictly isolated to your tenant storage.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpload} className="space-y-4 text-sm mt-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Select File (max 15MB)</label>
              <input
                type="file"
                required
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:opacity-90"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Category</label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className="w-full bg-background border border-input rounded-md px-2.5 py-1.5 text-xs"
                >
                  <option value="contract">Contract</option>
                  <option value="resume">Resume</option>
                  <option value="identification">Identification</option>
                  <option value="tax_form">Tax Form</option>
                  <option value="invoice_attachment">Invoice Attachment</option>
                  <option value="policy">Company Policy</option>
                  <option value="general">General</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Owner Service</label>
                <select
                  value={uploadOwnerService}
                  onChange={(e) => setUploadOwnerService(e.target.value)}
                  className="w-full bg-background border border-input rounded-md px-2.5 py-1.5 text-xs"
                >
                  <option value="hrms">HRMS</option>
                  <option value="recruitment">Recruitment</option>
                  <option value="finance">Finance</option>
                  <option value="compliance">Compliance</option>
                  <option value="project">Project Delivery</option>
                  <option value="general">General</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Visibility Scope</label>
                <select
                  value={uploadVisibility}
                  onChange={(e) => setUploadVisibility(e.target.value)}
                  className="w-full bg-background border border-input rounded-md px-2.5 py-1.5 text-xs"
                >
                  <option value="internal">Internal Staff</option>
                  <option value="confidential">Confidential (HR/Admin)</option>
                  <option value="private">Private (Uploader only)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Retention Policy</label>
                <select
                  value={uploadRetention}
                  onChange={(e) => setUploadRetention(e.target.value)}
                  className="w-full bg-background border border-input rounded-md px-2.5 py-1.5 text-xs"
                >
                  <option value="standard">Standard Retention</option>
                  <option value="legal_hold">Legal Hold (Protected)</option>
                  <option value="indefinite">Indefinite Archive</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsUploadModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={uploading}>
                {uploading ? "Uploading…" : "Upload"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Verify / Review Document */}
      <Dialog open={isVerifyModalOpen} onOpenChange={setIsVerifyModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Document Verification Review</DialogTitle>
            <DialogDescription>
              Authenticate compliance, identification, or contractual integrity.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleVerify} className="space-y-4 text-sm mt-3">
            <div className="p-3 rounded bg-secondary/30 text-xs space-y-1">
              <div>
                File: <strong>{selectedDocForVerify?.fileName}</strong>
              </div>
              <div>
                Category: <span className="uppercase">{selectedDocForVerify?.category}</span>
              </div>
              <div className="font-mono text-[10px] text-muted-foreground">
                SHA-256: {selectedDocForVerify?.checksumSha256}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Verification Outcome</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name="verifyStatus"
                    value="verified"
                    checked={verifyStatus === "verified"}
                    onChange={() => setVerifyStatus("verified")}
                  />
                  <span className="font-semibold text-emerald-600">Approve & Verify</span>
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name="verifyStatus"
                    value="rejected"
                    checked={verifyStatus === "rejected"}
                    onChange={() => setVerifyStatus("rejected")}
                  />
                  <span className="font-semibold text-rose-600">Reject Document</span>
                </label>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Auditor Review Notes</label>
              <input
                type="text"
                placeholder="e.g. Government watermark confirmed"
                value={verifyNotes}
                onChange={(e) => setVerifyNotes(e.target.value)}
                className="w-full bg-background border border-input rounded-md px-3 py-1.5 text-sm"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsVerifyModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={verifying}>
                {verifying ? "Submitting…" : "Save Review Decision"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
