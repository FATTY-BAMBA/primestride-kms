"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/AuthContext";
import Link from "next/link";

type Language = "zh" | "en";

export default function UserMenu() {
  const { user, profile, isAdmin, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState<Language>("zh");
  const [savingLang, setSavingLang] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then(r => r.json())
      .then(d => { if (d.language) setLanguage(d.language); })
      .catch(() => {});
  }, []);

  // Calculate position when opening
  const handleToggle = () => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPos({
        // Open above the button, aligned to left edge of button
        top: rect.top - 8, // will be offset by dropdown height via transform
        left: rect.left,
      });
    }
    setOpen(!open);
  };

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
      setTimeout(() => window.location.reload(), 300);
    } catch {
      // silently fail
    } finally {
      setSavingLang(false);
    }
  };

  return (
    <div style={{ position: "relative", width: "100%" }}>
      {/* Trigger button */}
      <button
        ref={buttonRef}
        onClick={handleToggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 10px",
          borderRadius: 8,
          border: "1px solid #E2E8F0",
          background: "white",
          cursor: "pointer",
          color: "#374151",
          width: "100%",
          minWidth: 0,
        }}
      >
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt={displayName} style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0 }} />
        ) : (
          <div style={{ width: 26, height: 26, borderRadius: "50%", background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "white", flexShrink: 0 }}>
            {initials}
          </div>
        )}
        <span style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, textAlign: "left", color: "#0F172A" }}>
          {displayName}
        </span>
        <span style={{ fontSize: 10, color: "#94A3B8", flexShrink: 0 }}>▼</span>
      </button>

      {/* Dropdown — rendered fixed to escape sidebar overflow */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            style={{ position: "fixed", inset: 0, zIndex: 9998 }}
            onClick={() => setOpen(false)}
          />
          {/* Dropdown panel — fixed position, opens upward from button */}
          <div style={{
            position: "fixed",
            bottom: `calc(100vh - ${dropdownPos.top}px + 4px)`,
            left: dropdownPos.left,
            width: 220,
            background: "white",
            border: "1px solid #E2E8F0",
            borderRadius: 12,
            boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
            zIndex: 9999,
            overflow: "hidden",
          }}>
            {/* User info */}
            <div style={{ padding: "12px 14px", borderBottom: "1px solid #F1F5F9" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {displayName}
              </div>
              <div style={{ fontSize: 12, color: "#94A3B8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
                {user.email}
              </div>
              {isAdmin && (
                <span style={{ display: "inline-block", marginTop: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600, borderRadius: 4, background: "#EFF6FF", color: "#2563EB" }}>
                  Admin
                </span>
              )}
            </div>

            {/* Language toggle */}
            <div style={{ padding: "10px 14px", borderBottom: "1px solid #F1F5F9" }}>
              <div style={{ fontSize: 10, color: "#94A3B8", marginBottom: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Language / 語言
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {(["zh", "en"] as Language[]).map(lang => (
                  <button
                    key={lang}
                    onClick={() => handleLanguageChange(lang)}
                    disabled={savingLang}
                    style={{
                      flex: 1, padding: "6px 0", borderRadius: 7,
                      border: language === lang ? "1.5px solid #7C3AED" : "1.5px solid #E2E8F0",
                      background: language === lang ? "#F5F3FF" : "white",
                      color: language === lang ? "#7C3AED" : "#94A3B8",
                      fontSize: 13, fontWeight: language === lang ? 700 : 500,
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
            <div style={{ padding: "6px 8px" }}>
              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setOpen(false)}
                  style={{
                    display: "block", padding: "8px 10px", fontSize: 14,
                    borderRadius: 7, color: "#374151", textDecoration: "none",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#F8FAFC")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  🎛️ Admin Dashboard
                </Link>
              )}
              <button
                onClick={() => { setOpen(false); signOut(); }}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  padding: "8px 10px", fontSize: 14, borderRadius: 7,
                  border: "none", background: "transparent",
                  color: "#DC2626", cursor: "pointer", transition: "background 0.1s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "#FEF2F2")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
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