"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

interface QuickCreateProps {
  onCreateFolder?: () => void;
}

export default function QuickCreate({ onCreateFolder }: QuickCreateProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  return (
    <div ref={menuRef} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        className="btn btn-primary"
        style={{
          padding: "8px 14px",
          fontSize: 13,
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontWeight: 600,
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
          position: "absolute",
          top: "calc(100% + 6px)",
          right: 0,
          background: "white",
          borderRadius: 12,
          border: "1px solid #E5E7EB",
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          minWidth: 220,
          zIndex: 50,
          overflow: "hidden",
          animation: "fadeIn 0.15s ease-out",
        }}>
          {/* Upload Files */}
          <Link
            href="/library/new"
            onClick={() => setOpen(false)}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "14px 18px", textDecoration: "none",
              color: "#111827", fontSize: 14, fontWeight: 500,
              borderBottom: "1px solid #F3F4F6",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#F9FAFB")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <span style={{
              width: 36, height: 36, borderRadius: 10,
              background: "linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, flexShrink: 0,
            }}>📂</span>
            <div>
              <div style={{ fontWeight: 600 }}>Upload Files</div>
              <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>
                PDF, Word, Excel, PPT & more
              </div>
            </div>
          </Link>

          {/* New Note */}
          <Link
            href="/library/note/new"
            onClick={() => setOpen(false)}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "14px 18px", textDecoration: "none",
              color: "#111827", fontSize: 14, fontWeight: 500,
              borderBottom: "1px solid #F3F4F6",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#F9FAFB")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <span style={{
              width: 36, height: 36, borderRadius: 10,
              background: "linear-gradient(135deg, #10B981 0%, #34D399 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, flexShrink: 0,
            }}>📝</span>
            <div>
              <div style={{ fontWeight: 600 }}>New Note</div>
              <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>
                Write freely, auto-saved
              </div>
            </div>
          </Link>

          {/* New Folder */}
          <button
            onClick={() => {
              setOpen(false);
              onCreateFolder?.();
            }}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "14px 18px", textDecoration: "none",
              color: "#111827", fontSize: 14, fontWeight: 500,
              background: "none", border: "none", width: "100%",
              cursor: "pointer", textAlign: "left",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#F9FAFB")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <span style={{
              width: 36, height: 36, borderRadius: 10,
              background: "linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, flexShrink: 0,
            }}>📁</span>
            <div>
              <div style={{ fontWeight: 600 }}>New Folder</div>
              <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>
                Organize your documents
              </div>
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
  );
}
