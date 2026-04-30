"use client";

// src/app/admin/payroll/page.tsx
//
// Atlas EIP — Admin Payroll Page
// ──────────────────────────────────────────────────────────────────────
// Phase 3f early implementation.
//
// Two-panel layout:
//   1. Preview / Run panel: pick year/month → click Preview → see results
//      → optionally click "Confirm & Save" to persist
//   2. History panel: list of past persisted runs

import { useState, useEffect } from "react";

// ── Types (mirror the API response shape) ────────────────────────────

type LeaveOccurrence = {
  source_workflow_submission_id: string;
  leave_type_raw: string;
  days_in_period: number;
  effective_start: string;
  canonical_key: string | null;
  deduction_amount: number;
  treatment_kind: string | null;
  calculation_detail: string | null;
  notes: string[];
  filtered: boolean;
};

type EmployeeResult = {
  user_id: string;
  full_name: string;
  total_leave_deduction_amount: number;
  total_unpaid_leave_days: number;
  total_half_pay_leave_days: number;
  total_full_pay_leave_days: number;
  attendance_bonus: {
    original: number;
    deduction: number;
    net: number;
  };
  leave_occurrence_count: number;
  warning_count: number;
  warnings: string[];
  leave_occurrences: LeaveOccurrence[];
};

type RunResult = {
  mode: "preview" | "persist";
  organization_id: string;
  period_year: number;
  period_month: number;
  calculator_version: string;
  compute_time_ms: number;
  summary: {
    employee_count: number;
    total_leave_deduction_amount: number;
    total_attendance_bonus_deduction: number;
    run_warnings_count: number;
  };
  run_warnings: string[];
  employees: EmployeeResult[];
  persisted_run_id: string | null;
  superseded_run_id: string | null;
  line_items_written: number;
};

type PastRun = {
  id: string;
  period_year: number;
  period_month: number;
  calculator_version: string;
  triggered_by_name: string | null;
  started_at: string;
  completed_at: string;
  compute_time_ms: number | null;
  superseded_at: string | null;
  total_employees: number;
  total_leave_deduction_amount: number;
  total_attendance_bonus_deduction: number;
  run_warnings_count: number;
  created_at: string;
};

// ── Page component ──────────────────────────────────────────────────

