"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface QuickCreateProps {
  onCreateFolder?: () => void;
}

export default function QuickCreate({ onCreateFolder }: QuickCreateProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showUrlModal, setShowUrlModal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  const menuItemStyle = {
    display: "flex" as const,
    alignItems: "center" as const,
    gap: 12,
    padding: "14px 18px",
    textDecoration: "none" as const,
    color: "#111827",
    fontSize: 14,
    fontWeight: 500 as const,
    borderBottom: "1px solid #F3F4F6",
    transition: "background 0.15s",
    background: "none",
    border: "none",
    width: "100%" as const,
    cursor: "pointer" as const,
    textAlign: "left" as const,
  };

  return (
    <>
      <div ref={menuRef} style={{ position: "relative" }}>
        <button
          onClick={() => setOpen(!open)}
          className="btn btn-primary"
          style={{
            padding: "8px 14px", fontSize: 13,
            display: "flex", alignItems: "center", gap: 6, fontWeight: 600,
          }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> New
          <span style={{
            fontSize: 10, marginLeft: 2,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
          }}>▼</span>
        </button>

        {open && (
          <div style={{
            position: "absolute", top: "calc(100% + 6px)", right: 0,
            background: "white", borderRadius: 12, border: "1px solid #E5E7EB",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)", minWidth: 220,
            zIndex: 50, overflow: "hidden", animation: "fadeIn 0.15s ease-out",
          }}>
            {/* Upload Files */}
            <Link href="/library/new" onClick={() => setOpen(false)}
              style={menuItemStyle}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#F9FAFB")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>📂</span>
              <div>
                <div style={{ fontWeight: 600 }}>Upload Files</div>
                <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>PDF, Word, Excel, PPT & more</div>
              </div>
            </Link>

            {/* Import URL */}
            <button
              onClick={() => { setOpen(false); setShowUrlModal(true); }}
              style={menuItemStyle}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#F9FAFB")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #2563EB 0%, #60A5FA 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>🔗</span>
              <div>
                <div style={{ fontWeight: 600 }}>Import URL</div>
                <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>Web page, article, YouTube</div>
              </div>
            </button>

            {/* New Note */}
            <Link href="/library/note/new" onClick={() => setOpen(false)}
              style={menuItemStyle}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#F9FAFB")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #10B981 0%, #34D399 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>📝</span>
              <div>
                <div style={{ fontWeight: 600 }}>New Note</div>
                <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>Write freely, auto-saved</div>
              </div>
            </Link>

            {/* New Folder */}
            <button
              onClick={() => { setOpen(false); onCreateFolder?.(); }}
              style={{ ...menuItemStyle, borderBottom: "none" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#F9FAFB")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>📁</span>
              <div>
                <div style={{ fontWeight: 600 }}>New Folder</div>
                <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>Organize your documents</div>
              </div>
            </button>
          </div>
        )}

        <style jsx>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-4px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>

      {showUrlModal && (
        <ImportUrlModal
          onClose={() => setShowUrlModal(false)}
          onImported={(docId) => {
            setShowUrlModal(false);
            router.push(`/library/${encodeURIComponent(docId)}`);
          }}
        />
      )}
    </>
  );
}

// ── Import URL Modal ──
function ImportUrlModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: (docId: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const handleImport = async () => {
    if (!url.trim()) return;

    let testUrl = url.trim();
    if (!testUrl.startsWith("http://") && !testUrl.startsWith("https://")) {
      testUrl = "https://" + testUrl;
    }

    try { new URL(testUrl); } catch {
      setError("Please enter a valid URL");
      return;
    }

    setImporting(true);
    setError("");
    setStatus("🔗 Fetching page...");

    try {
      const res = await fetch("/api/documents/import-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: testUrl }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to import URL");
        setImporting(false);
        setStatus("");
        return;
      }

      setStatus(`✅ Imported: ${data.title}`);
      setTimeout(() => onImported(data.docId), 800);
    } catch {
      setError("Failed to import URL");
      setImporting(false);
      setStatus("");
    }
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.4)", display: "flex",
        alignItems: "center", justifyContent: "center", padding: 20,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "white", borderRadius: 16, padding: 32,
          width: "100%", maxWidth: 480,
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <span style={{
            width: 40, height: 40, borderRadius: 10,
            background: "linear-gradient(135deg, #2563EB 0%, #60A5FA 100%)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
          }}>🔗</span>
          <h3 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Import from URL</h3>
        </div>

        <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 20, lineHeight: 1.5 }}>
          Paste a web page, article, or YouTube URL. AI will extract the content and generate title, summary, and tags automatically.
        </p>

        {error && (
          <div style={{ padding: 10, background: "#FEE2E2", color: "#991B1B", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {status && !error && (
          <div style={{ padding: 10, background: "#D1FAE5", color: "#065F46", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
            {status}
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <input
            type="url"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setError(""); }}
            placeholder="https://example.com/article or YouTube URL"
            autoFocus
            disabled={importing}
            onKeyDown={(e) => { if (e.key === "Enter") handleImport(); }}
            style={{
              width: "100%", padding: "12px 16px",
              border: "1px solid #D1D5DB", borderRadius: 10,
              fontSize: 15, outline: "none",
              opacity: importing ? 0.6 : 1,
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            disabled={importing}
            style={{
              padding: "10px 20px", borderRadius: 8,
              border: "1px solid #D1D5DB", background: "white",
              fontSize: 14, cursor: "pointer", fontWeight: 500,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!url.trim() || importing}
            style={{
              padding: "10px 20px", borderRadius: 8, border: "none",
              background: importing || !url.trim() ? "#93C5FD" : "#2563EB",
              color: "white", fontSize: 14,
              cursor: importing ? "not-allowed" : "pointer",
              fontWeight: 600, display: "flex", alignItems: "center", gap: 6,
            }}
          >
            {importing ? (
              <>
                <span style={{
                  width: 14, height: 14, borderRadius: "50%",
                  border: "2px solid white", borderTopColor: "transparent",
                  animation: "spin 0.6s linear infinite", display: "inline-block",
                }} />
                Importing...
              </>
            ) : "🔗 Import"}
          </button>
        </div>

        <style jsx>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </div>
  );
}
