"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function CreateDocumentForm() {
  const router = useRouter();
  const [docId, setDocId] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [docType, setDocType] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError("");

    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId, title, content, docType }),
      });

      const data = await res.json();

      if (res.ok) {
        router.push(`/library/${data.docId}`);
      } else {
        setError(data.error || "Failed to create document");
      }
    } catch (err) {
      setError("Failed to create document");
    } finally {
      setCreating(false);
    }
  };

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

  return (
    <div style={{ minHeight: "100vh", background: "#F9FAFB", paddingBottom: 60 }}>
      <div className="container" style={{ maxWidth: 900, padding: "40px 20px" }}>
        <div style={{ marginBottom: 32 }}>
          <Link
            href="/library"
            style={{
              color: "#6B7280",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            ← Back to Library
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
            Create New Document
          </h1>
          <p style={{ color: "#6B7280", marginBottom: 32 }}>
            Add a new document to your knowledge base
          </p>

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

          <form onSubmit={handleCreate}>
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
                Document ID *
              </label>
              <input
                type="text"
                value={docId}
                onChange={(e) => setDocId(e.target.value.toUpperCase())}
                placeholder="PS-GUIDE-001"
                required
                disabled={creating}
                pattern="[A-Z0-9-]+"
                style={{
                  ...inputStyle,
                  opacity: creating ? 0.6 : 1,
                }}
              />
              <p style={{ fontSize: 13, color: "#6B7280", marginTop: 8 }}>
                Format: PS-TYPE-### (e.g., PS-GUIDE-001)
              </p>
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
                Document Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Customer Onboarding Guide"
                required
                disabled={creating}
                style={{
                  ...inputStyle,
                  opacity: creating ? 0.6 : 1,
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
                disabled={creating}
                style={{
                  ...inputStyle,
                  opacity: creating ? 0.6 : 1,
                }}
              />
            </div>

            <div style={{ marginBottom: 32 }}>
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
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Start writing your document content here..."
                required
                disabled={creating}
                rows={20}
                style={{
                  ...inputStyle,
                  padding: "16px",
                  fontSize: 15,
                  fontFamily: "monospace",
                  lineHeight: 1.6,
                  resize: "vertical",
                  opacity: creating ? 0.6 : 1,
                }}
              />
              <p style={{ fontSize: 13, color: "#6B7280", marginTop: 8 }}>
                {content.length} characters
              </p>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button
                type="submit"
                disabled={creating}
                className="btn btn-primary"
                style={{
                  padding: "12px 24px",
                  fontSize: 16,
                  fontWeight: 600,
                  opacity: creating ? 0.7 : 1,
                }}
              >
                {creating ? "Creating..." : "Create Document"}
              </button>
              <Link
                href="/library"
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