"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function NewNotePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [docId, setDocId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [folders, setFolders] = useState<{ id: string; name: string; icon: string }[]>([]);
  const [folderId, setFolderId] = useState<string>("");
  const [teamId, setTeamId] = useState<string>("");
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [charCount, setCharCount] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const titleRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);
  const hasCreated = useRef(false);

  // Focus title on mount
  useEffect(() => {
    titleRef.current?.focus();
    loadMetadata();
  }, []);

  // Update counts
  useEffect(() => {
    setCharCount(content.length);
    setWordCount(content.trim() ? content.trim().split(/\s+/).length : 0);
  }, [content]);

  const loadMetadata = async () => {
    try {
      const [foldersRes, teamsRes] = await Promise.all([
        fetch("/api/folders"),
        fetch("/api/teams"),
      ]);
      const foldersData = await foldersRes.json();
      const teamsData = await teamsRes.json();
      if (foldersRes.ok) setFolders(foldersData.folders || []);
      if (teamsRes.ok) setTeams(teamsData.teams || []);
    } catch {}
  };

  // Auto-save: create on first meaningful content, then update
  const autoSave = useCallback(async () => {
    if (!title.trim() && !content.trim()) return;

    setSaving(true);
    setError("");

    try {
      if (!hasCreated.current) {
        // First save — create the note
        const res = await fetch("/api/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim() || "Untitled Note",
            content: content || "",
            docType: "note",
            autoGenerate: true,
            originalFileName: (title.trim() || "Untitled Note") + ".md",
            teamId: teamId || null,
            folderId: folderId || null,
            docSource: "note",
          }),
        });

        const data = await res.json();
        if (res.ok) {
          setDocId(data.docId);
          hasCreated.current = true;
          setSaved(true);
        } else {
          setError(data.error || "Failed to save");
        }
      } else if (docId) {
        // Subsequent saves — update existing
        const res = await fetch(`/api/documents/${encodeURIComponent(docId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim() || "Untitled Note",
            content,
          }),
        });

        if (res.ok) {
          setSaved(true);
        } else {
          const data = await res.json();
          setError(data.error || "Failed to save");
        }
      }
    } catch {
      setError("Failed to save");
    } finally {
      setSaving(false);
      setTimeout(() => setSaved(false), 2000);
    }
  }, [title, content, docId, teamId, folderId]);

  // Debounced auto-save on content change
  useEffect(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      if (title.trim() || content.trim()) {
        autoSave();
      }
    }, 3000); // Save 3 seconds after user stops typing

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [title, content, autoSave]);

  // Keyboard shortcut: Cmd+S / Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        autoSave();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [autoSave]);

  // Tab key inserts spaces in textarea
  const handleContentKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const target = e.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const newContent = content.substring(0, start) + "  " + content.substring(end);
      setContent(newContent);
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      }, 0);
    }
  };

  return (
    <ProtectedRoute requireAdmin>
      <div style={{
        minHeight: "100vh",
        background: "#FAFAFA",
        display: "flex",
        flexDirection: "column",
      }}>
        {/* Top bar */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 24px",
          borderBottom: "1px solid #E5E7EB",
          background: "white",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Link href="/library" style={{
              color: "#6B7280", textDecoration: "none", fontSize: 14,
              display: "flex", alignItems: "center", gap: 4,
            }}>
              ← Library
            </Link>
            <span style={{ color: "#D1D5DB" }}>|</span>
            <span style={{ fontSize: 14, color: "#9CA3AF" }}>
              {saving ? "💾 Saving..." : saved ? "✅ Saved" : docId ? "📝 Note" : "📝 New Note"}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Folder selector */}
            {folders.length > 0 && (
              <select
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
                style={{
                  padding: "6px 10px", borderRadius: 6,
                  border: "1px solid #E5E7EB", fontSize: 13,
                  color: "#6B7280", background: "white",
                }}
              >
                <option value="">No folder</option>
                {folders.map(f => (
                  <option key={f.id} value={f.id}>{f.icon} {f.name}</option>
                ))}
              </select>
            )}

            {/* Team selector */}
            {teams.length > 0 && (
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                style={{
                  padding: "6px 10px", borderRadius: 6,
                  border: "1px solid #E5E7EB", fontSize: 13,
                  color: "#6B7280", background: "white",
                }}
              >
                <option value="">🌐 Org-wide</option>
                {teams.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}

            {/* Manual save button */}
            <button
              onClick={autoSave}
              disabled={saving || (!title.trim() && !content.trim())}
              style={{
                padding: "6px 14px", borderRadius: 6,
                border: "1px solid #E5E7EB", background: "white",
                fontSize: 13, fontWeight: 500, cursor: "pointer",
                color: saving ? "#9CA3AF" : "#374151",
              }}
            >
              {saving ? "Saving..." : "Save"}
            </button>

            {docId && (
              <Link
                href={`/library/${encodeURIComponent(docId)}`}
                style={{
                  padding: "6px 14px", borderRadius: 6,
                  background: "#7C3AED", color: "white",
                  fontSize: 13, fontWeight: 600, textDecoration: "none",
                }}
              >
                View →
              </Link>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            padding: "10px 24px", background: "#FEE2E2",
            color: "#991B1B", fontSize: 14,
          }}>
            {error}
          </div>
        )}

        {/* Editor area */}
        <div style={{
          flex: 1, maxWidth: 800, width: "100%",
          margin: "0 auto", padding: "40px 24px",
        }}>
          {/* Title */}
          <input
            ref={titleRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled Note"
            style={{
              width: "100%", border: "none", outline: "none",
              fontSize: 32, fontWeight: 700, color: "#111827",
              background: "transparent", marginBottom: 24,
              lineHeight: 1.3,
            }}
          />

          {/* Content */}
          <textarea
            ref={contentRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleContentKeyDown}
            placeholder="Start writing... (Markdown supported)"
            style={{
              width: "100%", border: "none", outline: "none",
              fontSize: 16, lineHeight: 1.8, color: "#374151",
              background: "transparent", resize: "none",
              minHeight: "calc(100vh - 250px)",
              fontFamily: "'Georgia', 'Times New Roman', serif",
            }}
          />
        </div>

        {/* Bottom status bar */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 24px", borderTop: "1px solid #E5E7EB",
          background: "white", fontSize: 12, color: "#9CA3AF",
          position: "sticky", bottom: 0,
        }}>
          <div style={{ display: "flex", gap: 16 }}>
            <span>{wordCount} words</span>
            <span>{charCount} characters</span>
          </div>
          <div style={{ display: "flex", gap: 16 }}>
            <span>Markdown supported</span>
            <span>⌘S to save</span>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
