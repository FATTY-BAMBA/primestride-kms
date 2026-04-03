"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useOrganizationList, useUser, useOrganization } from "@clerk/nextjs";

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
  { value: "1-10", label: "1–10 人" },
  { value: "11-50", label: "11–50 人" },
  { value: "51-200", label: "51–200 人" },
  { value: "201-500", label: "201–500 人" },
  { value: "500+", label: "500+ 人" },
];

// ── Brand constants matching the app ──────────────────────────────────────────
const PRIMARY = "#7C3AED";
const PRIMARY_LIGHT = "#A78BFA";
const PRIMARY_DIM = "rgba(124,58,237,0.12)";
const PRIMARY_BORDER = "rgba(124,58,237,0.25)";

// ── Logo mark ─────────────────────────────────────────────────────────────────
function LogoMark({ size = 48 }: { size?: number }) {
  const r = Math.round(size * 0.27);
  return (
    <div style={{
      width: size, height: size, borderRadius: r,
      background: "#4C1D95",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0,
      boxShadow: "0 0 0 1px rgba(167,139,250,0.2), 0 8px 24px rgba(76,29,149,0.4)",
    }}>
      <svg width={size * 0.52} height={size * 0.52} viewBox="0 0 26 26" fill="none">
        <path d="M13 2 L7 14 L12 14 L6 24 L20 12 L14.5 12 L21 2 Z" fill="white" fillOpacity="0.95"/>
      </svg>
    </div>
  );
}

