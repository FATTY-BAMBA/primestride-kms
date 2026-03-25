"use client";

import { useState } from "react";

interface Props {
  docId: string;
  currentLevel: "all_members" | "admin_only";
  isAdmin: boolean;
  onUpdate?: (newLevel: string) => void;
}

export default function DocumentAccessToggle({ docId, currentLevel, isAdmin, onUpdate }: Props) {
  const [level, setLevel] = useState(currentLevel);
  const [saving, setSaving] = useState(false);

  if (!isAdmin) return null;

  const toggle = async () => {
    const newLevel = level === "all_members" ? "admin_only" : "all_members";
    setSaving(true);
    try {
      const res = await fetch("/api/documents/access", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc_id: docId, access_level: newLevel }),
      });
      if (res.ok) {
        setLevel(newLevel);
        onUpdate?.(newLevel);
      }
    } catch (e) {
      console.error("Failed to update access level", e);
    } finally {
      setSaving(false);
    }
  };

  const isRestricted = level === "admin_only";

  return (
    <button
      onClick={toggle}
      disabled={saving}
      title={isRestricted ? "點擊開放所有成員查閱" : "點擊設為僅限管理員查閱"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 6,
        border: `1px solid ${isRestricted ? "#FECACA" : "#E2E8F0"}`,
        background: isRestricted ? "#FEF2F2" : "#F8FAFC",
        color: isRestricted ? "#DC2626" : "#64748B",
        fontSize: 12,
        fontWeight: 600,
        cursor: saving ? "not-allowed" : "pointer",
        opacity: saving ? 0.6 : 1,
        transition: "all 0.15s",
        fontFamily: "inherit",
      }}
    >
      {saving ? "..." : isRestricted ? "🔒 僅限管理員" : "👥 全體成員可見"}
    </button>
  );
}