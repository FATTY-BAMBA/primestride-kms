"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import ComplianceConflictScanner from "@/components/ComplianceConflictScanner";
import { FormTemplate } from "@/components/FormTemplates";

interface Submission {
  id: string; form_type: string; form_data: Record<string, any>; status: string;
  submitted_by: string; submitter_name: string; original_text: string | null;
  ai_parsed: boolean; reviewed_by: string | null; reviewer_name: string | null;
  reviewed_at: string | null; review_note: string | null; created_at: string;
  compliance_result: { status: "pass"|"warning"|"blocked"; checks: { check_type: string; status: string; rule_reference: string; message_zh: string; message: string }[]; ai_analysis_zh?: string; } | null;
}

interface EmployeeSummary {
  user_id: string; name: string; email: string; total_submissions: number;
  pending: number; approved: number; rejected: number; leave_days_taken: number; overtime_hours: number;
  leave_balance: { annual_total: number; annual_used: number; sick_total: number; sick_used: number; personal_total: number; personal_used: number; family_care_total: number; family_care_used: number; family_care_hours_total: number; family_care_hours_used: number; maternity_total: number; maternity_used: number; paternity_total: number; paternity_used: number; marriage_total: number; marriage_used: number; bereavement_total: number; bereavement_used: number; comp_time_total: number; comp_time_used: number; } | null;
}

interface ComplianceSyncStatus { last_sync: string | null; total_rules: number; status: string; }
interface Toast { id: string; type: "success"|"error"|"info"|"warning"; message: string; duration?: number; }

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

function useDebounce<T>(value: T, delay: number): T {
  const [dv, setDv] = useState<T>(value);
  useEffect(() => { const t = setTimeout(() => setDv(value), delay); return () => clearTimeout(t); }, [value, delay]);
  return dv;
}

function useLocalStorage<T>(key: string, initial: T): [T, (v: T) => void] {
  const [val, setVal] = useState<T>(initial);
  useEffect(() => { try { const item = window.localStorage.getItem(key); if (item) setVal(JSON.parse(item)); } catch {} }, [key]);
  const set = (v: T) => { setVal(v); try { window.localStorage.setItem(key, JSON.stringify(v)); } catch {} };
  return [val, set];
}

function SkeletonCard() {
  return (
    <div style={{ padding: 18, background: "white", borderRadius: 12, border: "1px solid #E5E7EB" }}>
      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "#E5E7EB", animation: "pulse 2s infinite" }} />
        <div style={{ flex: 1 }}>
          <div style={{ height: 16, width: "60%", background: "#E5E7EB", borderRadius: 4, marginBottom: 8, animation: "pulse 2s infinite" }} />
          <div style={{ height: 12, width: "40%", background: "#E5E7EB", borderRadius: 4, animation: "pulse 2s infinite" }} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {[1,2,3].map(i => <div key={i} style={{ height: 50, background: "#F3F4F6", borderRadius: 8, animation: "pulse 2s infinite" }} />)}
      </div>
    </div>
  );
}

function SkeletonStat() {
  return (
    <div style={{ padding: "18px 16px", background: "#F9FAFB", borderRadius: 12, textAlign: "center" }}>
      <div style={{ width: 32, height: 32, background: "#E5E7EB", borderRadius: 8, margin: "0 auto 8px", animation: "pulse 2s infinite" }} />
      <div style={{ height: 28, width: "50%", background: "#E5E7EB", borderRadius: 4, margin: "0 auto 4px", animation: "pulse 2s infinite" }} />
      <div style={{ height: 12, width: "70%", background: "#E5E7EB", borderRadius: 4, margin: "0 auto", animation: "pulse 2s infinite" }} />
    </div>
  );
}

function ToastContainer({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: string) => void }) {
  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8, maxWidth: 400 }}>
      {toasts.map(t => <ToastItem key={t.id} toast={t} onClose={() => removeToast(t.id)} />)}
    </div>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, toast.duration || 4000); return () => clearTimeout(t); }, [onClose, toast.duration]);
  const c = { success: { bg: "#D1FAE5", border: "#6EE7B7", text: "#065F46", icon: "✓" }, error: { bg: "#FEE2E2", border: "#FCA5A5", text: "#991B1B", icon: "✕" }, warning: { bg: "#FEF3C7", border: "#FCD34D", text: "#92400E", icon: "!" }, info: { bg: "#DBEAFE", border: "#93C5FD", text: "#1E40AF", icon: "i" } }[toast.type];
  return (
    <div style={{ padding: "12px 16px", background: c.bg, border: `1px solid ${c.border}`, borderRadius: 10, display: "flex", alignItems: "center", gap: 10, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", animation: "slideIn 0.3s ease-out", cursor: "pointer" }} onClick={onClose}>
      <span style={{ width: 20, height: 20, borderRadius: "50%", background: c.text, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>{c.icon}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: c.text, flex: 1 }}>{toast.message}</span>
      <button onClick={e => { e.stopPropagation(); onClose(); }} style={{ background: "none", border: "none", color: c.text, cursor: "pointer", fontSize: 16, padding: 0 }}>×</button>
    </div>
  );
}

function EmptyState({ icon, title, subtitle, action }: { icon: string; title: string; subtitle: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div style={{ padding: 60, textAlign: "center", background: "white", borderRadius: 12, border: "1px solid #E5E7EB" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: "#374151", marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 13, color: "#9CA3AF", marginBottom: action ? 20 : 0 }}>{subtitle}</div>
      {action && <button onClick={action.onClick} style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid #7C3AED", background: "#EDE9FE", color: "#7C3AED", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{action.label}</button>}
    </div>
  );
}

function ConfirmModal({ isOpen, title, message, confirmText, cancelText, onConfirm, onCancel }: { isOpen: boolean; title: string; message: string; confirmText: string; cancelText: string; onConfirm: () => void; onCancel: () => void; }) {
  if (!isOpen) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000 }} onClick={onCancel}>
      <div style={{ background: "white", borderRadius: 16, padding: 24, maxWidth: 400, width: "90%", boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#111827", marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 14, color: "#6B7280", marginBottom: 24, lineHeight: 1.6 }}>{message}</div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #E5E7EB", background: "white", color: "#6B7280", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{cancelText}</button>
          <button onClick={onConfirm} style={{ padding: "10px 16px", borderRadius: 8, border: "none", background: "#DC2626", color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
}

function DataFreshness({ lastUpdate, onRefresh, isRefreshing }: { lastUpdate: Date | null; onRefresh: () => void; isRefreshing: boolean }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t); }, []);
  const diff = lastUpdate ? Math.floor((now.getTime() - lastUpdate.getTime()) / 60000) : -1;
  const ago = diff < 0 ? "尚未更新" : diff < 1 ? "剛剛" : diff < 60 ? `${diff} 分鐘前` : `${Math.floor(diff / 60)} 小時前`;
  const fresh = lastUpdate && (now.getTime() - lastUpdate.getTime()) < 300000;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#6B7280" }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: fresh ? "#10B981" : "#F59E0B", display: "inline-block" }} />
      <span>上次更新: {ago}</span>
      <button onClick={onRefresh} disabled={isRefreshing} style={{ background: "none", border: "none", color: "#7C3AED", cursor: isRefreshing ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600, opacity: isRefreshing ? 0.5 : 1 }}>
        <span style={{ display: "inline-block", animation: isRefreshing ? "spin 1s linear infinite" : "none" }}>↻</span> 刷新
      </button>
    </div>
  );
}

function BalanceBar({ used, total, color }: { used: number; total: number; color: string }) {
  const remaining = total - used;
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const barColor = remaining <= 0 ? "#DC2626" : pct >= 80 ? "#F59E0B" : color;
  return (
    <div style={{ minWidth: 80 }}>
      <div style={{ height: 4, background: "#E5E7EB", borderRadius: 2, overflow: "hidden", marginBottom: 2 }}>
        <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 2, transition: "width 0.5s ease-out" }} />
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: remaining <= 0 ? "#DC2626" : "#374151" }}>
        {remaining}<span style={{ fontWeight: 400, color: "#9CA3AF", fontSize: 10 }}>/{total}</span>
      </div>
    </div>
  );
}

