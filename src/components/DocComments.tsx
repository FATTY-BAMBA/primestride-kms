"use client";

import { useState, useEffect, useCallback } from "react";

interface Comment {
  id: string;
  doc_id: string;
  user_id: string;
  user_name: string;
  content: string;
  highlighted_text: string | null;
  selection_start: number | null;
  selection_end: number | null;
  parent_id: string | null;
  resolved: boolean;
  created_at: string;
}

interface Props {
  docId: string;
  currentUserId: string;
  isAdmin: boolean;
}

export default function DocComments({ docId, currentUserId, isAdmin }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showResolved, setShowResolved] = useState(false);

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/comments?docId=${docId}`);
      const data = await res.json();
      if (res.ok) setComments(data.comments || []);
    } catch {} finally {
      setLoading(false);
    }
  }, [docId]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  const handlePost = async (content: string, parentId?: string | null) => {
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docId,
          content: content.trim(),
          parentId: parentId || null,
        }),
      });
      if (res.ok) {
        setNewComment("");
        setReplyTo(null);
        setReplyText("");
        fetchComments();
      }
    } catch {} finally {
      setSubmitting(false);
    }
  };

  const handleResolve = async (commentId: string, resolved: boolean) => {
    try {
      await fetch("/api/comments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId, resolved }),
      });
      fetchComments();
    } catch {}
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm("Delete this comment?")) return;
    try {
      await fetch(`/api/comments?id=${commentId}`, { method: "DELETE" });
      fetchComments();
    } catch {}
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHrs < 24) return `${diffHrs}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Separate top-level and replies
  const topLevel = comments.filter(c => !c.parent_id);
  const replies = comments.filter(c => c.parent_id);
  const getReplies = (parentId: string) => replies.filter(r => r.parent_id === parentId);

  // Separate inline (highlighted) vs general comments
  const inlineComments = topLevel.filter(c => c.highlighted_text);
  const generalComments = topLevel.filter(c => !c.highlighted_text);

  const activeInline = inlineComments.filter(c => !c.resolved);
  const resolvedInline = inlineComments.filter(c => c.resolved);
  const activeGeneral = generalComments.filter(c => !c.resolved);
  const resolvedGeneral = generalComments.filter(c => c.resolved);

  const totalActive = activeInline.length + activeGeneral.length;
  const totalResolved = resolvedInline.length + resolvedGeneral.length;

  return (
    <div style={{
      background: "white", borderRadius: 12, padding: "32px 40px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.1)", marginBottom: 24,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h3 style={{ fontSize: 20, fontWeight: 700, color: "#111827", display: "flex", alignItems: "center", gap: 10, margin: 0 }}>
          💬 Comments
          {totalActive > 0 && (
            <span style={{
              padding: "2px 10px", background: "#EEF2FF", color: "#4F46E5",
              borderRadius: 10, fontSize: 13, fontWeight: 700,
            }}>
              {totalActive}
            </span>
          )}
        </h3>
        {totalResolved > 0 && (
          <button
            onClick={() => setShowResolved(!showResolved)}
            style={{
              padding: "6px 12px", borderRadius: 6, border: "1px solid #D1D5DB",
              background: "white", fontSize: 12, color: "#6B7280",
              cursor: "pointer", fontWeight: 500,
            }}
          >
            {showResolved ? "Hide" : "Show"} {totalResolved} resolved
          </button>
        )}
      </div>

      {loading && (
        <div style={{ padding: 20, textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>
          Loading comments...
        </div>
      )}

      {/* Inline (highlighted) comments */}
      {activeInline.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#6B7280", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Inline Comments
          </div>
          {activeInline.map(c => (
            <CommentThread
              key={c.id}
              comment={c}
              replies={getReplies(c.id)}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              replyTo={replyTo}
              replyText={replyText}
              submitting={submitting}
              onReplyTo={setReplyTo}
              onReplyTextChange={setReplyText}
              onPost={handlePost}
              onResolve={handleResolve}
              onDelete={handleDelete}
              formatDate={formatDate}
            />
          ))}
        </div>
      )}

      {/* General comments */}
      {activeGeneral.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          {activeInline.length > 0 && (
            <div style={{ fontSize: 13, fontWeight: 600, color: "#6B7280", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              General Discussion
            </div>
          )}
          {activeGeneral.map(c => (
            <CommentThread
              key={c.id}
              comment={c}
              replies={getReplies(c.id)}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              replyTo={replyTo}
              replyText={replyText}
              submitting={submitting}
              onReplyTo={setReplyTo}
              onReplyTextChange={setReplyText}
              onPost={handlePost}
              onResolve={handleResolve}
              onDelete={handleDelete}
              formatDate={formatDate}
            />
          ))}
        </div>
      )}

      {/* Resolved comments */}
      {showResolved && (resolvedInline.length > 0 || resolvedGeneral.length > 0) && (
        <div style={{ marginBottom: 20, opacity: 0.6 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#6B7280", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            ✓ Resolved
          </div>
          {[...resolvedInline, ...resolvedGeneral].map(c => (
            <CommentThread
              key={c.id}
              comment={c}
              replies={getReplies(c.id)}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              replyTo={replyTo}
              replyText={replyText}
              submitting={submitting}
              onReplyTo={setReplyTo}
              onReplyTextChange={setReplyText}
              onPost={handlePost}
              onResolve={handleResolve}
              onDelete={handleDelete}
              formatDate={formatDate}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && totalActive === 0 && totalResolved === 0 && (
        <div style={{ padding: "16px 0", color: "#9CA3AF", fontSize: 14 }}>
          No comments yet. Be the first to start a discussion.
        </div>
      )}

      {/* New comment input */}
      <div style={{ marginTop: 16, borderTop: "1px solid #F3F4F6", paddingTop: 16 }}>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
            background: "linear-gradient(135deg, #7C3AED, #A78BFA)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "white", fontSize: 13, fontWeight: 700,
          }}>
            {currentUserId.slice(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              rows={2}
              style={{
                width: "100%", padding: "10px 14px", border: "1px solid #D1D5DB",
                borderRadius: 8, fontSize: 14, resize: "vertical", outline: "none",
                fontFamily: "system-ui, -apple-system, sans-serif",
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  handlePost(newComment);
                }
              }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
              <span style={{ fontSize: 12, color: "#9CA3AF" }}>
                ⌘+Enter to post
              </span>
              <button
                onClick={() => handlePost(newComment)}
                disabled={!newComment.trim() || submitting}
                style={{
                  padding: "6px 16px", borderRadius: 6, border: "none",
                  background: !newComment.trim() || submitting ? "#D1D5DB" : "#7C3AED",
                  color: "white", fontSize: 13, fontWeight: 600,
                  cursor: !newComment.trim() || submitting ? "not-allowed" : "pointer",
                }}
              >
                {submitting ? "Posting..." : "Comment"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Single Comment Thread ──
function CommentThread({
  comment,
  replies,
  currentUserId,
  isAdmin,
  replyTo,
  replyText,
  submitting,
  onReplyTo,
  onReplyTextChange,
  onPost,
  onResolve,
  onDelete,
  formatDate,
}: {
  comment: Comment;
  replies: Comment[];
  currentUserId: string;
  isAdmin: boolean;
  replyTo: string | null;
  replyText: string;
  submitting: boolean;
  onReplyTo: (id: string | null) => void;
  onReplyTextChange: (text: string) => void;
  onPost: (content: string, parentId?: string | null) => void;
  onResolve: (id: string, resolved: boolean) => void;
  onDelete: (id: string) => void;
  formatDate: (date: string) => string;
}) {
  const isOwner = comment.user_id === currentUserId;
  const canDelete = isOwner || isAdmin;
  const canResolve = isAdmin || isOwner;

  const getInitials = (name: string) => {
    const parts = name.split(" ").filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div style={{
      marginBottom: 12, padding: 16, borderRadius: 10,
      border: "1px solid #E5E7EB", background: comment.resolved ? "#F9FAFB" : "white",
    }}>
      {/* Highlighted text quote */}
      {comment.highlighted_text && (
        <div style={{
          padding: "8px 12px", marginBottom: 12,
          borderLeft: "3px solid #7C3AED", background: "#F5F3FF",
          borderRadius: "0 6px 6px 0", fontSize: 13, color: "#5B21B6",
          fontStyle: "italic", lineHeight: 1.5,
        }}>
          &ldquo;{comment.highlighted_text.length > 150
            ? comment.highlighted_text.slice(0, 150) + "..."
            : comment.highlighted_text}&rdquo;
        </div>
      )}

      {/* Comment header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{
          width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
          background: isOwner
            ? "linear-gradient(135deg, #7C3AED, #A78BFA)"
            : "linear-gradient(135deg, #6B7280, #9CA3AF)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "white", fontSize: 11, fontWeight: 700,
        }}>
          {getInitials(comment.user_name)}
        </div>
        <span style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>
          {comment.user_name}
        </span>
        <span style={{ fontSize: 12, color: "#9CA3AF" }}>
          {formatDate(comment.created_at)}
        </span>
        {comment.resolved && (
          <span style={{
            padding: "2px 8px", background: "#D1FAE5", color: "#065F46",
            borderRadius: 4, fontSize: 11, fontWeight: 600,
          }}>✓ Resolved</span>
        )}
      </div>

      {/* Comment body */}
      <div style={{ fontSize: 14, lineHeight: 1.6, color: "#374151", marginBottom: 10, whiteSpace: "pre-wrap" }}>
        {comment.content}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button
          onClick={() => onReplyTo(replyTo === comment.id ? null : comment.id)}
          style={{ background: "none", border: "none", color: "#6B7280", fontSize: 12, cursor: "pointer", fontWeight: 500 }}
        >
          💬 Reply
        </button>
        {canResolve && (
          <button
            onClick={() => onResolve(comment.id, !comment.resolved)}
            style={{ background: "none", border: "none", color: comment.resolved ? "#059669" : "#6B7280", fontSize: 12, cursor: "pointer", fontWeight: 500 }}
          >
            {comment.resolved ? "↩️ Reopen" : "✓ Resolve"}
          </button>
        )}
        {canDelete && (
          <button
            onClick={() => onDelete(comment.id)}
            style={{ background: "none", border: "none", color: "#DC2626", fontSize: 12, cursor: "pointer", fontWeight: 500 }}
          >
            🗑️ Delete
          </button>
        )}
      </div>

      {/* Replies */}
      {replies.length > 0 && (
        <div style={{ marginTop: 12, marginLeft: 20, borderLeft: "2px solid #E5E7EB", paddingLeft: 16 }}>
          {replies.map(r => (
            <div key={r.id} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                  background: r.user_id === currentUserId
                    ? "linear-gradient(135deg, #7C3AED, #A78BFA)"
                    : "linear-gradient(135deg, #6B7280, #9CA3AF)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "white", fontSize: 9, fontWeight: 700,
                }}>
                  {getInitials(r.user_name)}
                </div>
                <span style={{ fontWeight: 600, fontSize: 13, color: "#111827" }}>{r.user_name}</span>
                <span style={{ fontSize: 11, color: "#9CA3AF" }}>{formatDate(r.created_at)}</span>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.5, color: "#374151", whiteSpace: "pre-wrap" }}>
                {r.content}
              </div>
              {(r.user_id === currentUserId || isAdmin) && (
                <button
                  onClick={() => onDelete(r.id)}
                  style={{ background: "none", border: "none", color: "#DC2626", fontSize: 11, cursor: "pointer", marginTop: 4 }}
                >
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reply input */}
      {replyTo === comment.id && (
        <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
          <input
            type="text"
            value={replyText}
            onChange={(e) => onReplyTextChange(e.target.value)}
            placeholder="Reply..."
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && replyText.trim()) {
                onPost(replyText, comment.id);
              }
              if (e.key === "Escape") onReplyTo(null);
            }}
            style={{
              flex: 1, padding: "8px 12px", border: "1px solid #D1D5DB",
              borderRadius: 6, fontSize: 13, outline: "none",
            }}
          />
          <button
            onClick={() => { if (replyText.trim()) onPost(replyText, comment.id); }}
            disabled={!replyText.trim() || submitting}
            style={{
              padding: "8px 14px", borderRadius: 6, border: "none",
              background: !replyText.trim() ? "#D1D5DB" : "#7C3AED",
              color: "white", fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}
          >
            Reply
          </button>
        </div>
      )}
    </div>
  );
}
