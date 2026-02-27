"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface UploadingFile {
  id: string;
  file: File;
  name: string;
  size: number;
  status: "queued" | "extracting" | "uploading" | "processing" | "done" | "error";
  progress: string;
  docId?: string;
  error?: string;
}

const ACCEPTED_EXTENSIONS = [
  ".pdf", ".doc", ".docx", ".pptx", ".ppt",
  ".xlsx", ".xls", ".csv", ".tsv",
  ".txt", ".md", ".rtf", ".json", ".xml", ".html",
];

const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "text/tab-separated-values",
  "text/plain",
  "text/markdown",
  "application/rtf",
  "application/json",
  "application/xml",
  "text/xml",
  "text/html",
];

function getFileIcon(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const icons: Record<string, string> = {
    pdf: "📕", doc: "📘", docx: "📘",
    pptx: "📙", ppt: "📙",
    xlsx: "📗", xls: "📗", csv: "📗", tsv: "📗",
    txt: "📄", md: "📄", rtf: "📄",
    json: "📋", xml: "📋", html: "🌐",
  };
  return icons[ext] || "📄";
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<UploadingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [teamId, setTeamId] = useState<string>("");
  const [teams, setTeams] = useState<{ id: string; name: string; color: string }[]>([]);
  const [teamsLoaded, setTeamsLoaded] = useState(false);

  // Load teams on first interaction
  const loadTeams = useCallback(async () => {
    if (teamsLoaded) return;
    try {
      const res = await fetch("/api/teams");
      const data = await res.json();
      if (res.ok) setTeams(data.teams || []);
    } catch {}
    setTeamsLoaded(true);
  }, [teamsLoaded]);

  const isValidFile = (file: File): boolean => {
    const ext = "." + (file.name.split(".").pop()?.toLowerCase() || "");
    return ACCEPTED_EXTENSIONS.includes(ext) || ACCEPTED_MIME_TYPES.includes(file.type);
  };

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    loadTeams();
    const fileArray = Array.from(newFiles);
    const validFiles = fileArray.filter(isValidFile);
    const invalidFiles = fileArray.filter(f => !isValidFile(f));

    if (invalidFiles.length > 0) {
      alert(`Unsupported file types skipped: ${invalidFiles.map(f => f.name).join(", ")}\n\nSupported: PDF, Word, PowerPoint, Excel, CSV, TXT, Markdown, RTF, JSON, XML, HTML`);
    }

    const uploadingFiles: UploadingFile[] = validFiles.map(file => ({
      id: generateId(),
      file,
      name: file.name,
      size: file.size,
      status: "queued",
      progress: "Waiting...",
    }));

    setFiles(prev => [...prev, ...uploadingFiles]);

    // Process each file
    uploadingFiles.forEach(uf => processFile(uf));
  }, [loadTeams, teamId]);

  const processFile = async (uf: UploadingFile) => {
    const updateFile = (updates: Partial<UploadingFile>) => {
      setFiles(prev => prev.map(f => f.id === uf.id ? { ...f, ...updates } : f));
    };

    try {
      // Step 1: Extract text
      updateFile({ status: "extracting", progress: "Extracting text..." });

      const ext = uf.name.split(".").pop()?.toLowerCase() || "";
      let extractedContent = "";

      if (["txt", "md", "csv", "tsv", "json", "xml", "html"].includes(ext)) {
        extractedContent = await uf.file.text();
      } else {
        const formData = new FormData();
        formData.append("file", uf.file);
        const parseRes = await fetch("/api/documents/parse", {
          method: "POST",
          body: formData,
        });
        const parseData = await parseRes.json();
        if (parseRes.ok && parseData.content) {
          extractedContent = parseData.content;
        }
      }

      // Step 2: Upload file to storage
      updateFile({ status: "uploading", progress: "Uploading file..." });

      const uploadFormData = new FormData();
      uploadFormData.append("file", uf.file);
      uploadFormData.append("docId", "auto");

      const uploadRes = await fetch("/api/documents/upload", {
        method: "POST",
        body: uploadFormData,
      });
      const uploadData = await uploadRes.json();

      if (!uploadRes.ok) {
        throw new Error(uploadData.error || "Upload failed");
      }

      // Step 3: Create document (AI auto-generates everything)
      updateFile({ status: "processing", progress: "AI processing..." });

      const createRes = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: null, // API will auto-generate from filename
          content: extractedContent || null,
          fileUrl: uploadData.fileUrl,
          fileName: uploadData.fileName,
          fileType: uploadData.fileType,
          originalFileName: uf.name,
          teamId: teamId || null,
          autoGenerate: true, // Signal to API to auto-generate everything
        }),
      });

      const createData = await createRes.json();

      if (!createRes.ok) {
        throw new Error(createData.error || "Failed to create document");
      }

      updateFile({
        status: "done",
        progress: "Done!",
        docId: createData.docId,
      });
    } catch (err: any) {
      updateFile({
        status: "error",
        progress: "Failed",
        error: err?.message || "Upload failed",
      });
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const retryFile = (uf: UploadingFile) => {
    setFiles(prev => prev.map(f =>
      f.id === uf.id ? { ...f, status: "queued" as const, progress: "Retrying...", error: undefined } : f
    ));
    processFile(uf);
  };

  // Drag & drop handlers
  const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const doneCount = files.filter(f => f.status === "done").length;
  const errorCount = files.filter(f => f.status === "error").length;
  const processingCount = files.filter(f => !["done", "error"].includes(f.status)).length;

  return (
    <div style={{ minHeight: "100vh", background: "#F9FAFB" }}>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 20px" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
          <div>
            <Link href="/library" style={{ color: "#6B7280", textDecoration: "none", fontSize: 14, fontWeight: 500 }}>
              ← Back to Library
            </Link>
            <h1 style={{ fontSize: 28, fontWeight: 700, margin: "12px 0 4px" }}>Upload Documents</h1>
            <p style={{ color: "#6B7280", margin: 0, fontSize: 15 }}>
              Drop your files — AI handles the rest
            </p>
          </div>
          {doneCount > 0 && (
            <Link
              href="/library"
              className="btn btn-primary"
              style={{ padding: "12px 24px", fontSize: 15, fontWeight: 600 }}
            >
              Go to Library →
            </Link>
          )}
        </div>

        {/* Optional: Team selector */}
        {teams.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 13, color: "#6B7280", display: "block", marginBottom: 6 }}>
              Assign to group (optional)
            </label>
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              style={{
                padding: "10px 14px", borderRadius: 8,
                border: "1px solid #D1D5DB", background: "white",
                fontSize: 14, color: "#374151", minWidth: 200,
              }}
            >
              <option value="">🌐 Organization-wide</option>
              {teams.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Drop Zone */}
        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            padding: files.length > 0 ? "40px 24px" : "80px 24px",
            border: `2px dashed ${isDragging ? "#7C3AED" : "#D1D5DB"}`,
            borderRadius: 16,
            background: isDragging ? "#F5F3FF" : "white",
            textAlign: "center",
            cursor: "pointer",
            transition: "all 0.2s",
            marginBottom: 24,
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_EXTENSIONS.join(",")}
            onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
            style={{ display: "none" }}
          />

          <div style={{ fontSize: 48, marginBottom: 16 }}>
            {isDragging ? "✨" : "📂"}
          </div>
          <div style={{ fontSize: 18, fontWeight: 600, color: "#111827", marginBottom: 8 }}>
            {isDragging ? "Drop files here" : "Drag & drop files here"}
          </div>
          <div style={{ fontSize: 14, color: "#6B7280", marginBottom: 16 }}>
            or click to browse
          </div>
          <div style={{
            display: "inline-flex", flexWrap: "wrap", gap: 6,
            justifyContent: "center", maxWidth: 500,
          }}>
            {["PDF", "Word", "PowerPoint", "Excel", "CSV", "TXT", "Markdown", "RTF", "JSON", "XML", "HTML"].map(fmt => (
              <span key={fmt} style={{
                padding: "4px 10px", background: "#F3F4F6",
                borderRadius: 6, fontSize: 12, color: "#6B7280", fontWeight: 500,
              }}>
                {fmt}
              </span>
            ))}
          </div>
        </div>

        {/* File Queue */}
        {files.length > 0 && (
          <>
            {/* Summary bar */}
            <div style={{
              display: "flex", gap: 16, marginBottom: 16,
              padding: "12px 16px", background: "white",
              borderRadius: 10, border: "1px solid #E5E7EB",
              fontSize: 14, color: "#6B7280", alignItems: "center",
            }}>
              <span style={{ fontWeight: 600, color: "#111827" }}>{files.length} file{files.length !== 1 ? "s" : ""}</span>
              {processingCount > 0 && <span>⏳ {processingCount} processing</span>}
              {doneCount > 0 && <span style={{ color: "#059669" }}>✓ {doneCount} done</span>}
              {errorCount > 0 && <span style={{ color: "#DC2626" }}>✕ {errorCount} failed</span>}
              <div style={{ flex: 1 }} />
              {files.every(f => ["done", "error"].includes(f.status)) && (
                <button
                  onClick={() => setFiles([])}
                  style={{
                    background: "none", border: "none", color: "#6B7280",
                    cursor: "pointer", fontSize: 13, fontWeight: 500,
                  }}
                >
                  Clear all
                </button>
              )}
            </div>

            {/* File list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {files.map(f => (
                <div key={f.id} style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "14px 18px", background: "white",
                  borderRadius: 10, border: "1px solid #E5E7EB",
                  transition: "all 0.2s",
                }}>
                  {/* Icon */}
                  <span style={{ fontSize: 28, flexShrink: 0 }}>{getFileIcon(f.name)}</span>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: 600, color: "#111827", fontSize: 14,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      {f.name}
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                      <span style={{ fontSize: 12, color: "#9CA3AF" }}>{formatSize(f.size)}</span>
                      <span style={{
                        fontSize: 12, fontWeight: 500,
                        color: f.status === "done" ? "#059669"
                          : f.status === "error" ? "#DC2626"
                          : "#7C3AED",
                      }}>
                        {f.progress}
                      </span>
                    </div>
                    {f.error && (
                      <div style={{ fontSize: 12, color: "#DC2626", marginTop: 4 }}>{f.error}</div>
                    )}
                  </div>

                  {/* Status / Actions */}
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    {f.status === "done" && f.docId && (
                      <Link
                        href={`/library/${encodeURIComponent(f.docId)}`}
                        style={{
                          padding: "6px 14px", background: "#D1FAE5",
                          color: "#065F46", borderRadius: 8,
                          fontSize: 13, fontWeight: 600, textDecoration: "none",
                        }}
                      >
                        View →
                      </Link>
                    )}
                    {f.status === "error" && (
                      <button
                        onClick={() => retryFile(f)}
                        style={{
                          padding: "6px 14px", background: "#FEF3C7",
                          color: "#92400E", borderRadius: 8, border: "none",
                          fontSize: 13, fontWeight: 600, cursor: "pointer",
                        }}
                      >
                        Retry
                      </button>
                    )}
                    {!["extracting", "uploading", "processing"].includes(f.status) && (
                      <button
                        onClick={() => removeFile(f.id)}
                        style={{
                          padding: "6px 10px", background: "none", border: "none",
                          color: "#9CA3AF", cursor: "pointer", fontSize: 16,
                        }}
                      >
                        ✕
                      </button>
                    )}
                    {["extracting", "uploading", "processing"].includes(f.status) && (
                      <div style={{
                        width: 24, height: 24, borderRadius: "50%",
                        border: "3px solid #E5E7EB", borderTopColor: "#7C3AED",
                        animation: "spin 0.8s linear infinite",
                      }} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Empty state hint */}
        {files.length === 0 && (
          <div style={{ textAlign: "center", padding: "20px 0", color: "#9CA3AF", fontSize: 14 }}>
            <p style={{ marginBottom: 4 }}>Upload any document and AI will automatically:</p>
            <p style={{ margin: 0 }}>
              <strong style={{ color: "#6B7280" }}>Generate title</strong> · <strong style={{ color: "#6B7280" }}>Extract content</strong> · <strong style={{ color: "#6B7280" }}>Add tags</strong> · <strong style={{ color: "#6B7280" }}>Create summary</strong> · <strong style={{ color: "#6B7280" }}>Build embeddings</strong>
            </p>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
