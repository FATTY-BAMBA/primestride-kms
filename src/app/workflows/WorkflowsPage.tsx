"use client";

import { useState, useEffect } from "react";

interface Submission {
  id: string;
  form_type: string;
  form_data: Record<string, any>;
  status: string;
  submitted_by: string;
  submitter_name: string;
  original_text: string | null;
  ai_parsed: boolean;
  reviewed_by: string | null;
  reviewer_name: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
}

interface LeaveBalance {
  annual_total: number; annual_used: number;
  sick_total: number; sick_used: number;
  personal_total: number; personal_used: number;
  family_care_total: number; family_care_used: number;
  family_care_hours_total: number; family_care_hours_used: number;
  maternity_total: number; maternity_used: number;
  paternity_total: number; paternity_used: number;
  marriage_total: number; marriage_used: number;
  bereavement_total: number; bereavement_used: number;
  comp_time_total: number; comp_time_used: number;
}

interface Stats { pending: number; approved_this_month: number; rejected_this_month: number; total_this_month: number; }

interface ComplianceCheck {
  check_type: string;
  status: "pass" | "warning" | "blocked";
  rule_reference: string;
  message: string;
  message_zh: string;
  details: Record<string, any>;
}

interface ComplianceResult {
  status: "pass" | "warning" | "blocked";
  checks: ComplianceCheck[];
  ai_analysis?: string;
  ai_analysis_zh?: string;
}

const formMeta: Record<string, { icon: string; name_zh: string; name_en: string; color: string }> = {
  leave: { icon: "📝", name_zh: "請假申請", name_en: "Leave Request", color: "#7C3AED" },
  overtime: { icon: "🕐", name_zh: "加班申請", name_en: "Overtime Request", color: "#2563EB" },
  business_trip: { icon: "✈️", name_zh: "出差申請", name_en: "Business Trip", color: "#059669" },
};

const fieldLabels: Record<string, string> = {
  leave_type: "假別", start_date: "開始日期", end_date: "結束日期",
  days: "天數", reason: "事由", proxy: "職務代理人",
  date: "日期", start_time: "開始時間", end_time: "結束時間",
  hours: "時數", overtime_type: "加班類別", project: "專案",
  destination: "地點", purpose: "目的",
  transport: "交通", budget: "預估費用", accommodation: "住宿",
};

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "⏳ 待審核", color: "#D97706", bg: "#FEF3C7" },
  approved: { label: "✅ 已核准", color: "#059669", bg: "#D1FAE5" },
  rejected: { label: "❌ 已駁回", color: "#DC2626", bg: "#FEE2E2" },
  cancelled: { label: "🚫 已取消", color: "#6B7280", bg: "#F3F4F6" },
};

const examples = [
  "我下週一到週三要請特休，回南部探親",
  "今天晚上加班到九點，趕客戶報告",
  "下週二到週四去高雄出差，拜訪客戶，搭高鐵",
  "明天請病假一天，身體不舒服",
  "週六加班4小時處理緊急訂單",
];

