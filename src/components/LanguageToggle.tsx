"use client";

import { useState, useEffect } from "react";

type Language = "zh" | "en";

export default function LanguageToggle() {
  const [language, setLanguage] = useState<Language>("zh");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/profile")
      .then(r => r.json())
      .then(d => { if (d.language) setLanguage(d.language); })
      .catch(() => {});
  }, []);

  const handleChange = async (lang: Language) => {
    if (lang === language) return;
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: lang }),
      });
      setLanguage(lang);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      // Reload so sidebar re-fetches language preference
      window.location.reload();
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      background: "white",
      borderRadius: 12,
      border: "1px solid #E5E7EB",
      padding: 20,
      marginBottom: 20,
    }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 4 }}>
        🌐 Interface Language / 介面語言
      </div>
      <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 16 }}>
        Choose the language for sidebar navigation labels.
        <br />選擇側邊欄導覽列的顯示語言。
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {(["zh", "en"] as Language[]).map(lang => (
          <button
            key={lang}
            onClick={() => handleChange(lang)}
            disabled={saving}
            style={{
              padding: "10px 24px",
              borderRadius: 8,
              border: language === lang ? "2px solid #7C3AED" : "2px solid #E5E7EB",
              background: language === lang ? "#EDE9FE" : "white",
              color: language === lang ? "#7C3AED" : "#6B7280",
              fontSize: 14,
              fontWeight: 700,
              cursor: saving ? "not-allowed" : "pointer",
              transition: "all 0.15s",
            }}
          >
            {lang === "zh" ? "中文" : "English"}
          </button>
        ))}

        {saving && (
          <span style={{ fontSize: 13, color: "#9CA3AF" }}>Saving...</span>
        )}
        {saved && (
          <span style={{ fontSize: 13, color: "#059669", fontWeight: 600 }}>
            ✓ Saved — reloading
          </span>
        )}
      </div>
    </div>
  );
}