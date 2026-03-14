"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import Link from "next/link";

type Language = "zh" | "en";

export default function UserMenu() {
  const { user, profile, isAdmin, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState<Language>("zh");
  const [savingLang, setSavingLang] = useState(false);

  useEffect(() => {
    fetch("/api/profile")
      .then(r => r.json())
      .then(d => { if (d.language) setLanguage(d.language); })
      .catch(() => {});
  }, []);

  if (!user) return null;

  const displayName = profile?.full_name || user.email?.split("@")[0] || "User";
  const initials = displayName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

  const handleLanguageChange = async (lang: Language) => {
    if (lang === language || savingLang) return;
    setSavingLang(true);
    try {
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: lang }),
      });
      setLanguage(lang);
      // Short delay so user sees the toggle flip before reload
      setTimeout(() => window.location.reload(), 300);
    } catch {
      // silently fail
    } finally {
      setSavingLang(false);
    }
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 10px",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border-color)",
          background: "var(--bg-secondary)",
          cursor: "pointer",
          color: "var(--text-primary)",
          maxWidth: "100%",
          overflow: "hidden",
        }}
      >
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt={displayName} style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0 }} />
        ) : (
          <div style={{ width: 26, height: 26, borderRadius: "50%", background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, color: "white", flexShrink: 0 }}>
            {initials}
          </div>
        )}
        <span style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
          {displayName}
        </span>
        <span style={{ fontSize: 11, opacity: 0.5, flexShrink: 0 }}>▼</span>
      </button>

      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setOpen(false)} />
          <div style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: 0,
            width: 220,
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-color)",
            borderRadius: "var(--radius-md)",
            boxShadow: "0 10px 40px rgba(0,0,0,0.15)",
            zIndex: 50,
            overflow: "hidden",
          }}>
            {/* User info */}
            <div style={{ padding: 12, borderBottom: "1px solid var(--border-color)" }}>
              <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {displayName}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user.email}
              </div>
              {isAdmin && (
                <span style={{ display: "inline-block", marginTop: 6, padding: "2px 8px", fontSize: 11, borderRadius: 4, background: "var(--accent-blue-soft)", color: "var(--accent-blue)" }}>
                  Admin
                </span>
              )}
            </div>

            {/* Language toggle — visible to ALL users */}
            <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border-color)" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Language / 語言
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {(["zh", "en"] as Language[]).map(lang => (
                  <button
                    key={lang}
                    onClick={() => handleLanguageChange(lang)}
                    disabled={savingLang}
                    style={{
                      flex: 1,
                      padding: "6px 0",
                      borderRadius: 6,
                      border: language === lang ? "1.5px solid #7C3AED" : "1.5px solid #E5E7EB",
                      background: language === lang ? "#EDE9FE" : "transparent",
                      color: language === lang ? "#7C3AED" : "var(--text-muted)",
                      fontSize: 13,
                      fontWeight: language === lang ? 700 : 400,
                      cursor: savingLang ? "not-allowed" : "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {lang === "zh" ? "中文" : "English"}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div style={{ padding: 8 }}>
              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setOpen(false)}
                  style={{ display: "block", padding: "8px 12px", fontSize: 14, borderRadius: "var(--radius-sm)", color: "var(--text-primary)", textDecoration: "none" }}
                >
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