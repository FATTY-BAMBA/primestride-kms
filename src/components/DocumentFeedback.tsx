"use client";

import { useState } from "react";

interface DocumentFeedbackProps {
  docId: string;
  helpfulCount: number;
  notHelpfulCount: number;
}

export default function DocumentFeedback({
  docId,
  helpfulCount,
  notHelpfulCount,
}: DocumentFeedbackProps) {
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const handleFeedback = async (isHelpful: boolean) => {
    setSubmitting(true);
    setMessage("");

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId, isHelpful }),
      });

      if (res.ok) {
        setMessage("✅ Thank you for your feedback!");
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        setMessage("❌ Failed to submit feedback");
      }
    } catch (error) {
      setMessage("❌ Failed to submit feedback");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card" style={{ padding: 24 }}>
      <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
        Was this document helpful?
      </h3>

      {message && (
        <div
          style={{
            padding: 12,
            marginBottom: 16,
            borderRadius: 8,
            background: message.includes("✅") ? "#D1FAE5" : "#FEE2E2",
            color: message.includes("✅") ? "#065F46" : "#991B1B",
            fontSize: 14,
          }}
        >
          {message}
        </div>
      )}

      <div style={{ display: "flex", gap: 12 }}>
        <button
          className="btn"
          disabled={submitting}
          style={{
            padding: "10px 20px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            opacity: submitting ? 0.7 : 1,
          }}
          onClick={() => handleFeedback(true)}
        >
          👍 Helpful ({helpfulCount})
        </button>
        <button
          className="btn"
          disabled={submitting}
          style={{
            padding: "10px 20px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            opacity: submitting ? 0.7 : 1,
          }}
          onClick={() => handleFeedback(false)}
        >
          👎 Not Helpful ({notHelpfulCount})
        </button>
      </div>
    </div>
  );
}