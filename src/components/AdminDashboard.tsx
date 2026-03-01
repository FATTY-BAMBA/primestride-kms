"use client";

import { useState, useEffect } from "react";
import ComplianceConflictScanner from "@/components/ComplianceConflictScanner";

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

interface EmployeeSummary {
  user_id: string;
  name: string;
  email: string;
  total_submissions: number;
  pending: number;
  approved: number;
  rejected: number;
  leave_days_taken: number;
  overtime_hours: number;
  leave_balance: {
    annual_total: number; annual_used: number;
    sick_total: number; sick_used: number;
    personal_total: number; personal_used: number;
    family_care_total: number; family_care_used: number;
    family_care_hours_total: number; family_care_hours_used: number;
  } | null;
}

interface ComplianceSyncStatus {
  last_sync: string | null;
  total_rules: number;
  status: string;
}

const formMeta: Record<string, { icon: string; name_zh: string; color: string }> = {
  leave: { icon: "📝", name_zh: "請假", color: "#7C3AED" },
  overtime: { icon: "🕐", name_zh: "加班", color: "#2563EB" },
  business_trip: { icon: "✈️", name_zh: "出差", color: "#059669" },
};

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "⏳ 待審核", color: "#D97706", bg: "#FEF3C7" },
  approved: { label: "✅ 已核准", color: "#059669", bg: "#D1FAE5" },
  rejected: { label: "❌ 已駁回", color: "#DC2626", bg: "#FEE2E2" },
  cancelled: { label: "🚫 已取消", color: "#6B7280", bg: "#F3F4F6" },
};

const fieldLabels: Record<string, string> = {
  leave_type: "假別", start_date: "開始", end_date: "結束", days: "天數", reason: "事由", proxy: "代理人",
  date: "日期", start_time: "開始", end_time: "結束", hours: "時數", overtime_type: "類別", project: "專案",
  destination: "地點", purpose: "目的", transport: "交通", budget: "預算", accommodation: "住宿",
};

