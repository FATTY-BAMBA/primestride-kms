"use client";

import { useState, useEffect, useMemo } from "react";
import ComplianceConflictScanner from "@/components/ComplianceConflictScanner";
import { FormTemplate } from "@/components/FormTemplates";

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
  compliance_result: {
    status: "pass" | "warning" | "blocked";
    checks: { check_type: string; status: string; rule_reference: string; message_zh: string; message: string }[];
    ai_analysis_zh?: string;
  } | null;
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
    maternity_total: number; maternity_used: number;
    paternity_total: number; paternity_used: number;
    marriage_total: number; marriage_used: number;
    bereavement_total: number; bereavement_used: number;
    comp_time_total: number; comp_time_used: number;
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

function BalanceBar({ used, total, color }: { used: number; total: number; color: string }) {
  const remaining = total - used;
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const barColor = remaining <= 0 ? "#DC2626" : pct >= 80 ? "#F59E0B" : color;
  return (
    <div style={{ minWidth: 80 }}>
      <div style={{ height: 4, background: "#E5E7EB", borderRadius: 2, overflow: "hidden", marginBottom: 2 }}>
        <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 2, transition: "width 0.3s" }} />
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: remaining <= 0 ? "#DC2626" : "#374151" }}>
        {remaining}<span style={{ fontWeight: 400, color: "#9CA3AF", fontSize: 10 }}>/{total}</span>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [tab, setTab] = useState<"overview" | "pending" | "employees" | "leave" | "compliance">("overview");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [allSubmissions, setAllSubmissions] = useState<Submission[]>([]);
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
  const [empSearch, setEmpSearch] = useState("");
  const [empSort, setEmpSort] = useState<"name" | "pending" | "leave" | "overtime">("name");
  const [shadowRisks, setShadowRisks] = useState<any[]>([]);
  const [subsidies, setSubsidies] = useState<any[]>([]);
  const [subsidySummary, setSubsidySummary] = useState<any>(null);
  const [showSubsidyDetail, setShowSubsidyDetail] = useState<string | null>(null);
  const [expandedCompliance, setExpandedCompliance] = useState<string | null>(null);
  const [templateView, setTemplateView] = useState<Set<string>>(new Set());
  const [leaveSearch, setLeaveSearch] = useState("");
  const [leaveTypeFilter, setLeaveTypeFilter] = useState<"annual" | "sick" | "personal" | "family_care" | "all">("all");

  const toggleTemplate = (id: string) => {
    const n = new Set(templateView); n.has(id) ? n.delete(id) : n.add(id); setTemplateView(n);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [subRes, allSubRes, empRes, compRes, shadowRes, subsidyRes] = await Promise.all([
        fetch("/api/workflows?view=all&status=pending"),
        fetch("/api/workflows?view=all"),
        fetch("/api/admin/employees"),
        fetch("/api/compliance/sync"),
        fetch("/api/shadow-audit"),
        fetch("/api/subsidy-hunter"),
      ]);
      const subData = await subRes.json();
      setSubmissions(subData.submissions || []);
      const allSubData = await allSubRes.json();
      setAllSubmissions(allSubData.submissions || []);
      if (empRes.ok) { const empData = await empRes.json(); setEmployees(empData.employees || []); }
      if (compRes.ok) { const compData = await compRes.json(); setComplianceStatus(compData); }
      if (shadowRes.ok) { const shadowData = await shadowRes.json(); setShadowRisks(shadowData.risks || []); }
      if (subsidyRes.ok) { const subsidyData = await subsidyRes.json(); setSubsidies(subsidyData.subsidies || []); setSubsidySummary(subsidyData.summary || null); }
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleReview = async (id: string, action: string) => {
    try {
      await fetch("/api/workflows", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action, review_note: reviewNote }) });
      setReviewingId(null); setReviewNote(""); fetchData();
    } catch {}
  };

  const handleBatch = async (action: string) => {
    try {
      await fetch("/api/workflows", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: Array.from(selectedIds), action, review_note: reviewNote }) });
      setSelectedIds(new Set()); setReviewNote(""); fetchData();
    } catch {}
  };

  const loadEmployeeDetail = async (userId: string) => {
    if (expandedEmployee === userId) { setExpandedEmployee(null); return; }
    setExpandedEmployee(userId);
    try {
      const res = await fetch(`/api/workflows?view=all&user_id=${userId}`);
      const data = await res.json();
      setEmployeeSubmissions(data.submissions || []);
    } catch { setEmployeeSubmissions([]); }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/compliance/sync", { method: "POST" });
      const data = await res.json();
      if (data.success) { setMessage("✅ 同步完成！"); setComplianceStatus({ last_sync: data.synced_at, total_rules: complianceStatus?.total_rules || 0, status: "synced" }); }
      else { setMessage("❌ 同步失敗"); }
      setTimeout(() => setMessage(""), 4000);
    } catch { setMessage("❌ 同步失敗"); } finally { setSyncing(false); }
  };

  const toggleSelect = (id: string) => { const n = new Set(selectedIds); n.has(id) ? n.delete(id) : n.add(id); setSelectedIds(n); };
  const formatDate = (d: string) => new Date(d).toLocaleDateString("zh-TW", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  const pendingCount = submissions.length;
  const todayStr = new Date().toISOString().split("T")[0];

  const onLeaveToday = useMemo(() => allSubmissions.filter(s => s.form_type === "leave" && s.status === "approved" && s.form_data.start_date <= todayStr && (s.form_data.end_date || s.form_data.start_date) >= todayStr), [allSubmissions, todayStr]);
  const thisMonthApproved = useMemo(() => { const ms = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(); return allSubmissions.filter(s => s.status === "approved" && s.created_at >= ms).length; }, [allSubmissions]);
  const thisMonthOvertime = useMemo(() => { const ms = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(); return allSubmissions.filter(s => s.form_type === "overtime" && s.status === "approved" && s.created_at >= ms).reduce((sum, s) => sum + (Number(s.form_data.hours) || 0), 0); }, [allSubmissions]);
  const employeesLowLeave = useMemo(() => employees.filter(emp => { if (!emp.leave_balance) return false; const r = emp.leave_balance.annual_total - emp.leave_balance.annual_used; return r <= 2 && emp.leave_balance.annual_total > 0; }), [employees]);
  const filteredEmployees = useMemo(() => { let r = employees; if (empSearch.trim()) { const q = empSearch.toLowerCase(); r = r.filter(e => (e.name || "").toLowerCase().includes(q) || (e.email || "").toLowerCase().includes(q)); } return [...r].sort((a, b) => { switch (empSort) { case "pending": return b.pending - a.pending; case "leave": return b.leave_days_taken - a.leave_days_taken; case "overtime": return b.overtime_hours - a.overtime_hours; default: return (a.name || "").localeCompare(b.name || ""); } }); }, [employees, empSearch, empSort]);
  const leaveOverviewEmployees = useMemo(() => { let r = employees.filter(e => e.leave_balance !== null); if (leaveSearch.trim()) { const q = leaveSearch.toLowerCase(); r = r.filter(e => (e.name || "").toLowerCase().includes(q) || (e.email || "").toLowerCase().includes(q)); } return [...r].sort((a, b) => (a.name || "").localeCompare(b.name || "")); }, [employees, leaveSearch]);
  const leaveStats = useMemo(() => { const w = employees.filter(e => e.leave_balance); const exhausted = w.filter(e => e.leave_balance!.annual_used >= e.leave_balance!.annual_total && e.leave_balance!.annual_total > 0); const low = w.filter(e => { const r = e.leave_balance!.annual_total - e.leave_balance!.annual_used; return r > 0 && r <= 2; }); return { exhausted: exhausted.length, lowLeave: low.length, withBalance: w.length }; }, [employees]);
  const pendingLeave = useMemo(() => submissions.filter(s => s.form_type === "leave"), [submissions]);

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 12px" }}>
      {message && <div style={{ padding: "10px 16px", borderRadius: 10, background: message.includes("✅") ? "#D1FAE5" : "#FEE2E2", color: message.includes("✅") ? "#065F46" : "#991B1B", fontSize: 14, fontWeight: 600, marginBottom: 16 }}>{message}</div>}

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0 }}>⚙️ 管理員儀表板</h1>
        <p style={{ fontSize: 13, color: "#6B7280", margin: "4px 0 0" }}>Admin Dashboard — 總覽、審核、員工管理、合規管理</p>
      </div>

      {/* ═══ TAB BAR ═══ */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "2px solid #E5E7EB", paddingBottom: 0, overflowX: "auto" }}>
        {[
          { key: "overview",   label: "📊 總覽" },
          { key: "pending",    label: `📋 待審核 (${pendingCount})` },
          { key: "employees",  label: `👥 員工 (${employees.length})` },
          { key: "leave",      label: "🏖️ 假期總覽" },
          { key: "compliance", label: "⚖️ 合規" },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)} style={{ padding: "10px 18px", border: "none", background: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", color: tab === t.key ? "#7C3AED" : "#6B7280", borderBottom: tab === t.key ? "2px solid #7C3AED" : "2px solid transparent", marginBottom: -2, transition: "all 0.15s" }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading && <div style={{ padding: 60, textAlign: "center", color: "#9CA3AF" }}>載入中...</div>}

      {/* ═══ OVERVIEW ═══ */}
      {!loading && tab === "overview" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 20 }}>
            {[
              { label: "待審核", val: pendingCount, icon: "📋", color: "#D97706", bg: "#FEF3C7", onClick: () => setTab("pending") },
              { label: "今日請假", val: onLeaveToday.length, icon: "🏖️", color: "#7C3AED", bg: "#EDE9FE", onClick: () => setTab("leave") },
              { label: "本月核准", val: thisMonthApproved, icon: "✅", color: "#059669", bg: "#D1FAE5", onClick: undefined },
              { label: "本月加班時數", val: thisMonthOvertime, icon: "🕐", color: "#2563EB", bg: "#DBEAFE", onClick: undefined },
            ].map(s => (
              <div key={s.label} onClick={s.onClick} style={{ padding: "18px 16px", background: s.bg, borderRadius: 12, textAlign: "center", cursor: s.onClick ? "pointer" : "default", transition: "transform 0.15s" }}
                onMouseEnter={(e) => { if (s.onClick) e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}>
                <div style={{ fontSize: 14, marginBottom: 4 }}>{s.icon}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.val}</div>
                <div style={{ fontSize: 12, color: s.color, opacity: 0.8 }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div style={{ background: "white", borderRadius: 12, border: "1px solid #E5E7EB", padding: 20, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>🏖️ 今日請假人員</div>
              <button onClick={() => setTab("leave")} style={{ fontSize: 12, color: "#7C3AED", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>假期總覽 →</button>
            </div>
            {onLeaveToday.length === 0 ? <div style={{ fontSize: 13, color: "#9CA3AF", padding: "10px 0" }}>今天沒有人請假 ✓</div> : (
              <div style={{ display: "grid", gap: 8 }}>
                {onLeaveToday.map(s => (
                  <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "#F9FAFB", borderRadius: 8, borderLeft: "3px solid #7C3AED" }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{s.submitter_name || s.submitted_by.slice(0, 12)}</div>
                      <div style={{ fontSize: 12, color: "#6B7280" }}>{s.form_data.leave_type} · {s.form_data.start_date} → {s.form_data.end_date || s.form_data.start_date}</div>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#7C3AED" }}>{s.form_data.days || 1} 天</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12, marginBottom: 16 }}>
            <div style={{ background: "white", borderRadius: 12, border: "1px solid #E5E7EB", padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>📋 待審核隊列</div>
                {pendingCount > 0 && <button onClick={() => setTab("pending")} style={{ fontSize: 12, color: "#7C3AED", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>查看全部 →</button>}
              </div>
              {submissions.length === 0 ? <div style={{ fontSize: 13, color: "#059669", padding: "10px 0" }}>🎉 全部審核完畢！</div> : (
                <div style={{ display: "grid", gap: 6 }}>
                  {submissions.slice(0, 5).map(s => { const ft = formMeta[s.form_type]; return (
                    <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "#F9FAFB", borderRadius: 6 }}>
                      <span style={{ fontSize: 16 }}>{ft?.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}>{s.submitter_name || s.submitted_by.slice(0, 10)}</div>
                        <div style={{ fontSize: 10, color: "#9CA3AF" }}>{ft?.name_zh} · {formatDate(s.created_at)}</div>
                      </div>
                    </div>
                  ); })}
                  {submissions.length > 5 && <div style={{ fontSize: 11, color: "#9CA3AF", textAlign: "center", padding: "4px 0" }}>+{submissions.length - 5} 筆更多</div>}
                </div>
              )}
            </div>
            <div style={{ background: "white", borderRadius: 12, border: "1px solid #E5E7EB", padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>⚠️ 假期餘額不足提醒</div>
                {employeesLowLeave.length > 0 && <button onClick={() => setTab("leave")} style={{ fontSize: 12, color: "#7C3AED", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>查看全部 →</button>}
              </div>
              {employeesLowLeave.length === 0 ? <div style={{ fontSize: 13, color: "#059669", padding: "10px 0" }}>所有員工假期餘額充足 ✓</div> : (
                <div style={{ display: "grid", gap: 6 }}>
                  {employeesLowLeave.slice(0, 5).map(emp => { const remaining = (emp.leave_balance?.annual_total || 0) - (emp.leave_balance?.annual_used || 0); return (
                    <div key={emp.user_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: remaining <= 0 ? "#FEF2F2" : "#FFFBEB", borderRadius: 6 }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}>{emp.name || emp.email}</div>
                        <div style={{ fontSize: 10, color: "#9CA3AF" }}>特休 Annual Leave</div>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 800, color: remaining <= 0 ? "#DC2626" : "#D97706" }}>{remaining} 天</span>
                    </div>
                  ); })}
                </div>
              )}
            </div>
          </div>

          {shadowRisks.length > 0 && (
            <div style={{ background: "white", borderRadius: 12, border: "1px solid #FECACA", marginBottom: 16, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", background: "#FEF2F2", borderBottom: "1px solid #FECACA", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18 }}>🔍</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#991B1B" }}>Shadow Audit — 加班風險預警</div>
                    <div style={{ fontSize: 11, color: "#DC2626" }}>{shadowRisks.filter(r => r.risk_level === "critical").length} 名員工超標 · {shadowRisks.filter(r => r.risk_level === "warning").length} 名員工接近上限</div>
                  </div>
                </div>
                <div style={{ fontSize: 10, color: "#9CA3AF", padding: "3px 8px", background: "white", borderRadius: 4, border: "1px solid #FECACA" }}>依 LSA Art. 32 即時監控</div>
              </div>
              <div style={{ padding: "10px 16px", display: "grid", gap: 8 }}>
                {shadowRisks.map(risk => (
                  <div key={risk.user_id} style={{ padding: "10px 14px", borderRadius: 8, background: risk.risk_level === "critical" ? "#FEF2F2" : "#FFFBEB", border: `1px solid ${risk.risk_level === "critical" ? "#FECACA" : "#FCD34D"}`, display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: risk.risk_level === "critical" ? "#FEE2E2" : "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: risk.risk_level === "critical" ? "#DC2626" : "#D97706" }}>{risk.name[0]?.toUpperCase() || "?"}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 4 }}>
                        {risk.name}
                        <span style={{ marginLeft: 8, padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700, background: risk.risk_level === "critical" ? "#FEE2E2" : "#FEF3C7", color: risk.risk_level === "critical" ? "#DC2626" : "#D97706" }}>{risk.risk_level === "critical" ? "🚨 超標" : "⚠️ 接近上限"}</span>
                      </div>
                      <div style={{ display: "flex", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, color: "#6B7280" }}>本月 <strong style={{ color: risk.monthly_hours >= 46 ? "#DC2626" : "#111827" }}>{risk.monthly_hours}h</strong> / 46h</span>
                        <span style={{ fontSize: 11, color: "#6B7280" }}>近3月 <strong style={{ color: risk.quarterly_hours >= 138 ? "#DC2626" : "#111827" }}>{risk.quarterly_hours}h</strong> / 138h</span>
                        {risk.monthly_remaining > 0 && <span style={{ fontSize: 11, color: "#6B7280" }}>本月剩餘 <strong>{risk.monthly_remaining}h</strong></span>}
                      </div>
                      {risk.alerts.map((alert: any, i: number) => (
                        <div key={i} style={{ fontSize: 11, color: risk.risk_level === "critical" ? "#991B1B" : "#92400E", marginBottom: 2 }}>
                          {alert.message_zh}
                          <span style={{ marginLeft: 6, padding: "1px 5px", borderRadius: 3, fontSize: 9, fontWeight: 600, background: "white", border: `1px solid ${risk.risk_level === "critical" ? "#FECACA" : "#FCD34D"}`, color: risk.risk_level === "critical" ? "#DC2626" : "#D97706" }}>📖 {alert.law}{alert.fine && ` · 罰款 ${alert.fine}`}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {subsidies.length > 0 && (
            <div style={{ background: "white", borderRadius: 12, border: "1px solid #BBF7D0", marginBottom: 16, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", background: "linear-gradient(135deg, #F0FDF4, #ECFDF5)", borderBottom: "1px solid #BBF7D0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18 }}>💰</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#065F46" }}>補助獵人 Subsidy Hunter — {subsidies.length} 項可申請補助</div>
                    <div style={{ fontSize: 11, color: "#059669" }}>最高可申請 NT${subsidySummary?.total_potential_nt?.toLocaleString() || "—"} 政府補助</div>
                  </div>
                </div>
                <span style={{ fontSize: 10, color: "#059669", padding: "3px 8px", background: "white", borderRadius: 4, border: "1px solid #BBF7D0" }}>自動掃描</span>
              </div>
              <div style={{ padding: "10px 16px", display: "grid", gap: 8 }}>
                {subsidies.map(sub => (
                  <div key={sub.id} style={{ padding: "12px 14px", borderRadius: 8, background: sub.urgency === "high" ? "#F0FDF4" : "#F9FAFB", border: `1px solid ${sub.urgency === "high" ? "#BBF7D0" : "#E5E7EB"}`, cursor: "pointer" }} onClick={() => setShowSubsidyDetail(showSubsidyDetail === sub.id ? null : sub.id)}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <span style={{ fontSize: 20, flexShrink: 0 }}>{sub.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, flexWrap: "wrap", gap: 4 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>
                            {sub.name_zh}
                            {sub.urgency === "high" && <span style={{ marginLeft: 6, padding: "1px 6px", borderRadius: 4, fontSize: 9, fontWeight: 700, background: "#D1FAE5", color: "#065F46" }}>高優先</span>}
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 800, color: "#059669" }}>{sub.amount}</span>
                        </div>
                        <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 4 }}>{sub.description_zh}</div>
                        {showSubsidyDetail === sub.id && (
                          <div style={{ marginTop: 8, padding: "8px 10px", background: "white", borderRadius: 6, border: "1px solid #E5E7EB" }}>
                            <div style={{ fontSize: 11, color: "#374151", marginBottom: 4 }}>📅 <strong>截止：</strong>{sub.deadline}</div>
                            <div style={{ fontSize: 11, color: "#374151", marginBottom: 4 }}>🏛️ <strong>主管機關：</strong>{sub.source}</div>
                            <div style={{ fontSize: 11, color: "#059669", marginBottom: 4 }}>✅ <strong>行動：</strong>{sub.action_zh}</div>
                            {sub.portal_url && (
                              <a href={sub.portal_url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 8, padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, background: "#059669", color: "white", textDecoration: "none" }} onClick={e => e.stopPropagation()}>🔗 前往申請官網</a>
                            )}
                          </div>
                        )}
                        <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 4 }}>{showSubsidyDetail === sub.id ? "▲ 收合" : "▼ 查看詳情"}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ PENDING ═══ */}
      {!loading && tab === "pending" && (
        <div style={{ paddingBottom: selectedIds.size > 0 ? 100 : 0 }}>

          {/* Select all link */}
          {submissions.length > 0 && selectedIds.size === 0 && (
            <button onClick={() => setSelectedIds(new Set(submissions.map(s => s.id)))} style={{ fontSize: 12, color: "#7C3AED", background: "none", border: "none", cursor: "pointer", marginBottom: 10, textDecoration: "underline" }}>全選 ({submissions.length})</button>
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
                <div key={s.id} style={{ background: isSelected ? "#F5F3FF" : "white", borderRadius: 12, border: isSelected ? "2px solid #7C3AED" : "1px solid #E5E7EB", padding: 18, borderLeft: `4px solid ${ft?.color || "#6B7280"}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(s.id)} style={{ width: 18, height: 18, cursor: "pointer", accentColor: "#7C3AED" }} />
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
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
                    <button onClick={() => toggleTemplate(s.id)} style={{ fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 5, cursor: "pointer", border: "1px solid #E5E7EB", background: templateView.has(s.id) ? "#EDE9FE" : "#F9FAFB", color: templateView.has(s.id) ? "#7C3AED" : "#6B7280" }}>
                      {templateView.has(s.id) ? "📄 一般檢視" : "📋 切換表單格式"}
                    </button>
                  </div>
                  {templateView.has(s.id) ? (
                    <div style={{ marginBottom: 10 }}><FormTemplate submission={s} /></div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 6, marginBottom: 10 }}>
                      {Object.entries(s.form_data).map(([key, value]) => (
                        <div key={key} style={{ padding: "5px 8px", background: "#F9FAFB", borderRadius: 6 }}>
                          <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 600 }}>{fieldLabels[key] || key}</div>
                          <div style={{ fontSize: 13, color: "#111827", fontWeight: 500 }}>{String(value || "—")}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {s.original_text && <div style={{ fontSize: 11, color: "#6B7280", padding: "4px 8px", background: "#F5F3FF", borderRadius: 6, marginBottom: 8 }}>💬 {s.original_text}</div>}
                  {s.compliance_result && (() => {
                    const cr = s.compliance_result;
                    const nonPass = cr.checks.filter((c: any) => c.status !== "pass");
                    const isExpanded = expandedCompliance === s.id;
                    return (
                      <div style={{ margin: "0 0 10px 0", padding: "8px 12px", borderRadius: 8, background: cr.status === "blocked" ? "#FEF2F2" : cr.status === "warning" ? "#FFFBEB" : "#F0FDF4", border: `1px solid ${cr.status === "blocked" ? "#FECACA" : cr.status === "warning" ? "#FCD34D" : "#BBF7D0"}` }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 11 }}>{cr.status === "blocked" ? "🚫" : cr.status === "warning" ? "⚠️" : "✅"}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: cr.status === "blocked" ? "#991B1B" : cr.status === "warning" ? "#92400E" : "#065F46" }}>
                              {cr.status === "blocked" ? "合規未通過" : cr.status === "warning" ? "合規提醒" : "合規通過"}
                              <span style={{ fontSize: 10, fontWeight: 400, marginLeft: 4, color: "#9CA3AF" }}>申請時合規狀態</span>
                            </span>
                          </div>
                          {cr.checks.length > 0 && (
                            <button onClick={() => setExpandedCompliance(isExpanded ? null : s.id)} style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4, cursor: "pointer", border: `1px solid ${cr.status === "blocked" ? "#FECACA" : cr.status === "warning" ? "#FCD34D" : "#BBF7D0"}`, background: "white", color: cr.status === "blocked" ? "#991B1B" : cr.status === "warning" ? "#92400E" : "#065F46" }}>
                              {isExpanded ? "收合 ▲" : "查看法條 ▼"}
                            </button>
                          )}
                        </div>
                        {nonPass.length > 0 && (
                          <div style={{ marginTop: 6 }}>
                            {nonPass.map((check: any, i: number) => (
                              <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 4 }}>
                                <span style={{ fontSize: 10, color: check.status === "blocked" ? "#DC2626" : "#D97706", flexShrink: 0, marginTop: 1 }}>{check.status === "blocked" ? "✕" : "!"}</span>
                                <div>
                                  <div style={{ fontSize: 11, color: "#374151" }}>{check.message_zh}</div>
                                  <div style={{ fontSize: 10, color: "#7C3AED", fontWeight: 600 }}>📖 {check.rule_reference}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {isExpanded && (
                          <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(0,0,0,0.08)" }}>
                            {cr.checks.map((check: any, i: number) => (
                              <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6, padding: "6px 8px", borderRadius: 6, background: check.status === "blocked" ? "#FEE2E2" : check.status === "warning" ? "#FEF3C7" : "rgba(255,255,255,0.7)", border: `1px solid ${check.status === "blocked" ? "#FECACA" : check.status === "warning" ? "#FCD34D" : "rgba(0,0,0,0.06)"}` }}>
                                <span style={{ fontSize: 9, fontWeight: 700, flexShrink: 0, marginTop: 1, color: check.status === "blocked" ? "#DC2626" : check.status === "warning" ? "#D97706" : "#059669" }}>{check.status === "blocked" ? "✕" : check.status === "warning" ? "!" : "✓"}</span>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 11, color: "#111827", marginBottom: 2 }}>{check.message_zh}</div>
                                  <div style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "1px 6px", borderRadius: 3, fontSize: 9, fontWeight: 700, background: "#EDE9FE", color: "#7C3AED", border: "1px solid #DDD6FE" }}>📖 {check.rule_reference}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {cr.ai_analysis_zh && <div style={{ fontSize: 10, color: "#6B7280", marginTop: 6, paddingTop: 6, borderTop: "1px solid rgba(0,0,0,0.06)" }}>🤖 {cr.ai_analysis_zh}</div>}
                      </div>
                    );
                  })()}
                  {reviewingId === s.id ? (
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input type="text" value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} placeholder="備註" style={{ flex: 1, padding: "6px 10px", border: "1px solid #D1D5DB", borderRadius: 6, fontSize: 12, outline: "none", color: "#111827", background: "white" }} />
                      <button onClick={() => handleReview(s.id, "approved")} style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "#059669", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>✅ 核准</button>
                      <button onClick={() => handleReview(s.id, "rejected")} style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "#DC2626", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>❌ 駁回</button>
                      <button onClick={() => setReviewingId(null)} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #D1D5DB", background: "white", fontSize: 12, cursor: "pointer", color: "#6B7280" }}>取消</button>
                    </div>
                  ) : (
                    <button onClick={() => setReviewingId(s.id)} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #7C3AED", background: "#EDE9FE", color: "#7C3AED", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>📋 審核</button>
                  )}
                </div>
              );
            })}
          </div>

          {/* ═══ STICKY BATCH ACTION BAR — appears at bottom when items selected ═══ */}
          {selectedIds.size > 0 && (
            <div style={{
              position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
              zIndex: 50, width: "calc(100% - 48px)", maxWidth: 700,
              background: "white",
              borderRadius: 16,
              border: "1px solid #E5E7EB",
              boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
              padding: "12px 16px",
              display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
            }}>
              {/* Count badge */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, background: "#EDE9FE", flexShrink: 0 }}>
                <div style={{ width: 18, height: 18, borderRadius: 4, background: "#7C3AED", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ color: "white", fontSize: 10, fontWeight: 800 }}>✓</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#5B21B6" }}>{selectedIds.size} 筆已選</span>
              </div>

              {/* Note input */}
              <input
                type="text"
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder="備註（選填）"
                style={{ flex: 1, minWidth: 100, padding: "8px 12px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, outline: "none", color: "#111827", background: "#F9FAFB" }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#7C3AED"; e.currentTarget.style.background = "white"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.background = "#F9FAFB"; }}
              />

              {/* Approve */}
              <button onClick={() => handleBatch("approved")}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 10, border: "none", background: "#059669", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0, transition: "opacity 0.15s" }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = "0.85"}
                onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}>
                ✅ 批次核准
              </button>

              {/* Reject */}
              <button onClick={() => handleBatch("rejected")}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 10, border: "none", background: "#DC2626", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0, transition: "opacity 0.15s" }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = "0.85"}
                onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}>
                ❌ 批次駁回
              </button>

              {/* Deselect */}
              <button onClick={() => setSelectedIds(new Set())}
                style={{ padding: "9px 14px", borderRadius: 10, border: "1px solid #E5E7EB", background: "white", color: "#6B7280", fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0, transition: "all 0.15s" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#9CA3AF"; e.currentTarget.style.color = "#374151"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.color = "#6B7280"; }}>
                ✕ 取消
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══ EMPLOYEES ═══ */}
      {!loading && tab === "employees" && (
        <div>
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <input type="text" value={empSearch} onChange={(e) => setEmpSearch(e.target.value)} placeholder="🔍 搜尋員工姓名或 email..."
              style={{ flex: 1, minWidth: 200, padding: "10px 14px", border: "1px solid #D1D5DB", borderRadius: 10, fontSize: 14, outline: "none", color: "#111827" }}
              onFocus={(e) => e.currentTarget.style.borderColor = "#7C3AED"}
              onBlur={(e) => e.currentTarget.style.borderColor = "#D1D5DB"} />
            <div style={{ display: "flex", gap: 4 }}>
              {([{ key: "name", label: "姓名" }, { key: "pending", label: "待審" }, { key: "leave", label: "請假多" }, { key: "overtime", label: "加班多" }] as const).map(s => (
                <button key={s.key} onClick={() => setEmpSort(s.key)} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 12, fontWeight: 600, cursor: "pointer", background: empSort === s.key ? "#7C3AED" : "white", color: empSort === s.key ? "white" : "#6B7280" }}>{s.label}</button>
              ))}
            </div>
          </div>
          <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 10 }}>顯示 {filteredEmployees.length} / {employees.length} 位員工</div>
          {filteredEmployees.length === 0 && (
            <div style={{ padding: 60, textAlign: "center", background: "white", borderRadius: 12, border: "1px solid #E5E7EB" }}>
              <div style={{ fontSize: 48, marginBottom: 10 }}>👥</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#374151" }}>{empSearch ? "找不到符合的員工" : "尚無員工資料"}</div>
            </div>
          )}
          <div style={{ display: "grid", gap: 10 }}>
            {filteredEmployees.map(emp => {
              const isExpanded = expandedEmployee === emp.user_id;
              const lb = emp.leave_balance;
              return (
                <div key={emp.user_id} style={{ background: "white", borderRadius: 12, border: "1px solid #E5E7EB", overflow: "hidden" }}>
                  <div onClick={() => loadEmployeeDetail(emp.user_id)} style={{ padding: "14px 18px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "#FAFAFA"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "white"}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: "#EDE9FE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "#7C3AED" }}>{(emp.name || "?")[0].toUpperCase()}</div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>{emp.name || emp.user_id.slice(0, 12)}</div>
                        <div style={{ fontSize: 11, color: "#9CA3AF" }}>{emp.email}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      {emp.pending > 0 && <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: "#FEF3C7", color: "#D97706" }}>{emp.pending} 待審</span>}
                      <div style={{ display: "flex", gap: 8, fontSize: 11, color: "#6B7280" }}><span>📝{emp.leave_days_taken}天</span><span>🕐{emp.overtime_hours}hr</span></div>
                      <span style={{ fontSize: 14, color: "#9CA3AF" }}>{isExpanded ? "▲" : "▼"}</span>
                    </div>
                  </div>
                  {isExpanded && (
                    <div style={{ borderTop: "1px solid #E5E7EB" }}>
                      {lb && (
                        <div style={{ padding: "14px 18px", background: "#F8FAFC" }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 10 }}>🏖️ 假期餘額</div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
                            {[
                              { label: "特休 Annual", used: lb.annual_used, total: lb.annual_total, color: "#7C3AED", tag: "有薪", tagColor: "#059669" },
                              { label: "病假 Sick", used: lb.sick_used, total: lb.sick_total, color: "#2563EB", tag: "半薪", tagColor: "#D97706" },
                              { label: "事假 Personal", used: lb.personal_used, total: lb.personal_total, color: "#D97706", tag: "無薪", tagColor: "#DC2626" },
                              { label: "家庭照顧", used: lb.family_care_used, total: lb.family_care_total, color: "#059669", tag: "有薪", tagColor: "#059669" },
                            ].map(b => {
                              const remaining = b.total - b.used;
                              const usedPct = b.total > 0 ? Math.min((b.used / b.total) * 100, 100) : 0;
                              const isLow = b.total > 0 && remaining / b.total <= 0.2;
                              return (
                                <div key={b.label} style={{ padding: "8px 10px", background: "white", borderRadius: 8, border: "1px solid #E5E7EB" }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                                    <div style={{ fontSize: 10, color: "#6B7280", fontWeight: 600 }}>{b.label}</div>
                                    <span style={{ fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: b.tagColor === "#059669" ? "#D1FAE5" : b.tagColor === "#D97706" ? "#FEF3C7" : "#FEE2E2", color: b.tagColor }}>{b.tag}</span>
                                  </div>
                                  <div style={{ height: 5, background: "#E5E7EB", borderRadius: 3, overflow: "hidden", marginBottom: 4 }}>
                                    <div style={{ height: "100%", width: `${usedPct}%`, background: remaining <= 0 ? "#DC2626" : isLow ? "#F59E0B" : b.color, borderRadius: 3 }} />
                                  </div>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: remaining <= 0 ? "#DC2626" : "#374151" }}>{remaining}<span style={{ fontWeight: 400, color: "#9CA3AF", fontSize: 10 }}>/{b.total}</span></div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      <div style={{ padding: "14px 18px" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 10 }}>📜 近期申請</div>
                        {employeeSubmissions.length === 0 ? <div style={{ fontSize: 13, color: "#9CA3AF" }}>無申請紀錄</div> : (
                          <div style={{ display: "grid", gap: 6 }}>
                            {employeeSubmissions.slice(0, 10).map(s => {
                              const ft = formMeta[s.form_type]; const st = statusConfig[s.status] || statusConfig.pending;
                              return (
                                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#F9FAFB", borderRadius: 8, borderLeft: `3px solid ${ft?.color || "#6B7280"}` }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: 16 }}>{ft?.icon}</span>
                                    <div>
                                      <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{ft?.name_zh} — {s.form_data.leave_type || s.form_data.overtime_type || s.form_data.destination || ""}</div>
                                      <div style={{ fontSize: 11, color: "#9CA3AF" }}>{s.form_data.start_date || s.form_data.date || ""} · {s.form_data.days ? `${s.form_data.days}天` : s.form_data.hours ? `${s.form_data.hours}hr` : ""}</div>
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

      {/* ═══ LEAVE OVERVIEW ═══ */}
      {!loading && tab === "leave" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 20 }}>
            {[
              { label: "全勤員工", val: leaveStats.withBalance - leaveStats.exhausted - leaveStats.lowLeave, icon: "✅", color: "#059669", bg: "#D1FAE5" },
              { label: "餘額不足 (≤2天)", val: leaveStats.lowLeave, icon: "⚠️", color: "#D97706", bg: "#FEF3C7" },
              { label: "特休已用盡", val: leaveStats.exhausted, icon: "🚨", color: "#DC2626", bg: "#FEE2E2" },
              { label: "待審請假申請", val: pendingLeave.length, icon: "📋", color: "#7C3AED", bg: "#EDE9FE", onClick: () => setTab("pending") },
            ].map(s => (
              <div key={s.label} onClick={(s as any).onClick} style={{ padding: "16px", background: s.bg, borderRadius: 12, textAlign: "center", cursor: (s as any).onClick ? "pointer" : "default" }}>
                <div style={{ fontSize: 18, marginBottom: 4 }}>{s.icon}</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.val}</div>
                <div style={{ fontSize: 11, color: s.color, opacity: 0.8 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {pendingLeave.length > 0 && (
            <div style={{ background: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: 12, padding: "14px 18px", marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#92400E", marginBottom: 8 }}>⏳ 待審請假 — 通過後將扣減餘額</div>
              <div style={{ display: "grid", gap: 6 }}>
                {pendingLeave.map(s => (
                  <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "white", borderRadius: 8 }}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{s.submitter_name}</span>
                      <span style={{ fontSize: 12, color: "#6B7280", marginLeft: 8 }}>{s.form_data.leave_type} · {s.form_data.days} 天</span>
                    </div>
                    <button onClick={() => setTab("pending")} style={{ fontSize: 11, color: "#7C3AED", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>審核 →</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <input type="text" value={leaveSearch} onChange={(e) => setLeaveSearch(e.target.value)} placeholder="🔍 搜尋員工..."
            style={{ width: "100%", padding: "10px 14px", border: "1px solid #D1D5DB", borderRadius: 10, fontSize: 14, outline: "none", marginBottom: 14, boxSizing: "border-box", color: "#111827" }}
            onFocus={(e) => e.currentTarget.style.borderColor = "#7C3AED"}
            onBlur={(e) => e.currentTarget.style.borderColor = "#D1D5DB"} />

          {leaveOverviewEmployees.length === 0 ? (
            <div style={{ padding: 60, textAlign: "center", background: "white", borderRadius: 12, border: "1px solid #E5E7EB" }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🏖️</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#374151" }}>尚無假期資料</div>
              <div style={{ fontSize: 13, color: "#9CA3AF" }}>員工登入後系統會自動建立假期餘額</div>
            </div>
          ) : (
            <div style={{ background: "white", borderRadius: 12, border: "1px solid #E5E7EB", overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1fr", padding: "10px 16px", background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
                {["員工", "特休 Annual", "病假 Sick", "事假 Personal", "家庭照顧"].map((h, i) => (
                  <div key={h} style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textAlign: i === 0 ? "left" : "center" }}>{h}</div>
                ))}
              </div>
              {leaveOverviewEmployees.map((emp, idx) => {
                const lb = emp.leave_balance!;
                const annualRemaining = lb.annual_total - lb.annual_used;
                const isExhausted = annualRemaining <= 0 && lb.annual_total > 0;
                const isLow = annualRemaining > 0 && annualRemaining <= 2;
                return (
                  <div key={emp.user_id} style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1fr", padding: "12px 16px", alignItems: "center", background: isExhausted ? "#FEF2F2" : isLow ? "#FFFBEB" : idx % 2 === 0 ? "white" : "#FAFAFA", borderBottom: "1px solid #F3F4F6" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 8, background: isExhausted ? "#FEE2E2" : "#EDE9FE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: isExhausted ? "#DC2626" : "#7C3AED", flexShrink: 0 }}>{(emp.name || "?")[0].toUpperCase()}</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{emp.name || emp.email}</div>
                        {isExhausted && <div style={{ fontSize: 10, color: "#DC2626", fontWeight: 600 }}>特休已用盡</div>}
                        {isLow && !isExhausted && <div style={{ fontSize: 10, color: "#D97706", fontWeight: 600 }}>餘額不足</div>}
                      </div>
                    </div>
                    <div style={{ textAlign: "center" }}><BalanceBar used={lb.annual_used} total={lb.annual_total} color="#7C3AED" /></div>
                    <div style={{ textAlign: "center" }}><BalanceBar used={lb.sick_used} total={lb.sick_total} color="#2563EB" /></div>
                    <div style={{ textAlign: "center" }}><BalanceBar used={lb.personal_used} total={lb.personal_total} color="#D97706" /></div>
                    <div style={{ textAlign: "center" }}><BalanceBar used={lb.family_care_used} total={lb.family_care_total} color="#059669" /></div>
                  </div>
                );
              })}
              <div style={{ padding: "10px 16px", background: "#F9FAFB", borderTop: "1px solid #E5E7EB", fontSize: 11, color: "#9CA3AF" }}>
                {new Date().getFullYear()} 年度假期餘額 · 顯示 {leaveOverviewEmployees.length} 位員工 · 餘額即時更新（核准請假後自動扣減）
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ COMPLIANCE ═══ */}
      {!loading && tab === "compliance" && (
        <div>
          <div style={{ background: "white", borderRadius: 12, border: "1px solid #E5E7EB", padding: 20, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 4 }}>⚖️ 合規規則資料庫</div>
                <div style={{ fontSize: 12, color: "#6B7280" }}>{complianceStatus?.total_rules || 0} 條勞基法規則已載入{complianceStatus?.last_sync ? ` · 上次更新：${new Date(complianceStatus.last_sync).toLocaleDateString("zh-TW", { month: "short", day: "numeric" })}` : " · 尚未同步"}</div>
                <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>資料來源：勞動部開放資料 API（apiservice.mol.gov.tw）</div>
              </div>
              <button onClick={handleSync} disabled={syncing} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: syncing ? "#D1D5DB" : "#7C3AED", color: "white", fontSize: 13, fontWeight: 700, cursor: syncing ? "not-allowed" : "pointer" }}>
                {syncing ? "⏳ 同步中..." : "🔄 立即同步"}
              </button>
            </div>
          </div>
          <div style={{ background: "white", borderRadius: 12, border: "1px solid #E5E7EB", padding: 24, marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 14 }}>📖 主要合規規則</div>
            <div style={{ display: "grid", gap: 8 }}>
              {[
                { art: "LSA Art. 30/32", rule: "每日工時上限12小時，每月加班上限46-54小時", color: "#2563EB", url: "https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=N0030001&flno=30" },
                { art: "LSA Art. 24", rule: "加班費率：前2小時 1.34x，後2小時 1.67x，假日 2x", color: "#D97706", url: "https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=N0030001&flno=24" },
                { art: "LSA Art. 38", rule: "特休：滿半年3天，滿1年7天，逐年遞增至30天", color: "#7C3AED", url: "https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=N0030001&flno=38" },
                { art: "LSA Art. 50", rule: "產假56天，滿6個月全薪", color: "#DC2626", url: "https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=N0030001&flno=50" },
                { art: "2026 更新", rule: "家庭照顧假可按小時請假（56小時/年），全勤獎金比例扣減", color: "#059669", url: "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=N0030036" },
                { art: "2026 基本工資", rule: "月薪 NT$29,500 / 時薪 NT$196", color: "#059669", url: "https://www.mol.gov.tw/1607/1632/1633/56601/" },
              ].map(r => (
                <div key={r.art} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 12px", background: "#F9FAFB", borderRadius: 8, borderLeft: `3px solid ${r.color}`, justifyContent: "space-between" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flex: 1 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: r.color, whiteSpace: "nowrap" }}>{r.art}</span>
                    <span style={{ fontSize: 13, color: "#374151" }}>{r.rule}</span>
                  </div>
                  <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, fontWeight: 600, color: r.color, textDecoration: "none", whiteSpace: "nowrap", padding: "3px 8px", borderRadius: 4, border: `1px solid ${r.color}30`, background: "white", flexShrink: 0 }}>查看全文 →</a>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: "#F8FAFC", borderRadius: 12, border: "1px solid #E5E7EB", padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#6B7280", marginBottom: 8 }}>🔗 資料來源</div>
            <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.8 }}>勞動部開放資料 API: apiservice.mol.gov.tw<br />全國法規資料庫: law.moj.gov.tw<br />更新頻率: 可手動同步，建議每週一次</div>
          </div>
          <ComplianceConflictScanner />
        </div>
      )}
    </div>
  );
}