function CompliancePanel({ result, id, expandedId, setExpandedId }: {
  result: Submission["compliance_result"]; id: string; expandedId: string | null; setExpandedId: (v: string | null) => void;
}) {
  if (!result) return null;
  const nonPass = result.checks.filter(c => c.status !== "pass");
  const isExpanded = expandedId === id;
  const borderColor = result.status === "blocked" ? "#FECACA" : result.status === "warning" ? "#FCD34D" : "#BBF7D0";
  const bg = result.status === "blocked" ? "#FEF2F2" : result.status === "warning" ? "#FFFBEB" : "#F0FDF4";
  const textColor = result.status === "blocked" ? "#991B1B" : result.status === "warning" ? "#92400E" : "#065F46";
  return (
    <div style={{ margin: "0 0 10px", padding: "8px 12px", borderRadius: 8, background: bg, border: `1px solid ${borderColor}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11 }}>{result.status === "blocked" ? "🚫" : result.status === "warning" ? "⚠️" : "✅"}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: textColor }}>
            {result.status === "blocked" ? "合規未通過" : result.status === "warning" ? "合規提醒" : "合規通過"}
            <span style={{ fontSize: 10, fontWeight: 400, marginLeft: 4, color: "#9CA3AF" }}>申請時合規狀態</span>
          </span>
        </div>
        {result.checks.length > 0 && (
          <button onClick={() => setExpandedId(isExpanded ? null : id)} style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4, cursor: "pointer", border: `1px solid ${borderColor}`, background: "white", color: textColor }}>
            {isExpanded ? "收合 ▲" : "查看法條 ▼"}
          </button>
        )}
      </div>
      {nonPass.length > 0 && (
        <div style={{ marginTop: 6 }}>
          {nonPass.map((c, i) => (
            <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: c.status === "blocked" ? "#DC2626" : "#D97706", flexShrink: 0, marginTop: 1 }}>{c.status === "blocked" ? "✕" : "!"}</span>
              <div>
                <div style={{ fontSize: 11, color: "#374151" }}>{c.message_zh}</div>
                <div style={{ fontSize: 10, color: "#7C3AED", fontWeight: 600 }}>📖 {c.rule_reference}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      {isExpanded && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(0,0,0,0.08)" }}>
          {result.checks.map((c, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6, padding: "6px 8px", borderRadius: 6, background: c.status === "blocked" ? "#FEE2E2" : c.status === "warning" ? "#FEF3C7" : "rgba(255,255,255,0.7)", border: `1px solid ${c.status === "blocked" ? "#FECACA" : c.status === "warning" ? "#FCD34D" : "rgba(0,0,0,0.06)"}` }}>
              <span style={{ fontSize: 9, fontWeight: 700, flexShrink: 0, marginTop: 1, color: c.status === "blocked" ? "#DC2626" : c.status === "warning" ? "#D97706" : "#059669" }}>{c.status === "blocked" ? "✕" : c.status === "warning" ? "!" : "✓"}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: "#111827", marginBottom: 2 }}>{c.message_zh}</div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "1px 6px", borderRadius: 3, fontSize: 9, fontWeight: 700, background: "#EDE9FE", color: "#7C3AED", border: "1px solid #DDD6FE" }}>📖 {c.rule_reference}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      {result.ai_analysis_zh && <div style={{ fontSize: 10, color: "#6B7280", marginTop: 6, paddingTop: 6, borderTop: "1px solid rgba(0,0,0,0.06)" }}>🤖 {result.ai_analysis_zh}</div>}
    </div>
  );
}

function ShortcutsHelp({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000 }} onClick={onClose}>
      <div style={{ background: "white", borderRadius: 16, padding: 24, maxWidth: 450, width: "90%" }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#111827", marginBottom: 16 }}>⌨️ 鍵盤快捷鍵</div>
        {[["⌘/Ctrl + 1-6", "切換分頁"], ["⌘/Ctrl + A", "全選待審"], ["Shift + 點擊", "範圍選取"], ["Esc", "取消選取/關閉"], ["?", "顯示說明"]].map(([k, a]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <kbd style={{ padding: "4px 10px", background: "#F3F4F6", border: "1px solid #E5E7EB", borderRadius: 6, fontSize: 12, fontFamily: "monospace", fontWeight: 600, color: "#374151" }}>{k}</kbd>
            <span style={{ fontSize: 13, color: "#6B7280" }}>{a}</span>
          </div>
        ))}
        <button onClick={onClose} style={{ marginTop: 8, width: "100%", padding: "10px", borderRadius: 8, border: "none", background: "#7C3AED", color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>關閉</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════
export default function AdminDashboard() {
  const [tab, setTab] = useLocalStorage<"overview"|"pending"|"employees"|"leave"|"compliance"|"esg">("admin_last_tab", "overview");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [allSubmissions, setAllSubmissions] = useState<Submission[]>([]);
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [complianceStatus, setComplianceStatus] = useState<ComplianceSyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);
  const [employeeSubmissions, setEmployeeSubmissions] = useState<Submission[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [empSearch, setEmpSearch] = useState("");
  const debouncedEmpSearch = useDebounce(empSearch, 300);
  const [empSort, setEmpSort] = useState<"name"|"pending"|"leave"|"overtime">("name");
  const [shadowRisks, setShadowRisks] = useState<any[]>([]);
  const [subsidies, setSubsidies] = useState<any[]>([]);
  const [subsidySummary, setSubsidySummary] = useState<any>(null);
  const [showSubsidyDetail, setShowSubsidyDetail] = useState<string | null>(null);
  const [expandedCompliance, setExpandedCompliance] = useState<string | null>(null);
  const [templateView, setTemplateView] = useState<Set<string>>(new Set());
  const [leaveSearch, setLeaveSearch] = useState("");
  const [requestSubTab, setRequestSubTab] = useState<"leave"|"overtime"|"business_trip">("leave");
  const debouncedLeaveSearch = useDebounce(leaveSearch, 300);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; action: string; count: number }>({ isOpen: false, action: "", count: 0 });
  const lastSelectedRef = useRef<string | null>(null);

  const addToast = useCallback((type: Toast["type"], message: string, duration?: number) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, type, message, duration }]);
  }, []);
  const removeToast = useCallback((id: string) => setToasts(prev => prev.filter(t => t.id !== id)), []);

  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true); else setRefreshing(true);
    try {
      const [subRes, allSubRes, empRes, compRes, shadowRes, subsidyRes] = await Promise.all([
        fetch("/api/workflows?view=all&status=pending"), fetch("/api/workflows?view=all"),
        fetch("/api/admin/employees"), fetch("/api/compliance/sync"),
        fetch("/api/shadow-audit"), fetch("/api/subsidy-hunter"),
      ]);
      setSubmissions((await subRes.json()).submissions || []);
      setAllSubmissions((await allSubRes.json()).submissions || []);
      if (empRes.ok) setEmployees((await empRes.json()).employees || []);
      if (compRes.ok) setComplianceStatus(await compRes.json());
      if (shadowRes.ok) setShadowRisks((await shadowRes.json()).risks || []);
      if (subsidyRes.ok) { const d = await subsidyRes.json(); setSubsidies(d.subsidies || []); setSubsidySummary(d.summary || null); }
      setLastUpdate(new Date());
    } catch { addToast("error", "❌ 載入失敗，請檢查網路連線"); }
    finally { setLoading(false); setRefreshing(false); }
  }, [addToast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "?") { setShowShortcuts(true); return; }
      if (e.key === "Escape") { setSelectedIds(new Set()); setReviewingId(null); setShowShortcuts(false); return; }
      if ((e.metaKey || e.ctrlKey) && e.key >= "1" && e.key <= "6") { const tabs = ["overview","pending","employees","leave","compliance","esg"] as const; setTab(tabs[parseInt(e.key)-1]); return; }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a" && tab === "pending") { e.preventDefault(); setSelectedIds(new Set(submissions.map(s => s.id))); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [tab, submissions, setTab]);

  const handleReview = async (id: string, action: "approved"|"rejected") => {
    const sub = submissions.find(s => s.id === id);
    if (!sub) return;
    setSubmissions(prev => prev.filter(s => s.id !== id));
    addToast("success", `✅ 已${action === "approved" ? "核准" : "駁回"} ${sub.submitter_name} 的申請`);
    try { await fetch("/api/workflows", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action, review_note: reviewNote }) }); setReviewingId(null); setReviewNote(""); fetchData(false); }
    catch { setSubmissions(prev => [...prev, sub]); addToast("error", "❌ 操作失敗，請重試"); }
  };

  const executeBatch = async (action: "approved"|"rejected") => {
    const count = selectedIds.size; const ids = Array.from(selectedIds);
    setSubmissions(prev => prev.filter(s => !ids.includes(s.id))); setSelectedIds(new Set());
    addToast("success", `✅ 已${action === "approved" ? "核准" : "駁回"} ${count} 筆申請`);
    try { await fetch("/api/workflows", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, action, review_note: reviewNote }) }); setReviewNote(""); fetchData(false); }
    catch { addToast("error", "❌ 批次操作失敗"); fetchData(false); }
    setConfirmModal({ isOpen: false, action: "", count: 0 });
  };

  const handleBatch = (action: "approved"|"rejected") => {
    if (selectedIds.size === 0) return;
    if (selectedIds.size > 3 && action === "rejected") { setConfirmModal({ isOpen: true, action, count: selectedIds.size }); return; }
    executeBatch(action);
  };

  const loadEmployeeDetail = async (userId: string) => {
    if (expandedEmployee === userId) { setExpandedEmployee(null); return; }
    setExpandedEmployee(userId);
    try { const res = await fetch(`/api/workflows?view=all&user_id=${userId}`); setEmployeeSubmissions((await res.json()).submissions || []); }
    catch { setEmployeeSubmissions([]); addToast("error", "❌ 無法載入員工詳情"); }
  };

  const handleSync = async () => {
    setSyncing(true);
    try { const res = await fetch("/api/compliance/sync", { method: "POST" }); const d = await res.json(); if (d.success) { addToast("success", "✅ 合規規則同步完成！"); setComplianceStatus({ last_sync: d.synced_at, total_rules: complianceStatus?.total_rules || 0, status: "synced" }); } else addToast("error", "❌ 同步失敗"); }
    catch { addToast("error", "❌ 同步失敗"); } finally { setSyncing(false); }
  };

  const toggleSelect = (id: string, e?: React.MouseEvent) => {
    const ns = new Set(selectedIds);
    if (e?.shiftKey && lastSelectedRef.current) {
      const ids = submissions.map(s => s.id); const si = ids.indexOf(lastSelectedRef.current); const ei = ids.indexOf(id);
      for (let i = Math.min(si,ei); i <= Math.max(si,ei); i++) ns.add(ids[i]);
    } else { ns.has(id) ? ns.delete(id) : ns.add(id); }
    lastSelectedRef.current = id; setSelectedIds(ns);
  };
  const toggleTemplate = (id: string) => { const n = new Set(templateView); n.has(id) ? n.delete(id) : n.add(id); setTemplateView(n); };

  const pendingCount = submissions.length;
  const todayStr = new Date().toISOString().split("T")[0];

  const onLeaveToday = useMemo(() => allSubmissions.filter(s => s.form_type === "leave" && s.status === "approved" && s.form_data.start_date <= todayStr && (s.form_data.end_date || s.form_data.start_date) >= todayStr), [allSubmissions, todayStr]);
  const thisMonthApproved = useMemo(() => { const ms = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(); return allSubmissions.filter(s => s.status === "approved" && s.created_at >= ms).length; }, [allSubmissions]);
  const thisMonthOvertime = useMemo(() => { const ms = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(); return allSubmissions.filter(s => s.form_type === "overtime" && s.status === "approved" && s.created_at >= ms).reduce((sum, s) => sum + (Number(s.form_data.hours) || 0), 0); }, [allSubmissions]);
  const employeesLowLeave = useMemo(() => employees.filter(emp => { if (!emp.leave_balance) return false; const r = emp.leave_balance.annual_total - emp.leave_balance.annual_used; return r <= 2 && emp.leave_balance.annual_total > 0; }), [employees]);
  const filteredEmployees = useMemo(() => { let r = employees; if (debouncedEmpSearch.trim()) { const q = debouncedEmpSearch.toLowerCase(); r = r.filter(e => (e.name||"").toLowerCase().includes(q)||(e.email||"").toLowerCase().includes(q)); } return [...r].sort((a,b) => { switch(empSort) { case "pending": return b.pending-a.pending; case "leave": return b.leave_days_taken-a.leave_days_taken; case "overtime": return b.overtime_hours-a.overtime_hours; default: return (a.name||"").localeCompare(b.name||""); } }); }, [employees, debouncedEmpSearch, empSort]);
  const leaveOverviewEmployees = useMemo(() => { let r = employees.filter(e => e.leave_balance); if (debouncedLeaveSearch.trim()) { const q = debouncedLeaveSearch.toLowerCase(); r = r.filter(e => (e.name||"").toLowerCase().includes(q)||(e.email||"").toLowerCase().includes(q)); } return [...r].sort((a,b) => (a.name||"").localeCompare(b.name||"")); }, [employees, debouncedLeaveSearch]);
  const leaveStats = useMemo(() => { const w = employees.filter(e => e.leave_balance); const ex = w.filter(e => e.leave_balance!.annual_used >= e.leave_balance!.annual_total && e.leave_balance!.annual_total > 0); const lo = w.filter(e => { const r = e.leave_balance!.annual_total - e.leave_balance!.annual_used; return r > 0 && r <= 2; }); return { exhausted: ex.length, lowLeave: lo.length, withBalance: w.length }; }, [employees]);
  const pendingLeave = useMemo(() => submissions.filter(s => s.form_type === "leave"), [submissions]);
  const allOvertime = useMemo(() => allSubmissions.filter(s => s.form_type === "overtime"), [allSubmissions]);
  const allTrips = useMemo(() => allSubmissions.filter(s => s.form_type === "business_trip"), [allSubmissions]);
  const fmt = (d: string) => new Date(d).toLocaleDateString("zh-TW", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 12px 40px" }}>
      <style>{`
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.5 } }
        @keyframes slideIn { from { transform:translateX(100%);opacity:0 } to { transform:translateX(0);opacity:1 } }
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }
      `}</style>

      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <ConfirmModal isOpen={confirmModal.isOpen} title="確認批次駁回" message={`確定要駁回 ${confirmModal.count} 筆申請嗎？此操作無法復原。`} confirmText="確定駁回" cancelText="取消" onConfirm={() => executeBatch("rejected")} onCancel={() => setConfirmModal({ isOpen: false, action: "", count: 0 })} />
      <ShortcutsHelp isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />

      {/* Header */}
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0 }}>⚙️ 管理員儀表板</h1>
          <p style={{ fontSize: 13, color: "#6B7280", margin: "4px 0 0" }}>Admin Dashboard — 總覽、審核、員工管理、合規管理</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <DataFreshness lastUpdate={lastUpdate} onRefresh={() => fetchData(false)} isRefreshing={refreshing} />
          <button onClick={() => setShowShortcuts(true)} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #E5E7EB", background: "white", cursor: "pointer", fontSize: 14, color: "#6B7280" }}>?</button>
        </div>
      </div>

      {/* Tab Bar */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "2px solid #E5E7EB", overflowX: "auto", position: "sticky", top: 0, background: "white", zIndex: 20, paddingTop: 8 }}>
        {[
          { key: "overview", label: "📊 總覽" },
          { key: "pending", label: `📋 待審核 (${pendingCount})` },
          { key: "employees", label: `👥 員工 (${employees.length})` },
          { key: "leave", label: "📋 申請總覽" },
          { key: "compliance", label: "⚖️ 合規" },
          { key: "esg", label: "🌿 ESG 報告" },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as typeof tab)} style={{ padding: "10px 18px", border: "none", background: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", color: tab === t.key ? "#7C3AED" : "#6B7280", borderBottom: tab === t.key ? "2px solid #7C3AED" : "2px solid transparent", marginBottom: -2, transition: "all 0.15s" }}>{t.label}</button>
        ))}
      </div>

      {loading && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 20 }}>{[1,2,3,4].map(i => <SkeletonStat key={i} />)}</div>
          <div style={{ display: "grid", gap: 10 }}>{[1,2,3].map(i => <SkeletonCard key={i} />)}</div>
        </div>
      )}

      {/* ═══ OVERVIEW ═══ */}
      {!loading && tab === "overview" && (
        <div style={{ animation: "fadeIn 0.4s" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 20 }}>
            {[
              { label: "待審核", val: pendingCount, icon: "📋", color: "#D97706", bg: "#FEF3C7", onClick: () => setTab("pending") },
              { label: "今日請假", val: onLeaveToday.length, icon: "🏖️", color: "#7C3AED", bg: "#EDE9FE", onClick: () => setTab("leave") },
              { label: "本月核准", val: thisMonthApproved, icon: "✅", color: "#059669", bg: "#D1FAE5" },
              { label: "本月加班時數", val: thisMonthOvertime, icon: "🕐", color: "#2563EB", bg: "#DBEAFE" },
            ].map(s => (
              <div key={s.label} onClick={(s as any).onClick} style={{ padding: "18px 16px", background: s.bg, borderRadius: 12, textAlign: "center", cursor: (s as any).onClick ? "pointer" : "default", transition: "transform 0.15s" }}
                onMouseEnter={e => { if ((s as any).onClick) e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}>
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
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{s.submitter_name || s.submitted_by.slice(0,12)}</div>
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
                  {submissions.slice(0,5).map(s => { const ft = formMeta[s.form_type]; return (
                    <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "#F9FAFB", borderRadius: 6 }}>
                      <span style={{ fontSize: 16 }}>{ft?.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}>{s.submitter_name || s.submitted_by.slice(0,10)}</div>
                        <div style={{ fontSize: 10, color: "#9CA3AF" }}>{ft?.name_zh} · {fmt(s.created_at)}</div>
                      </div>
                    </div>
                  ); })}
                  {submissions.length > 5 && <div style={{ fontSize: 11, color: "#9CA3AF", textAlign: "center", padding: "4px 0" }}>+{submissions.length-5} 筆更多</div>}
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
                  {employeesLowLeave.slice(0,5).map(emp => { const r = (emp.leave_balance?.annual_total||0)-(emp.leave_balance?.annual_used||0); return (
                    <div key={emp.user_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: r<=0 ? "#FEF2F2" : "#FFFBEB", borderRadius: 6 }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}>{emp.name || emp.email}</div>
                        <div style={{ fontSize: 10, color: "#9CA3AF" }}>特休 Annual Leave</div>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 800, color: r<=0 ? "#DC2626" : "#D97706" }}>{r} 天</span>
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
                  <div key={risk.user_id} style={{ padding: "10px 14px", borderRadius: 8, background: risk.risk_level==="critical" ? "#FEF2F2":"#FFFBEB", border: `1px solid ${risk.risk_level==="critical"?"#FECACA":"#FCD34D"}`, display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: risk.risk_level==="critical"?"#FEE2E2":"#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: risk.risk_level==="critical"?"#DC2626":"#D97706" }}>{risk.name[0]?.toUpperCase()}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 4 }}>
                        {risk.name} <span style={{ marginLeft: 8, padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700, background: risk.risk_level==="critical"?"#FEE2E2":"#FEF3C7", color: risk.risk_level==="critical"?"#DC2626":"#D97706" }}>{risk.risk_level==="critical"?"🚨 超標":"⚠️ 接近上限"}</span>
                      </div>
                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
                        <span style={{ fontSize: 11, color: "#6B7280" }}>本月 <strong style={{ color: risk.monthly_hours>=46?"#DC2626":"#111827" }}>{risk.monthly_hours}h</strong>/46h</span>
                        <span style={{ fontSize: 11, color: "#6B7280" }}>近3月 <strong style={{ color: risk.quarterly_hours>=138?"#DC2626":"#111827" }}>{risk.quarterly_hours}h</strong>/138h</span>
                      </div>
                      {risk.alerts.map((a: any, i: number) => (
                        <div key={i} style={{ fontSize: 11, color: risk.risk_level==="critical"?"#991B1B":"#92400E", marginBottom: 2 }}>
                          {a.message_zh} <span style={{ marginLeft: 6, padding: "1px 5px", borderRadius: 3, fontSize: 9, fontWeight: 600, background: "white", border: `1px solid ${risk.risk_level==="critical"?"#FECACA":"#FCD34D"}`, color: risk.risk_level==="critical"?"#DC2626":"#D97706" }}>📖 {a.law}{a.fine && ` · 罰款 ${a.fine}`}</span>
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
              <div style={{ padding: "12px 16px", background: "linear-gradient(135deg,#F0FDF4,#ECFDF5)", borderBottom: "1px solid #BBF7D0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18 }}>💰</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#065F46" }}>補助獵人 Subsidy Hunter — {subsidies.length} 項可申請補助</div>
                    <div style={{ fontSize: 11, color: "#059669" }}>最高可申請 NT${subsidySummary?.total_potential_nt?.toLocaleString()||"—"} 政府補助</div>
                  </div>
                </div>
                <span style={{ fontSize: 10, color: "#059669", padding: "3px 8px", background: "white", borderRadius: 4, border: "1px solid #BBF7D0" }}>自動掃描</span>
              </div>
              <div style={{ padding: "10px 16px", display: "grid", gap: 8 }}>
                {subsidies.map(sub => (
                  <div key={sub.id} style={{ padding: "12px 14px", borderRadius: 8, background: sub.urgency==="high"?"#F0FDF4":"#F9FAFB", border: `1px solid ${sub.urgency==="high"?"#BBF7D0":"#E5E7EB"}`, cursor: "pointer" }} onClick={() => setShowSubsidyDetail(showSubsidyDetail===sub.id?null:sub.id)}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <span style={{ fontSize: 20, flexShrink: 0 }}>{sub.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, flexWrap: "wrap", gap: 4 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{sub.name_zh}{sub.urgency==="high" && <span style={{ marginLeft: 6, padding: "1px 6px", borderRadius: 4, fontSize: 9, fontWeight: 700, background: "#D1FAE5", color: "#065F46" }}>高優先</span>}</div>
                          <span style={{ fontSize: 13, fontWeight: 800, color: "#059669" }}>{sub.amount}</span>
                        </div>
                        <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 4 }}>{sub.description_zh}</div>
                        {showSubsidyDetail===sub.id && (
                          <div style={{ marginTop: 8, padding: "8px 10px", background: "white", borderRadius: 6, border: "1px solid #E5E7EB" }}>
                            <div style={{ fontSize: 11, color: "#374151", marginBottom: 4 }}>📅 <strong>截止：</strong>{sub.deadline}</div>
                            <div style={{ fontSize: 11, color: "#374151", marginBottom: 4 }}>🏛️ <strong>主管機關：</strong>{sub.source}</div>
                            <div style={{ fontSize: 11, color: "#059669", marginBottom: 4 }}>✅ <strong>行動：</strong>{sub.action_zh}</div>
                            {sub.portal_url && <a href={sub.portal_url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 8, padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, background: "#059669", color: "white", textDecoration: "none" }} onClick={e => e.stopPropagation()}>🔗 前往申請官網</a>}
                            {sub.eligible_employees?.length > 0 && <div style={{ marginTop: 8 }}><div style={{ fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 4 }}>符合資格員工：</div>{sub.eligible_employees.map((e: any) => <div key={e.user_id} style={{ fontSize: 11, color: "#6B7280", padding: "3px 6px", background: "#F9FAFB", borderRadius: 4, marginBottom: 2 }}>👤 {e.name} — {e.reason}</div>)}</div>}
                          </div>
                        )}
                        <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 4 }}>{showSubsidyDetail===sub.id?"▲ 收合":"▼ 查看詳情"}</div>
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
        <div style={{ animation: "fadeIn 0.4s", paddingBottom: selectedIds.size > 0 ? 100 : 0 }}>
          <div style={{ position: "sticky", top: 60, zIndex: 15, background: "white", padding: "10px 0", borderBottom: "1px solid #E5E7EB", marginBottom: 10 }}>
            {submissions.length > 0 && selectedIds.size === 0 && (
              <button onClick={() => setSelectedIds(new Set(submissions.map(s => s.id)))} style={{ fontSize: 12, color: "#7C3AED", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>全選 ({submissions.length})</button>
            )}
            {selectedIds.size > 0 && <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 13, fontWeight: 600, color: "#7C3AED" }}>{selectedIds.size} 筆已選</span><button onClick={() => setSelectedIds(new Set())} style={{ fontSize: 12, color: "#6B7280", background: "none", border: "none", cursor: "pointer" }}>取消</button></div>}
          </div>

          {submissions.length === 0 ? <EmptyState icon="🎉" title="沒有待審核的申請" subtitle="All caught up!" action={{ label: "查看總覽", onClick: () => setTab("overview") }} /> : (
            <div style={{ display: "grid", gap: 10 }}>
              {submissions.map(s => {
                const ft = formMeta[s.form_type]; const isSel = selectedIds.has(s.id);
                return (
                  <div key={s.id} style={{ background: isSel ? "#F5F3FF" : "white", borderRadius: 12, border: isSel ? "2px solid #7C3AED" : "1px solid #E5E7EB", padding: 18, borderLeft: `4px solid ${ft?.color||"#6B7280"}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <input type="checkbox" checked={isSel} onChange={e => toggleSelect(s.id, e as any)} style={{ width: 18, height: 18, cursor: "pointer", accentColor: "#7C3AED" }} />
                      <span style={{ fontSize: 22 }}>{ft?.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>{ft?.name_zh} — {s.submitter_name || s.submitted_by.slice(0,16)}</div>
                        <div style={{ fontSize: 11, color: "#9CA3AF" }}>{fmt(s.created_at)}{s.ai_parsed && <span style={{ marginLeft: 4, padding: "1px 5px", background: "#EDE9FE", color: "#7C3AED", borderRadius: 4, fontSize: 9, fontWeight: 600 }}>AI</span>}</div>
                      </div>
                      <button onClick={() => toggleTemplate(s.id)} style={{ fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 5, cursor: "pointer", border: "1px solid #E5E7EB", background: templateView.has(s.id) ? "#EDE9FE" : "#F9FAFB", color: templateView.has(s.id) ? "#7C3AED" : "#6B7280", flexShrink: 0 }}>
                        {templateView.has(s.id) ? "📄 一般" : "📋 表單格式"}
                      </button>
                    </div>

                    {templateView.has(s.id) ? (
                      <div style={{ marginBottom: 10 }}><FormTemplate submission={s} /></div>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 6, marginBottom: 10 }}>
                        {Object.entries(s.form_data).filter(([k]) => !k.startsWith("_")).map(([key, val]) => (
                          <div key={key} style={{ padding: "5px 8px", background: "#F9FAFB", borderRadius: 6 }}>
                            <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 600 }}>{fieldLabels[key]||key}</div>
                            <div style={{ fontSize: 13, color: "#111827", fontWeight: 500 }}>{String(val||"—")}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {s.original_text && <div style={{ fontSize: 11, color: "#6B7280", padding: "4px 8px", background: "#F5F3FF", borderRadius: 6, marginBottom: 8 }}>💬 {s.original_text}</div>}
                    <CompliancePanel result={s.compliance_result} id={s.id} expandedId={expandedCompliance} setExpandedId={setExpandedCompliance} />

                    {reviewingId === s.id ? (
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <input type="text" value={reviewNote} onChange={e => setReviewNote(e.target.value)} placeholder="備註" style={{ flex: 1, padding: "6px 10px", border: "1px solid #D1D5DB", borderRadius: 6, fontSize: 12, outline: "none", color: "#111827", background: "white" }} autoFocus />
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
          )}

          {selectedIds.size > 0 && (
            <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 50, width: "calc(100% - 48px)", maxWidth: 700, background: "white", borderRadius: 16, border: "1px solid #E5E7EB", boxShadow: "0 8px 32px rgba(0,0,0,0.12)", padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", animation: "slideIn 0.3s ease-out" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, background: "#EDE9FE", flexShrink: 0 }}>
                <div style={{ width: 18, height: 18, borderRadius: 4, background: "#7C3AED", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ color: "white", fontSize: 10, fontWeight: 800 }}>✓</span></div>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#5B21B6" }}>{selectedIds.size} 筆已選</span>
              </div>
              <input type="text" value={reviewNote} onChange={e => setReviewNote(e.target.value)} placeholder="備註（選填）" style={{ flex: 1, minWidth: 100, padding: "8px 12px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, outline: "none", color: "#111827", background: "#F9FAFB" }}
                onFocus={e => { e.currentTarget.style.borderColor="#7C3AED"; e.currentTarget.style.background="white"; }}
                onBlur={e => { e.currentTarget.style.borderColor="#E5E7EB"; e.currentTarget.style.background="#F9FAFB"; }} />
              <button onClick={() => handleBatch("approved")} style={{ padding: "8px 16px", borderRadius: 10, border: "1.5px solid #6EE7B7", background: "transparent", color: "#065F46", fontSize: 13, fontWeight: 500, cursor: "pointer", flexShrink: 0 }}
                onMouseEnter={e => { e.currentTarget.style.background="#F0FDF4"; e.currentTarget.style.borderColor="#34D399"; }}
                onMouseLeave={e => { e.currentTarget.style.background="transparent"; e.currentTarget.style.borderColor="#6EE7B7"; }}>✓ 批次核准</button>
              <button onClick={() => handleBatch("rejected")} style={{ padding: "8px 16px", borderRadius: 10, border: "1.5px solid #FCA5A5", background: "transparent", color: "#991B1B", fontSize: 13, fontWeight: 500, cursor: "pointer", flexShrink: 0 }}
                onMouseEnter={e => { e.currentTarget.style.background="#FEF2F2"; e.currentTarget.style.borderColor="#F87171"; }}
                onMouseLeave={e => { e.currentTarget.style.background="transparent"; e.currentTarget.style.borderColor="#FCA5A5"; }}>✕ 批次駁回</button>
              <button onClick={() => setSelectedIds(new Set())} style={{ padding: "8px 14px", borderRadius: 10, border: "1.5px solid #E5E7EB", background: "transparent", color: "#6B7280", fontSize: 13, fontWeight: 500, cursor: "pointer", flexShrink: 0 }}
                onMouseEnter={e => { e.currentTarget.style.background="#F9FAFB"; e.currentTarget.style.borderColor="#D1D5DB"; }}
                onMouseLeave={e => { e.currentTarget.style.background="transparent"; e.currentTarget.style.borderColor="#E5E7EB"; }}>× 取消</button>
            </div>
          )}
        </div>
      )}

      {/* ═══ EMPLOYEES ═══ */}
      {!loading && tab === "employees" && (
        <div style={{ animation: "fadeIn 0.4s" }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <input type="text" value={empSearch} onChange={e => setEmpSearch(e.target.value)} placeholder="🔍 搜尋員工姓名或 email..." style={{ flex: 1, minWidth: 200, padding: "10px 14px", border: "1px solid #D1D5DB", borderRadius: 10, fontSize: 14, outline: "none", color: "#111827" }}
              onFocus={e => e.currentTarget.style.borderColor="#7C3AED"} onBlur={e => e.currentTarget.style.borderColor="#D1D5DB"} />
            <div style={{ display: "flex", gap: 4 }}>
              {([{key:"name",label:"姓名"},{key:"pending",label:"待審"},{key:"leave",label:"請假多"},{key:"overtime",label:"加班多"}] as const).map(s => (
                <button key={s.key} onClick={() => setEmpSort(s.key)} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 12, fontWeight: 600, cursor: "pointer", background: empSort===s.key?"#7C3AED":"white", color: empSort===s.key?"white":"#6B7280" }}>{s.label}</button>
              ))}
            </div>
          </div>
          <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 10 }}>顯示 {filteredEmployees.length} / {employees.length} 位員工</div>

          {filteredEmployees.length === 0 ? <EmptyState icon="👥" title={debouncedEmpSearch ? "找不到符合的員工" : "尚無員工資料"} subtitle={debouncedEmpSearch ? "請嘗試其他關鍵字" : "員工登入後會自動建立資料"} /> : (
            <div style={{ display: "grid", gap: 10 }}>
              {filteredEmployees.map(emp => {
                const isExp = expandedEmployee === emp.user_id; const lb = emp.leave_balance;
                return (
                  <div key={emp.user_id} style={{ background: "white", borderRadius: 12, border: "1px solid #E5E7EB", overflow: "hidden" }}>
                    <div onClick={() => loadEmployeeDetail(emp.user_id)} style={{ padding: "14px 18px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                      onMouseEnter={e => e.currentTarget.style.background="#FAFAFA"} onMouseLeave={e => e.currentTarget.style.background="white"}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 38, height: 38, borderRadius: 10, background: "#EDE9FE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "#7C3AED" }}>{(emp.name||"?")[0].toUpperCase()}</div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>{emp.name || emp.user_id.slice(0,12)}</div>
                          <div style={{ fontSize: 11, color: "#9CA3AF" }}>{emp.email}</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        {emp.pending > 0 && <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: "#FEF3C7", color: "#D97706" }}>{emp.pending} 待審</span>}
                        <div style={{ display: "flex", gap: 8, fontSize: 11, color: "#6B7280" }}><span>📝{emp.leave_days_taken}天</span><span>🕐{emp.overtime_hours}hr</span></div>
                        <span style={{ fontSize: 14, color: "#9CA3AF" }}>{isExp ? "▲" : "▼"}</span>
                      </div>
                    </div>

                    {isExp && (
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
                                const rem = b.total - b.used; const pct = b.total > 0 ? Math.min((b.used/b.total)*100, 100) : 0; const isLow = b.total > 0 && rem/b.total <= 0.2;
                                return (
                                  <div key={b.label} style={{ padding: "8px 10px", background: "white", borderRadius: 8, border: "1px solid #E5E7EB" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                                      <div style={{ fontSize: 10, color: "#6B7280", fontWeight: 600 }}>{b.label}</div>
                                      <span style={{ fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: b.tagColor==="#059669"?"#D1FAE5":b.tagColor==="#D97706"?"#FEF3C7":"#FEE2E2", color: b.tagColor }}>{b.tag}</span>
                                    </div>
                                    <div style={{ height: 5, background: "#E5E7EB", borderRadius: 3, overflow: "hidden", marginBottom: 4 }}>
                                      <div style={{ height: "100%", width: `${pct}%`, background: rem<=0?"#DC2626":isLow?"#F59E0B":b.color, borderRadius: 3 }} />
                                    </div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: rem<=0?"#DC2626":"#374151" }}>{rem}<span style={{ fontWeight: 400, color: "#9CA3AF", fontSize: 10 }}>/{b.total}</span></div>
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
                              {employeeSubmissions.slice(0,10).map(s => {
                                const ft = formMeta[s.form_type]; const st = statusConfig[s.status] || statusConfig.pending;
                                return (
                                  <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#F9FAFB", borderRadius: 8, borderLeft: `3px solid ${ft?.color||"#6B7280"}` }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                      <span style={{ fontSize: 16 }}>{ft?.icon}</span>
                                      <div>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{ft?.name_zh} — {s.form_data.leave_type||s.form_data.overtime_type||s.form_data.destination||""}</div>
                                        <div style={{ fontSize: 11, color: "#9CA3AF" }}>{s.form_data.start_date||s.form_data.date||""} · {s.form_data.days?`${s.form_data.days}天`:s.form_data.hours?`${s.form_data.hours}hr`:""}</div>
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
          )}
        </div>
      )}

      {/* ═══ REQUESTS OVERVIEW ═══ */}
      {!loading && tab === "leave" && (
        <div style={{ animation: "fadeIn 0.4s" }}>

          {/* Sub-tabs */}
          <div style={{ display: "flex", gap: 0, marginBottom: 20, borderBottom: "2px solid #E5E7EB" }}>
            {([
              { key: "leave" as const, label: "📝 請假", count: allSubmissions.filter(s => s.form_type === "leave").length, color: "#7C3AED" },
              { key: "overtime" as const, label: "🕐 加班", count: allOvertime.length, color: "#2563EB" },
              { key: "business_trip" as const, label: "✈️ 出差", count: allTrips.length, color: "#059669" },
            ]).map(t => (
              <button key={t.key} onClick={() => setRequestSubTab(t.key)}
                style={{ flex: 1, padding: "10px 16px", border: "none", background: "none", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  color: requestSubTab === t.key ? t.color : "#6B7280",
                  borderBottom: requestSubTab === t.key ? "2px solid " + t.color : "2px solid transparent",
                  marginBottom: -2, transition: "all 0.15s" }}>
                {t.label}
                <span style={{ marginLeft: 6, padding: "1px 7px", borderRadius: 10, fontSize: 10, fontWeight: 700,
                  background: requestSubTab === t.key ? t.color + "15" : "#F3F4F6",
                  color: requestSubTab === t.key ? t.color : "#9CA3AF" }}>{t.count}</span>
              </button>
            ))}
          </div>

          {/* ── 請假 sub-tab ── */}
          {requestSubTab === "leave" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 20 }}>
                {[
                  { label: "全勤員工", val: leaveStats.withBalance-leaveStats.exhausted-leaveStats.lowLeave, icon: "✅", color: "#059669", bg: "#D1FAE5" },
                  { label: "餘額不足 (≤2天)", val: leaveStats.lowLeave, icon: "⚠️", color: "#D97706", bg: "#FEF3C7" },
                  { label: "特休已用盡", val: leaveStats.exhausted, icon: "🚨", color: "#DC2626", bg: "#FEE2E2" },
                  { label: "待審請假申請", val: pendingLeave.length, icon: "📋", color: "#7C3AED", bg: "#EDE9FE", onClick: () => setTab("pending") },
                ].map(s => (
                  <div key={s.label} onClick={(s as any).onClick} style={{ padding: "16px", background: s.bg, borderRadius: 12, textAlign: "center", cursor: (s as any).onClick?"pointer":"default" }}>
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
                        <div><span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{s.submitter_name}</span><span style={{ fontSize: 12, color: "#6B7280", marginLeft: 8 }}>{s.form_data.leave_type} · {s.form_data.days} 天</span></div>
                        <button onClick={() => setTab("pending")} style={{ fontSize: 11, color: "#7C3AED", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>審核 →</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <input type="text" value={leaveSearch} onChange={e => setLeaveSearch(e.target.value)} placeholder="🔍 搜尋員工..." style={{ width: "100%", padding: "10px 14px", border: "1px solid #D1D5DB", borderRadius: 10, fontSize: 14, outline: "none", marginBottom: 14, boxSizing: "border-box", color: "#111827", background: "white" }}
                onFocus={e => e.currentTarget.style.borderColor="#7C3AED"} onBlur={e => e.currentTarget.style.borderColor="#D1D5DB"} />

              {leaveOverviewEmployees.length === 0 ? <EmptyState icon="🏖️" title="尚無假期資料" subtitle="員工登入後系統會自動建立假期餘額" /> : (
                <div style={{ background: "white", borderRadius: 12, border: "1px solid #E5E7EB", overflow: "hidden" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1fr", padding: "10px 16px", background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
                    {["員工","特休 Annual","病假 Sick","事假 Personal","家庭照顧"].map((h,i) => (
                      <div key={h} style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textAlign: i===0?"left":"center" }}>{h}</div>
                    ))}
                  </div>
                  {leaveOverviewEmployees.map((emp, idx) => {
                    const lb = emp.leave_balance!; const rem = lb.annual_total-lb.annual_used;
                    const isEx = rem<=0 && lb.annual_total>0; const isLo = rem>0 && rem<=2;
                    return (
                      <div key={emp.user_id} style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1fr", padding: "12px 16px", alignItems: "center", background: isEx?"#FEF2F2":isLo?"#FFFBEB":idx%2===0?"white":"#FAFAFA", borderBottom: "1px solid #F3F4F6" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 30, height: 30, borderRadius: 8, background: isEx?"#FEE2E2":"#EDE9FE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: isEx?"#DC2626":"#7C3AED", flexShrink: 0 }}>{(emp.name||"?")[0].toUpperCase()}</div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{emp.name||emp.email}</div>
                            {isEx && <div style={{ fontSize: 10, color: "#DC2626", fontWeight: 600 }}>特休已用盡</div>}
                            {isLo && !isEx && <div style={{ fontSize: 10, color: "#D97706", fontWeight: 600 }}>餘額不足</div>}
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
                    {new Date().getFullYear()} 年度假期餘額 · 顯示 {leaveOverviewEmployees.length} 位員工
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── 加班 sub-tab ── */}
          {requestSubTab === "overtime" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
                {[
                  { label: "總加班申請", val: allOvertime.length, color: "#2563EB", bg: "#DBEAFE" },
                  { label: "已核准", val: allOvertime.filter(s => s.status === "approved").length, color: "#059669", bg: "#D1FAE5" },
                  { label: "本月加班時數", val: thisMonthOvertime, color: "#D97706", bg: "#FEF3C7" },
                ].map(s => (
                  <div key={s.label} style={{ padding: "14px", background: s.bg, borderRadius: 12, textAlign: "center" }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.val}</div>
                    <div style={{ fontSize: 11, color: s.color, opacity: 0.8, marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              {allOvertime.length === 0 ? (
                <EmptyState icon="🕐" title="尚無加班申請" subtitle="員工提交加班申請後會顯示在這裡" />
              ) : (
                <div style={{ background: "white", borderRadius: 12, border: "1px solid #E5E7EB", overflow: "hidden" }}>
                  {allOvertime.map((s, idx) => {
                    const st = statusConfig[s.status] || statusConfig.pending;
                    return (
                      <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: idx < allOvertime.length-1 ? "1px solid #F3F4F6" : "none", background: idx%2===0?"white":"#FAFAFA", borderLeft: "3px solid #2563EB" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 18 }}>🕐</span>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{s.submitter_name}</div>
                            <div style={{ fontSize: 11, color: "#6B7280" }}>
                              {s.form_data.date || s.form_data.start_date || "—"} · {s.form_data.hours ? `${s.form_data.hours} 小時` : "—"}
                              {s.form_data.overtime_type && <span style={{ marginLeft: 8, color: "#9CA3AF" }}>{s.form_data.overtime_type}</span>}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 11, color: "#6B7280" }}>{fmt(s.created_at)}</span>
                          <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: st.bg, color: st.color }}>{st.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── 出差 sub-tab ── */}
          {requestSubTab === "business_trip" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
                {[
                  { label: "總出差申請", val: allTrips.length, color: "#059669", bg: "#D1FAE5" },
                  { label: "已核准", val: allTrips.filter(s => s.status === "approved").length, color: "#059669", bg: "#D1FAE5" },
                  { label: "待審核", val: allTrips.filter(s => s.status === "pending").length, color: "#D97706", bg: "#FEF3C7" },
                ].map(s => (
                  <div key={s.label} style={{ padding: "14px", background: s.bg, borderRadius: 12, textAlign: "center" }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.val}</div>
                    <div style={{ fontSize: 11, color: s.color, opacity: 0.8, marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              {allTrips.length === 0 ? (
                <EmptyState icon="✈️" title="尚無出差申請" subtitle="員工提交出差申請後會顯示在這裡" />
              ) : (
                <div style={{ background: "white", borderRadius: 12, border: "1px solid #E5E7EB", overflow: "hidden" }}>
                  {allTrips.map((s, idx) => {
                    const st = statusConfig[s.status] || statusConfig.pending;
                    return (
                      <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: idx < allTrips.length-1 ? "1px solid #F3F4F6" : "none", background: idx%2===0?"white":"#FAFAFA", borderLeft: "3px solid #059669" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 18 }}>✈️</span>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{s.submitter_name}</div>
                            <div style={{ fontSize: 11, color: "#6B7280" }}>
                              {s.form_data.destination || "—"} · {s.form_data.start_date || "—"} → {s.form_data.end_date || "—"}
                              {s.form_data.transport && <span style={{ marginLeft: 8, color: "#9CA3AF" }}>{s.form_data.transport}</span>}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 11, color: "#6B7280" }}>{fmt(s.created_at)}</span>
                          <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: st.bg, color: st.color }}>{st.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* ═══ COMPLIANCE ═══ */}
      {!loading && tab === "compliance" && (
        <div style={{ animation: "fadeIn 0.4s" }}>
          <div style={{ background: "white", borderRadius: 12, border: "1px solid #E5E7EB", padding: 20, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 4 }}>⚖️ 合規規則資料庫</div>
                <div style={{ fontSize: 12, color: "#6B7280" }}>{complianceStatus?.total_rules||0} 條勞基法規則已載入{complianceStatus?.last_sync ? ` · 上次更新：${new Date(complianceStatus.last_sync).toLocaleDateString("zh-TW",{month:"short",day:"numeric"})}` : " · 尚未同步"}</div>
                <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>資料來源：勞動部開放資料 API（apiservice.mol.gov.tw）</div>
              </div>
              <button onClick={handleSync} disabled={syncing} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: syncing?"#D1D5DB":"#7C3AED", color: "white", fontSize: 13, fontWeight: 700, cursor: syncing?"not-allowed":"pointer" }}>{syncing?"⏳ 同步中...":"🔄 立即同步"}</button>
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

      {/* ═══ ESG S-PILLAR REPORT ═══ */}
      {!loading && tab === "esg" && (
        <div style={{ animation: "fadeIn 0.4s" }}>

          {/* Header + Export */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>🌿 ESG 社會面報告 — S-Pillar</div>
              <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>資料來源：Atlas EIP 即時工作流程與合規記錄 · 自動彙整，無需人工填報</div>
            </div>
            <button
              onClick={() => window.print()}
              style={{ padding: "8px 18px", borderRadius: 8, border: "1.5px solid #059669", background: "#F0FDF4", color: "#065F46", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
            >
              📄 匯出報告
            </button>
          </div>

          {/* Section 1: Workforce Overview */}
          <div style={{ background: "white", borderRadius: 12, border: "1px solid #E5E7EB", padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 14 }}>👥 勞動力概況 Workforce Overview</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
              {[
                { label: "全體員工數", val: employees.length, unit: "人", color: "#7C3AED", bg: "#EDE9FE" },
                { label: "本月核准申請", val: thisMonthApproved, unit: "件", color: "#2563EB", bg: "#DBEAFE" },
                { label: "本月加班時數", val: thisMonthOvertime, unit: "小時", color: "#D97706", bg: "#FEF3C7" },
                { label: "加班超標人數", val: shadowRisks.filter(r => r.risk_level === "critical").length, unit: "人", color: "#DC2626", bg: "#FEE2E2" },
              ].map(s => (
                <div key={s.label} style={{ padding: "14px 16px", background: s.bg, borderRadius: 10, textAlign: "center" }}>
                  <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.val}<span style={{ fontSize: 13, fontWeight: 600 }}> {s.unit}</span></div>
                  <div style={{ fontSize: 11, color: s.color, opacity: 0.8, marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Overtime Compliance */}
          <div style={{ background: "white", borderRadius: 12, border: "1px solid #E5E7EB", padding: 20, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>🕐 加班合規率 Overtime Compliance</div>
              <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, background: "#F0FDF4", color: "#059669", fontWeight: 700, border: "1px solid #BBF7D0" }}>依 LSA Art. 32</span>
            </div>
            {(() => {
              const total = employees.length;
              const critical = shadowRisks.filter(r => r.risk_level === "critical").length;
              const warning = shadowRisks.filter(r => r.risk_level === "warning").length;
              const compliant = Math.max(0, total - critical - warning);
              const complianceRate = total > 0 ? Math.round((compliant / total) * 100) : 100;
              return (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <div style={{ flex: 1, height: 12, background: "#F3F4F6", borderRadius: 6, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${complianceRate}%`, background: complianceRate >= 90 ? "#10B981" : complianceRate >= 70 ? "#F59E0B" : "#EF4444", borderRadius: 6, transition: "width 0.6s ease" }} />
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: complianceRate >= 90 ? "#059669" : "#D97706", minWidth: 60 }}>{complianceRate}%</div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                    {[
                      { label: "✅ 合規", val: compliant, color: "#059669", bg: "#D1FAE5" },
                      { label: "⚠️ 接近上限", val: warning, color: "#D97706", bg: "#FEF3C7" },
                      { label: "🚨 超標", val: critical, color: "#DC2626", bg: "#FEE2E2" },
                    ].map(s => (
                      <div key={s.label} style={{ padding: "10px", background: s.bg, borderRadius: 8, textAlign: "center" }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.val}</div>
                        <div style={{ fontSize: 11, color: s.color, opacity: 0.85 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Section 3: Leave Approval Rates */}
          <div style={{ background: "white", borderRadius: 12, border: "1px solid #E5E7EB", padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 14 }}>📝 請假核准率 Leave Approval Rates</div>
            {(() => {
              const leaveSubmissions = allSubmissions.filter(s => s.form_type === "leave");
              const approved = leaveSubmissions.filter(s => s.status === "approved").length;
              const total = leaveSubmissions.length;
              const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;
              const byType: Record<string, { approved: number; total: number }> = {};
              leaveSubmissions.forEach(s => {
                const t = s.form_data.leave_type || "其他";
                if (!byType[t]) byType[t] = { approved: 0, total: 0 };
                byType[t].total++;
                if (s.status === "approved") byType[t].approved++;
              });
              return (
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 14 }}>
                    {[
                      { label: "總申請數", val: total, color: "#7C3AED", bg: "#EDE9FE" },
                      { label: "已核准", val: approved, color: "#059669", bg: "#D1FAE5" },
                      { label: "核准率", val: `${approvalRate}%`, color: "#2563EB", bg: "#DBEAFE" },
                    ].map(s => (
                      <div key={s.label} style={{ padding: "12px", background: s.bg, borderRadius: 8, textAlign: "center" }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.val}</div>
                        <div style={{ fontSize: 11, color: s.color, opacity: 0.8 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                  {Object.keys(byType).length > 0 && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 8 }}>假別核准率明細</div>
                      <div style={{ display: "grid", gap: 6 }}>
                        {Object.entries(byType).map(([type, data]) => {
                          const rate = data.total > 0 ? Math.round((data.approved / data.total) * 100) : 0;
                          return (
                            <div key={type} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "#F9FAFB", borderRadius: 8 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", minWidth: 80 }}>{type}</div>
                              <div style={{ flex: 1, height: 6, background: "#E5E7EB", borderRadius: 3, overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${rate}%`, background: "#7C3AED", borderRadius: 3 }} />
                              </div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: "#7C3AED", minWidth: 40, textAlign: "right" }}>{rate}%</div>
                              <div style={{ fontSize: 11, color: "#9CA3AF", minWidth: 50, textAlign: "right" }}>{data.approved}/{data.total} 件</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Section 4: Compliance Health */}
          <div style={{ background: "white", borderRadius: 12, border: "1px solid #E5E7EB", padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 14 }}>⚖️ 合規健康度 Compliance Health</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px,1fr))", gap: 10 }}>
              {[
                { label: "勞基法規則已載入", val: complianceStatus?.total_rules || 0, unit: "條", icon: "📖", color: "#7C3AED", bg: "#EDE9FE", note: "全條文即時比對" },
                { label: "合規引擎狀態", val: complianceStatus?.status === "synced" ? "正常" : "待同步", unit: "", icon: complianceStatus?.status === "synced" ? "✅" : "⚠️", color: complianceStatus?.status === "synced" ? "#059669" : "#D97706", bg: complianceStatus?.status === "synced" ? "#D1FAE5" : "#FEF3C7", note: complianceStatus?.last_sync ? `上次同步：${new Date(complianceStatus.last_sync).toLocaleDateString("zh-TW")}` : "尚未同步" },
                { label: "加班預警人數", val: shadowRisks.length, unit: "人", icon: "🔍", color: shadowRisks.length === 0 ? "#059669" : "#DC2626", bg: shadowRisks.length === 0 ? "#D1FAE5" : "#FEE2E2", note: shadowRisks.length === 0 ? "無超標員工" : `${shadowRisks.filter(r => r.risk_level === "critical").length} 人超標` },
              ].map(s => (
                <div key={s.label} style={{ padding: "16px", background: s.bg, borderRadius: 10 }}>
                  <div style={{ fontSize: 20, marginBottom: 6 }}>{s.icon}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.val}<span style={{ fontSize: 13, fontWeight: 600 }}> {s.unit}</span></div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: s.color, marginTop: 2 }}>{s.label}</div>
                  <div style={{ fontSize: 10, color: s.color, opacity: 0.7, marginTop: 4 }}>{s.note}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 5: Audit Trail */}
          <div style={{ background: "#F0FDF4", borderRadius: 12, border: "1px solid #BBF7D0", padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#065F46", marginBottom: 8 }}>🔒 資料可稽核性聲明 Audit Trail</div>
            <div style={{ fontSize: 12, color: "#065F46", lineHeight: 1.8 }}>
              本報告所有數據均源自 Atlas EIP 系統內的即時結構化記錄，包含：工作流程申請記錄（workflow_submissions）、員工假期餘額（leave_balances）、加班監控記錄（shadow_audit_logs）及合規掃描結果（compliance_checks）。每筆資料均附有時間戳記與操作人員資訊，可供內部稽核或外部查核使用。
              <br /><br />
              <strong>注意：</strong>本報告由 Atlas EIP 自動彙整產出，企業對報告內容之準確性與法律責任負最終責任。
            </div>
          </div>

          {/* Footer */}
          <div style={{ padding: "12px 16px", background: "#F9FAFB", borderRadius: 8, border: "1px solid #E5E7EB", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontSize: 11, color: "#9CA3AF" }}>
              報告產生時間：{new Date().toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })} · 由 Atlas EIP 自動產出
            </div>
            <div style={{ fontSize: 11, color: "#9CA3AF" }}>PrimeStride AI · primestrideatlas.com</div>
          </div>

        </div>
      )}

    </div>
  );
}
