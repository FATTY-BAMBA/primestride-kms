"use client";

import { useState } from "react";
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
  const [title, setTitle] = useState(document.title);
  const [content, setContent] = useState(document.content);
  const [docType, setDocType] = useState(document.doc_type || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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
                  width: "100%",
                  padding: "12px 16px",
                  fontSize: 16,
                  border: "2px solid #E5E7EB",
                  borderRadius: 8,
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
                  width: "100%",
                  padding: "12px 16px",
                  fontSize: 16,
                  border: "2px solid #E5E7EB",
                  borderRadius: 8,
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
                required
                disabled={saving}
                rows={20}
                style={{
                  width: "100%",
                  padding: "16px",
                  fontSize: 15,
                  border: "2px solid #E5E7EB",
                  borderRadius: 8,
                  fontFamily: "monospace",
                  lineHeight: 1.6,
                }}
              />
              <p style={{ fontSize: 13, color: "#6B7280", marginTop: 8 }}>
                {content.length} characters
              </p>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button
                type="submit"
                disabled={saving}
                className="btn btn-primary"
                style={{
                  padding: "12px 24px",
                  fontSize: 16,
                  fontWeight: 600,
                  opacity: saving ? 0.7 : 1,
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