export default function WorkflowsPage() {
  // ── Core State ──
  const [nlpInput, setNlpInput] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsedType, setParsedType] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, any> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [showEditMode, setShowEditMode] = useState(false);

  // ── Compliance ──
  const [compliance, setCompliance] = useState<ComplianceResult | null>(null);
  const [checkingCompliance, setCheckingCompliance] = useState(false);

  // ── Submissions ──
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [viewMode, setViewMode] = useState<"my" | "all">("my");
  const [statusFilter, setStatusFilter] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({ pending: 0, approved_this_month: 0, rejected_this_month: 0, total_this_month: 0 });
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalance | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── Fetch ──
  const fetchSubmissions = async () => {
    try {
      let url = `/api/workflows?view=${viewMode}`;
      if (statusFilter) url += `&status=${statusFilter}`;
      const res = await fetch(url);
      const data = await res.json();
      setSubmissions(data.submissions || []);
      setIsAdmin(data.isAdmin || false);
      if (data.stats) setStats(data.stats);
      if (data.leave_balance) setLeaveBalance(data.leave_balance);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchSubmissions(); }, [viewMode, statusFilter]);

  // ── Universal NLP Parse (auto-detects form type) ──
  const handleParse = async () => {
    if (!nlpInput.trim()) return;
    setParsing(true); setFormData(null); setParsedType(null); setCompliance(null); setShowEditMode(false);
    try {
      // Let the AI detect form type + fill fields in one call
      const res = await fetch("/api/workflows/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: nlpInput, form_type: "auto" }),
      });
      const data = await res.json();
      if (data.form_data) {
        setFormData(data.form_data);
        setParsedType(data.form_type || "leave");
      }
    } catch {} finally { setParsing(false); }
  };

  // ── Compliance Check (auto-runs when form parsed) ──
  const runComplianceCheck = async () => {
    if (!formData || !parsedType) return;
    setCheckingCompliance(true); setCompliance(null);
    try {
      const res = await fetch("/api/compliance/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form_type: parsedType, form_data: formData }),
      });
      const data = await res.json();
      if (data.data) setCompliance(data.data);
    } catch {
      setCompliance({ status: "pass", checks: [] });
    } finally { setCheckingCompliance(false); }
  };

  useEffect(() => {
    if (formData && parsedType) {
      const t = setTimeout(() => runComplianceCheck(), 400);
      return () => clearTimeout(t);
    }
  }, [formData, parsedType]);

  // ── Submit ──
  const handleSubmit = async () => {
    if (!formData || !parsedType) return;
    if (compliance?.status === "blocked") {
      setMessage("🚫 合規檢查未通過，請調整內容。");
      setTimeout(() => setMessage(""), 4000);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form_type: parsedType, form_data: formData, original_text: nlpInput, ai_parsed: true }),
      });
      if (res.ok) {
        setMessage("✅ 已送出！");
        setNlpInput(""); setFormData(null); setParsedType(null); setCompliance(null);
        fetchSubmissions();
        setTimeout(() => setMessage(""), 3000);
      }
    } catch {} finally { setSubmitting(false); }
  };

  // ── Admin Actions ──
  const handleReview = async (id: string, action: string) => {
    try {
      await fetch("/api/workflows", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, review_note: reviewNote }),
      });
      setReviewingId(null); setReviewNote(""); fetchSubmissions();
    } catch {}
  };

  const handleCancel = async (id: string) => {
    try {
      await fetch("/api/workflows", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action: "cancelled" }) });
      fetchSubmissions();
    } catch {}
  };

  const handleBatchApproval = async (action: string) => {
    try {
      await fetch("/api/workflows", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), action, review_note: reviewNote }),
      });
      setSelectedIds(new Set()); setReviewNote(""); fetchSubmissions();
    } catch {}
  };

  const toggleSelect = (id: string) => { const n = new Set(selectedIds); n.has(id) ? n.delete(id) : n.add(id); setSelectedIds(n); };
  const selectAllPending = () => setSelectedIds(new Set(submissions.filter(s => s.status === "pending").map(s => s.id)));

  const exportPdf = (s: Submission) => {
    const ft = formMeta[s.form_type];
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${ft?.name_zh || s.form_type}</title><style>body{font-family:'Noto Sans TC',sans-serif;max-width:600px;margin:40px auto;padding:20px;color:#111827}h1{font-size:22px;border-bottom:3px solid ${ft?.color || "#7C3AED"};padding-bottom:12px}.field{display:flex;padding:8px 0;border-bottom:1px solid #eee}.field-label{width:140px;color:#6B7280;font-weight:600;font-size:14px}.field-val{flex:1;font-size:14px}.status{display:inline-block;padding:4px 12px;border-radius:6px;font-size:13px;font-weight:600;margin-top:16px;background:${statusConfig[s.status]?.bg};color:${statusConfig[s.status]?.color}}</style></head><body>`);
    w.document.write(`<h1>${ft?.icon} ${ft?.name_zh} ${ft?.name_en}</h1>`);
    Object.entries(s.form_data).forEach(([k, v]) => w.document.write(`<div class="field"><div class="field-label">${fieldLabels[k] || k}</div><div class="field-val">${v || "—"}</div></div>`));
    w.document.write(`<div class="status">${statusConfig[s.status]?.label}</div>`);
    if (s.original_text) w.document.write(`<p style="margin-top:16px;font-size:12px;color:#9CA3AF">💬 ${s.original_text}</p>`);
    w.document.write(`<p style="margin-top:32px;font-size:11px;color:#D1D5DB;text-align:center">PrimeStride Atlas · ${new Date().toLocaleDateString()}</p></body></html>`);
    w.document.close(); w.print();
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString("zh-TW", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const meta = parsedType ? formMeta[parsedType] : null;

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 12px 80px 12px" }}>
      {message && <div style={{ padding: "10px 16px", borderRadius: 10, background: message.includes("✅") ? "#D1FAE5" : "#FEE2E2", color: message.includes("✅") ? "#065F46" : "#991B1B", fontSize: 14, fontWeight: 600, marginBottom: 16 }}>{message}</div>}

      {/* ═══ STATS ═══ */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginBottom: 16 }}>
        {[
          { label: "待審核", val: stats.pending, color: "#D97706", bg: "#FEF3C7" },
          { label: "本月核准", val: stats.approved_this_month, color: "#059669", bg: "#D1FAE5" },
          { label: "本月駁回", val: stats.rejected_this_month, color: "#DC2626", bg: "#FEE2E2" },
          { label: "本月總計", val: stats.total_this_month, color: "#6B7280", bg: "#F3F4F6" },
        ].map(s => (
          <div key={s.label} style={{ padding: "10px 8px", background: s.bg, borderRadius: 10, textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 11, color: s.color, opacity: 0.8 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ═══ LEAVE BALANCE ═══ */}
      {leaveBalance && (
        <div style={{ padding: 16, background: "white", borderRadius: 12, border: "1px solid #E5E7EB", marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 12 }}>🏖️ 假期餘額 {new Date().getFullYear()}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 6 }}>
            {[
              { label: "特休 Annual", used: leaveBalance.annual_used, total: leaveBalance.annual_total, color: "#7C3AED", tag: "有薪 Paid", tagColor: "#059669" },
              { label: "病假 Sick", used: leaveBalance.sick_used, total: leaveBalance.sick_total, color: "#2563EB", tag: "半薪 Half-Pay", tagColor: "#D97706" },
              { label: "事假 Personal", used: leaveBalance.personal_used, total: leaveBalance.personal_total, color: "#D97706", tag: "無薪 Unpaid", tagColor: "#DC2626" },
              { label: "家庭照顧 Family Care", used: leaveBalance.family_care_used || 0, total: leaveBalance.family_care_total || 7, color: "#059669", tag: "有薪 Paid", tagColor: "#059669" },
              ...(leaveBalance.comp_time_total > 0 ? [{ label: "補休 Comp Time", used: leaveBalance.comp_time_used || 0, total: leaveBalance.comp_time_total, color: "#6366F1", tag: "有薪 Paid", tagColor: "#059669" }] : []),
              ...(leaveBalance.marriage_total > 0 ? [{ label: "婚假 Marriage", used: leaveBalance.marriage_used || 0, total: leaveBalance.marriage_total, color: "#EC4899", tag: "有薪 Paid", tagColor: "#059669" }] : []),
              ...(leaveBalance.maternity_total > 0 ? [{ label: "產假 Maternity", used: leaveBalance.maternity_used || 0, total: leaveBalance.maternity_total, color: "#F43F5E", tag: "有薪 Paid", tagColor: "#059669" }] : []),
              ...(leaveBalance.paternity_total > 0 ? [{ label: "陪產假 Paternity", used: leaveBalance.paternity_used || 0, total: leaveBalance.paternity_total, color: "#0EA5E9", tag: "有薪 Paid", tagColor: "#059669" }] : []),
            ].map(b => {
              const remaining = b.total - b.used;
              const usedPct = b.total > 0 ? Math.min((b.used / b.total) * 100, 100) : 0;
              const isLow = b.total > 0 && remaining / b.total <= 0.2;
              const isEmpty = remaining <= 0;
              return (
                <div key={b.label} style={{ padding: "10px 12px", background: isEmpty ? "#FEF2F2" : "#F9FAFB", borderRadius: 10, border: `1px solid ${isEmpty ? "#FECACA" : "#F3F4F6"}` }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{ fontSize: 11, color: "#6B7280", fontWeight: 600 }}>{b.label}</div>
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                      background: b.tagColor === "#059669" ? "#D1FAE5" : b.tagColor === "#D97706" ? "#FEF3C7" : "#FEE2E2",
                      color: b.tagColor,
                    }}>{b.tag}</span>
                  </div>
                  <div style={{ height: 6, background: "#E5E7EB", borderRadius: 3, overflow: "hidden", marginBottom: 6 }}>
                    <div style={{
                      height: "100%",
                      width: `${usedPct}%`,
                      background: isEmpty ? "#DC2626" : isLow ? "#F59E0B" : b.color,
                      borderRadius: 3,
                      transition: "width 0.4s ease",
                    }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: isEmpty ? "#DC2626" : "#111827" }}>
                      {remaining}<span style={{ fontSize: 11, fontWeight: 400, color: "#9CA3AF" }}>/{b.total} 天</span>
                    </div>
                    {b.used > 0 && (
                      <div style={{ fontSize: 10, color: "#9CA3AF" }}>已用 {b.used} 天</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
           THE ONE INPUT BOX — Zero Forms
           ═══════════════════════════════════════════ */}
      <div style={{ background: "white", borderRadius: 16, border: "1px solid #E5E7EB", overflow: "hidden", marginBottom: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", background: "linear-gradient(135deg, #7C3AED08, #7C3AED03)", borderBottom: "1px solid #F1F5F9" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>💬 用一句話完成申請</div>
          <div style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>請假、加班、出差 — 直接說，AI 幫你搞定</div>
        </div>

        {/* Input */}
        <div style={{ padding: 20 }}>
          <div style={{ position: "relative" }}>
            <textarea
              value={nlpInput}
              onChange={(e) => setNlpInput(e.target.value)}
              placeholder="例如：我下週一到週三要請特休，因為要回南部探親..."
              rows={3}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleParse(); } }}
              style={{ width: "100%", padding: "14px 16px", paddingRight: 90, border: "1.5px solid #E5E7EB", borderRadius: 12, fontSize: 15, outline: "none", resize: "none", lineHeight: 1.6, boxSizing: "border-box", transition: "border-color 0.2s", fontFamily: "inherit", WebkitTextSizeAdjust: "100%" }}
              onFocus={(e) => e.currentTarget.style.borderColor = "#7C3AED"}
              onBlur={(e) => e.currentTarget.style.borderColor = "#E5E7EB"}
            />
            <button
              onClick={handleParse}
              disabled={parsing || !nlpInput.trim()}
              style={{
                position: "absolute", right: 10, bottom: 10,
                padding: "10px 18px", borderRadius: 10, border: "none",
                background: parsing || !nlpInput.trim() ? "#D1D5DB" : "#7C3AED",
                color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              {parsing ? "⏳" : "送出 →"}
            </button>
          </div>

          {/* Quick Examples */}
          {!formData && !parsing && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
              {examples.map((ex) => (
                <button key={ex} onClick={() => { setNlpInput(ex); }}
                  style={{ padding: "5px 12px", borderRadius: 100, border: "1px solid #E5E7EB", background: "#F9FAFB", fontSize: 12, color: "#6B7280", cursor: "pointer", transition: "all 0.15s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#7C3AED"; e.currentTarget.style.color = "#7C3AED"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.color = "#6B7280"; }}
                >
                  {ex.length > 20 ? ex.slice(0, 20) + "..." : ex}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ═══ AI SUMMARY CARD ═══ */}
        {formData && meta && (
          <div style={{ borderTop: "1px solid #E5E7EB" }}>
            {/* Type Badge */}
            <div style={{ padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", background: `${meta.color}08` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${meta.color}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{meta.icon}</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: meta.color }}>{meta.name_zh}</div>
                  <div style={{ fontSize: 12, color: "#9CA3AF" }}>{meta.name_en} · AI 自動辨識</div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: "#9CA3AF", display: "flex", gap: 6 }}>
                <button onClick={() => setShowEditMode(!showEditMode)}
                  style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #E5E7EB", background: showEditMode ? "#F3F4F6" : "white", fontSize: 11, cursor: "pointer", color: "#6B7280" }}>
                  {showEditMode ? "收起" : "✏️ 編輯"}
                </button>
              </div>
            </div>

            {/* Summary Fields — clean read-only view */}
            <div style={{ padding: "12px 20px" }}>
              {!showEditMode ? (
                /* ── READ-ONLY SUMMARY ── */
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
                  {Object.entries(formData).map(([key, value]) => (
                    <div key={key} style={{ padding: "8px 12px", background: "#F9FAFB", borderRadius: 8 }}>
                      <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>{fieldLabels[key] || key}</div>
                      <div style={{ fontSize: 14, color: "#111827", fontWeight: 600, marginTop: 2 }}>{String(value || "—")}</div>
                    </div>
                  ))}
                </div>
              ) : (
                /* ── EDIT MODE (hidden by default) ── */
                <div style={{ display: "grid", gap: 12 }}>
                  {Object.entries(formData).map(([key, value]) => {
                    const selectOptions: Record<string, string[]> = {
                      leave_type: ["特休 Annual", "病假 Sick", "事假 Personal", "家庭照顧假 Family Care", "婚假 Marriage", "喪假 Bereavement", "產假 Maternity", "陪產假 Paternity", "公假 Official"],
                      overtime_type: ["平日加班 Weekday", "假日加班 Holiday", "國定假日 National Holiday"],
                      transport: ["高鐵 HSR", "飛機 Flight", "自駕 Driving", "火車 Train", "其他 Other"],
                    };
                    const options = selectOptions[key];
                    return (
                      <div key={key}>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 3 }}>{fieldLabels[key] || key}</label>
                        {options ? (
                          <select value={String(value || "")} onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                            style={{ width: "100%", padding: "8px 12px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box", background: "white" }}>
                            {options.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : (
                          <input
                            type={key.includes("date") ? "date" : (key === "start_time" || key === "end_time") ? "time" : key === "hours" || key === "days" ? "number" : "text"}
                            value={String(value || "")}
                            onChange={(e) => setFormData({ ...formData, [key]: key === "hours" || key === "days" ? parseFloat(e.target.value) : e.target.value })}
                            style={{ width: "100%", padding: "8px 12px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ═══ COMPLIANCE PANEL ═══ */}
            {(checkingCompliance || compliance) && (
              <div style={{ margin: "0 20px 12px", borderRadius: 10, overflow: "hidden", border: `1px solid ${compliance?.status === "blocked" ? "#FCA5A5" : compliance?.status === "warning" ? "#FCD34D" : "#86EFAC"}` }}>
                <div style={{
                  padding: "8px 14px", fontWeight: 700, fontSize: 12,
                  background: compliance?.status === "blocked" ? "#FEE2E2" : compliance?.status === "warning" ? "#FEF3C7" : "#D1FAE5",
                  color: compliance?.status === "blocked" ? "#991B1B" : compliance?.status === "warning" ? "#92400E" : "#065F46",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  {checkingCompliance ? "⏳ 合規檢查中..."
                    : compliance?.status === "blocked" ? "🚫 合規未通過 — 無法送出"
                    : compliance?.status === "warning" ? "⚠️ 合規提醒"
                    : "✅ 合規通過"}
                </div>
                {compliance && compliance.checks.filter(c => c.status !== "pass").length > 0 && (
                  <div style={{ padding: 12, background: "white" }}>
                    {compliance.checks.filter(c => c.status !== "pass").map((check, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8 }}>
                        <div style={{
                          width: 20, height: 20, borderRadius: 5, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10,
                          background: check.status === "blocked" ? "#FEE2E2" : "#FEF3C7",
                          color: check.status === "blocked" ? "#DC2626" : "#D97706",
                        }}>{check.status === "blocked" ? "✕" : "!"}</div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}>{check.message_zh}</div>
                          <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}>📖 {check.rule_reference}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {compliance?.ai_analysis_zh && (
                  <div style={{ padding: "8px 14px", borderTop: "1px solid #E5E7EB", background: "#F8FAFC", fontSize: 12, color: "#374151" }}>
                    🤖 {compliance.ai_analysis_zh}
                  </div>
                )}
              </div>
            )}

            {/* ═══ SUBMIT / CANCEL ═══ */}
            <div style={{ padding: "12px 20px 16px", display: "flex", gap: 10 }}>
              <button onClick={handleSubmit}
                disabled={submitting || checkingCompliance || compliance?.status === "blocked"}
                style={{
                  flex: 1, padding: "12px", borderRadius: 10, border: "none",
                  background: compliance?.status === "blocked" ? "#D1D5DB" : meta.color,
                  color: "white", fontSize: 15, fontWeight: 700,
                  cursor: compliance?.status === "blocked" ? "not-allowed" : "pointer",
                  opacity: submitting || checkingCompliance ? 0.6 : 1, transition: "all 0.2s",
                }}>
                {checkingCompliance ? "⏳ 檢查中..." : submitting ? "送出中..." : compliance?.status === "blocked" ? "🚫 無法送出" : "確認送出 →"}
              </button>
              <button onClick={() => { setFormData(null); setParsedType(null); setCompliance(null); setShowEditMode(false); }}
                style={{ padding: "12px 20px", borderRadius: 10, border: "1px solid #E5E7EB", background: "white", fontSize: 14, cursor: "pointer", color: "#6B7280" }}>
                取消
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ═══ SUBMISSIONS LIST ═══ */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: 0 }}>📜 申請紀錄</h2>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {isAdmin && (
              <>
                <button onClick={() => setViewMode("my")} style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 12, cursor: "pointer", background: viewMode === "my" ? "#7C3AED" : "white", color: viewMode === "my" ? "white" : "#374151" }}>我的</button>
                <button onClick={() => setViewMode("all")} style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 12, cursor: "pointer", background: viewMode === "all" ? "#7C3AED" : "white", color: viewMode === "all" ? "white" : "#374151" }}>全部</button>
              </>
            )}
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 12, outline: "none" }}>
              <option value="">全部</option>
              <option value="pending">⏳ 待審核</option>
              <option value="approved">✅ 已核准</option>
              <option value="rejected">❌ 已駁回</option>
            </select>
          </div>
        </div>

        {/* Batch Actions */}
        {isAdmin && selectedIds.size > 0 && (
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 10, padding: "8px 14px", background: "#EDE9FE", borderRadius: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#5B21B6" }}>已選 {selectedIds.size} 筆</span>
            <input type="text" value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} placeholder="備註 (optional)"
              style={{ flex: 1, minWidth: 120, padding: "4px 8px", border: "1px solid #C4B5FD", borderRadius: 6, fontSize: 11, outline: "none" }} />
            <button onClick={() => handleBatchApproval("approved")} style={{ padding: "4px 12px", borderRadius: 6, border: "none", background: "#059669", color: "white", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>✅ 批次核准</button>
            <button onClick={() => handleBatchApproval("rejected")} style={{ padding: "4px 12px", borderRadius: 6, border: "none", background: "#DC2626", color: "white", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>❌ 批次駁回</button>
            <button onClick={() => setSelectedIds(new Set())} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #D1D5DB", background: "white", fontSize: 11, cursor: "pointer" }}>取消</button>
          </div>
        )}

        {isAdmin && viewMode === "all" && submissions.some(s => s.status === "pending") && selectedIds.size === 0 && (
          <button onClick={selectAllPending} style={{ fontSize: 11, color: "#7C3AED", background: "none", border: "none", cursor: "pointer", marginBottom: 6, textDecoration: "underline" }}>
            全選待審核 ({submissions.filter(s => s.status === "pending").length})
          </button>
        )}

        {loading && <div style={{ padding: 40, textAlign: "center", color: "#9CA3AF" }}>載入中...</div>}

        {!loading && submissions.length === 0 && (
          <div style={{ padding: 50, textAlign: "center", background: "white", borderRadius: 12, border: "1px solid #E5E7EB" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>💬</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#374151" }}>還沒有申請紀錄</div>
            <div style={{ fontSize: 13, color: "#9CA3AF" }}>在上方輸入框用一句話開始申請吧！</div>
          </div>
        )}

        <div style={{ display: "grid", gap: 10 }}>
          {submissions.map(s => {
            const ft = formMeta[s.form_type];
            const st = statusConfig[s.status] || statusConfig.pending;
            const isSelected = selectedIds.has(s.id);
            return (
              <div key={s.id} style={{
                background: isSelected ? "#F5F3FF" : "white", borderRadius: 12,
                border: isSelected ? "2px solid #7C3AED" : "1px solid #E5E7EB",
                padding: 16, borderLeft: `4px solid ${ft?.color || "#6B7280"}`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {isAdmin && s.status === "pending" && (
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(s.id)} style={{ width: 16, height: 16, cursor: "pointer", accentColor: "#7C3AED" }} />
                    )}
                    <span style={{ fontSize: 20 }}>{ft?.icon}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>{ft?.name_zh || s.form_type}</div>
                      <div style={{ fontSize: 11, color: "#9CA3AF" }}>
                        {s.submitter_name || s.submitted_by.slice(0, 12)} · {formatDate(s.created_at)}
                        {s.ai_parsed && <span style={{ marginLeft: 4, padding: "1px 5px", background: "#EDE9FE", color: "#7C3AED", borderRadius: 4, fontSize: 9, fontWeight: 600 }}>AI</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: st.bg, color: st.color }}>{st.label}</span>
                    <button onClick={() => exportPdf(s)} title="PDF" style={{ padding: "3px 6px", borderRadius: 5, border: "1px solid #E5E7EB", background: "white", fontSize: 12, cursor: "pointer" }}>📥</button>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 5, marginBottom: 10 }}>
                  {Object.entries(s.form_data).map(([key, value]) => (
                    <div key={key} style={{ padding: "5px 8px", background: "#F9FAFB", borderRadius: 6 }}>
                      <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 600 }}>{fieldLabels[key] || key}</div>
                      <div style={{ fontSize: 13, color: "#111827", fontWeight: 500 }}>{value || "—"}</div>
                    </div>
                  ))}
                </div>

                {s.original_text && (
                  <div style={{ fontSize: 11, color: "#6B7280", padding: "5px 8px", background: "#F5F3FF", borderRadius: 6, marginBottom: 8 }}>
                    💬 {s.original_text}
                  </div>
                )}

                {s.reviewed_at && (
                  <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 8 }}>
                    審核: {s.reviewer_name || s.reviewed_by} · {formatDate(s.reviewed_at)}{s.review_note && ` · ${s.review_note}`}
                  </div>
                )}

                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {s.status === "pending" && (
                    <button onClick={() => handleCancel(s.id)} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #D1D5DB", background: "white", color: "#6B7280", fontSize: 11, cursor: "pointer" }}>🚫 取消</button>
                  )}
                  {isAdmin && s.status === "pending" && (
                    reviewingId === s.id ? (
                      <div style={{ display: "flex", gap: 4, alignItems: "center", flex: 1 }}>
                        <input type="text" value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} placeholder="備註"
                          style={{ flex: 1, padding: "4px 8px", border: "1px solid #D1D5DB", borderRadius: 6, fontSize: 11, outline: "none" }} />
                        <button onClick={() => handleReview(s.id, "approved")} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: "#059669", color: "white", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>✅</button>
                        <button onClick={() => handleReview(s.id, "rejected")} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: "#DC2626", color: "white", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>❌</button>
                        <button onClick={() => setReviewingId(null)} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #D1D5DB", background: "white", fontSize: 11, cursor: "pointer" }}>取消</button>
                      </div>
                    ) : (
                      <button onClick={() => setReviewingId(s.id)} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #7C3AED", background: "#EDE9FE", color: "#7C3AED", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>📋 審核</button>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}