"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Document {
  doc_id: string;
  title: string;
  content: string;
  summary?: string;
  current_version: string;
  doc_type?: string;
  tags?: string[];
  file_url?: string;
  file_name?: string;
  file_type?: string;
}

interface SimilarDoc {
  doc_id: string;
  title: string;
  similarity: number;
}

interface Version {
  id: string;
  version_number: string;
  title: string;
  content: string;
  summary: string | null;
  doc_type: string | null;
  tags: string[] | null;
  change_description: string | null;
  created_by: string;
  created_at: string;
}

interface Props {
  document: Document;
  helpfulCount: number;
  notHelpfulCount: number;
  organizationId: string;
  userRole?: string;
}

export default function DocumentView({
  document,
  helpfulCount,
  notHelpfulCount,
  organizationId,
  userRole,
}: Props) {
  const isAdmin = userRole === "owner" || userRole === "admin";
  const [similarDocs, setSimilarDocs] = useState<SimilarDoc[]>([]);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [summary, setSummary] = useState(document.summary || "");
  const [generatingSummary, setGeneratingSummary] = useState(false);

  // Version history state
  const [versions, setVersions] = useState<Version[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [viewingVersion, setViewingVersion] = useState<Version | null>(null);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [restoringVersion, setRestoringVersion] = useState(false);

  // Tag management state
  const [docTags, setDocTags] = useState<string[]>(document.tags || []);
  const [tagInput, setTagInput] = useState("");
  const [showTagEditor, setShowTagEditor] = useState(false);
  const [suggestingTags, setSuggestingTags] = useState(false);
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);

  useEffect(() => {
    fetch(`/api/embeddings/similar?docId=${document.doc_id}&limit=3`)
      .then((res) => res.json())
      .then((data) => setSimilarDocs(data.similar || []))
      .catch((err) => console.error("Failed to fetch similar docs:", err));
  }, [document.doc_id]);

  const fetchVersions = async () => {
    if (versions.length > 0) {
      setShowVersions(!showVersions);
      return;
    }
    setLoadingVersions(true);
    try {
      const res = await fetch(`/api/versions?docId=${document.doc_id}`);
      const data = await res.json();
      setVersions(data.versions || []);
      setShowVersions(true);
    } catch {
      console.error("Failed to fetch versions");
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleRestoreVersion = async (version: Version) => {
    if (!confirm(`Restore to ${version.version_number}? Current content will be saved as a new version first.`)) return;
    setRestoringVersion(true);
    try {
      await fetch("/api/versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docId: document.doc_id,
          changeDescription: `Snapshot before restoring to ${version.version_number}`,
        }),
      });
      const res = await fetch(`/api/documents/${document.doc_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: version.title, content: version.content }),
      });
      if (res.ok) window.location.reload();
    } catch {
      alert("Failed to restore version");
    } finally {
      setRestoringVersion(false);
    }
  };

  // ── Tag Management ──
  const saveTagsToServer = async (newTags: string[]) => {
    try {
      await fetch(`/api/documents/${document.doc_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: newTags }),
      });
    } catch {
      console.error("Failed to save tags");
    }
  };

  const addTag = (tag: string) => {
    const cleaned = tag.trim();
    if (cleaned && !docTags.includes(cleaned)) {
      const newTags = [...docTags, cleaned];
      setDocTags(newTags);
      saveTagsToServer(newTags);
      setSuggestedTags(suggestedTags.filter(t => t !== cleaned));
    }
    setTagInput("");
  };

  const removeDocTag = (tag: string) => {
    const newTags = docTags.filter(t => t !== tag);
    setDocTags(newTags);
    saveTagsToServer(newTags);
  };

  const handleSuggestTags = async () => {
    setSuggestingTags(true);
    setSuggestedTags([]);
    try {
      const res = await fetch("/api/tags/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: document.title,
          content: document.content,
          docType: document.doc_type,
        }),
      });
      const data = await res.json();
      if (res.ok && data.tags) {
        setSuggestedTags(data.tags.filter((t: string) => !docTags.includes(t)));
      }
    } catch {
      console.error("Failed to suggest tags");
    } finally {
      setSuggestingTags(false);
    }
  };

  const handleGenerateSummary = async () => {
    setGeneratingSummary(true);
    try {
      const res = await fetch("/api/documents/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId: document.doc_id }),
      });
      const data = await res.json();
      if (res.ok && data.summary) {
        setSummary(data.summary);
      }
    } catch (error) {
      console.error("Failed to generate summary:", error);
    } finally {
      setGeneratingSummary(false);
    }
  };

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
    } catch {
      setFeedbackMessage("❌ Failed to submit feedback");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this document? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/documents/${document.doc_id}`, { method: "DELETE" });
      if (res.ok) {
        window.location.href = "/library";
      } else {
        alert("Failed to delete document");
      }
    } catch {
      alert("Failed to delete document");
    }
  };

  const isPdf = document.file_type === "pdf" || document.file_name?.endsWith(".pdf");

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  // Content to display — either current doc or a historical version
  const displayTitle = viewingVersion?.title || document.title;
  const displayContent = viewingVersion?.content || document.content;

  return (
    <div style={{ minHeight: "100vh", background: "#F9FAFB", paddingBottom: 60 }}>
      <div className="container" style={{ maxWidth: 900, padding: "40px 20px" }}>
        {/* Breadcrumb */}
        <div style={{ marginBottom: 32 }}>
          <Link href="/library" style={{ color: "#6B7280", textDecoration: "none", fontSize: 14, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 6 }}>
            ← Back to Library
          </Link>
        </div>

        {/* Viewing old version banner */}
        {viewingVersion && (
          <div style={{
            padding: "14px 20px", marginBottom: 24, borderRadius: 10,
            background: "#FEF3C7", border: "1px solid #F59E0B",
            display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18 }}>🕐</span>
              <span style={{ fontWeight: 600, color: "#92400E" }}>
                Viewing {viewingVersion.version_number} — {formatDate(viewingVersion.created_at)}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => handleRestoreVersion(viewingVersion)}
                disabled={restoringVersion}
                style={{
                  padding: "6px 14px", borderRadius: 8, border: "none",
                  background: "#7C3AED", color: "white", fontSize: 13,
                  fontWeight: 600, cursor: "pointer",
                }}
              >
                {restoringVersion ? "Restoring..." : "↩️ Restore this version"}
              </button>
              <button
                onClick={() => setViewingVersion(null)}
                style={{
                  padding: "6px 14px", borderRadius: 8, border: "1px solid #D1D5DB",
                  background: "white", fontSize: 13, fontWeight: 500, cursor: "pointer",
                }}
              >
                Back to current
              </button>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {isAdmin && !viewingVersion && (
          <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
            <Link href={`/library/${document.doc_id}/edit`} className="btn" style={{ padding: "10px 20px", fontSize: 14 }}>
              ✏️ Edit
            </Link>
            <button className="btn" onClick={handleDelete} style={{ padding: "10px 20px", fontSize: 14, background: "#FEE2E2", color: "#991B1B", border: "1px solid #FCA5A5" }}>
              🗑️ Delete
            </button>
          </div>
        )}

        {/* Document Header Card */}
        <div className="card" style={{ padding: "32px 40px", marginBottom: 24, background: "white", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
            <span style={{ padding: "6px 14px", background: "#EEF2FF", color: "#4F46E5", borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
              {document.doc_id}
            </span>
            <span style={{ padding: "6px 14px", background: "#F3F4F6", color: "#374151", borderRadius: 8, fontSize: 13, fontWeight: 500 }}>
              Version {document.current_version}
            </span>
            {document.doc_type && (
              <span style={{ padding: "6px 14px", background: "#ECFDF5", color: "#059669", borderRadius: 8, fontSize: 13, fontWeight: 500 }}>
                {document.doc_type}
              </span>
            )}
          </div>

          <h1 style={{ fontSize: 36, fontWeight: 700, marginBottom: 20, color: "#111827", lineHeight: 1.2 }}>
            {displayTitle}
          </h1>

          {/* Tags */}
          {!viewingVersion && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {docTags.map((tag) => (
                  <span key={tag} style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "4px 10px", background: "#EEF2FF", color: "#4338CA",
                    borderRadius: 6, fontSize: 13, fontWeight: 600,
                  }}>
                    #{tag}
                    {isAdmin && showTagEditor && (
                      <button onClick={() => removeDocTag(tag)} style={{
                        background: "none", border: "none", color: "#6366F1",
                        cursor: "pointer", fontSize: 13, padding: 0, marginLeft: 2,
                      }}>✕</button>
                    )}
                  </span>
                ))}
                {isAdmin && (
                  <button
                    onClick={() => setShowTagEditor(!showTagEditor)}
                    style={{
                      padding: "4px 10px", background: showTagEditor ? "#7C3AED" : "#F3F4F6",
                      color: showTagEditor ? "white" : "#6B7280",
                      border: "none", borderRadius: 6, fontSize: 12,
                      fontWeight: 500, cursor: "pointer",
                    }}
                  >
                    {showTagEditor ? "Done" : "✏️ Edit tags"}
                  </button>
                )}
              </div>

              {/* Tag editor */}
              {isAdmin && showTagEditor && (
                <div style={{ marginTop: 10, padding: 14, background: "#F9FAFB", borderRadius: 8, border: "1px solid #E5E7EB" }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      placeholder="Add tag..."
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (tagInput.trim()) addTag(tagInput); } }}
                      style={{
                        flex: 1, padding: "8px 12px", border: "1px solid #D1D5DB",
                        borderRadius: 6, fontSize: 13, outline: "none",
                      }}
                    />
                    <button
                      onClick={() => { if (tagInput.trim()) addTag(tagInput); }}
                      style={{
                        padding: "8px 14px", background: "#7C3AED", color: "white",
                        border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer",
                      }}
                    >
                      Add
                    </button>
                    <button
                      onClick={handleSuggestTags}
                      disabled={suggestingTags}
                      style={{
                        padding: "8px 14px", background: suggestingTags ? "#A5B4FC" : "#4F46E5",
                        color: "white", border: "none", borderRadius: 6, fontSize: 13,
                        fontWeight: 600, cursor: suggestingTags ? "not-allowed" : "pointer",
                      }}
                    >
                      {suggestingTags ? "⏳" : "🏷️ AI Suggest"}
                    </button>
                  </div>

                  {suggestedTags.length > 0 && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {suggestedTags.map((tag) => (
                        <button key={tag} onClick={() => addTag(tag)} style={{
                          padding: "4px 10px", background: "white", color: "#4F46E5",
                          border: "1px solid #C7D2FE", borderRadius: 6, fontSize: 12,
                          fontWeight: 600, cursor: "pointer",
                        }}>
                          + {tag}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 24, paddingTop: 20, borderTop: "1px solid #E5E7EB" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 22 }}>👍</span>
              <span style={{ fontSize: 15, color: "#374151", fontWeight: 500 }}>{helpfulCount} people found this helpful</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 22 }}>👎</span>
              <span style={{ fontSize: 15, color: "#6B7280", fontWeight: 500 }}>{notHelpfulCount} didn&apos;t</span>
            </div>
          </div>
        </div>

        {/* AI Summary Card */}
        {summary && !viewingVersion && (
          <div style={{ padding: "24px 32px", marginBottom: 24, background: "linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)", borderRadius: 12, border: "1px solid #C7D2FE" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 20 }}>💡</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#4338CA" }}>AI Summary</span>
            </div>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: "#312E81", margin: 0 }}>{summary}</p>
          </div>
        )}

        {/* No summary yet — show generate button only if no summary */}
        {!summary && !viewingVersion && (
          <div style={{ padding: "24px 32px", marginBottom: 24, background: "linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)", borderRadius: 12, border: "1px solid #C7D2FE" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 20 }}>💡</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#4338CA" }}>AI Summary</span>
              </div>
              <button
                onClick={handleGenerateSummary}
                disabled={generatingSummary}
                style={{
                  padding: "6px 14px", background: generatingSummary ? "#A5B4FC" : "#4F46E5",
                  color: "white", border: "none", borderRadius: 8, fontSize: 13,
                  fontWeight: 600, cursor: generatingSummary ? "not-allowed" : "pointer",
                }}
              >
                {generatingSummary ? "⏳ Generating..." : "✨ Generate Summary"}
              </button>
            </div>
          </div>
        )}

        {/* Version History Section */}
        <div style={{ marginBottom: 24 }}>
          <button
            onClick={fetchVersions}
            disabled={loadingVersions}
            style={{
              padding: "12px 20px", background: "white", border: "1px solid #E5E7EB",
              borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 8, width: "100%",
              justifyContent: "space-between",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span>🕐</span>
              <span>Version History</span>
              {versions.length > 0 && (
                <span style={{ padding: "2px 8px", background: "#EEF2FF", color: "#4F46E5", borderRadius: 10, fontSize: 12, fontWeight: 700 }}>
                  {versions.length}
                </span>
              )}
            </div>
            <span style={{ color: "#9CA3AF", fontSize: 18 }}>
              {loadingVersions ? "⏳" : showVersions ? "▲" : "▼"}
            </span>
          </button>

          {showVersions && (
            <div style={{ marginTop: 8, border: "1px solid #E5E7EB", borderRadius: 12, background: "white", overflow: "hidden" }}>
              {versions.length === 0 ? (
                <div style={{ padding: "24px 20px", textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>
                  No version history yet. Versions are created automatically when you edit a document.
                </div>
              ) : (
                versions.map((v, i) => (
                  <div
                    key={v.id}
                    style={{
                      padding: "14px 20px",
                      borderBottom: i < versions.length - 1 ? "1px solid #F3F4F6" : "none",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      gap: 12, flexWrap: "wrap",
                      background: viewingVersion?.id === v.id ? "#F5F3FF" : "white",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{
                          padding: "3px 10px", background: "#EEF2FF", color: "#4F46E5",
                          borderRadius: 6, fontSize: 12, fontWeight: 700,
                        }}>
                          {v.version_number}
                        </span>
                        <span style={{ fontSize: 13, color: "#6B7280" }}>
                          {formatDate(v.created_at)}
                        </span>
                      </div>
                      {v.change_description && (
                        <div style={{ fontSize: 13, color: "#374151" }}>
                          {v.change_description}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => setViewingVersion(viewingVersion?.id === v.id ? null : v)}
                        style={{
                          padding: "5px 12px", borderRadius: 6,
                          border: "1px solid #D1D5DB", background: viewingVersion?.id === v.id ? "#7C3AED" : "white",
                          color: viewingVersion?.id === v.id ? "white" : "#374151",
                          fontSize: 12, fontWeight: 500, cursor: "pointer",
                        }}
                      >
                        {viewingVersion?.id === v.id ? "Viewing" : "View"}
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => handleRestoreVersion(v)}
                          disabled={restoringVersion}
                          style={{
                            padding: "5px 12px", borderRadius: 6,
                            border: "1px solid #C4B5FD", background: "#EDE9FE",
                            color: "#5B21B6", fontSize: 12, fontWeight: 500, cursor: "pointer",
                          }}
                        >
                          Restore
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Original File Card */}
        {document.file_url && !viewingVersion && (
          <div className="card" style={{ padding: "24px 32px", marginBottom: 24, background: "white", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 32 }}>{isPdf ? "📕" : document.file_name?.endsWith(".docx") ? "📘" : "📄"}</span>
                <div>
                  <div style={{ fontWeight: 600, color: "#111827" }}>{document.file_name || "Attached File"}</div>
                  <div style={{ fontSize: 13, color: "#6B7280" }}>Original uploaded document</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {isPdf && (
                  <button onClick={() => setShowPreview(!showPreview)} className="btn" style={{ padding: "8px 16px", fontSize: 14 }}>
                    {showPreview ? "🙈 Hide Preview" : "👁️ Preview"}
                  </button>
                )}
                <a href={document.file_url} download={document.file_name} className="btn btn-primary" style={{ padding: "8px 16px", fontSize: 14 }}>
                  📥 Download
                </a>
              </div>
            </div>
            {showPreview && isPdf && (
              <div style={{ marginTop: 20 }}>
                <iframe src={`${document.file_url}#toolbar=0`} style={{ width: "100%", height: 600, border: "1px solid #E5E7EB", borderRadius: 8 }} title="PDF Preview" />
              </div>
            )}
          </div>
        )}

        {/* Document Content */}
        <div className="card" style={{ padding: "40px", marginBottom: 24, background: "white", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {viewingVersion ? `Content (${viewingVersion.version_number})` : document.file_url ? "Extracted Text" : "Content"}
          </h3>
          <div style={{ fontSize: 17, lineHeight: 1.8, color: "#1F2937", whiteSpace: "pre-wrap", fontFamily: "system-ui, -apple-system, sans-serif" }}>
            {displayContent || "No content available"}
          </div>
        </div>

        {/* Feedback Section */}
        {!viewingVersion && (
          <div className="card" style={{ padding: "32px 40px", marginBottom: 24, background: "white", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, color: "#111827" }}>
              Was this document helpful?
            </h3>
            {feedbackMessage && (
              <div style={{ padding: 16, marginBottom: 20, borderRadius: 10, background: feedbackMessage.includes("✅") ? "#D1FAE5" : "#FEE2E2", color: feedbackMessage.includes("✅") ? "#065F46" : "#991B1B", fontSize: 15, fontWeight: 500 }}>
                {feedbackMessage}
              </div>
            )}
            <div style={{ display: "flex", gap: 12 }}>
              <button className="btn btn-primary" disabled={submitting} onClick={() => handleFeedback(true)} style={{ padding: "12px 24px", opacity: submitting ? 0.7 : 1, fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                👍 Yes, helpful
              </button>
              <button className="btn" disabled={submitting} onClick={() => handleFeedback(false)} style={{ padding: "12px 24px", opacity: submitting ? 0.7 : 1, fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                👎 No, not helpful
              </button>
            </div>
          </div>
        )}

        {/* Related Documents */}
        {similarDocs.length > 0 && !viewingVersion && (
          <div className="card" style={{ padding: "32px 40px", background: "white", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, color: "#111827", display: "flex", alignItems: "center", gap: 10 }}>
              🔗 Related Documents
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {similarDocs.map((doc) => (
                <Link key={doc.doc_id} href={`/library/${encodeURIComponent(doc.doc_id)}`} className="card" style={{ padding: 20, border: "2px solid #E5E7EB", borderRadius: 10, textDecoration: "none", color: "inherit", display: "block", background: "white" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 16, color: "#111827" }}>{doc.title}</div>
                      <div style={{ fontSize: 14, color: "#6B7280", fontFamily: "monospace" }}>{doc.doc_id}</div>
                    </div>
                    <div style={{ padding: "8px 16px", background: "#EEF2FF", color: "#4F46E5", borderRadius: 8, fontSize: 14, fontWeight: 700, whiteSpace: "nowrap" }}>
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
