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

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this document? This cannot be undone.")) {
      return;
    }
    
    try {
      const res = await fetch(`/api/documents/${document.doc_id}`, {
        method: "DELETE",
      });
      
      if (res.ok) {
        window.location.href = "/library";
      } else {
        alert("Failed to delete document");
      }
    } catch (err) {
      alert("Failed to delete document");
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F9FAFB", paddingBottom: 60 }}>
      <div className="container" style={{ maxWidth: 900, padding: "40px 20px" }}>
        {/* Breadcrumb */}
        <div style={{ marginBottom: 32 }}>
          <Link 
            href="/library" 
            style={{ 
              color: "#6B7280", 
              textDecoration: "none", 
              fontSize: 14,
              fontWeight: 500,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            ← Back to Library
          </Link>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
          <Link
            href={`/library/${document.doc_id}/edit`}
            className="btn"
            style={{ padding: "10px 20px", fontSize: 14 }}
          >
            ✏️ Edit
          </Link>
          <button
            className="btn"
            onClick={handleDelete}
            style={{
              padding: "10px 20px",
              fontSize: 14,
              background: "#FEE2E2",
              color: "#991B1B",
              border: "1px solid #FCA5A5",
            }}
          >
            🗑️ Delete
          </button>
        </div>

        {/* Document Header Card */}
        <div 
          className="card" 
          style={{ 
            padding: "32px 40px", 
            marginBottom: 24,
            background: "white",
            borderRadius: 12,
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        >
          {/* Metadata Badges */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
            <span style={{ 
              padding: "6px 14px", 
              background: "#EEF2FF", 
              color: "#4F46E5", 
              borderRadius: 8, 
              fontSize: 13, 
              fontWeight: 600,
            }}>
              {document.doc_id}
            </span>
            <span style={{ 
              padding: "6px 14px", 
              background: "#F3F4F6", 
              color: "#374151", 
              borderRadius: 8, 
              fontSize: 13,
              fontWeight: 500,
            }}>
              Version {document.current_version}
            </span>
            {document.doc_type && (
              <span style={{ 
                padding: "6px 14px", 
                background: "#ECFDF5", 
                color: "#059669", 
                borderRadius: 8, 
                fontSize: 13,
                fontWeight: 500,
              }}>
                {document.doc_type}
              </span>
            )}
          </div>

          {/* Title */}
          <h1 style={{ 
            fontSize: 36, 
            fontWeight: 700, 
            marginBottom: 20, 
            color: "#111827",
            lineHeight: 1.2,
          }}>
            {document.title}
          </h1>

          {/* Feedback Stats */}
          <div style={{ 
            display: "flex", 
            gap: 24, 
            paddingTop: 20, 
            borderTop: "1px solid #E5E7EB",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 22 }}>👍</span>
              <span style={{ fontSize: 15, color: "#374151", fontWeight: 500 }}>
                {helpfulCount} people found this helpful
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 22 }}>👎</span>
              <span style={{ fontSize: 15, color: "#6B7280", fontWeight: 500 }}>
                {notHelpfulCount} didn't
              </span>
            </div>
          </div>
        </div>

        {/* Document Content Card */}
        <div 
          className="card" 
          style={{ 
            padding: "40px", 
            marginBottom: 24,
            background: "white",
            borderRadius: 12,
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        >
          <div style={{ 
            fontSize: 17, 
            lineHeight: 1.8, 
            color: "#1F2937", 
            whiteSpace: "pre-wrap",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}>
            {document.content || "No content available"}
          </div>
        </div>

        {/* Feedback Section */}
        <div 
          className="card" 
          style={{ 
            padding: "32px 40px", 
            marginBottom: 24,
            background: "white",
            borderRadius: 12,
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        >
          <h3 style={{ 
            fontSize: 20, 
            fontWeight: 700, 
            marginBottom: 20,
            color: "#111827",
          }}>
            Was this document helpful?
          </h3>

          {feedbackMessage && (
            <div style={{
              padding: 16,
              marginBottom: 20,
              borderRadius: 10,
              background: feedbackMessage.includes("✅") ? "#D1FAE5" : "#FEE2E2",
              color: feedbackMessage.includes("✅") ? "#065F46" : "#991B1B",
              fontSize: 15,
              fontWeight: 500,
            }}>
              {feedbackMessage}
            </div>
          )}

          <div style={{ display: "flex", gap: 12 }}>
            <button
              className="btn btn-primary"
              disabled={submitting}
              onClick={() => handleFeedback(true)}
              style={{ 
                padding: "12px 24px", 
                opacity: submitting ? 0.7 : 1,
                fontSize: 15,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              👍 Yes, helpful
            </button>
            <button
              className="btn"
              disabled={submitting}
              onClick={() => handleFeedback(false)}
              style={{ 
                padding: "12px 24px", 
                opacity: submitting ? 0.7 : 1,
                fontSize: 15,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              👎 No, not helpful
            </button>
          </div>
        </div>

        {/* Related Documents */}
        {similarDocs.length > 0 && (
          <div 
            className="card" 
            style={{ 
              padding: "32px 40px",
              background: "white",
              borderRadius: 12,
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            }}
          >
            <h3 style={{ 
              fontSize: 20, 
              fontWeight: 700, 
              marginBottom: 20,
              color: "#111827",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}>
              🔗 Related Documents
            </h3>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {similarDocs.map(doc => (
                <Link
                  key={doc.docId}
                  href={`/library/${doc.docId}`}
                  style={{ 
                    padding: 20, 
                    border: "2px solid #E5E7EB",
                    borderRadius: 10,
                    textDecoration: "none", 
                    color: "inherit",
                    display: "block",
                    transition: "all 0.2s",
                    background: "white",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#4F46E5";
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(79, 70, 237, 0.15)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#E5E7EB";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div style={{ 
                    display: "flex", 
                    justifyContent: "space-between", 
                    alignItems: "center",
                    gap: 20,
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        fontWeight: 600, 
                        marginBottom: 6,
                        fontSize: 16,
                        color: "#111827",
                      }}>
                        {doc.title}
                      </div>
                      <div style={{ fontSize: 14, color: "#6B7280" }}>
                        {doc.docId}
                      </div>
                    </div>
                    <div style={{ 
                      padding: "8px 16px", 
                      background: "#EEF2FF", 
                      color: "#4F46E5", 
                      borderRadius: 8, 
                      fontSize: 14, 
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}>
                      {Math.round(doc.similarity > 1 ? doc.similarity : doc.similarity * 100)}% match
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}