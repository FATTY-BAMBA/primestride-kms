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
}

interface Stats {
  pending: number;
  approved_this_month: number;
  rejected_this_month: number;
  total_this_month: number;
}

const formTypes = [
  { id: "leave", icon: "📝", name_zh: "請假申請單", name_en: "Leave Request", color: "#7C3AED",
    placeholder: "例如：我下週一到週三要請特休，因為要回南部探親",
    placeholderEn: "e.g., I need annual leave from Monday to Wednesday next week for a family visit" },
  { id: "overtime", icon: "🕐", name_zh: "加班申請單", name_en: "Overtime Request", color: "#2563EB",
    placeholder: "例如：今天晚上要加班到九點，處理客戶報告",
    placeholderEn: "e.g., Working overtime tonight until 9pm to finish the client report" },
  { id: "business_trip", icon: "✈️", name_zh: "出差申請單", name_en: "Business Trip Request", color: "#059669",
    placeholder: "例如：下週需要出差到高雄兩天，拜訪客戶",
    placeholderEn: "e.g., Business trip to Kaohsiung for 2 days next week to visit a client" },
];

const fieldLabels: Record<string, string> = {
  leave_type: "假別 Leave Type", start_date: "開始日期 Start Date", end_date: "結束日期 End Date",
  days: "天數 Days", reason: "事由 Reason", proxy: "職務代理人 Proxy",
  date: "日期 Date", start_time: "開始時間 Start Time", end_time: "結束時間 End Time",
  hours: "時數 Hours", overtime_type: "加班類別 Type", project: "專案名稱 Project",
  destination: "出差地點 Destination", purpose: "出差目的 Purpose",
  transport: "交通方式 Transport", budget: "預估費用 Budget", accommodation: "住宿安排 Accommodation",
};

const getFieldLabel = (key: string) => fieldLabels[key] || key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "⏳ 待審核 Pending", color: "#D97706", bg: "#FEF3C7" },
  approved: { label: "✅ 已核准 Approved", color: "#059669", bg: "#D1FAE5" },
  rejected: { label: "❌ 已駁回 Rejected", color: "#DC2626", bg: "#FEE2E2" },
  cancelled: { label: "🚫 已取消 Cancelled", color: "#6B7280", bg: "#F3F4F6" },
};

