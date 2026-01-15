"use client";

import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import Link from "next/link";

export default function UserMenu() {
  const { user, profile, isAdmin, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  const displayName = profile?.full_name || user.email?.split("@")[0] || "User";
  const initials = displayName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 12px",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border-color)",
          background: "var(--bg-secondary)",
          cursor: "pointer",
          color: "var(--text-primary)",
        }}
      >
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt={displayName} style={{ width: 28, height: 28, borderRadius: "50%" }} />
        ) : (
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: "white" }}>
            {initials}
          </div>
        )}
        <span style={{ fontSize: 14, fontWeight: 500 }}>{displayName}</span>
        <span style={{ fontSize: 12, opacity: 0.6 }}>▼</span>
      </button>

      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setOpen(false)} />
          <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: 200, background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", boxShadow: "0 10px 40px rgba(0,0,0,0.3)", zIndex: 50, overflow: "hidden" }}>
            <div style={{ padding: 12, borderBottom: "1px solid var(--border-color)" }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{displayName}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{user.email}</div>
              {isAdmin && (
                <span style={{ display: "inline-block", marginTop: 6, padding: "2px 8px", fontSize: 11, borderRadius: 4, background: "var(--accent-blue-soft)", color: "var(--accent-blue)" }}>
                  Admin
                </span>
              )}
            </div>
            <div style={{ padding: 8 }}>
              {isAdmin && (
                <Link href="/admin" onClick={() => setOpen(false)} style={{ display: "block", padding: "8px 12px", fontSize: 14, borderRadius: "var(--radius-sm)", color: "var(--text-primary)", textDecoration: "none" }}>
                  Admin Dashboard
                </Link>
              )}
              <button
                onClick={() => { setOpen(false); signOut(); }}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", fontSize: 14, borderRadius: "var(--radius-sm)", border: "none", background: "transparent", color: "var(--accent-red)", cursor: "pointer" }}
              >
                Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}