export default function AdminDashboard() {
  const [tab, setTab] = useState<"pending" | "employees" | "compliance">("pending");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [complianceStatus, setComplianceStatus] = useState<ComplianceSyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);
  const [employeeSubmissions, setEmployeeSubmissions] = useState<Submission[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");

  // ── Fetch All Data ──
  const fetchData = async () => {
    setLoading(true);
    try {
      const [subRes, empRes, compRes] = await Promise.all([
        fetch("/api/workflows?view=all&status=pending"),
        fetch("/api/admin/employees"),
        fetch("/api/compliance/sync"),
      ]);
      const subData = await subRes.json();
      setSubmissions(subData.submissions || []);

      if (empRes.ok) {
        const empData = await empRes.json();
        setEmployees(empData.employees || []);
      }

      if (compRes.ok) {
        const compData = await compRes.json();
        setComplianceStatus(compData);
      }
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  // ── Review Actions ──
  const handleReview = async (id: string, action: string) => {
    try {
      await fetch("/api/workflows", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, review_note: reviewNote }),
      });
      setReviewingId(null); setReviewNote("");
      fetchData();
    } catch {}
  };

  const handleBatch = async (action: string) => {
    try {
      await fetch("/api/workflows", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), action, review_note: reviewNote }),
      });
      setSelectedIds(new Set()); setReviewNote("");
      fetchData();
    } catch {}
  };

  // ── Employee Detail ──
  const loadEmployeeDetail = async (userId: string) => {
    if (expandedEmployee === userId) { setExpandedEmployee(null); return; }
    setExpandedEmployee(userId);
    try {
      const res = await fetch(`/api/workflows?view=all&user_id=${userId}`);
      const data = await res.json();
      setEmployeeSubmissions(data.submissions || []);
    } catch { setEmployeeSubmissions([]); }
  };

  // ── Compliance Sync ──
  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/compliance/sync", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setMessage(`✅ 同步完成！處理 ${data.results?.length || 0} 個步驟`);
        setComplianceStatus({ last_sync: data.synced_at, total_rules: complianceStatus?.total_rules || 0, status: "synced" });
      } else {
        setMessage("❌ 同步失敗");
      }
      setTimeout(() => setMessage(""), 4000);
    } catch { setMessage("❌ 同步失敗"); }
    finally { setSyncing(false); }
  };

  const toggleSelect = (id: string) => { const n = new Set(selectedIds); n.has(id) ? n.delete(id) : n.add(id); setSelectedIds(n); };
  const formatDate = (d: string) => new Date(d).toLocaleDateString("zh-TW", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  const pendingCount = submissions.length;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 16px" }}>
      {message && <div style={{ padding: "10px 16px", borderRadius: 10, background: message.includes("✅") ? "#D1FAE5" : "#FEE2E2", color: message.includes("✅") ? "#065F46" : "#991B1B", fontSize: 14, fontWeight: 600, marginBottom: 16 }}>{message}</div>}

      {/* ═══ HEADER ═══ */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0 }}>⚙️ 管理員儀表板</h1>
        <p style={{ fontSize: 13, color: "#6B7280", margin: "4px 0 0" }}>Admin Dashboard — 審核申請、管理員工、合規管理</p>
      </div>

      {/* ═══ TAB BAR ═══ */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "2px solid #E5E7EB", paddingBottom: 0 }}>
        {[
          { key: "pending", label: `📋 待審核 (${pendingCount})`, },
          { key: "employees", label: `👥 員工總覽 (${employees.length})` },
          { key: "compliance", label: "⚖️ 合規管理" },
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            style={{
              padding: "10px 18px", border: "none", background: "none",
              fontSize: 14, fontWeight: 600, cursor: "pointer",
              color: tab === t.key ? "#7C3AED" : "#6B7280",
              borderBottom: tab === t.key ? "2px solid #7C3AED" : "2px solid transparent",
              marginBottom: -2, transition: "all 0.15s",
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading && <div style={{ padding: 60, textAlign: "center", color: "#9CA3AF" }}>載入中...</div>}

      {/* ═══ TAB: PENDING REVIEWS ═══ */}
      {!loading && tab === "pending" && (
        <div>
          {/* Batch Actions */}
          {selectedIds.size > 0 && (
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 14, padding: "10px 16px", background: "#EDE9FE", borderRadius: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#5B21B6" }}>已選 {selectedIds.size} 筆</span>
              <input type="text" value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} placeholder="批次備註"
                style={{ flex: 1, minWidth: 140, padding: "6px 10px", border: "1px solid #C4B5FD", borderRadius: 6, fontSize: 12, outline: "none" }} />
              <button onClick={() => handleBatch("approved")} style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "#059669", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>✅ 批次核准</button>
              <button onClick={() => handleBatch("rejected")} style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "#DC2626", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>❌ 批次駁回</button>
              <button onClick={() => setSelectedIds(new Set())} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #D1D5DB", background: "white", fontSize: 12, cursor: "pointer" }}>取消</button>
            </div>
          )}

          {/* Select All */}
          {submissions.length > 0 && selectedIds.size === 0 && (
            <button onClick={() => setSelectedIds(new Set(submissions.map(s => s.id)))}
              style={{ fontSize: 12, color: "#7C3AED", background: "none", border: "none", cursor: "pointer", marginBottom: 10, textDecoration: "underline" }}>
              全選 ({submissions.length})
            </button>
          )}

          {submissions.length === 0 && (
            <div style={{ padding: 60, textAlign: "center", background: "white", borderRadius: 12, border: "1px solid #E5E7EB" }}>
              <div style={{ fontSize: 48, marginBottom: 10 }}>🎉</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#374151" }}>沒有待審核的申請</div>
              <div style={{ fontSize: 13, color: "#9CA3AF" }}>All caught up!</div>
            </div>
          )}

          <div style={{ display: "grid", gap: 10 }}>
            {submissions.map(s => {
              const ft = formMeta[s.form_type];
              const isSelected = selectedIds.has(s.id);
              return (
                <div key={s.id} style={{
                  background: isSelected ? "#F5F3FF" : "white", borderRadius: 12,
                  border: isSelected ? "2px solid #7C3AED" : "1px solid #E5E7EB",
                  padding: 18, borderLeft: `4px solid ${ft?.color || "#6B7280"}`,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(s.id)}
                        style={{ width: 18, height: 18, cursor: "pointer", accentColor: "#7C3AED" }} />
                      <span style={{ fontSize: 22 }}>{ft?.icon}</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>{ft?.name_zh} — {s.submitter_name || s.submitted_by.slice(0, 16)}</div>
                        <div style={{ fontSize: 11, color: "#9CA3AF" }}>
                          {formatDate(s.created_at)}
                          {s.ai_parsed && <span style={{ marginLeft: 4, padding: "1px 5px", background: "#EDE9FE", color: "#7C3AED", borderRadius: 4, fontSize: 9, fontWeight: 600 }}>AI</span>}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Form Data */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 6, marginBottom: 10 }}>
                    {Object.entries(s.form_data).map(([key, value]) => (
                      <div key={key} style={{ padding: "5px 8px", background: "#F9FAFB", borderRadius: 6 }}>
                        <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 600 }}>{fieldLabels[key] || key}</div>
                        <div style={{ fontSize: 13, color: "#111827", fontWeight: 500 }}>{String(value || "—")}</div>
                      </div>
                    ))}
                  </div>

                  {s.original_text && (
                    <div style={{ fontSize: 11, color: "#6B7280", padding: "4px 8px", background: "#F5F3FF", borderRadius: 6, marginBottom: 8 }}>
                      💬 {s.original_text}
                    </div>
                  )}

                  {/* Review Actions */}
                  {reviewingId === s.id ? (
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input type="text" value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} placeholder="備註 (optional)"
                        style={{ flex: 1, padding: "6px 10px", border: "1px solid #D1D5DB", borderRadius: 6, fontSize: 12, outline: "none" }} />
                      <button onClick={() => handleReview(s.id, "approved")} style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "#059669", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>✅ 核准</button>
                      <button onClick={() => handleReview(s.id, "rejected")} style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "#DC2626", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>❌ 駁回</button>
                      <button onClick={() => setReviewingId(null)} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #D1D5DB", background: "white", fontSize: 12, cursor: "pointer" }}>取消</button>
                    </div>
                  ) : (
                    <button onClick={() => setReviewingId(s.id)} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #7C3AED", background: "#EDE9FE", color: "#7C3AED", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>📋 審核 Review</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ TAB: EMPLOYEES ═══ */}
      {!loading && tab === "employees" && (
        <div>
          {employees.length === 0 && (
            <div style={{ padding: 60, textAlign: "center", background: "white", borderRadius: 12, border: "1px solid #E5E7EB" }}>
              <div style={{ fontSize: 48, marginBottom: 10 }}>👥</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#374151" }}>尚無員工資料</div>
            </div>
          )}

          <div style={{ display: "grid", gap: 12 }}>
            {employees.map(emp => {
              const isExpanded = expandedEmployee === emp.user_id;
              const lb = emp.leave_balance;
              return (
                <div key={emp.user_id} style={{ background: "white", borderRadius: 12, border: "1px solid #E5E7EB", overflow: "hidden" }}>
                  {/* Employee Header */}
                  <div onClick={() => loadEmployeeDetail(emp.user_id)}
                    style={{ padding: 18, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: "#EDE9FE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: "#7C3AED" }}>
                        {(emp.name || "?")[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>{emp.name || emp.user_id.slice(0, 12)}</div>
                        <div style={{ fontSize: 12, color: "#9CA3AF" }}>{emp.email}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      {emp.pending > 0 && (
                        <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: "#FEF3C7", color: "#D97706" }}>
                          {emp.pending} 待審
                        </span>
                      )}
                      <div style={{ display: "flex", gap: 6, fontSize: 12, color: "#6B7280" }}>
                        <span>📝 {emp.leave_days_taken}天假</span>
                        <span>🕐 {emp.overtime_hours}hr加班</span>
                      </div>
                      <span style={{ fontSize: 16, color: "#9CA3AF" }}>{isExpanded ? "▲" : "▼"}</span>
                    </div>
                  </div>

                  {/* Expanded Detail */}
                  {isExpanded && (
                    <div style={{ borderTop: "1px solid #E5E7EB" }}>
                      {/* Leave Balance */}
                      {lb && (
                        <div style={{ padding: "14px 18px", background: "#F8FAFC" }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 10 }}>🏖️ 假期餘額</div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8 }}>
                            {[
                              { label: "特休 Annual", used: lb.annual_used, total: lb.annual_total, color: "#7C3AED" },
                              { label: "病假 Sick", used: lb.sick_used, total: lb.sick_total, color: "#2563EB" },
                              { label: "事假 Personal", used: lb.personal_used, total: lb.personal_total, color: "#D97706" },
                              { label: "家庭照顧 Family Care", used: lb.family_care_used, total: lb.family_care_total, color: "#059669" },
                            ].map(b => (
                              <div key={b.label} style={{ padding: "8px 10px", background: "white", borderRadius: 8, border: "1px solid #E5E7EB" }}>
                                <div style={{ fontSize: 11, color: "#6B7280", fontWeight: 600, marginBottom: 3 }}>{b.label}</div>
                                <div style={{ height: 4, background: "#E5E7EB", borderRadius: 2, overflow: "hidden" }}>
                                  <div style={{ height: "100%", width: `${Math.min((b.used / Math.max(b.total, 1)) * 100, 100)}%`, background: b.used / Math.max(b.total, 1) > 0.8 ? "#DC2626" : b.color, borderRadius: 2 }} />
                                </div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginTop: 3 }}>
                                  {b.total - b.used} 剩餘 <span style={{ fontWeight: 400, color: "#9CA3AF" }}>/ {b.total}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                          {lb.family_care_hours_total > 0 && (
                            <div style={{ marginTop: 8, fontSize: 12, color: "#059669", background: "#F0FDF4", padding: "5px 10px", borderRadius: 6 }}>
                              ℹ️ 家庭照顧假：{lb.family_care_hours_used}/{lb.family_care_hours_total} 小時已使用（可按小時請假）
                            </div>
                          )}
                        </div>
                      )}

                      {/* Recent Submissions */}
                      <div style={{ padding: "14px 18px" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 10 }}>📜 近期申請</div>
                        {employeeSubmissions.length === 0 ? (
                          <div style={{ fontSize: 13, color: "#9CA3AF" }}>無申請紀錄</div>
                        ) : (
                          <div style={{ display: "grid", gap: 8 }}>
                            {employeeSubmissions.slice(0, 10).map(s => {
                              const ft = formMeta[s.form_type];
                              const st = statusConfig[s.status] || statusConfig.pending;
                              return (
                                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#F9FAFB", borderRadius: 8, borderLeft: `3px solid ${ft?.color || "#6B7280"}` }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: 16 }}>{ft?.icon}</span>
                                    <div>
                                      <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
                                        {ft?.name_zh} — {s.form_data.leave_type || s.form_data.overtime_type || s.form_data.destination || ""}
                                      </div>
                                      <div style={{ fontSize: 11, color: "#9CA3AF" }}>
                                        {s.form_data.start_date || s.form_data.date || ""} · {s.form_data.days ? `${s.form_data.days}天` : s.form_data.hours ? `${s.form_data.hours}hr` : ""}
                                      </div>
                                    </div>
                                  </div>
                                  <span style={{ padding: "2px 8px", borderRadius: 5, fontSize: 10, fontWeight: 600, background: st.bg, color: st.color }}>{st.label}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ TAB: COMPLIANCE ═══ */}
      {!loading && tab === "compliance" && (
        <div>
          {/* Sync Status */}
          <div style={{ background: "white", borderRadius: 12, border: "1px solid #E5E7EB", padding: 24, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>⚖️ 勞動部 API 同步狀態</div>
                <div style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>Taiwan Ministry of Labor Open Data API</div>
              </div>
              <button onClick={handleSync} disabled={syncing}
                style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: syncing ? "#D1D5DB" : "#7C3AED", color: "white", fontSize: 14, fontWeight: 700, cursor: syncing ? "not-allowed" : "pointer" }}>
                {syncing ? "⏳ 同步中..." : "🔄 立即同步"}
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              <div style={{ padding: 16, background: "#F8FAFC", borderRadius: 10, textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#7C3AED", fontFamily: "monospace" }}>{complianceStatus?.total_rules || 0}</div>
                <div style={{ fontSize: 12, color: "#6B7280" }}>合規規則數</div>
              </div>
              <div style={{ padding: 16, background: "#F8FAFC", borderRadius: 10, textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: complianceStatus?.status === "synced" ? "#059669" : "#D97706", fontFamily: "monospace" }}>
                  {complianceStatus?.status === "synced" ? "✓" : "—"}
                </div>
                <div style={{ fontSize: 12, color: "#6B7280" }}>同步狀態</div>
              </div>
              <div style={{ padding: 16, background: "#F8FAFC", borderRadius: 10, textAlign: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#374151", fontFamily: "monospace" }}>
                  {complianceStatus?.last_sync ? new Date(complianceStatus.last_sync).toLocaleDateString("zh-TW", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "尚未同步"}
                </div>
                <div style={{ fontSize: 12, color: "#6B7280" }}>上次同步</div>
              </div>
            </div>
          </div>

          {/* Key Rules */}
          <div style={{ background: "white", borderRadius: 12, border: "1px solid #E5E7EB", padding: 24, marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 14 }}>📖 主要合規規則</div>
            <div style={{ display: "grid", gap: 8 }}>
              {[
                { art: "LSA Art. 30/32", rule: "每日工時上限12小時（8正常+4加班），每月加班上限46-54小時", color: "#2563EB" },
                { art: "LSA Art. 24", rule: "加班費率：前2小時 1.33x，後2小時 1.67x，假日 2x", color: "#D97706" },
                { art: "LSA Art. 38", rule: "特休：滿半年3天，滿1年7天，滿2年10天，逐年遞增至30天", color: "#7C3AED" },
                { art: "LSA Art. 50", rule: "產假56天，滿6個月全薪，未滿半薪", color: "#DC2626" },
                { art: "2026 更新", rule: "家庭照顧假可按小時請假（7天=56小時），全勤獎金比例扣減", color: "#059669" },
                { art: "2026 基本工資", rule: "月薪 NT$29,500 / 時薪 NT$196", color: "#059669" },
              ].map(r => (
                <div key={r.art} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", background: "#F9FAFB", borderRadius: 8, borderLeft: `3px solid ${r.color}` }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: r.color, whiteSpace: "nowrap", marginTop: 1 }}>{r.art}</span>
                  <span style={{ fontSize: 13, color: "#374151" }}>{r.rule}</span>
                </div>
              ))}
            </div>
          </div>

          {/* API Info */}
          <div style={{ background: "#F8FAFC", borderRadius: 12, border: "1px solid #E5E7EB", padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#6B7280", marginBottom: 8 }}>🔗 資料來源</div>
            <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.8 }}>
              勞動部開放資料 API: apiservice.mol.gov.tw<br />
              全國法規資料庫: law.moj.gov.tw<br />
              更新頻率: 可手動同步，建議每週一次<br />
              規則來源: 勞動基準法、勞工請假規則、性別平等工作法
            </div>
          </div>

          {/* ═══ CONFLICT SCANNER ═══ */}
          <ComplianceConflictScanner />
        </div>
      )}
    </div>
  );
}
