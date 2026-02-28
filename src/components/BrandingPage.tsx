"use client";

import { useState, useEffect } from "react";

interface Branding {
  org_name: string | null;
  logo_emoji: string | null;
  logo_url: string | null;
  primary_color: string;
  accent_color: string;
  tagline: string | null;
}

const defaultBranding: Branding = {
  org_name: "",
  logo_emoji: "📚",
  logo_url: "",
  primary_color: "#7C3AED",
  accent_color: "#A78BFA",
  tagline: "",
};

const presetColors = [
  { name: "紫色 Purple", primary: "#7C3AED", accent: "#A78BFA" },
  { name: "藍色 Blue", primary: "#2563EB", accent: "#60A5FA" },
  { name: "綠色 Green", primary: "#059669", accent: "#34D399" },
  { name: "紅色 Red", primary: "#DC2626", accent: "#F87171" },
  { name: "橘色 Orange", primary: "#EA580C", accent: "#FB923C" },
  { name: "粉色 Pink", primary: "#DB2777", accent: "#F472B6" },
  { name: "深藍 Navy", primary: "#1E3A5F", accent: "#3B82F6" },
  { name: "黑色 Dark", primary: "#111827", accent: "#4B5563" },
];

const emojiOptions = ["📚", "🏢", "🏗️", "💼", "🎯", "🚀", "⚡", "🔬", "🏥", "🎓", "🏛️", "🌐", "💡", "🛡️", "📊", "🤖"];

export default function BrandingPage() {
  const [branding, setBranding] = useState<Branding>(defaultBranding);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/branding")
      .then(r => r.json())
      .then(d => {
        if (d.branding) {
          setBranding({ ...defaultBranding, ...d.branding });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/branding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(branding),
      });
      if (res.ok) {
        setMessage("✅ 品牌設定已儲存 Branding saved!");
        setTimeout(() => setMessage(""), 3000);
      } else {
        setMessage("❌ 儲存失敗 Failed to save");
      }
    } catch {
      setMessage("❌ 儲存失敗 Failed to save");
    } finally { setSaving(false); }
  };

  if (loading) return <div style={{ padding: 60, textAlign: "center", color: "#9CA3AF" }}>載入中...</div>;

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 20px", paddingBottom: 60 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111827", marginBottom: 4 }}>🎨 品牌設定 Custom Branding</h1>
        <p style={{ fontSize: 14, color: "#6B7280" }}>自訂組織外觀 | Customize your organization's appearance</p>
      </div>

      {/* Live Preview */}
      <div style={{
        background: "white", borderRadius: 12, border: "1px solid #E5E7EB",
        padding: 24, marginBottom: 28,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#9CA3AF", marginBottom: 12, textTransform: "uppercase" }}>
          預覽 Preview
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 12, padding: 16,
          background: "#F9FAFB", borderRadius: 10,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: `linear-gradient(135deg, ${branding.primary_color} 0%, ${branding.accent_color} 100%)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20,
          }}>
            {branding.logo_emoji || "📚"}
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: "#111827" }}>
              {branding.org_name || "PS Atlas"}
            </div>
            <div style={{ fontSize: 11, color: "#9CA3AF" }}>
              {branding.tagline || "Knowledge System"}
            </div>
          </div>
        </div>
        {/* Sample button */}
        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <div style={{
            padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: branding.primary_color, color: "white",
          }}>主要按鈕 Primary</div>
          <div style={{
            padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: branding.accent_color + "20", color: branding.primary_color,
            border: `1px solid ${branding.primary_color}30`,
          }}>次要按鈕 Secondary</div>
        </div>
      </div>

      {/* Settings */}
      <div style={{ background: "white", borderRadius: 12, border: "1px solid #E5E7EB", padding: 28 }}>

        {/* Org Name */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 6, color: "#374151" }}>
            組織名稱 Organization Name
          </label>
          <input
            type="text" value={branding.org_name || ""} placeholder="e.g., 台灣建設公司"
            onChange={(e) => setBranding({ ...branding, org_name: e.target.value })}
            style={{ width: "100%", padding: "10px 14px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" }}
          />
        </div>

        {/* Tagline */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 6, color: "#374151" }}>
            標語 Tagline
          </label>
          <input
            type="text" value={branding.tagline || ""} placeholder="e.g., 智慧知識管理平台"
            onChange={(e) => setBranding({ ...branding, tagline: e.target.value })}
            style={{ width: "100%", padding: "10px 14px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" }}
          />
        </div>

        {/* Logo Emoji */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 6, color: "#374151" }}>
            標誌圖示 Logo Emoji
          </label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {emojiOptions.map(e => (
              <button key={e} onClick={() => setBranding({ ...branding, logo_emoji: e })}
                style={{
                  width: 42, height: 42, borderRadius: 10, border: `2px solid ${branding.logo_emoji === e ? branding.primary_color : "#E5E7EB"}`,
                  background: branding.logo_emoji === e ? branding.primary_color + "15" : "white",
                  fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >{e}</button>
            ))}
          </div>
        </div>

        {/* Colors */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 6, color: "#374151" }}>
            品牌色彩 Brand Colors
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {presetColors.map(c => (
              <button key={c.name} onClick={() => setBranding({ ...branding, primary_color: c.primary, accent_color: c.accent })}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 14px", borderRadius: 10,
                  border: `2px solid ${branding.primary_color === c.primary ? c.primary : "#E5E7EB"}`,
                  background: branding.primary_color === c.primary ? c.primary + "10" : "white",
                  cursor: "pointer", fontSize: 12, fontWeight: 500, color: "#374151",
                }}
              >
                <div style={{ width: 20, height: 20, borderRadius: 6, background: `linear-gradient(135deg, ${c.primary}, ${c.accent})` }} />
                {c.name}
              </button>
            ))}
          </div>

          {/* Custom color inputs */}
          <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: "#6B7280" }}>主色 Primary</label>
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
                <input type="color" value={branding.primary_color}
                  onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })}
                  style={{ width: 36, height: 36, border: "none", cursor: "pointer", borderRadius: 6 }}
                />
                <code style={{ fontSize: 12, color: "#6B7280" }}>{branding.primary_color}</code>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#6B7280" }}>輔色 Accent</label>
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
                <input type="color" value={branding.accent_color}
                  onChange={(e) => setBranding({ ...branding, accent_color: e.target.value })}
                  style={{ width: 36, height: 36, border: "none", cursor: "pointer", borderRadius: 6 }}
                />
                <code style={{ fontSize: 12, color: "#6B7280" }}>{branding.accent_color}</code>
              </div>
            </div>
          </div>
        </div>

        {/* Save */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 28 }}>
          <button onClick={handleSave} disabled={saving}
            style={{
              padding: "12px 28px", borderRadius: 8, border: "none",
              background: branding.primary_color, color: "white",
              fontSize: 15, fontWeight: 700, cursor: "pointer",
              opacity: saving ? 0.7 : 1,
            }}>
            {saving ? "儲存中..." : "💾 儲存設定 Save"}
          </button>
          {message && <span style={{ fontSize: 14 }}>{message}</span>}
        </div>
      </div>
    </div>
  );
}