export default function WorkflowsPage() {
  const [activeForm, setActiveForm] = useState<string | null>(null);
  const [nlpInput, setNlpInput] = useState("");
  const [parsing, setParsing] = useState(false);
  const [formData, setFormData] = useState<Record<string, any> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [viewMode, setViewMode] = useState<"my" | "all">("my");
  const [statusFilter, setStatusFilter] = useState("");
  const [message, setMessage] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({ pending: 0, approved_this_month: 0, rejected_this_month: 0, total_this_month: 0 });
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalance | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  const handleNlpParse = async () => {
    if (!nlpInput.trim() || !activeForm) return;
    setParsing(true); setFormData(null);
    try {
      const res = await fetch("/api/workflows/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: nlpInput, form_type: activeForm }),
      });
      const data = await res.json();
      if (data.form_data) setFormData(data.form_data);
    } catch {} finally { setParsing(false); }
  };

  const handleSubmit = async () => {
    if (!formData || !activeForm) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form_type: activeForm, form_data: formData, original_text: nlpInput || null, ai_parsed: !!nlpInput }),
      });
      if (res.ok) {
        setMessage("✅ 申請已送出 Submitted successfully!");
        setActiveForm(null); setFormData(null); setNlpInput("");
        fetchSubmissions();
        setTimeout(() => setMessage(""), 3000);
      }
    } catch {} finally { setSubmitting(false); }
  };

  const handleReview = async (id: string, action: string) => {
    try {
      const res = await fetch("/api/workflows", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, review_note: reviewNote }),
      });
      if (res.ok) { setReviewingId(null); setReviewNote(""); fetchSubmissions(); }
    } catch {}
  };

  const handleBatchApproval = async (action: string) => {
    if (selectedIds.size === 0) return;
    if (!confirm(`確定要${action === "approved" ? "核准" : "駁回"} ${selectedIds.size} 筆申請？`)) return;
    try {
      await fetch("/api/workflows", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), action, review_note: reviewNote }),
      });
      setSelectedIds(new Set()); setReviewNote("");
      fetchSubmissions();
      setMessage(`✅ 已批次${action === "approved" ? "核准" : "駁回"} ${selectedIds.size} 筆申請`);
      setTimeout(() => setMessage(""), 3000);
    } catch {}
  };

  const handleCancel = async (id: string) => {
    if (!confirm("確定要取消此申請？ Cancel this request?")) return;
    try {
      await fetch("/api/workflows", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "cancel" }),
      });
      fetchSubmissions();
    } catch {}
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  };

  const selectAllPending = () => {
    const pendingIds = submissions.filter(s => s.status === "pending").map(s => s.id);
    setSelectedIds(new Set(pendingIds));
  };

  const exportPdf = (s: Submission) => {
    const ft = getFormType(s.form_type);
    const st = statusConfig[s.status];
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${ft?.name_zh || s.form_type}</title>
<style>
@page{margin:1in;size:A4}
@media print{.no-print{display:none}}
body{font-family:'Microsoft JhengHei','Segoe UI',sans-serif;max-width:700px;margin:0 auto;padding:40px 20px;color:#1a1a1a;line-height:1.8}
h1{font-size:24px;border-bottom:2px solid ${ft?.color || "#7C3AED"};padding-bottom:10px;color:${ft?.color || "#7C3AED"}}
.meta{color:#6B7280;font-size:13px;margin-bottom:20px}
table{width:100%;border-collapse:collapse;margin-bottom:20px}
th,td{padding:10px 14px;text-align:left;border:1px solid #E5E7EB}
th{background:#F9FAFB;font-size:13px;color:#6B7280;width:30%}
td{font-size:14px;color:#111827}
.status{display:inline-block;padding:4px 14px;border-radius:6px;font-size:13px;font-weight:700;background:${st?.bg};color:${st?.color}}
.footer{margin-top:40px;padding-top:12px;border-top:1px solid #E5E7EB;color:#9CA3AF;font-size:11px}
.print-btn{position:fixed;top:20px;right:20px;padding:12px 24px;background:${ft?.color || "#7C3AED"};color:white;border:none;border-radius:8px;font-size:15px;font-weight:700;cursor:pointer}
</style></head><body>
<button class="print-btn no-print" onclick="window.print()">📥 儲存 PDF</button>
<h1>${ft?.icon} ${ft?.name_zh} ${ft?.name_en}</h1>
<div class="meta">
  <span>申請人: ${s.submitter_name || s.submitted_by}</span> &bull;
  <span>日期: ${new Date(s.created_at).toLocaleDateString("zh-TW")}</span> &bull;
  <span class="status">${st?.label}</span>
</div>
<table>${Object.entries(s.form_data).map(([k, v]) => `<tr><th>${getFieldLabel(k)}</th><td>${v || "—"}</td></tr>`).join("")}</table>
${s.original_text ? `<p style="color:#6B7280;font-size:13px">💬 原始輸入: ${s.original_text}</p>` : ""}
${s.reviewed_at ? `<p style="color:#6B7280;font-size:13px">審核: ${s.reviewer_name || s.reviewed_by} • ${new Date(s.reviewed_at).toLocaleDateString("zh-TW")}${s.review_note ? ` • 備註: ${s.review_note}` : ""}</p>` : ""}
<div class="footer">PrimeStride Atlas &bull; ${new Date().toLocaleDateString("zh-TW")}</div>
<script class="no-print">window.onload=function(){setTimeout(function(){window.print()},500)}</script>
</body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString("zh-TW", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const getFormType = (id: string) => formTypes.find(f => f.id === id);

  const BalanceBar = ({ label, used, total, color }: { label: string; used: number; total: number; color: string }) => {
    const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
    return (
      <div style={{ flex: "1 1 140px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
          <span style={{ fontWeight: 600, color: "#374151" }}>{label}</span>
          <span style={{ color: "#6B7280" }}>{used}/{total} 天</span>
        </div>
        <div style={{ height: 8, background: "#F3F4F6", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: pct > 80 ? "#DC2626" : color, borderRadius: 4, transition: "width 0.3s" }} />
        </div>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "40px 20px", paddingBottom: 60 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111827", marginBottom: 4 }}>📋 表單申請 Workflow Forms</h1>
        <p style={{ fontSize: 14, color: "#6B7280" }}>用自然語言快速填寫表單 | Fill forms with natural language</p>
      </div>

      {message && (
        <div style={{ padding: 14, background: "#D1FAE5", borderRadius: 10, marginBottom: 16, color: "#065F46", fontWeight: 600, fontSize: 14 }}>{message}</div>
      )}

      {/* Dashboard Stats */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 140px", padding: "16px 20px", background: "white", borderRadius: 12, border: "1px solid #E5E7EB" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#D97706" }}>{stats.pending}</div>
          <div style={{ fontSize: 12, color: "#6B7280" }}>⏳ 待審核 Pending</div>
        </div>
        <div style={{ flex: "1 1 140px", padding: "16px 20px", background: "white", borderRadius: 12, border: "1px solid #E5E7EB" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#059669" }}>{stats.approved_this_month}</div>
          <div style={{ fontSize: 12, color: "#6B7280" }}>✅ 本月核准 Approved</div>
        </div>
        <div style={{ flex: "1 1 140px", padding: "16px 20px", background: "white", borderRadius: 12, border: "1px solid #E5E7EB" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#DC2626" }}>{stats.rejected_this_month}</div>
          <div style={{ fontSize: 12, color: "#6B7280" }}>❌ 本月駁回 Rejected</div>
        </div>
        <div style={{ flex: "1 1 140px", padding: "16px 20px", background: "white", borderRadius: 12, border: "1px solid #E5E7EB" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#4B5563" }}>{stats.total_this_month}</div>
          <div style={{ fontSize: 12, color: "#6B7280" }}>📊 本月總計 Total</div>
        </div>
      </div>

      {/* Leave Balance */}
      {leaveBalance && (
        <div style={{ padding: 20, background: "white", borderRadius: 12, border: "1px solid #E5E7EB", marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 14 }}>🏖️ 假期餘額 Leave Balance ({new Date().getFullYear()})</div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            <BalanceBar label="特休 Annual" used={leaveBalance.annual_used} total={leaveBalance.annual_total} color="#7C3AED" />
            <BalanceBar label="病假 Sick" used={leaveBalance.sick_used} total={leaveBalance.sick_total} color="#2563EB" />
            <BalanceBar label="事假 Personal" used={leaveBalance.personal_used} total={leaveBalance.personal_total} color="#D97706" />
          </div>
        </div>
      )}

      {/* Form Type Selector */}
      {!activeForm && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14, marginBottom: 32 }}>
          {formTypes.map(f => (
            <button key={f.id} onClick={() => { setActiveForm(f.id); setFormData(null); setNlpInput(""); }}
              style={{ padding: 24, borderRadius: 14, border: "1px solid #E5E7EB", background: "white", cursor: "pointer", textAlign: "left", transition: "all 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = f.color; e.currentTarget.style.boxShadow = `0 4px 12px ${f.color}20`; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)"; }}
            >
              <div style={{ fontSize: 36, marginBottom: 12 }}>{f.icon}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#111827", marginBottom: 4 }}>{f.name_zh}</div>
              <div style={{ fontSize: 13, color: "#6B7280" }}>{f.name_en}</div>
            </button>
          ))}
        </div>
      )}

      {/* Active Form — NLP Input + Preview */}
      {activeForm && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <button onClick={() => { setActiveForm(null); setFormData(null); setNlpInput(""); }}
              style={{ background: "none", border: "none", fontSize: 14, cursor: "pointer", color: "#6B7280" }}>← 返回 Back</button>
            <div style={{ fontSize: 28 }}>{getFormType(activeForm)?.icon}</div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>{getFormType(activeForm)?.name_zh}</div>
              <div style={{ fontSize: 13, color: "#6B7280" }}>{getFormType(activeForm)?.name_en}</div>
            </div>
          </div>

          {/* NLP Input */}
          <div style={{ background: "white", borderRadius: 14, border: "1px solid #E5E7EB", overflow: "hidden", marginBottom: 20 }}>
            <div style={{ padding: "12px 18px", background: `linear-gradient(135deg, ${getFormType(activeForm)?.color}10, ${getFormType(activeForm)?.color}05)`, borderBottom: "1px solid #E5E7EB" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: getFormType(activeForm)?.color }}>🤖 AI 智慧填寫 — 用自然語言描述您的需求</div>
              <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>Describe your request in natural language — AI will fill the form</div>
            </div>
            <div style={{ padding: 18, display: "flex", gap: 10 }}>
              <textarea value={nlpInput} onChange={(e) => setNlpInput(e.target.value)} placeholder={getFormType(activeForm)?.placeholder} rows={2}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleNlpParse(); } }}
                style={{ flex: 1, padding: "12px 14px", border: "1px solid #D1D5DB", borderRadius: 10, fontSize: 15, outline: "none", resize: "none", lineHeight: 1.5 }}
              />
              <button onClick={handleNlpParse} disabled={parsing || !nlpInput.trim()}
                style={{ padding: "12px 20px", borderRadius: 10, border: "none", background: getFormType(activeForm)?.color, color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", opacity: parsing || !nlpInput.trim() ? 0.6 : 1, alignSelf: "flex-end" }}>
                {parsing ? "解析中..." : "🤖 AI 填寫"}
              </button>
            </div>
          </div>

          {/* Parsed Form Preview */}
          {formData && (
            <div style={{ background: "white", borderRadius: 14, border: `2px solid ${getFormType(activeForm)?.color}30`, padding: 24 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 16 }}>📋 表單預覽 — 請確認後送出 | Review & Submit</div>
              <div style={{ display: "grid", gap: 16 }}>
                {Object.entries(formData).map(([key, value]) => (
                  <div key={key}>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4 }}>{getFieldLabel(key)}</label>
                    {typeof value === "string" && value.length > 50 ? (
                      <textarea value={String(value || "")} onChange={(e) => setFormData({ ...formData, [key]: e.target.value })} rows={2}
                        style={{ width: "100%", padding: "10px 14px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 14, outline: "none", resize: "vertical", boxSizing: "border-box" }} />
                    ) : (
                      <input type={key.includes("date") ? "date" : key.includes("time") ? "time" : key === "hours" || key === "days" ? "number" : "text"}
                        value={String(value || "")} onChange={(e) => setFormData({ ...formData, [key]: key === "hours" || key === "days" ? parseFloat(e.target.value) : e.target.value })}
                        style={{ width: "100%", padding: "10px 14px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                    )}
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button onClick={handleSubmit} disabled={submitting}
                  style={{ padding: "12px 28px", borderRadius: 10, border: "none", background: getFormType(activeForm)?.color, color: "white", fontSize: 15, fontWeight: 700, cursor: "pointer", opacity: submitting ? 0.6 : 1 }}>
                  {submitting ? "送出中..." : "📤 確認送出 Submit"}
                </button>
                <button onClick={() => setFormData(null)} style={{ padding: "12px 20px", borderRadius: 10, border: "1px solid #D1D5DB", background: "white", fontSize: 14, cursor: "pointer", color: "#6B7280" }}>取消 Cancel</button>
              </div>
            </div>
          )}

          {!formData && !parsing && (
            <button onClick={() => setFormData(getDefaultFormData(activeForm))}
              style={{ fontSize: 13, color: "#6B7280", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
              或手動填寫表單 Or fill form manually
            </button>
          )}
        </div>
      )}

      {/* Submissions List */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: 0 }}>📜 申請紀錄 Submissions</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {isAdmin && (
              <>
                <button onClick={() => setViewMode("my")} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13, cursor: "pointer", background: viewMode === "my" ? "#7C3AED" : "white", color: viewMode === "my" ? "white" : "#374151" }}>我的 Mine</button>
                <button onClick={() => setViewMode("all")} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13, cursor: "pointer", background: viewMode === "all" ? "#7C3AED" : "white", color: viewMode === "all" ? "white" : "#374151" }}>全部 All</button>
              </>
            )}
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13, outline: "none" }}>
              <option value="">全部狀態 All</option>
              <option value="pending">⏳ 待審核</option>
              <option value="approved">✅ 已核准</option>
              <option value="rejected">❌ 已駁回</option>
              <option value="cancelled">🚫 已取消</option>
            </select>
          </div>
        </div>

        {/* Batch Actions */}
        {isAdmin && selectedIds.size > 0 && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, padding: "10px 16px", background: "#EDE9FE", borderRadius: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#5B21B6" }}>已選 {selectedIds.size} 筆 | {selectedIds.size} selected</span>
            <input type="text" value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} placeholder="批次備註 Batch note (optional)"
              style={{ flex: 1, minWidth: 150, padding: "5px 10px", border: "1px solid #C4B5FD", borderRadius: 6, fontSize: 12, outline: "none" }} />
            <button onClick={() => handleBatchApproval("approved")} style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "#059669", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>✅ 批次核准</button>
            <button onClick={() => handleBatchApproval("rejected")} style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "#DC2626", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>❌ 批次駁回</button>
            <button onClick={() => setSelectedIds(new Set())} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #D1D5DB", background: "white", fontSize: 12, cursor: "pointer" }}>取消</button>
          </div>
        )}

        {/* Select All for admin */}
        {isAdmin && viewMode === "all" && submissions.some(s => s.status === "pending") && selectedIds.size === 0 && (
          <button onClick={selectAllPending} style={{ fontSize: 12, color: "#7C3AED", background: "none", border: "none", cursor: "pointer", marginBottom: 8, textDecoration: "underline" }}>
            全選待審核 Select all pending ({submissions.filter(s => s.status === "pending").length})
          </button>
        )}

        {loading && <div style={{ padding: 40, textAlign: "center", color: "#9CA3AF" }}>載入中...</div>}

        {!loading && submissions.length === 0 && (
          <div style={{ padding: 60, textAlign: "center", background: "white", borderRadius: 12, border: "1px solid #E5E7EB" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#374151" }}>尚無申請紀錄</div>
            <div style={{ fontSize: 14, color: "#9CA3AF" }}>No submissions yet. Create one above!</div>
          </div>
        )}

        <div style={{ display: "grid", gap: 12 }}>
          {submissions.map(s => {
            const ft = getFormType(s.form_type);
            const st = statusConfig[s.status] || statusConfig.pending;
            const isSelected = selectedIds.has(s.id);
            return (
              <div key={s.id} style={{
                background: isSelected ? "#F5F3FF" : "white", borderRadius: 12,
                border: isSelected ? "2px solid #7C3AED" : "1px solid #E5E7EB",
                padding: 20, borderLeft: `4px solid ${ft?.color || "#6B7280"}`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {isAdmin && s.status === "pending" && (
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(s.id)}
                        style={{ width: 18, height: 18, cursor: "pointer", accentColor: "#7C3AED" }} />
                    )}
                    <span style={{ fontSize: 24 }}>{ft?.icon}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>{ft?.name_zh || s.form_type}</div>
                      <div style={{ fontSize: 12, color: "#9CA3AF" }}>
                        {s.submitter_name || s.submitted_by.slice(0, 12)} • {formatDate(s.created_at)}
                        {s.ai_parsed && <span style={{ marginLeft: 6, padding: "1px 6px", background: "#EDE9FE", color: "#7C3AED", borderRadius: 4, fontSize: 10, fontWeight: 600 }}>🤖 AI</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ padding: "4px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: st.bg, color: st.color }}>{st.label}</span>
                    <button onClick={() => exportPdf(s)} title="匯出 PDF"
                      style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #E5E7EB", background: "white", fontSize: 14, cursor: "pointer" }}>📥</button>
                  </div>
                </div>

                {/* Form Data */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8, marginBottom: 12 }}>
                  {Object.entries(s.form_data).map(([key, value]) => (
                    <div key={key} style={{ padding: "6px 10px", background: "#F9FAFB", borderRadius: 6 }}>
                      <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>{getFieldLabel(key)}</div>
                      <div style={{ fontSize: 13, color: "#111827", fontWeight: 500 }}>{value || "—"}</div>
                    </div>
                  ))}
                </div>

                {s.original_text && (
                  <div style={{ fontSize: 12, color: "#6B7280", padding: "6px 10px", background: "#F5F3FF", borderRadius: 6, marginBottom: 10 }}>
                    💬 原始輸入: {s.original_text}
                  </div>
                )}

                {s.reviewed_at && (
                  <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 10 }}>
                    審核: {s.reviewer_name || s.reviewed_by} • {formatDate(s.reviewed_at)}
                    {s.review_note && <span> • 備註: {s.review_note}</span>}
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {s.status === "pending" && (
                    <button onClick={() => handleCancel(s.id)} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #D1D5DB", background: "white", color: "#6B7280", fontSize: 12, cursor: "pointer" }}>🚫 取消 Cancel</button>
                  )}
                  {isAdmin && s.status === "pending" && (
                    <>
                      {reviewingId === s.id ? (
                        <div style={{ display: "flex", gap: 6, alignItems: "center", flex: 1 }}>
                          <input type="text" value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} placeholder="審核備註 (optional)"
                            style={{ flex: 1, padding: "5px 10px", border: "1px solid #D1D5DB", borderRadius: 6, fontSize: 12, outline: "none" }} />
                          <button onClick={() => handleReview(s.id, "approved")} style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: "#059669", color: "white", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>✅ 核准</button>
                          <button onClick={() => handleReview(s.id, "rejected")} style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: "#DC2626", color: "white", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>❌ 駁回</button>
                          <button onClick={() => setReviewingId(null)} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #D1D5DB", background: "white", fontSize: 12, cursor: "pointer" }}>取消</button>
                        </div>
                      ) : (
                        <button onClick={() => setReviewingId(s.id)} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #7C3AED", background: "#EDE9FE", color: "#7C3AED", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>📋 審核 Review</button>
                      )}
                    </>
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

function getDefaultFormData(formType: string): Record<string, any> {
  const today = new Date().toISOString().split("T")[0];
  switch (formType) {
    case "leave": return { leave_type: "事假 Personal", start_date: today, end_date: today, days: 1, reason: "", proxy: "" };
    case "overtime": return { date: today, start_time: "18:00", end_time: "21:00", hours: 3, overtime_type: "平日加班 Weekday", reason: "", project: "" };
    case "business_trip": return { destination: "", start_date: today, end_date: today, days: 1, purpose: "", transport: "高鐵 HSR", budget: "", accommodation: "" };
    default: return {};
  }
}
