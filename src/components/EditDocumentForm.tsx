"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Document {
  doc_id: string;
  title: string;
  content: string;
  doc_type?: string;
  current_version: string;
}

export default function EditDocumentForm({ document }: { document: Document }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(document.title);
  const [content, setContent] = useState(document.content);
  const [docType, setDocType] = useState(document.doc_type || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);
  const [fileName, setFileName] = useState("");

  // Shared input styles
  const inputStyle = {
    width: "100%",
    padding: "12px 16px",
    fontSize: 16,
    border: "1px solid #D1D5DB",
    borderRadius: 8,
    background: "#FFFFFF",
    color: "#111827",
    outline: "none",
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch(`/api/documents/${document.doc_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, docType }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage("✅ Document updated successfully!");
        setTimeout(() => {
          router.push(`/library/${document.doc_id}`);
        }, 1000);
      } else {
        setError(data.error || "Failed to update document");
      }
    } catch (err) {
      setError("Failed to update document");
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    setError("");
    setFileName(file.name);

    try {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      
      // Handle plain text files directly
      if (fileExtension === 'txt' || fileExtension === 'md') {
        const text = await file.text();
        setContent(text);
        setMessage(`✅ Loaded content from ${file.name}`);
        setUploadingFile(false);
        return;
      }

      // For PDF and DOCX, send to API for parsing
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/documents/parse', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (res.ok && data.content) {
        setContent(data.content);
        setMessage(`✅ Extracted content from ${file.name}`);
      } else {
        setError(data.error || 'Failed to extract content from file');
      }
    } catch (err) {
      setError('Failed to process file');
    } finally {
      setUploadingFile(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F9FAFB", paddingBottom: 60 }}>
      <div className="container" style={{ maxWidth: 900, padding: "40px 20px" }}>
        <div style={{ marginBottom: 32 }}>
          <Link
            href={`/library/${document.doc_id}`}
            style={{
              color: "#6B7280",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            ← Back to Document
          </Link>
        </div>

        <div
          className="card"
          style={{
            padding: 40,
            background: "white",
            borderRadius: 12,
          }}
        >
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
            Edit Document
          </h1>
          <p style={{ color: "#6B7280", marginBottom: 32 }}>
            {document.doc_id} • Version {document.current_version}
          </p>

          {message && (
            <div
              style={{
                padding: 16,
                marginBottom: 24,
                borderRadius: 8,
                background: "#D1FAE5",
                color: "#065F46",
                fontSize: 15,
              }}
            >
              {message}
            </div>
          )}

          {error && (
            <div
              style={{
                padding: 16,
                marginBottom: 24,
                borderRadius: 8,
                background: "#FEE2E2",
                color: "#991B1B",
                fontSize: 15,
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSave}>
            <div style={{ marginBottom: 24 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 14,
                  fontWeight: 600,
                  marginBottom: 8,
                  color: "#374151",
                }}
              >
                Document Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                disabled={saving}
                style={{
                  ...inputStyle,
                  opacity: saving ? 0.6 : 1,
                }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 14,
                  fontWeight: 600,
                  marginBottom: 8,
                  color: "#374151",
                }}
              >
                Document Type
              </label>
              <input
                type="text"
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                placeholder="e.g., guide, playbook, strategy"
                disabled={saving}
                style={{
                  ...inputStyle,
                  opacity: saving ? 0.6 : 1,
                }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 14,
                  fontWeight: 600,
                  marginBottom: 8,
                  color: "#374151",
                }}
              >
                Content *
              </label>
              
              {/* File Upload Option */}
              <div
                style={{
                  marginBottom: 16,
                  padding: 20,
                  border: "2px dashed #D1D5DB",
                  borderRadius: 8,
                  background: "#F9FAFB",
                  textAlign: "center",
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.doc,.txt,.md"
                  onChange={handleFileUpload}
                  disabled={uploadingFile || saving}
                  style={{ display: "none" }}
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  style={{
                    cursor: uploadingFile || saving ? "not-allowed" : "pointer",
                    display: "block",
                  }}
                >
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 32 }}>📄</span>
                  </div>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: "#374151",
                      marginBottom: 4,
                    }}
                  >
                    {uploadingFile ? "Processing..." : "Upload a file to replace content"}
                  </div>
                  <div style={{ fontSize: 13, color: "#6B7280" }}>
                    Supports PDF, DOCX, TXT, MD files
                  </div>
                  {fileName && !uploadingFile && (
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 13,
                        color: "#059669",
                        fontWeight: 500,
                      }}
                    >
                      Last uploaded: {fileName}
                    </div>
                  )}
                </label>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <div
                  style={{ flex: 1, height: 1, background: "#E5E7EB" }}
                ></div>
                <span style={{ fontSize: 13, color: "#6B7280", fontWeight: 500 }}>
                  or edit directly
                </span>
                <div
                  style={{ flex: 1, height: 1, background: "#E5E7EB" }}
                ></div>
              </div>

              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
                disabled={saving}
                rows={20}
                style={{
                  ...inputStyle,
                  padding: "16px",
                  fontSize: 15,
                  fontFamily: "monospace",
                  lineHeight: 1.6,
                  resize: "vertical",
                  opacity: saving ? 0.6 : 1,
                }}
              />
              <p style={{ fontSize: 13, color: "#6B7280", marginTop: 8 }}>
                {content.length} characters
              </p>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button
                type="submit"
                disabled={saving || uploadingFile}
                className="btn btn-primary"
                style={{
                  padding: "12px 24px",
                  fontSize: 16,
                  fontWeight: 600,
                  opacity: saving || uploadingFile ? 0.7 : 1,
                }}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <Link
                href={`/library/${document.doc_id}`}
                className="btn"
                style={{ padding: "12px 24px", fontSize: 16 }}
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}