"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Document {
  doc_id: string;
  title: string;
  content: string;
  current_version: string;
  doc_type?: string;
}

interface SimilarDoc {
  docId: string;
  title: string;
  similarity: number;
}

interface Props {
  document: Document;
  helpfulCount: number;
  notHelpfulCount: number;
  organizationId: string;
}

export default function DocumentView({ 
  document, 
  helpfulCount, 
  notHelpfulCount,
  organizationId 
}: Props) {
  const [similarDocs, setSimilarDocs] = useState<SimilarDoc[]>([]);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Fetch similar documents on mount
  useEffect(() => {
    fetch(`/api/embeddings/similar?docId=${document.doc_id}&limit=3`)
      .then(res => res.json())
      .then(data => setSimilarDocs(data.similar || []))
      .catch(err => console.error("Failed to fetch similar docs:", err));
  }, [document.doc_id]);

  const handleFeedback = async (isHelpful: boolean) => {
    setSubmitting(true);
    setFeedbackMessage("");

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId: document.doc_id, isHelpful }),
      });

      if (res.ok) {
        setFeedbackMessage("✅ Thank you for your feedback!");
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setFeedbackMessage("❌ Failed to submit feedback");
      }
    } catch (error) {
      setFeedbackMessage("❌ Failed to submit feedback");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 1000, padding: "40px 20px" }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 24 }}>
        <Link href="/library" style={{ color: "#6B7280", textDecoration: "none", fontSize: 14 }}>
          ← Back to Library
        </Link>
      </div>

      {/* Document Header */}
      <div className="card" style={{ padding: 32, marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <span style={{ padding: "4px 12px", background: "#EEF2FF", color: "#4F46E5", borderRadius: 6, fontSize: 13, fontWeight: 600 }}>
            {document.doc_id}
          </span>
          <span style={{ padding: "4px 12px", background: "#F3F4F6", color: "#374151", borderRadius: 6, fontSize: 13 }}>
            {document.current_version}
          </span>
          {document.doc_type && (
            <span style={{ padding: "4px 12px", background: "#F3F4F6", color: "#374151", borderRadius: 6, fontSize: 13 }}>
              {document.doc_type}
            </span>
          )}
        </div>

        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 16, color: "#111827" }}>
          {document.title}
        </h1>

        <div style={{ display: "flex", gap: 16, paddingTop: 16, borderTop: "1px solid #E5E7EB" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 20 }}>👍</span>
            <span style={{ fontSize: 14, color: "#6B7280" }}>{helpfulCount} helpful</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 20 }}>👎</span>
            <span style={{ fontSize: 14, color: "#6B7280" }}>{notHelpfulCount} not helpful</span>
          </div>
        </div>
      </div>

      {/* Document Content */}
      <div className="card" style={{ padding: 32, marginBottom: 24 }}>
        <div style={{ fontSize: 16, lineHeight: 1.8, color: "#374151", whiteSpace: "pre-wrap" }}>
          {document.content || "No content available"}
        </div>
      </div>

      {/* Feedback */}
      <div className="card" style={{ padding: 24, marginBottom: 24 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
          Was this document helpful?
        </h3>

        {feedbackMessage && (
          <div style={{
            padding: 12,
            marginBottom: 16,
            borderRadius: 8,
            background: feedbackMessage.includes("✅") ? "#D1FAE5" : "#FEE2E2",
            color: feedbackMessage.includes("✅") ? "#065F46" : "#991B1B",
            fontSize: 14,
          }}>
            {feedbackMessage}
          </div>
        )}

        <div style={{ display: "flex", gap: 12 }}>
          <button
            className="btn"
            disabled={submitting}
            onClick={() => handleFeedback(true)}
            style={{ padding: "10px 20px", opacity: submitting ? 0.7 : 1 }}
          >
            👍 Helpful
          </button>
          <button
            className="btn"
            disabled={submitting}
            onClick={() => handleFeedback(false)}
            style={{ padding: "10px 20px", opacity: submitting ? 0.7 : 1 }}
          >
            👎 Not Helpful
          </button>
        </div>
      </div>

      {/* Similar Documents */}
      {similarDocs.length > 0 && (
        <div className="card" style={{ padding: 32 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
            🔗 Related Documents
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {similarDocs.map(doc => (
              <Link
                key={doc.docId}
                href={`/library/${doc.docId}`}
                className="card"
                style={{ padding: 16, textDecoration: "none", color: "inherit" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{doc.title}</div>
                    <div style={{ fontSize: 13, color: "#6B7280" }}>{doc.docId}</div>
                  </div>
                  <div style={{ padding: "4px 12px", background: "#EEF2FF", color: "#4F46E5", borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
                    {Math.round(doc.similarity * 100)}% match
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}