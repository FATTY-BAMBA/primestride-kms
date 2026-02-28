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

  const fetchSubmissions = async () => {
    try {
      let url = `/api/workflows?view=${viewMode}`;
      if (statusFilter) url += `&status=${statusFilter}`;
      const res = await fetch(url);
      const data = await res.json();
      setSubmissions(data.submissions || []);
      setIsAdmin(data.isAdmin || false);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchSubmissions(); }, [viewMode, statusFilter]);

  const handleNlpParse = async () => {
    if (!nlpInput.trim() || !activeForm) return;
    setParsing(true);
    setFormData(null);
    try {
      const res = await fetch("/api/workflows/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: nlpInput, form_type: activeForm }),
      });
      const data = await res.json();
      if (data.form_data) {
        setFormData(data.form_data);
      }
    } catch {} finally { setParsing(false); }
  };

  const handleSubmit = async () => {
    if (!formData || !activeForm) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          form_type: activeForm,
          form_data: formData,
          original_text: nlpInput || null,
          ai_parsed: !!nlpInput,
        }),
      });
      if (res.ok) {
        setMessage("✅ 申請已送出 Submitted successfully!");
        setActiveForm(null);
        setFormData(null);
        setNlpInput("");
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
      if (res.ok) {
        setReviewingId(null);
        setReviewNote("");
        fetchSubmissions();
      }
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

  const formatDate = (d: string) => new Date(d).toLocaleDateString("zh-TW", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  const getFormType = (id: string) => formTypes.find(f => f.id === id);

  const renderFormValue = (key: string, value: any) => {
    if (!value) return <span style={{ color: "#D1D5DB" }}>—</span>;
    return <span>{String(value)}</span>;
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 20px", paddingBottom: 60 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111827", marginBottom: 4 }}>📋 表單申請 Workflow Forms</h1>
        <p style={{ fontSize: 14, color: "#6B7280" }}>
          用自然語言快速填寫表單 | Fill forms with natural language
        </p>
      </div>

      {message && (
        <div style={{ padding: 14, background: "#D1FAE5", borderRadius: 10, marginBottom: 20, color: "#065F46", fontWeight: 600, fontSize: 14 }}>
          {message}
        </div>
      )}

      {/* Form Type Selector */}
      {!activeForm && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14, marginBottom: 32 }}>
          {formTypes.map(f => (
            <button key={f.id} onClick={() => { setActiveForm(f.id); setFormData(null); setNlpInput(""); }}
              style={{
                padding: 24, borderRadius: 14, border: "1px solid #E5E7EB",
                background: "white", cursor: "pointer", textAlign: "left",
                transition: "all 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              }}
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
              style={{ background: "none", border: "none", fontSize: 14, cursor: "pointer", color: "#6B7280" }}>
              ← 返回 Back
            </button>
            <div style={{ fontSize: 28 }}>{getFormType(activeForm)?.icon}</div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>{getFormType(activeForm)?.name_zh}</div>
              <div style={{ fontSize: 13, color: "#6B7280" }}>{getFormType(activeForm)?.name_en}</div>
            </div>
          </div>

          {/* NLP Input */}
          <div style={{
            background: "white", borderRadius: 14, border: "1px solid #E5E7EB",
            overflow: "hidden", marginBottom: 20,
          }}>
            <div style={{
              padding: "12px 18px",
              background: `linear-gradient(135deg, ${getFormType(activeForm)?.color}10, ${getFormType(activeForm)?.color}05)`,
              borderBottom: "1px solid #E5E7EB",
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: getFormType(activeForm)?.color }}>
                🤖 AI 智慧填寫 — 用自然語言描述您的需求
              </div>
              <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
                Describe your request in natural language — AI will fill the form for you
              </div>
            </div>
            <div style={{ padding: 18, display: "flex", gap: 10 }}>
              <textarea
                value={nlpInput}
                onChange={(e) => setNlpInput(e.target.value)}
                placeholder={getFormType(activeForm)?.placeholder}
                rows={2}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleNlpParse(); } }}
                style={{
                  flex: 1, padding: "12px 14px", border: "1px solid #D1D5DB",
                  borderRadius: 10, fontSize: 15, outline: "none", resize: "none",
                  lineHeight: 1.5,
                }}
              />
              <button onClick={handleNlpParse} disabled={parsing || !nlpInput.trim()}
                style={{
                  padding: "12px 20px", borderRadius: 10, border: "none",
                  background: getFormType(activeForm)?.color, color: "white",
                  fontSize: 14, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
                  opacity: parsing || !nlpInput.trim() ? 0.6 : 1,
                  alignSelf: "flex-end",
                }}>
                {parsing ? "解析中..." : "🤖 AI 填寫"}
              </button>
            </div>
          </div>

          {/* Parsed Form Preview / Manual Edit */}
          {formData && (
            <div style={{
              background: "white", borderRadius: 14, border: `2px solid ${getFormType(activeForm)?.color}30`,
              padding: 24,
            }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 16 }}>
                📋 表單預覽 — 請確認後送出 | Review & Submit
              </div>

              <div style={{ display: "grid", gap: 16 }}>
                {Object.entries(formData).map(([key, value]) => (
                  <div key={key}>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                      {key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                    </label>
                    {typeof value === "string" && value.length > 50 ? (
                      <textarea
                        value={String(value || "")}
                        onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                        rows={2}
                        style={{ width: "100%", padding: "10px 14px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 14, outline: "none", resize: "vertical", boxSizing: "border-box" }}
                      />
                    ) : (
                      <input
                        type={key.includes("date") ? "date" : key.includes("time") ? "time" : key === "hours" || key === "days" ? "number" : "text"}
                        value={String(value || "")}
                        onChange={(e) => setFormData({ ...formData, [key]: key === "hours" || key === "days" ? parseFloat(e.target.value) : e.target.value })}
                        style={{ width: "100%", padding: "10px 14px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" }}
                      />
                    )}
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button onClick={handleSubmit} disabled={submitting}
                  style={{
                    padding: "12px 28px", borderRadius: 10, border: "none",
                    background: getFormType(activeForm)?.color, color: "white",
                    fontSize: 15, fontWeight: 700, cursor: "pointer",
                    opacity: submitting ? 0.6 : 1,
                  }}>
                  {submitting ? "送出中..." : "📤 確認送出 Submit"}
                </button>
                <button onClick={() => setFormData(null)}
                  style={{ padding: "12px 20px", borderRadius: 10, border: "1px solid #D1D5DB", background: "white", fontSize: 14, cursor: "pointer", color: "#6B7280" }}>
                  取消 Cancel
                </button>
              </div>
            </div>
          )}

          {/* Or fill manually */}
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
          <div style={{ display: "flex", gap: 8 }}>
            {isAdmin && (
              <>
                <button onClick={() => setViewMode("my")} style={{
                  padding: "6px 14px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13, cursor: "pointer",
                  background: viewMode === "my" ? "#7C3AED" : "white", color: viewMode === "my" ? "white" : "#374151",
                }}>我的 Mine</button>
                <button onClick={() => setViewMode("all")} style={{
                  padding: "6px 14px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13, cursor: "pointer",
                  background: viewMode === "all" ? "#7C3AED" : "white", color: viewMode === "all" ? "white" : "#374151",
                }}>全部 All</button>
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
            return (
              <div key={s.id} style={{
                background: "white", borderRadius: 12, border: "1px solid #E5E7EB",
                padding: 20, borderLeft: `4px solid ${ft?.color || "#6B7280"}`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 24 }}>{ft?.icon}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>{ft?.name_zh || s.form_type}</div>
                      <div style={{ fontSize: 12, color: "#9CA3AF" }}>
                        {s.submitter_name || s.submitted_by.slice(0, 12)} • {formatDate(s.created_at)}
                        {s.ai_parsed && <span style={{ marginLeft: 6, padding: "1px 6px", background: "#EDE9FE", color: "#7C3AED", borderRadius: 4, fontSize: 10, fontWeight: 600 }}>🤖 AI</span>}
                      </div>
                    </div>
                  </div>
                  <span style={{
                    padding: "4px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                    background: st.bg, color: st.color,
                  }}>{st.label}</span>
                </div>

                {/* Form Data Preview */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8, marginBottom: 12 }}>
                  {Object.entries(s.form_data).map(([key, value]) => (
                    <div key={key} style={{ padding: "6px 10px", background: "#F9FAFB", borderRadius: 6 }}>
                      <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>{key.replace(/_/g, " ")}</div>
                      <div style={{ fontSize: 13, color: "#111827", fontWeight: 500 }}>{renderFormValue(key, value)}</div>
                    </div>
                  ))}
                </div>

                {/* Original NLP text */}
                {s.original_text && (
                  <div style={{ fontSize: 12, color: "#6B7280", padding: "6px 10px", background: "#F5F3FF", borderRadius: 6, marginBottom: 10 }}>
                    💬 原始輸入: {s.original_text}
                  </div>
                )}

                {/* Review info */}
                {s.reviewed_at && (
                  <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 10 }}>
                    審核: {s.reviewer_name || s.reviewed_by} • {formatDate(s.reviewed_at)}
                    {s.review_note && <span> • 備註: {s.review_note}</span>}
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {/* User can cancel pending */}
                  {s.status === "pending" && s.submitted_by === (typeof window !== "undefined" ? "" : "") && (
                    <button onClick={() => handleCancel(s.id)}
                      style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #FCA5A5", background: "#FEE2E2", color: "#DC2626", fontSize: 12, cursor: "pointer" }}>
                      取消申請
                    </button>
                  )}
                  {s.status === "pending" && (
                    <button onClick={() => handleCancel(s.id)}
                      style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #D1D5DB", background: "white", color: "#6B7280", fontSize: 12, cursor: "pointer" }}>
                      🚫 取消 Cancel
                    </button>
                  )}

                  {/* Admin approve/reject */}
                  {isAdmin && s.status === "pending" && (
                    <>
                      {reviewingId === s.id ? (
                        <div style={{ display: "flex", gap: 6, alignItems: "center", flex: 1 }}>
                          <input type="text" value={reviewNote} onChange={(e) => setReviewNote(e.target.value)}
                            placeholder="審核備註 Review note (optional)"
                            style={{ flex: 1, padding: "5px 10px", border: "1px solid #D1D5DB", borderRadius: 6, fontSize: 12, outline: "none" }}
                          />
                          <button onClick={() => handleReview(s.id, "approved")}
                            style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: "#059669", color: "white", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                            ✅ 核准
                          </button>
                          <button onClick={() => handleReview(s.id, "rejected")}
                            style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: "#DC2626", color: "white", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                            ❌ 駁回
                          </button>
                          <button onClick={() => setReviewingId(null)}
                            style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #D1D5DB", background: "white", fontSize: 12, cursor: "pointer" }}>
                            取消
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setReviewingId(s.id)}
                          style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #7C3AED", background: "#EDE9FE", color: "#7C3AED", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                          📋 審核 Review
                        </button>
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