// ── Input ─────────────────────────────────────────────────────────────────────
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#94a3b8", marginBottom: 6, letterSpacing: "0.04em", textTransform: "uppercase" }}>
        {label}
      </label>
      {hint && <p style={{ fontSize: 11, color: "#4b5563", marginBottom: 6, marginTop: -2 }}>{hint}</p>}
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "11px 14px", borderRadius: 10,
  border: "1.5px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)",
  color: "#e8e6e1", fontSize: 14, outline: "none", boxSizing: "border-box",
  fontFamily: "system-ui, sans-serif", transition: "border-color 0.15s",
};

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useUser();
  const { organization } = useOrganization();
  const { createOrganization, setActive, isLoaded, userMemberships } = useOrganizationList({ userMemberships: true });

  // step: 1 = company info, 2 = your role, 3 = success/welcome
  const [step, setStep] = useState(1);
  const [companyName, setCompanyName] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [industry, setIndustry] = useState("");
  const [taxId, setTaxId] = useState("");
  const [role, setRole] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  // If already has active org AND it has been onboarded (has a name that's not default), go home
  useEffect(() => {
    if (organization) {
      // Check if org has already been properly onboarded via our API
      fetch("/api/onboarding/status").then(r => r.json()).then(data => {
        if (data.completed) router.replace("/home");
        // Otherwise stay on onboarding to collect company details
      }).catch(() => router.replace("/home"));
    }
  }, [organization, router]);

  // If has memberships but no active org, activate first one (don't create new)
  useEffect(() => {
    if (isLoaded && userMemberships?.data && userMemberships.data.length > 0 && !organization) {
      const firstOrg = userMemberships.data[0].organization;
      if (setActive) setActive({ organization: firstOrg.id });
      // Don't redirect yet — let the organization useEffect handle it
    }
  }, [isLoaded, userMemberships, organization, setActive, router]);

  const handleCreateOrg = async () => {
    if (!companyName.trim()) { setError("請輸入公司名稱 Company name is required"); return; }
    if (!companySize) { setError("請選擇公司規模 Please select company size"); return; }
    if (!isLoaded || !createOrganization) { setError("系統載入中，請稍候..."); return; }
    if (taxId && taxId.length > 0 && taxId.length !== 8) { setError("統一編號必須為 8 位數字"); return; }

    setCreating(true);
    setError("");

    try {
      let orgId: string;

      if (organization) {
        // Org already exists (auto-created by Clerk) — just update its name
        orgId = organization.id;
        await organization.update({ name: companyName.trim() });
      } else if (userMemberships?.data && userMemberships.data.length > 0) {
        // Has a membership but no active org — activate and update it
        const firstOrg = userMemberships.data[0].organization;
        orgId = firstOrg.id;
        if (setActive) await setActive({ organization: orgId });
        await firstOrg.update({ name: companyName.trim() });
      } else {
        // Truly no org — create one
        const org = await createOrganization({ name: companyName.trim() });
        if (setActive) await setActive({ organization: org.id });
        orgId = org.id;
      }

      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_id: orgId,
          company_name: companyName.trim(),
          company_size: companySize,
          industry,
          admin_role: role,
          tax_id: taxId || null,
        }),
      });

      setStep(3);
      setCreating(false);
    } catch (err: any) {
      console.error("Failed to create organization:", err);
      setError(err.message || "建立組織失敗，請重試");
      setCreating(false);
    }
  };

  if (!isLoaded) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0e17", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <LogoMark size={40} />
          <div style={{ color: "#4b5563", fontSize: 13, marginTop: 14 }}>載入中...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0e17",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24,
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      {/* Subtle background glow */}
      <div style={{
        position: "fixed", top: "20%", left: "50%", transform: "translateX(-50%)",
        width: 600, height: 400, borderRadius: "50%",
        background: "radial-gradient(ellipse, rgba(124,58,237,0.08) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div style={{
        maxWidth: 500, width: "100%",
        background: "#111827",
        borderRadius: 20,
        border: "1px solid rgba(255,255,255,0.07)",
        overflow: "hidden",
        position: "relative",
      }}>

        {/* ── HEADER (all steps) ──────────────────────────────────── */}
        {step < 3 && (
          <div style={{ padding: "32px 32px 0", textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              <LogoMark size={52} />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9", margin: "0 0 4px" }}>
              歡迎使用 Atlas EIP
            </h1>
            <p style={{ fontSize: 13, color: "#4b5563", margin: "0 0 24px" }}>
              設定您的企業工作空間，全程只需 2 分鐘。
            </p>

            {/* Progress bar */}
            <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 28 }}>
              {[1, 2].map(s => (
                <div key={s} style={{
                  height: 4, borderRadius: 2,
                  width: s === step ? 36 : 16,
                  background: s <= step ? PRIMARY : "rgba(255,255,255,0.08)",
                  transition: "all 0.3s ease",
                }} />
              ))}
            </div>

            <div style={{ fontSize: 11, color: "#374151", marginBottom: 24 }}>
              步驟 {step} / 2 — {step === 1 ? "公司基本資料" : "您的職務"}
            </div>
          </div>
        )}

        {/* ── STEP 1: Company Info ─────────────────────────────────── */}
        {step === 1 && (
          <div style={{ padding: "0 32px 32px" }}>

            <Field label="公司名稱 Company Name *" hint="請輸入貴公司的正式名稱">
              <input
                type="text"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                placeholder="例如：台灣科技股份有限公司"
                style={inputStyle}
                onFocus={e => e.currentTarget.style.borderColor = PRIMARY}
                onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"}
                autoFocus
              />
            </Field>

            <Field
              label="統一編號 Tax ID"
              hint="可稍後補填。用於政府補助資格自動比對。"
            >
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  value={taxId}
                  onChange={e => setTaxId(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  placeholder="8 位數字（選填）"
                  maxLength={8}
                  style={{
                    ...inputStyle,
                    borderColor: taxId.length === 8 ? "rgba(16,185,129,0.4)" : "rgba(255,255,255,0.08)",
                    fontFamily: "monospace", letterSpacing: "0.08em",
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = PRIMARY}
                  onBlur={e => e.currentTarget.style.borderColor = taxId.length === 8 ? "rgba(16,185,129,0.4)" : "rgba(255,255,255,0.08)"}
                />
                {taxId.length === 8 && (
                  <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#10b981" }}>✓</span>
                )}
              </div>
              {taxId.length > 0 && taxId.length < 8 && (
                <div style={{ marginTop: 4, fontSize: 11, color: "#f87171" }}>{taxId.length}/8 位</div>
              )}
            </Field>

            <Field label="公司規模 Company Size *" hint="選擇最接近的員工人數範圍">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                {companySizes.map(s => (
                  <button key={s.value} onClick={() => setCompanySize(s.value)} style={{
                    padding: "10px 6px", borderRadius: 8,
                    border: `1.5px solid ${companySize === s.value ? PRIMARY : "rgba(255,255,255,0.08)"}`,
                    background: companySize === s.value ? PRIMARY_DIM : "rgba(255,255,255,0.02)",
                    color: companySize === s.value ? PRIMARY_LIGHT : "#64748b",
                    fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
                  }}>
                    {s.label}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="產業別 Industry" hint="用於比對適合的政府補助方案">
              <select
                value={industry}
                onChange={e => setIndustry(e.target.value)}
                style={{
                  ...inputStyle,
                  background: "#111827",
                  color: industry ? "#e8e6e1" : "#4b5563",
                }}
              >
                <option value="">選擇產業 Select industry...</option>
                {industries.map(i => (
                  <option key={i.value} value={i.value}>{i.label}</option>
                ))}
              </select>
            </Field>

            {error && (
              <div style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 8, background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", color: "#fca5a5", fontSize: 13, textAlign: "center" }}>
                {error}
              </div>
            )}

            <button
              onClick={() => {
                if (!companyName.trim()) { setError("請輸入公司名稱"); return; }
                if (!companySize) { setError("請選擇公司規模"); return; }
                if (taxId && taxId.length > 0 && taxId.length !== 8) { setError("統一編號必須為 8 位數字（或留空）"); return; }
                setError(""); setStep(2);
              }}
              style={{
                width: "100%", padding: "13px", borderRadius: 10, border: "none",
                background: PRIMARY, color: "white", fontSize: 15, fontWeight: 700,
                cursor: "pointer", transition: "opacity 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = "0.9"}
              onMouseLeave={e => e.currentTarget.style.opacity = "1"}
            >
              下一步 Continue →
            </button>
          </div>
        )}

        {/* ── STEP 2: Role + Create ────────────────────────────────── */}
        {step === 2 && (
          <div style={{ padding: "0 32px 32px" }}>

            {/* Summary card */}
            <div style={{ padding: "14px 18px", background: PRIMARY_DIM, borderRadius: 12, border: `1px solid ${PRIMARY_BORDER}`, marginBottom: 22 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>{companyName}</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>
                {companySizes.find(s => s.value === companySize)?.label}
                {industry && ` · ${industries.find(i => i.value === industry)?.label}`}
                {taxId && ` · 統編 ${taxId}`}
              </div>
            </div>

            <Field label="您的職務 Your Role" hint="幫助我們為您顯示最相關的功能">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  { value: "hr", label: "👤 HR 人資" },
                  { value: "ceo", label: "👔 CEO / 老闆" },
                  { value: "manager", label: "📊 部門主管" },
                  { value: "it", label: "💻 IT / 技術" },
                ].map(r => (
                  <button key={r.value} onClick={() => setRole(r.value)} style={{
                    padding: "12px", borderRadius: 8,
                    border: `1.5px solid ${role === r.value ? PRIMARY : "rgba(255,255,255,0.08)"}`,
                    background: role === r.value ? PRIMARY_DIM : "rgba(255,255,255,0.02)",
                    color: role === r.value ? PRIMARY_LIGHT : "#64748b",
                    fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
                    textAlign: "center",
                  }}>
                    {r.label}
                  </button>
                ))}
              </div>
            </Field>

            {/* What you get */}
            <div style={{ marginBottom: 22, padding: "14px 16px", background: "rgba(16,185,129,0.04)", borderRadius: 12, border: "1px solid rgba(16,185,129,0.1)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#10b981", marginBottom: 10, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                工作空間包含
              </div>
              <div style={{ display: "grid", gap: 7 }}>
                {[
                  ["📚", "知識庫", "上傳文件，AI 自動整理與搜尋"],
                  ["💬", "Ask Atlas", "員工 AI 問答，來源引用透明"],
                  ["📝", "智慧表單", "自然語言請假、加班申請"],
                  ["🛡️", "合規引擎", "2026 勞基法自動檢查"],
                ].map(([icon, title, desc]) => (
                  <div key={title as string} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 14, flexShrink: 0 }}>{icon}</span>
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>{title}</span>
                      <span style={{ fontSize: 12, color: "#4b5563" }}> — {desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 8, background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", color: "#fca5a5", fontSize: 13, textAlign: "center" }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => { setStep(1); setError(""); }}
                style={{
                  padding: "13px 18px", borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "transparent", color: "#64748b",
                  fontSize: 14, cursor: "pointer",
                }}
              >
                ← 返回
              </button>
              <button
                onClick={handleCreateOrg}
                disabled={creating}
                style={{
                  flex: 1, padding: "13px", borderRadius: 10, border: "none",
                  background: creating ? "#1f2937" : PRIMARY,
                  color: creating ? "#4b5563" : "white",
                  fontSize: 15, fontWeight: 700,
                  cursor: creating ? "not-allowed" : "pointer",
                  transition: "all 0.2s",
                  boxShadow: creating ? "none" : `0 4px 20px rgba(124,58,237,0.3)`,
                }}
              >
                {creating ? "建立中..." : "建立工作空間 →"}
              </button>
            </div>

            <div style={{ marginTop: 14, textAlign: "center", fontSize: 11, color: "#374151" }}>
              建立後您將成為管理員，可邀請團隊成員加入。
            </div>
          </div>
        )}

        {/* ── STEP 3: Success / Welcome ────────────────────────────── */}
        {step === 3 && (
          <div style={{ padding: "40px 32px 36px", textAlign: "center" }}>

            {/* Success icon */}
            <div style={{
              width: 64, height: 64, borderRadius: 18, background: "rgba(16,185,129,0.1)",
              border: "1px solid rgba(16,185,129,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 20px", fontSize: 28,
            }}>
              ✅
            </div>

            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9", margin: "0 0 6px" }}>
              工作空間已建立！
            </h2>
            <p style={{ fontSize: 13, color: "#4b5563", margin: "0 0 28px" }}>
              {companyName} 的 Atlas EIP 已準備就緒。
            </p>

            {/* Next steps */}
            <div style={{ textAlign: "left", marginBottom: 28 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>
                建議第一步
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {[
                  { num: "1", title: "上傳員工手冊", desc: "讓 Ask Atlas 能回答員工的政策問題", href: "/library" },
                  { num: "2", title: "邀請 HR 或主管", desc: "讓他們開始審核請假與加班申請", href: "/team" },
                  { num: "3", title: "試用 Ask Atlas", desc: '例如：「加班費怎麼計算？」', href: "/agent" },
                ].map(item => (
                  <div key={item.num} style={{
                    display: "flex", gap: 12, alignItems: "flex-start",
                    padding: "12px 14px", borderRadius: 10,
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                      background: PRIMARY_DIM, border: `1px solid ${PRIMARY_BORDER}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 700, color: PRIMARY_LIGHT,
                    }}>
                      {item.num}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", marginBottom: 2 }}>{item.title}</div>
                      <div style={{ fontSize: 11, color: "#4b5563" }}>{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => { window.location.href = "/home"; }}
              style={{
                width: "100%", padding: "14px", borderRadius: 10, border: "none",
                background: PRIMARY, color: "white", fontSize: 15, fontWeight: 700,
                cursor: "pointer", boxShadow: `0 4px 20px rgba(124,58,237,0.35)`,
              }}
            >
              進入工作空間 Enter Workspace →
            </button>

            <div style={{ marginTop: 14, fontSize: 11, color: "#374151" }}>
              您可以隨時在設定中補填統一編號與品牌資訊。
            </div>
          </div>
        )}
      </div>
    </div>
  );
}