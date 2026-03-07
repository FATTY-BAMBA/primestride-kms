"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useOrganizationList, useUser } from "@clerk/nextjs";

const industries = [
  { value: "technology", label: "科技業 Technology" },
  { value: "manufacturing", label: "製造業 Manufacturing" },
  { value: "finance", label: "金融業 Finance" },
  { value: "retail", label: "零售業 Retail" },
  { value: "healthcare", label: "醫療業 Healthcare" },
  { value: "education", label: "教育業 Education" },
  { value: "construction", label: "營造業 Construction" },
  { value: "logistics", label: "物流業 Logistics" },
  { value: "hospitality", label: "餐旅業 Hospitality" },
  { value: "consulting", label: "顧問業 Consulting" },
  { value: "legal", label: "法律業 Legal" },
  { value: "media", label: "媒體業 Media" },
  { value: "government", label: "政府機關 Government" },
  { value: "nonprofit", label: "非營利組織 Non-profit" },
  { value: "other", label: "其他 Other" },
];

const companySizes = [
  { value: "1-10", label: "1-10 人" },
  { value: "11-50", label: "11-50 人" },
  { value: "51-200", label: "51-200 人" },
  { value: "201-500", label: "201-500 人" },
  { value: "500+", label: "500+ 人" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useUser();
  const { createOrganization, setActive, isLoaded } = useOrganizationList();

  const [step, setStep] = useState(1);
  const [companyName, setCompanyName] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [industry, setIndustry] = useState("");
  const [role, setRole] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const handleCreateOrg = async () => {
    if (!companyName.trim()) { setError("請輸入公司名稱 Company name is required"); return; }
    if (!companySize) { setError("請選擇公司規模 Please select company size"); return; }
    if (!isLoaded || !createOrganization) { setError("系統載入中，請稍候 Loading..."); return; }

    setCreating(true);
    setError("");

    try {
      // Create the organization in Clerk
      const org = await createOrganization({ name: companyName.trim() });

      // Set it as the active organization
      if (setActive) {
        await setActive({ organization: org.id });
      }

      // Store company metadata in our database
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_id: org.id,
          company_name: companyName.trim(),
          company_size: companySize,
          industry,
          admin_role: role,
        }),
      });

      // Redirect to library
      router.push("/library");
    } catch (err: any) {
      console.error("Failed to create organization:", err);
      setError(err.message || "建立組織失敗，請重試 Failed to create organization");
      setCreating(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0e17", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ maxWidth: 520, width: "100%", background: "#111827", borderRadius: 20, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
        
        {/* Header */}
        <div style={{ padding: "32px 32px 0", textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg, #2563eb, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 20, fontWeight: 700, margin: "0 auto 16px", fontFamily: "system-ui" }}>P</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#e8e6e1", marginBottom: 6, fontFamily: "system-ui, sans-serif" }}>
            歡迎使用 Atlas EIP
          </h1>
          <p style={{ fontSize: 14, color: "#64748b", marginBottom: 24 }}>
            Welcome! Let&apos;s set up your company workspace.
          </p>

          {/* Progress Steps */}
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 24 }}>
            {[1, 2].map(s => (
              <div key={s} style={{
                width: s === step ? 32 : 12, height: 6, borderRadius: 3,
                background: s <= step ? "#2563eb" : "rgba(255,255,255,0.1)",
                transition: "all 0.3s",
              }} />
            ))}
          </div>
        </div>

        {/* Step 1: Company Info */}
        {step === 1 && (
          <div style={{ padding: "0 32px 32px" }}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#94a3b8", marginBottom: 6 }}>
                公司名稱 Company Name *
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="例如：台灣科技股份有限公司"
                style={{
                  width: "100%", padding: "12px 16px", borderRadius: 10,
                  border: "1.5px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)",
                  color: "#e8e6e1", fontSize: 15, outline: "none", boxSizing: "border-box",
                  fontFamily: "system-ui, sans-serif",
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = "#2563eb"}
                onBlur={(e) => e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"}
                autoFocus
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#94a3b8", marginBottom: 6 }}>
                公司規模 Company Size *
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {companySizes.map(s => (
                  <button key={s.value} onClick={() => setCompanySize(s.value)}
                    style={{
                      padding: "10px 8px", borderRadius: 8, border: `1.5px solid ${companySize === s.value ? "#2563eb" : "rgba(255,255,255,0.1)"}`,
                      background: companySize === s.value ? "rgba(37,99,235,0.1)" : "rgba(255,255,255,0.02)",
                      color: companySize === s.value ? "#60a5fa" : "#94a3b8",
                      fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
                      fontFamily: "system-ui, sans-serif",
                    }}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#94a3b8", marginBottom: 6 }}>
                產業別 Industry
              </label>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                style={{
                  width: "100%", padding: "12px 16px", borderRadius: 10,
                  border: "1.5px solid rgba(255,255,255,0.1)", background: "#111827",
                  color: industry ? "#e8e6e1" : "#64748b", fontSize: 14, outline: "none",
                  boxSizing: "border-box", fontFamily: "system-ui, sans-serif",
                }}>
                <option value="">選擇產業 Select industry...</option>
                {industries.map(i => (
                  <option key={i.value} value={i.value}>{i.label}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => {
                if (!companyName.trim()) { setError("請輸入公司名稱"); return; }
                if (!companySize) { setError("請選擇公司規模"); return; }
                setError("");
                setStep(2);
              }}
              style={{
                width: "100%", padding: "14px", borderRadius: 10, border: "none",
                background: "#2563eb", color: "white", fontSize: 16, fontWeight: 700,
                cursor: "pointer", transition: "all 0.2s", fontFamily: "system-ui, sans-serif",
              }}>
              下一步 Continue →
            </button>

            {error && (
              <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.2)", color: "#FCA5A5", fontSize: 13, textAlign: "center" }}>
                {error}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Your Role + Create */}
        {step === 2 && (
          <div style={{ padding: "0 32px 32px" }}>
            <div style={{ padding: "16px 20px", background: "rgba(37,99,235,0.06)", borderRadius: 12, border: "1px solid rgba(37,99,235,0.12)", marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#e8e6e1" }}>{companyName}</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                {companySizes.find(s => s.value === companySize)?.label} · {industries.find(i => i.value === industry)?.label || "未選擇產業"}
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#94a3b8", marginBottom: 6 }}>
                你的職務 Your Role
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  { value: "hr", label: "HR 人資" },
                  { value: "ceo", label: "CEO / 老闆" },
                  { value: "manager", label: "部門主管 Manager" },
                  { value: "it", label: "IT / 技術" },
                ].map(r => (
                  <button key={r.value} onClick={() => setRole(r.value)}
                    style={{
                      padding: "12px", borderRadius: 8,
                      border: `1.5px solid ${role === r.value ? "#2563eb" : "rgba(255,255,255,0.1)"}`,
                      background: role === r.value ? "rgba(37,99,235,0.1)" : "rgba(255,255,255,0.02)",
                      color: role === r.value ? "#60a5fa" : "#94a3b8",
                      fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
                      fontFamily: "system-ui, sans-serif",
                    }}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* What You Get */}
            <div style={{ marginBottom: 24, padding: "16px 18px", background: "rgba(16,185,129,0.04)", borderRadius: 12, border: "1px solid rgba(16,185,129,0.1)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#10b981", marginBottom: 8 }}>✨ 您的工作空間包含</div>
              <div style={{ display: "grid", gap: 6 }}>
                {[
                  "📚 知識庫 — 上傳文件，AI 自動整理搜尋",
                  "💬 Ask Atlas — 員工 AI 問答助手",
                  "📝 智慧表單 — 自然語言請假/加班",
                  "🛡️ 2026 合規引擎 — 自動勞基法檢查",
                ].map(f => (
                  <div key={f} style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>{f}</div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setStep(1)}
                style={{
                  padding: "14px 20px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)",
                  background: "transparent", color: "#94a3b8", fontSize: 14, cursor: "pointer",
                  fontFamily: "system-ui, sans-serif",
                }}>
                ← 返回
              </button>
              <button
                onClick={handleCreateOrg}
                disabled={creating}
                style={{
                  flex: 1, padding: "14px", borderRadius: 10, border: "none",
                  background: creating ? "#374151" : "linear-gradient(135deg, #2563eb, #7c3aed)",
                  color: "white", fontSize: 16, fontWeight: 700,
                  cursor: creating ? "not-allowed" : "pointer",
                  boxShadow: creating ? "none" : "0 4px 20px rgba(37,99,235,0.3)",
                  transition: "all 0.2s", fontFamily: "system-ui, sans-serif",
                }}>
                {creating ? "建立中 Creating..." : "建立工作空間 Create Workspace →"}
              </button>
            </div>

            {error && (
              <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.2)", color: "#FCA5A5", fontSize: 13, textAlign: "center" }}>
                {error}
              </div>
            )}

            <div style={{ marginTop: 16, textAlign: "center", fontSize: 11, color: "#4b5563" }}>
              建立後您將成為管理員（Owner），可以邀請團隊成員加入。
            </div>
          </div>
        )}
      </div>
    </div>
  );
}