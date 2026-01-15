"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import UserMenu from "@/components/UserMenu";
import { useAuth } from "@/lib/AuthContext";

type Doc = {
  doc_id: string;
  title: string;
  google_doc_url: string;
  current_version: string;
  status: string;
};

type FeedbackValue = "helped" | "not_confident" | "didnt_help";

export default function DocPage() {
  const params = useParams();
  const docId = decodeURIComponent(String(params.docId));
  const { user, profile } = useAuth();

  const [doc, setDoc] = useState<Doc | null>(null);
  const [notes, setNotes] = useState<string>("");
  const [statusMsg, setStatusMsg] = useState<string>("");
  const [statusType, setStatusType] = useState<"success" | "error" | "">("");
  const [loading, setLoading] = useState(true);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await fetch("/api/learning-summary");
      const data = await res.json();
      const found = (data.documents ?? []).find(
        (d: Doc) => d.doc_id === docId
      );
      setDoc(found ?? null);
      setLoading(false);
    })();
  }, [docId]);

  useEffect(() => {
    if (!doc) return;
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_email: user?.email || null,
        doc_id: doc.doc_id,
        version: doc.current_version,
        event_type: "view",
      }),
    });
  }, [doc?.doc_id, doc?.current_version, user?.email]);

  const openDoc = async () => {
    if (!doc) return;
    await fetch("/api/doc-open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_email: user?.email || null,
        doc_id: doc.doc_id,
        version: doc.current_version,
      }),
    });
    window.open(doc.google_doc_url, "_blank", "noopener,noreferrer");
  };

  const submitFeedback = async (value: FeedbackValue) => {
    if (!doc) return;
    setStatusMsg("Submitting...");
    setStatusType("");

    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_email: user?.email || null,
        doc_id: doc.doc_id,
        version: doc.current_version,
        event_type: "feedback",
        value,
        notes: notes.trim() || null,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setStatusMsg(`Error: ${data?.error ?? "Failed"}`);
      setStatusType("error");
      return;
    }

    setNotes("");
    setFeedbackSubmitted(true);
    setStatusMsg("Thanks! Your feedback will improve the next version.");
    setStatusType("success");
  };

  return (
    <ProtectedRoute>
      <main className="container">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text-secondary)", fontSize: 14 }}>
            <span>←</span>
            <span>Back to Library</span>
          </Link>
          <UserMenu />
        </div>

        {loading && <div className="loading">Loading document...</div>}

        {!loading && !doc && (
          <div className="card">
            <h1 style={{ marginBottom: 12 }}>Document not found</h1>
            <p style={{ color: "var(--text-secondary)" }}>
              The document ID &quot;{docId}&quot; doesn&apos;t exist.
            </p>
            <Link href="/" className="btn" style={{ marginTop: 16 }}>Return to Library</Link>
          </div>
        )}

        {!loading && doc && (
          <div className="animate-in">
            <header style={{ marginBottom: 32 }}>
              <h1 style={{ marginBottom: 12 }}>{doc.title}</h1>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span className="badge mono">{doc.doc_id}</span>
                <span className="badge">{doc.current_version}</span>
                <span className="badge badge-success">{doc.status}</span>
              </div>
            </header>

            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" style={{ width: 36, height: 36, borderRadius: "50%" }} />
                ) : (
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 600, color: "white" }}>
                    {(profile?.full_name || user?.email || "U").charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{profile?.full_name || "User"}</div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{user?.email}</div>
                </div>
              </div>
            </div>

            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                <div>
                  <h3 style={{ fontSize: 16, marginBottom: 4 }}>📄 View Document</h3>
                  <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: 0 }}>
                    Opens in a new tab. Return here to provide feedback.
                  </p>
                </div>
                <button onClick={openDoc} className="btn btn-primary">
                  Open Google Doc <span>↗</span>
                </button>
              </div>
            </div>

            <div className="card">
              <h3 style={{ fontSize: 16, marginBottom: 16 }}>💡 How did this document help you?</h3>

              {feedbackSubmitted ? (
                <div style={{ background: "var(--accent-green-soft)", border: "1px solid var(--accent-green)", borderRadius: "var(--radius-md)", padding: 16, textAlign: "center" }}>
                  <p style={{ color: "var(--accent-green)", fontWeight: 500 }}>✓ Feedback recorded — thank you!</p>
                  <button onClick={() => setFeedbackSubmitted(false)} className="btn" style={{ marginTop: 12 }}>
                    Submit More Feedback
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                    <button onClick={() => submitFeedback("helped")} className="btn btn-success" style={{ flex: "1 1 auto" }}>
                      ✓ This helped
                    </button>
                    <button onClick={() => submitFeedback("not_confident")} className="btn btn-warning" style={{ flex: "1 1 auto" }}>
                      ⚠ Not confident yet
                    </button>
                    <button onClick={() => submitFeedback("didnt_help")} className="btn btn-danger" style={{ flex: "1 1 auto" }}>
                      ✗ Didn&apos;t help
                    </button>
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: 8, fontSize: 14, color: "var(--text-secondary)" }}>
                      Optional: What was unclear or could be improved?
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g., The section on analytics was confusing..."
                      rows={3}
                      style={{ resize: "vertical" }}
                    />
                  </div>
                </>
              )}

              {statusMsg && (
                <div style={{
                  marginTop: 16,
                  padding: 12,
                  borderRadius: "var(--radius-md)",
                  background: statusType === "success" ? "var(--accent-green-soft)" : statusType === "error" ? "var(--accent-red-soft)" : "var(--bg-secondary)",
                  color: statusType === "success" ? "var(--accent-green)" : statusType === "error" ? "var(--accent-red)" : "var(--text-secondary)",
                  fontSize: 14,
                }}>
                  {statusMsg}
                </div>
              )}
            </div>

            <p style={{ marginTop: 24, fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>
              Feedback is logged per document version. Weekly updates will bump the version based on patterns.
            </p>
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
}