export default function PayrollAdminPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [pastRuns, setPastRuns] = useState<PastRun[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // ── Load past runs ────────────────────────────────────────────────
  async function loadHistory() {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/admin/payroll/runs?limit=12");
      const data = await res.json();
      if (data.runs) setPastRuns(data.runs);
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setLoadingHistory(false);
    }
  }

  useEffect(() => {
    loadHistory();
  }, []);

  // ── Run preview ───────────────────────────────────────────────────
  async function handlePreview() {
    setPreviewing(true);
    setError(null);
    setResult(null);
    setExpandedUserId(null);
    try {
      const res = await fetch("/api/admin/payroll/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period_year: year,
          period_month: month,
          mode: "preview",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to compute payroll");
      } else {
        setResult(data);
      }
    } catch (err: any) {
      setError(err.message ?? "Network error");
    } finally {
      setPreviewing(false);
    }
  }

  // ── Confirm & save ────────────────────────────────────────────────
  async function handlePersist() {
    if (!result) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/payroll/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period_year: year,
          period_month: month,
          mode: "persist",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save payroll");
      } else {
        setResult(data);
        loadHistory();
      }
    } catch (err: any) {
      setError(err.message ?? "Network error");
    } finally {
      setSaving(false);
    }
  }

  // ── Reset ──
  function handleReset() {
    setResult(null);
    setExpandedUserId(null);
    setError(null);
  }

  const monthNames = [
    "1月", "2月", "3月", "4月", "5月", "6月",
    "7月", "8月", "9月", "10月", "11月", "12月",
  ];
  const yearOptions: number[] = [];
  for (let y = now.getFullYear() - 2; y <= now.getFullYear() + 1; y++) {
    yearOptions.push(y);
  }

  const isPersisted = result?.mode === "persist";

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "24px 20px", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111827", margin: 0 }}>
          薪資計算 Payroll
        </h1>
        <p style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>
          Preview leave deductions and attendance bonus calculations for any period.
          Confirm & save persists the run for audit trail.
        </p>
      </div>

      {/* Period selector + run controls */}
      <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 4 }}>年度</label>
            <select
              value={year}
              onChange={(e) => { setYear(Number(e.target.value)); handleReset(); }}
              disabled={previewing || saving}
              style={{ padding: "8px 12px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 14, background: "white", outline: "none", minWidth: 100 }}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 4 }}>月份</label>
            <select
              value={month}
              onChange={(e) => { setMonth(Number(e.target.value)); handleReset(); }}
              disabled={previewing || saving}
              style={{ padding: "8px 12px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 14, background: "white", outline: "none", minWidth: 100 }}
            >
              {monthNames.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }} />
          <button
            onClick={handlePreview}
            disabled={previewing || saving}
            style={{
              padding: "10px 20px",
              background: previewing ? "#9CA3AF" : "#2563EB",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: previewing ? "not-allowed" : "pointer",
              minWidth: 140,
            }}
          >
            {previewing ? "計算中..." : "預覽 Preview"}
          </button>
          {result && !isPersisted && (
            <button
              onClick={handlePersist}
              disabled={saving}
              style={{
                padding: "10px 20px",
                background: saving ? "#9CA3AF" : "#059669",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: saving ? "not-allowed" : "pointer",
                minWidth: 160,
              }}
            >
              {saving ? "儲存中..." : "確認並儲存 Confirm & Save"}
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: "#FEE2E2", border: "1px solid #FCA5A5", color: "#991B1B", padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Persisted confirmation */}
      {result && isPersisted && (
        <div style={{ background: "#D1FAE5", border: "1px solid #86EFAC", color: "#065F46", padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          ✅ 薪資計算已儲存 — Run ID: <code style={{ fontFamily: "monospace", fontSize: 12 }}>{result.persisted_run_id}</code>
          {result.superseded_run_id && (
            <span style={{ marginLeft: 8 }}>
              (取代先前運行 {result.superseded_run_id?.slice(0, 8)}...)
            </span>
          )}
          {" — "}
          {result.line_items_written} 筆明細已寫入
        </div>
      )}

      {/* Result summary */}
      {result && (
        <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 12, marginBottom: 16, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #E5E7EB", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>
                {result.period_year} 年 {result.period_month} 月
                {!isPersisted && <span style={{ marginLeft: 8, padding: "2px 8px", background: "#FEF3C7", color: "#92400E", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>預覽 PREVIEW</span>}
              </div>
              <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
                Calculator: {result.calculator_version} · {result.compute_time_ms}ms · {result.summary.employee_count} employees
              </div>
            </div>
            <div style={{ display: "flex", gap: 16 }}>
              <SummaryCard label="員工數" value={String(result.summary.employee_count)} />
              <SummaryCard label="假別扣款合計" value={`NT$ ${result.summary.total_leave_deduction_amount.toLocaleString()}`} />
              <SummaryCard label="全勤獎金扣款" value={`NT$ ${result.summary.total_attendance_bonus_deduction.toLocaleString()}`} />
              {result.summary.run_warnings_count > 0 && (
                <SummaryCard label="運行警告" value={String(result.summary.run_warnings_count)} highlight />
              )}
            </div>
          </div>

          {/* Run-level warnings */}
          {result.run_warnings.length > 0 && (
            <div style={{ padding: "12px 20px", background: "#FEF3C7", borderBottom: "1px solid #FCD34D" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#92400E", marginBottom: 6 }}>運行警告 Run Warnings</div>
              {result.run_warnings.map((w, i) => (
                <div key={i} style={{ fontSize: 12, color: "#92400E", marginBottom: 3, fontFamily: "monospace" }}>
                  • {w}
                </div>
              ))}
            </div>
          )}

          {/* Employees table */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
                  <th style={thStyle}>員工</th>
                  <th style={thStyle}>請假筆數</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>假別扣款</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>全勤獎金 (淨)</th>
                  <th style={thStyle}>警告</th>
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {result.employees.map((emp) => (
                  <EmployeeRow
                    key={emp.user_id}
                    emp={emp}
                    expanded={expandedUserId === emp.user_id}
                    onToggle={() =>
                      setExpandedUserId(
                        expandedUserId === emp.user_id ? null : emp.user_id,
                      )
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* History */}
      <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #E5E7EB", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>歷史記錄 History</div>
          <button
            onClick={loadHistory}
            disabled={loadingHistory}
            style={{ fontSize: 12, color: "#6B7280", background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
          >
            {loadingHistory ? "載入中..." : "↻ 重新整理"}
          </button>
        </div>
        {pastRuns.length === 0 && !loadingHistory && (
          <div style={{ padding: 24, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
            尚無已儲存的薪資計算 — Click "Preview" then "Confirm & Save" to create the first run.
          </div>
        )}
        {pastRuns.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
                  <th style={thStyle}>期間</th>
                  <th style={thStyle}>計算機版本</th>
                  <th style={thStyle}>觸發者</th>
                  <th style={thStyle}>員工數</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>扣款合計</th>
                  <th style={thStyle}>儲存時間</th>
                </tr>
              </thead>
              <tbody>
                {pastRuns.map((r) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                    <td style={tdStyle}>
                      {r.period_year}/{String(r.period_month).padStart(2, "0")}
                    </td>
                    <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 12 }}>{r.calculator_version}</td>
                    <td style={tdStyle}>{r.triggered_by_name ?? "—"}</td>
                    <td style={tdStyle}>{r.total_employees}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      NT$ {(Number(r.total_leave_deduction_amount) + Number(r.total_attendance_bonus_deduction)).toLocaleString()}
                    </td>
                    <td style={{ ...tdStyle, fontSize: 12, color: "#6B7280" }}>
                      {new Date(r.completed_at).toLocaleString("zh-TW", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div style={{ padding: "8px 16px", borderRadius: 8, background: highlight ? "#FEF3C7" : "#F3F4F6", textAlign: "right" }}>
      <div style={{ fontSize: 11, color: highlight ? "#92400E" : "#6B7280", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 14, color: "#111827", fontWeight: 700, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function EmployeeRow({
  emp,
  expanded,
  onToggle,
}: {
  emp: EmployeeResult;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        style={{
          borderBottom: "1px solid #F3F4F6",
          cursor: "pointer",
          background: expanded ? "#F9FAFB" : "white",
        }}
      >
        <td style={tdStyle}>
          <div style={{ fontWeight: 600, color: "#111827", fontSize: 13 }}>{emp.full_name}</div>
          <div style={{ fontFamily: "monospace", fontSize: 10, color: "#9CA3AF" }}>{emp.user_id}</div>
        </td>
        <td style={tdStyle}>{emp.leave_occurrence_count}</td>
        <td style={{ ...tdStyle, textAlign: "right" }}>
          {emp.total_leave_deduction_amount > 0
            ? `NT$ ${emp.total_leave_deduction_amount.toLocaleString()}`
            : "—"}
        </td>
        <td style={{ ...tdStyle, textAlign: "right" }}>
          {emp.attendance_bonus.original > 0 ? (
            <>
              <span style={{ color: emp.attendance_bonus.deduction > 0 ? "#DC2626" : "#059669" }}>
                NT$ {emp.attendance_bonus.net.toLocaleString()}
              </span>
              {emp.attendance_bonus.deduction > 0 && (
                <span style={{ fontSize: 11, color: "#9CA3AF", marginLeft: 4 }}>
                  / {emp.attendance_bonus.original.toLocaleString()}
                </span>
              )}
            </>
          ) : "—"}
        </td>
        <td style={tdStyle}>
          {emp.warning_count > 0 ? (
            <span style={{ padding: "2px 8px", background: "#FEF3C7", color: "#92400E", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
              {emp.warning_count}
            </span>
          ) : "—"}
        </td>
        <td style={{ ...tdStyle, color: "#9CA3AF", fontSize: 12 }}>{expanded ? "▾" : "▸"}</td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} style={{ padding: 0, background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
            <div style={{ padding: 16 }}>
              {/* Per-employee warnings */}
              {emp.warnings.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#92400E", marginBottom: 4 }}>警告</div>
                  {emp.warnings.map((w, i) => (
                    <div key={i} style={{ fontSize: 11, color: "#92400E", marginBottom: 2, fontFamily: "monospace" }}>
                      • {w}
                    </div>
                  ))}
                </div>
              )}
              {/* Leave occurrences */}
              {emp.leave_occurrences.length > 0 ? (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 6 }}>請假明細</div>
                  <table style={{ width: "100%", borderCollapse: "collapse", background: "white", borderRadius: 6, overflow: "hidden" }}>
                    <thead>
                      <tr style={{ background: "#F3F4F6" }}>
                        <th style={subThStyle}>日期</th>
                        <th style={subThStyle}>假別</th>
                        <th style={subThStyle}>天數</th>
                        <th style={subThStyle}>處理方式</th>
                        <th style={{ ...subThStyle, textAlign: "right" }}>扣款</th>
                        <th style={subThStyle}>說明</th>
                      </tr>
                    </thead>
                    <tbody>
                      {emp.leave_occurrences.map((o) => (
                        <tr key={o.source_workflow_submission_id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                          <td style={subTdStyle}>{String(o.effective_start).slice(0, 10)}</td>
                          <td style={subTdStyle}>{o.leave_type_raw}</td>
                          <td style={subTdStyle}>{o.days_in_period}</td>
                          <td style={subTdStyle}>
                            {o.filtered ? (
                              <span style={{ color: "#9CA3AF" }}>(filtered)</span>
                            ) : (
                              o.treatment_kind ?? "—"
                            )}
                          </td>
                          <td style={{ ...subTdStyle, textAlign: "right" }}>
                            {o.deduction_amount > 0 ? `NT$ ${o.deduction_amount.toLocaleString()}` : "—"}
                          </td>
                          <td style={{ ...subTdStyle, fontSize: 11, color: "#6B7280" }}>
                            {o.calculation_detail ?? ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: "#9CA3AF", fontStyle: "italic" }}>本期無請假紀錄</div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Inline styles (matches WorkflowsPage.tsx pattern) ────────────────

const thStyle: React.CSSProperties = {
  padding: "10px 16px",
  textAlign: "left",
  fontSize: 11,
  fontWeight: 700,
  color: "#6B7280",
  textTransform: "uppercase",
  letterSpacing: 0.4,
};

const tdStyle: React.CSSProperties = {
  padding: "10px 16px",
  fontSize: 13,
  color: "#374151",
  verticalAlign: "top",
};

const subThStyle: React.CSSProperties = {
  padding: "6px 10px",
  textAlign: "left",
  fontSize: 10,
  fontWeight: 700,
  color: "#9CA3AF",
  textTransform: "uppercase",
};

const subTdStyle: React.CSSProperties = {
  padding: "6px 10px",
  fontSize: 12,
  color: "#374151",
  verticalAlign: "top",
};
