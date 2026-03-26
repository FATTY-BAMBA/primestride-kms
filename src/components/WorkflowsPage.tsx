"use client";

import { useState, useEffect } from "react";
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
  leave:         { icon: "📝", name_zh: "請假申請", name_en: "Leave Request",    color: "#7C3AED" },
  overtime:      { icon: "🕐", name_zh: "加班申請", name_en: "Overtime Request", color: "#D97706" },
  business_trip: { icon: "✈️", name_zh: "出差申請", name_en: "Business Trip",    color: "#059669" },
};

const fieldLabels: Record<string, string> = {
  leave_type: "假別", start_date: "開始日期", end_date: "結束日期",
  days: "天數", hours_requested: "請假時數", duration_type: "請假方式",
  reason: "事由", proxy: "職務代理人",
  date: "日期", start_time: "開始時間", end_time: "結束時間",
  hours: "時數", overtime_type: "加班類別", project: "專案",
  destination: "地點", purpose: "目的",
  transport: "交通", budget: "預估費用", accommodation: "住宿",
};

const durationLabels: Record<string, string> = {
  full_day: "全天", half_day_am: "上午半天", half_day_pm: "下午半天", hourly: "按小時",
};

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: "待審核", color: "#D97706", bg: "#FEF3C7" },
  approved:  { label: "已核准", color: "#059669", bg: "#D1FAE5" },
  rejected:  { label: "已駁回", color: "#DC2626", bg: "#FEE2E2" },
  cancelled: { label: "已取消", color: "#6B7280", bg: "#F3F4F6" },
};

const SHOW_PASS_TYPES = ["sick_leave_bonus_prorata", "family_care_hourly_2026", "overtime_pay_estimate", "attendance_bonus_protection", "quarterly_overtime_cap"];
const SHOW_PASS_TYPES_CARD = ["sick_leave_bonus_prorata", "family_care_hourly_2026", "attendance_bonus_protection"];

const quickHints = [
  { icon: "📝", label: "請假", text: "我下週一到週三要請特休，回南部探親" },
  { icon: "🕐", label: "加班", text: "今晚加班到九點，趕客戶報告" },
  { icon: "✈️", label: "出差", text: "下週二到週四去高雄出差，搭高鐵" },
];

type TypeFilter = "all" | "leave" | "overtime" | "business_trip";

function ComplianceSummary({ result, expanded, onToggle }: {
  result: Submission["compliance_result"];
  expanded: boolean;
  onToggle: () => void;
}) {
  if (!result) return null;
  const nonPass = result.checks.filter(c => c.status !== "pass");
  const keyPass = result.checks.filter(c => c.status === "pass" && SHOW_PASS_TYPES_CARD.includes(c.check_type));

  const statusColor = result.status === "blocked" ? "#DC2626" : result.status === "warning" ? "#D97706" : "#059669";
  const statusBg = result.status === "blocked" ? "#FEE2E2" : result.status === "warning" ? "#FEF3C7" : "#D1FAE5";
  const statusIcon = result.status === "blocked" ? "🚫" : result.status === "warning" ? "⚠️" : "✅";
  const statusLabel = result.status === "blocked" ? "合規未通過" : result.status === "warning" ? "合規提醒" : "合規通過";

  return (
    <div style={{ marginBottom: 8 }}>
      <button
        onClick={onToggle}
        style={{
          display: "flex", alignItems: "center", gap: 6, padding: "4px 10px",
          borderRadius: 6, border: `1px solid ${statusColor}30`,
          background: statusBg, cursor: "pointer",
          fontSize: 11, fontWeight: 600, color: statusColor,
        }}
      >
        <span>{statusIcon}</span>
        <span>{statusLabel}</span>
        {(nonPass.length > 0 || keyPass.length > 0) && (
          <span style={{ marginLeft: 2, opacity: 0.6 }}>{expanded ? "▲" : "▼"}</span>
        )}
      </button>

      {expanded && (nonPass.length > 0 || keyPass.length > 0) && (
        <div style={{ marginTop: 6, padding: "8px 10px", borderRadius: 8, background: "#F9FAFB", border: "1px solid #E5E7EB" }}>
          {nonPass.map((c, i) => (
            <div key={i} style={{ display: "flex", gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 9, color: c.status === "blocked" ? "#DC2626" : "#D97706", marginTop: 2 }}>
                {c.status === "blocked" ? "✕" : "!"}
              </span>
              <div>
                <div style={{ fontSize: 11, color: "#374151" }}>{c.message_zh}</div>
                <div style={{ fontSize: 10, color: "#9CA3AF" }}>📖 {c.rule_reference}</div>
              </div>
            </div>
          ))}
          {keyPass.map((c, i) => (
            <div key={i} style={{ display: "flex", gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 9, color: "#059669", marginTop: 2 }}>✓</span>
              <div style={{ fontSize: 11, color: "#065F46" }}>{c.message_zh}</div>
            </div>
          ))}
          {result.ai_analysis_zh && (
            <div style={{ fontSize: 10, color: "#6B7280", marginTop: 4 }}>🤖 {result.ai_analysis_zh}</div>
          )}
        </div>
      )}
    </div>
  );
}

// NEW: RecordRow Component for improved collapsible design
function RecordRow({ 
  submission, 
  isExpanded, 
  onToggle, 
  isAdmin, 
  isSelected, 
  onSelect,
  onCancel,
  onReview,
  reviewingId,
  setReviewingId,
  reviewNote,
  setReviewNote,
  expandedCompliance,
  onToggleCompliance,
  onExportPdf,
  showTemplate,
  onToggleTemplate,
}: {
  submission: Submission;
  isExpanded: boolean;
  onToggle: () => void;
  isAdmin: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onCancel: (id: string) => void;
  onReview: (id: string, action: string) => void;
  reviewingId: string | null;
  setReviewingId: (id: string | null) => void;
  reviewNote: string;
  setReviewNote: (note: string) => void;
  expandedCompliance: Set<string>;
  onToggleCompliance: (id: string) => void;
  onExportPdf: (s: Submission) => void;
  showTemplate: boolean;
  onToggleTemplate: () => void;
}) {
  const ft = formMeta[submission.form_type];
  const st = statusConfig[submission.status] || statusConfig.pending;
  const isReviewing = reviewingId === submission.id;

  const getCompactTitle = () => {
    const data = submission.form_data;
    if (submission.form_type === 'leave') {
      return `${data.leave_type || '請假'} · ${data.days || 1}天`;
    }
    if (submission.form_type === 'overtime') {
      return `${data.overtime_type || '加班'} · ${data.hours || 1}小時`;
    }
    if (submission.form_type === 'business_trip') {
      return `出差 · ${data.days || 1}天${data.destination ? ` · ${data.destination}` : ''}`;
    }
    return ft?.name_zh || submission.form_type;
  };

  const getDateDisplay = () => {
    const data = submission.form_data;
    if (data.start_date && data.end_date && data.start_date !== data.end_date) {
      const start = new Date(data.start_date);
      const end = new Date(data.end_date);
      return `${start.getMonth() + 1}月${start.getDate()}日 → ${end.getMonth() + 1}月${end.getDate()}日`;
    }
    const date = new Date(data.start_date || data.date || submission.created_at);
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  };

  const typeStyles = {
    leave: { borderLeft: '4px solid #7C3AED', iconBg: '#EDE9FE' },
    overtime: { borderLeft: '4px solid #2563EB', iconBg: '#DBEAFE' },
    business_trip: { borderLeft: '4px solid #059669', iconBg: '#D1FAE5' },
  };
  const style = typeStyles[submission.form_type as keyof typeof typeStyles] || typeStyles.leave;

  return (
    <div 
      style={{
        background: isSelected ? '#F5F3FF' : 'white',
        borderRadius: 12,
        border: '1px solid #E5E7EB',
        borderLeft: style.borderLeft,
        marginBottom: 8,
        overflow: 'hidden',
        transition: 'all 0.2s ease',
        boxShadow: isExpanded ? '0 4px 12px rgba(0,0,0,0.05)' : 'none',
      }}
    >
      {/* Collapsed Header Row */}
      <div 
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '14px 16px',
          cursor: 'pointer',
          gap: 12,
        }}
      >
        {isAdmin && submission.status === 'pending' && (
          <input 
            type="checkbox" 
            checked={isSelected} 
            onChange={(e) => { e.stopPropagation(); onSelect(); }}
            style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#7C3AED' }}
          />
        )}

        <div style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: style.iconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          flexShrink: 0,
        }}>
          {ft?.icon}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>
              {getCompactTitle()}
            </span>
            {submission.ai_parsed && (
              <span style={{
                padding: '1px 5px',
                background: '#EDE9FE',
                color: '#7C3AED',
                borderRadius: 4,
                fontSize: 9,
                fontWeight: 700,
              }}>AI</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              {getDateDisplay()}
            </span>
            {submission.original_text && (
              <span style={{
                fontSize: 11,
                color: '#9CA3AF',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 200,
              }}>
                {submission.original_text}
              </span>
            )}
          </div>
        </div>

        <span style={{
          padding: '4px 12px',
          borderRadius: 20,
          fontSize: 11,
          fontWeight: 700,
          background: st.bg,
          color: st.color,
          flexShrink: 0,
        }}>
          {st.label}
        </span>

        <div style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: 10,
          fontWeight: 700,
          flexShrink: 0,
        }}>
          {submission.submitter_name?.charAt(0) || 'U'}
        </div>

        <div style={{
          width: 24,
          height: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s ease',
          color: '#9CA3AF',
          flexShrink: 0,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div style={{
          padding: '0 16px 16px 64px',
          background: '#FAFAFA',
          borderTop: '1px solid #F3F4F6',
        }}>
          {/* Detail Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 12,
            padding: '16px 0',
          }}>
            {Object.entries(submission.form_data)
              .filter(([k]) => !k.startsWith('_') && fieldLabels[k])
              .map(([key, value]) => (
                <div key={key}>
                  <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {fieldLabels[key]}
                  </div>
                  <div style={{ fontSize: 13, color: '#111827', fontWeight: 500, marginTop: 2 }}>
                    {String(value || '—')}
                  </div>
                </div>
              ))}
          </div>

          {/* Original Text Quote */}
          {submission.original_text && (
            <div style={{
              padding: '8px 12px',
              background: 'white',
              borderRadius: 8,
              border: '1px solid #E5E7EB',
              fontSize: 12,
              color: '#6B7280',
              fontStyle: 'italic',
              marginBottom: 12,
            }}>
              💬 "{submission.original_text}"
            </div>
          )}

          {/* Compliance Section */}
          {submission.compliance_result && (
            <div style={{ marginBottom: 12 }}>
              <ComplianceSummary 
                result={submission.compliance_result}
                expanded={expandedCompliance.has(submission.id)}
                onToggle={() => onToggleCompliance(submission.id)}
              />
            </div>
          )}

          {/* Reviewer Info */}
          {submission.reviewed_at && (
            <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 12 }}>
              審核：{submission.reviewer_name || submission.reviewed_by} · {new Date(submission.reviewed_at).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              {submission.review_note && ` · ${submission.review_note}`}
            </div>
          )}

          {/* Action Bar */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={(e) => { e.stopPropagation(); onToggleTemplate(); }}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid #E5E7EB',
                background: showTemplate ? '#EDE9FE' : 'white',
                fontSize: 12,
                fontWeight: 600,
                color: showTemplate ? '#7C3AED' : '#6B7280',
                cursor: 'pointer',
              }}
            >
              {showTemplate ? '📄 收起表單' : '📋 表單格式'}
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); onExportPdf(submission); }}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid #E5E7EB',
                background: 'white',
                fontSize: 12,
                fontWeight: 600,
                color: '#6B7280',
                cursor: 'pointer',
              }}
            >
              📥 匯出 PDF
            </button>

            {submission.status === 'pending' && (
              <button
                onClick={(e) => { e.stopPropagation(); onCancel(submission.id); }}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: '1px solid #FCA5A5',
                  background: 'white',
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#DC2626',
                  cursor: 'pointer',
                  marginLeft: 'auto',
                }}
              >
                🚫 取消申請
              </button>
            )}

            {isAdmin && submission.status === 'pending' && (
              isReviewing ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1 }}>
                  <input
                    type="text"
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    placeholder="備註"
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      border: '1px solid #D1D5DB',
                      borderRadius: 6,
                      fontSize: 12,
                      outline: 'none',
                    }}
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); onReview(submission.id, 'approved'); }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 6,
                      border: 'none',
                      background: '#059669',
                      color: 'white',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    ✅ 核准
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onReview(submission.id, 'rejected'); }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 6,
                      border: 'none',
                      background: '#DC2626',
                      color: 'white',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    ❌ 駁回
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setReviewingId(null); }}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: '1px solid #D1D5DB',
                      background: 'white',
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    取消
                  </button>
                </div>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); setReviewingId(submission.id); }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: '1px solid #7C3AED',
                    background: '#EDE9FE',
                    color: '#7C3AED',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  📋 審核
                </button>
              )
            )}
          </div>

          {/* Form Template View */}
          {showTemplate && (
            <div style={{ marginTop: 12 }}>
              <FormTemplate submission={submission} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function WorkflowsPage() {
  const [nlpInput, setNlpInput] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsedType, setParsedType] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, any> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [showEditMode, setShowEditMode] = useState(false);
  const [compliance, setCompliance] = useState<ComplianceResult | null>(null);
  const [checkingCompliance, setCheckingCompliance] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [reviewNote, setReviewNote] = useState("");
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({ pending: 0, approved_this_month: 0, rejected_this_month: 0, total_this_month: 0 });
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalance | null>(null);
  const [leaveBalanceExpanded, setLeaveBalanceExpanded] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // NEW: State for expanded rows and template view
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [templateView, setTemplateView] = useState<Set<string>>(new Set());
  const [expandedCompliance, setExpandedCompliance] = useState<Set<string>>(new Set());

  // NEW: Toggle functions
  const toggleExpand = (id: string) => {
    const newSet = new Set(expandedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedIds(newSet);
  };

  const toggleTemplate = (id: string) => {
    const newSet = new Set(templateView);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setTemplateView(newSet);
  };

  const toggleCompliance = (id: string) => {
    const newSet = new Set(expandedCompliance);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedCompliance(newSet);
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const fetchSubmissions = async () => {
    try {
      let url = `/api/workflows?view=my`;
      if (statusFilter) url += `&status=${statusFilter}`;
      const res = await fetch(url);
      const data = await res.json();
      setSubmissions(data.submissions || []);
      setIsAdmin(data.isAdmin || false);
      if (data.stats) setStats(data.stats);
      if (data.leave_balance) setLeaveBalance(data.leave_balance);
    } catch {
      setMessage("⚠️ 無法載入申請紀錄，請重新整理頁面。");
      setTimeout(() => setMessage(""), 5000);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchSubmissions(); }, [statusFilter]);

  const handleParse = async () => {
    if (!nlpInput.trim()) return;
    setParsing(true); setFormData(null); setParsedType(null); setCompliance(null); setShowEditMode(false);
    try {
      const res = await fetch("/api/workflows/parse", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: nlpInput, form_type: "auto" }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setMessage(`⚠️ ${data.error || "AI 解析失敗，請再試一次。"}`);
        setTimeout(() => setMessage(""), 5000); return;
      }
      if (data.form_data) { setFormData(data.form_data); setParsedType(data.form_type || "leave"); }
    } catch {
      setMessage("⚠️ AI 解析失敗，請再試一次。");
      setTimeout(() => setMessage(""), 5000);
    } finally { setParsing(false); }
  };

  const runComplianceCheck = async () => {
    if (!formData || !parsedType) return;
    setCheckingCompliance(true); setCompliance(null);
    try {
      const res = await fetch("/api/compliance/check", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form_type: parsedType, form_data: formData }),
      });
      const data = await res.json();
      if (data.data) setCompliance(data.data);
    } catch { setCompliance({ status: "pass", checks: [] }); }
    finally { setCheckingCompliance(false); }
  };

  useEffect(() => {
    if (formData && parsedType) {
      const t = setTimeout(() => runComplianceCheck(), 400);
      return () => clearTimeout(t);
    }
  }, [formData, parsedType]);

  const handleSubmit = async () => {
    if (!formData || !parsedType) return;
    if (compliance?.status === "blocked") {
      setMessage("🚫 合規檢查未通過，請調整內容。");
      setTimeout(() => setMessage(""), 4000); return;
    }
    setSubmitting(true);
    try {
      let complianceToSave = compliance;
      if (!complianceToSave && !checkingCompliance) {
        try {
          const cRes = await fetch("/api/compliance/check", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ form_type: parsedType, form_data: formData }),
          });
          const cData = await cRes.json();
          complianceToSave = cData.data || { status: "pass", checks: [] };
          setCompliance(complianceToSave);
        } catch { complianceToSave = { status: "pass", checks: [] }; }
      }
      const res = await fetch("/api/workflows", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form_type: parsedType, form_data: formData, original_text: nlpInput, ai_parsed: true, compliance_result: complianceToSave || null }),
      });
      if (res.ok) {
        setMessage("✅ 已送出！");
        setNlpInput(""); setFormData(null); setParsedType(null); setCompliance(null);
        fetchSubmissions();
        setTimeout(() => setMessage(""), 3000);
      } else {
        const errData = await res.json().catch(() => ({}));
        setMessage(`❌ ${errData.error || "送出失敗，請再試一次。"}`);
        setTimeout(() => setMessage(""), 5000);
      }
    } catch {
      setMessage("❌ 送出失敗，請再試一次。");
      setTimeout(() => setMessage(""), 5000);
    } finally { setSubmitting(false); }
  };

  const handleReview = async (id: string, action: string) => {
    try {
      await fetch("/api/workflows", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action, review_note: reviewNote }) });
      setReviewingId(null); setReviewNote(""); fetchSubmissions();
    } catch { setMessage("⚠️ 審核操作失敗。"); setTimeout(() => setMessage(""), 4000); }
  };

  const handleCancel = async (id: string) => {
    try {
      await fetch("/api/workflows", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action: "cancelled" }) });
      fetchSubmissions();
    } catch { setMessage("⚠️ 取消失敗。"); setTimeout(() => setMessage(""), 4000); }
  };

  const handleBatchApproval = async (action: string) => {
    try {
      await fetch("/api/workflows", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: Array.from(selectedIds), action, review_note: reviewNote }) });
      setSelectedIds(new Set()); setReviewNote(""); fetchSubmissions();
    } catch { setMessage("⚠️ 批次操作失敗。"); setTimeout(() => setMessage(""), 4000); }
  };

  const exportPdf = (s: Submission) => {
    const ft = formMeta[s.form_type];
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${ft?.name_zh || s.form_type}</title><style>body{font-family:'Noto Sans TC',sans-serif;max-width:600px;margin:40px auto;padding:20px;color:#111827}h1{font-size:22px;border-bottom:3px solid ${ft?.color || "#7C3AED"};padding-bottom:12px}.field{display:flex;padding:8px 0;border-bottom:1px solid #eee}.field-label{width:140px;color:#6B7280;font-weight:600;font-size:14px}.field-val{flex:1;font-size:14px}.status{display:inline-block;padding:4px 12px;border-radius:6px;font-size:13px;font-weight:600;margin-top:16px;background:${statusConfig[s.status]?.bg};color:${statusConfig[s.status]?.color}}</style></head><body>`);
    w.document.write(`<h1>${ft?.icon} ${ft?.name_zh} ${ft?.name_en}</h1>`);
    Object.entries(s.form_data).forEach(([k, v]) => w.document.write(`<div class="field"><div class="field-label">${fieldLabels[k] || k}</div><div class="field-val">${v || "—"}</div></div>`));
    w.document.write(`<div class="status">${statusConfig[s.status]?.label}</div>`);
    if (s.original_text) w.document.write(`<p style="margin-top:16px;font-size:12px;color:#9CA3AF">💬 ${s.original_text}</p>`);
    w.document.write(`<p style="margin-top:32px;font-size:11px;color:#D1D5DB;text-align:center">Atlas EIP · ${new Date().toLocaleDateString()}</p></body></html>`);
    w.document.close(); w.print();
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString("zh-TW", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const meta = parsedType ? formMeta[parsedType] : null;

  const filteredSubmissions = submissions.filter(s => {
    if (typeFilter !== "all" && s.form_type !== typeFilter) return false;
    return true;
  });

  const typeCounts = {
    all: submissions.length,
    leave: submissions.filter(s => s.form_type === "leave").length,
    overtime: submissions.filter(s => s.form_type === "overtime").length,
    business_trip: submissions.filter(s => s.form_type === "business_trip").length,
  };

  const annualRemaining = leaveBalance ? leaveBalance.annual_total - leaveBalance.annual_used : null;

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 16px 48px", fontFamily: "system-ui, sans-serif" }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .wf-card { animation: fadeIn 0.25s ease forwards; }
      `}</style>

      {message && (
        <div style={{
          padding: "10px 16px", borderRadius: 10, marginBottom: 16, fontSize: 14, fontWeight: 600,
          background: message.includes("✅") ? "#D1FAE5" : "#FEE2E2",
          color: message.includes("✅") ? "#065F46" : "#991B1B",
        }}>{message}</div>
      )}

      {/* ZONE 1 — SUBMIT */}
      <div style={{ background: "white", borderRadius: 16, border: "1px solid #E5E7EB", overflow: "hidden", marginBottom: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
        <div style={{ padding: "14px 20px", background: "linear-gradient(135deg, rgba(124,58,237,0.05), rgba(124,58,237,0.02))", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "#EDE9FE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>💬</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>用一句話完成申請</div>
            <div style={{ fontSize: 12, color: "#9CA3AF" }}>請假、加班、出差 — AI 自動辨識類型</div>
          </div>
        </div>

        <div style={{ padding: 20 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {quickHints.map(h => (
              <button key={h.label} onClick={() => setNlpInput(h.text)}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "6px 14px", borderRadius: 8,
                  border: "1px solid #E5E7EB", background: "#F9FAFB",
                  fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer",
                  transition: "all 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#7C3AED"; e.currentTarget.style.color = "#7C3AED"; e.currentTarget.style.background = "#F5F3FF"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.color = "#374151"; e.currentTarget.style.background = "#F9FAFB"; }}
              >
                {h.icon} {h.label}
              </button>
            ))}
          </div>

          <div style={{ position: "relative" }}>
            <textarea
              value={nlpInput}
              onChange={e => setNlpInput(e.target.value)}
              placeholder="例如：我下週一到週三要請特休，因為要回南部探親..."
              rows={3}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleParse(); } }}
              style={{
                width: "100%", padding: "12px 16px", paddingRight: 100,
                border: "1.5px solid #E5E7EB", borderRadius: 12,
                fontSize: 14, outline: "none", resize: "none",
                lineHeight: 1.6, boxSizing: "border-box",
                fontFamily: "inherit", transition: "border-color 0.2s",
              }}
              onFocus={e => e.currentTarget.style.borderColor = "#7C3AED"}
              onBlur={e => e.currentTarget.style.borderColor = "#E5E7EB"}
            />
            <button
              onClick={handleParse}
              disabled={parsing || !nlpInput.trim()}
              style={{
                position: "absolute", right: 10, bottom: 10,
                padding: "9px 16px", borderRadius: 9, border: "none",
                background: parsing || !nlpInput.trim() ? "#D1D5DB" : "#7C3AED",
                color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}>
              {parsing ? "⏳" : "送出 →"}
            </button>
          </div>
        </div>

        {formData && meta && (
          <div style={{ borderTop: "1px solid #E5E7EB" }}>
            <div style={{ padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", background: `${meta.color}08` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${meta.color}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{meta.icon}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: meta.color }}>{meta.name_zh}</div>
                  <div style={{ fontSize: 11, color: "#9CA3AF" }}>AI 自動辨識</div>
                </div>
              </div>
              <button onClick={() => setShowEditMode(!showEditMode)}
                style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #E5E7EB", background: showEditMode ? "#F3F4F6" : "white", fontSize: 11, cursor: "pointer", color: "#6B7280" }}>
                {showEditMode ? "收起" : "✏️ 編輯"}
              </button>
            </div>

            <div style={{ padding: "12px 20px" }}>
              {!showEditMode ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
                  {Object.entries(formData).filter(([k]) => !k.startsWith("_") && k !== "duration_type" && k !== "hours_requested").map(([key, value]) => (
                    <div key={key} style={{ padding: "8px 10px", background: "#F9FAFB", borderRadius: 8 }}>
                      <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 600 }}>{fieldLabels[key] || key}</div>
                      <div style={{ fontSize: 13, color: "#111827", fontWeight: 600, marginTop: 2 }}>
                        {key === "days" && formData.duration_type && formData.duration_type !== "full_day"
                          ? (durationLabels[formData.duration_type] || String(value || "—"))
                          : String(value || "—")}
                        {key === "proxy" && formData._proxy_suggested && (
                          <span style={{ marginLeft: 4, padding: "1px 5px", background: "#EDE9FE", color: "#7C3AED", borderRadius: 4, fontSize: 9, fontWeight: 600 }}>AI 建議</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {Object.entries(formData).filter(([k]) => !k.startsWith("_")).map(([key, value]) => {
                    const selectOptions: Record<string, string[]> = {
                      leave_type: ["特休 Annual", "補休 Comp", "病假 Sick", "事假 Personal", "家庭照顧假 Family Care", "生理假 Menstrual", "婚假 Marriage", "喪假 Bereavement", "產假 Maternity", "陪產假 Paternity", "公假 Official"],
                      overtime_type: ["平日加班 Weekday", "假日加班 Holiday", "國定假日 National Holiday"],
                      transport: ["高鐵 HSR", "飛機 Flight", "自駕 Driving", "火車 Train", "客運 Bus", "其他 Other"],
                    };
                    const options = selectOptions[key];
                    return (
                      <div key={key}>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 3 }}>{fieldLabels[key] || key}</label>
                        {options ? (
                          <select value={String(value || "")} onChange={e => setFormData({ ...formData, [key]: e.target.value })}
                            style={{ width: "100%", padding: "8px 12px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 14, outline: "none", background: "white" }}>
                            {options.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : (
                          <input
                            type={key.includes("date") ? "date" : (key === "start_time" || key === "end_time") ? "time" : key === "hours" || key === "days" ? "number" : "text"}
                            value={String(value || "")}
                            onChange={e => setFormData({ ...formData, [key]: key === "hours" || key === "days" ? parseFloat(e.target.value) : e.target.value })}
                            style={{ width: "100%", padding: "8px 12px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

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
                {compliance && compliance.checks.length > 0 && (
                  <div style={{ padding: 12, background: "white" }}>
                    {compliance.checks.filter(c => c.status !== "pass").map((check, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8 }}>
                        <div style={{ width: 20, height: 20, borderRadius: 5, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, background: check.status === "blocked" ? "#FEE2E2" : "#FEF3C7", color: check.status === "blocked" ? "#DC2626" : "#D97706" }}>
                          {check.status === "blocked" ? "✕" : "!"}
                        </div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}>{check.message_zh}</div>
                          <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}>📖 {check.rule_reference}</div>
                        </div>
                      </div>
                    ))}
                    {compliance.checks.filter(c => c.status === "pass" && SHOW_PASS_TYPES.includes(c.check_type)).map((check, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8, padding: "8px 10px", background: "#F0FDF4", borderRadius: 8, border: "1px solid #BBF7D0" }}>
                        <div style={{ width: 20, height: 20, borderRadius: 5, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, background: "#D1FAE5", color: "#059669" }}>✓</div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "#065F46" }}>{check.message_zh}</div>
                          <div style={{ fontSize: 11, color: "#6B7280", marginTop: 1 }}>📖 {check.rule_reference}</div>
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

            <div style={{ padding: "12px 20px 16px", display: "flex", gap: 10 }}>
              <button onClick={handleSubmit}
                disabled={submitting || checkingCompliance || compliance?.status === "blocked"}
                style={{
                  flex: 1, padding: "11px", borderRadius: 10, border: "none",
                  background: compliance?.status === "blocked" ? "#D1D5DB" : meta.color,
                  color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer",
                  opacity: submitting || checkingCompliance ? 0.6 : 1,
                }}>
                {checkingCompliance ? "⏳ 檢查中..." : submitting ? "送出中..." : compliance?.status === "blocked" ? "🚫 無法送出" : "確認送出 →"}
              </button>
              <button onClick={() => { setFormData(null); setParsedType(null); setCompliance(null); setShowEditMode(false); }}
                style={{ padding: "11px 20px", borderRadius: 10, border: "1px solid #E5E7EB", background: "white", fontSize: 13, cursor: "pointer", color: "#6B7280" }}>
                取消
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ZONE 2 — LEAVE BALANCE */}
      {leaveBalance && (
        <div style={{ background: "white", borderRadius: 12, border: "1px solid #E5E7EB", marginBottom: 20, overflow: "hidden" }}>
          <button
            onClick={() => setLeaveBalanceExpanded(!leaveBalanceExpanded)}
            style={{
              width: "100%", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "none", border: "none", cursor: "pointer", textAlign: "left",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16 }}>🏖️</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>假期餘額</span>
              <span style={{ padding: "2px 10px", borderRadius: 20, background: "#EDE9FE", color: "#7C3AED", fontSize: 12, fontWeight: 700 }}>
                特休還剩 {annualRemaining} 天
              </span>
            </div>
            <span style={{ fontSize: 12, color: "#9CA3AF" }}>{leaveBalanceExpanded ? "▲ 收合" : "▼ 展開全部"}</span>
          </button>

          {leaveBalanceExpanded && (
            <div style={{ padding: "0 16px 16px", borderTop: "1px solid #F3F4F6" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8, marginTop: 12 }}>
                {[
                  { label: "特休", used: leaveBalance.annual_used, total: leaveBalance.annual_total, color: "#7C3AED", tag: "有薪", tagColor: "#059669" },
                  { label: "病假", used: leaveBalance.sick_used, total: leaveBalance.sick_total, color: "#2563EB", tag: "半薪", tagColor: "#D97706" },
                  { label: "事假", used: leaveBalance.personal_used, total: leaveBalance.personal_total, color: "#D97706", tag: "無薪", tagColor: "#DC2626" },
                  { label: "家庭照顧", used: leaveBalance.family_care_used || 0, total: leaveBalance.family_care_total || 7, color: "#059669", tag: "有薪", tagColor: "#059669" },
                ].map(b => (
                  <div key={b.label} style={{ padding: "8px 10px", background: "#F9FAFB", borderRadius: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <div style={{ fontSize: 11, color: "#6B7280", fontWeight: 600 }}>{b.label}</div>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: b.tagColor === "#059669" ? "#D1FAE5" : b.tagColor === "#D97706" ? "#FEF3C7" : "#FEE2E2", color: b.tagColor }}>{b.tag}</span>
                    </div>
                    <div style={{ height: 4, background: "#E5E7EB", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min((b.used / b.total) * 100, 100)}%`, background: b.used / b.total > 0.8 ? "#DC2626" : b.color, borderRadius: 2 }} />
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginTop: 3 }}>
                      {b.total - b.used}<span style={{ fontWeight: 400, color: "#9CA3AF", fontSize: 10 }}>/{b.total}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ZONE 3 — RECORDS (IMPROVED DESIGN) */}
      <div style={{ background: "white", borderRadius: 16, border: "1px solid #E5E7EB", overflow: "hidden" }}>
        {/* Records header */}
        <div style={{ padding: "14px 16px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>📜 申請紀錄</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              style={{ padding: "4px 10px", borderRadius: 7, border: "1px solid #D1D5DB", fontSize: 12, outline: "none", background: "white" }}>
              <option value="">全部狀態</option>
              <option value="pending">⏳ 待審核</option>
              <option value="approved">✅ 已核准</option>
              <option value="rejected">❌ 已駁回</option>
            </select>
          </div>
        </div>

        {/* Type Filter Tabs */}
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #F1F5F9", overflowX: "auto" }}>
          {([
            { key: "all", label: "全部", icon: "📋" },
            { key: "leave", label: "請假", icon: "📝" },
            { key: "overtime", label: "加班", icon: "🕐" },
            { key: "business_trip", label: "出差", icon: "✈️" },
          ] as { key: TypeFilter; label: string; icon: string }[]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setTypeFilter(tab.key)}
              style={{
                flex: 1, padding: "10px 8px", border: "none", background: "none",
                fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
                color: typeFilter === tab.key ? "#7C3AED" : "#6B7280",
                borderBottom: typeFilter === tab.key ? "2px solid #7C3AED" : "2px solid transparent",
                transition: "all 0.15s",
              }}
            >
              {tab.icon} {tab.label}
              <span style={{ marginLeft: 5, padding: "1px 6px", borderRadius: 10, fontSize: 10, fontWeight: 700, background: typeFilter === tab.key ? "#EDE9FE" : "#F3F4F6", color: typeFilter === tab.key ? "#7C3AED" : "#9CA3AF" }}>
                {typeCounts[tab.key]}
              </span>
            </button>
          ))}
        </div>

        {/* Batch action bar */}
        {isAdmin && selectedIds.size > 0 && (
          <div style={{ padding: "8px 16px", background: "#EDE9FE", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#5B21B6" }}>已選 {selectedIds.size} 筆</span>
            <input type="text" value={reviewNote} onChange={e => setReviewNote(e.target.value)} placeholder="備註（選填）"
              style={{ flex: 1, minWidth: 100, padding: "4px 8px", border: "1px solid #C4B5FD", borderRadius: 6, fontSize: 11, outline: "none" }} />
            <button onClick={() => handleBatchApproval("approved")} style={{ padding: "4px 12px", borderRadius: 6, border: "none", background: "#059669", color: "white", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>✅ 批次核准</button>
            <button onClick={() => handleBatchApproval("rejected")} style={{ padding: "4px 12px", borderRadius: 6, border: "none", background: "#DC2626", color: "white", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>❌ 批次駁回</button>
            <button onClick={() => setSelectedIds(new Set())} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #D1D5DB", background: "white", fontSize: 11, cursor: "pointer" }}>取消</button>
          </div>
        )}

        {/* Records List - Using NEW RecordRow Component */}
        <div style={{ padding: "8px" }}>
          {loading && <div style={{ padding: 40, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>載入中...</div>}

          {!loading && filteredSubmissions.length === 0 && (
            <div style={{ padding: 48, textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>
                {typeFilter === "leave" ? "📝" : typeFilter === "overtime" ? "🕐" : typeFilter === "business_trip" ? "✈️" : "💬"}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                {typeFilter === "all" ? "還沒有申請紀錄" : `還沒有${formMeta[typeFilter]?.name_zh || ""}紀錄`}
              </div>
              <div style={{ fontSize: 12, color: "#9CA3AF" }}>在上方輸入框用一句話開始申請吧！</div>
            </div>
          )}

          {filteredSubmissions.map((s) => (
            <RecordRow
              key={s.id}
              submission={s}
              isExpanded={expandedIds.has(s.id)}
              onToggle={() => toggleExpand(s.id)}
              isAdmin={isAdmin}
              isSelected={selectedIds.has(s.id)}
              onSelect={() => toggleSelect(s.id)}
              onCancel={handleCancel}
              onReview={handleReview}
              reviewingId={reviewingId}
              setReviewingId={setReviewingId}
              reviewNote={reviewNote}
              setReviewNote={setReviewNote}
              expandedCompliance={expandedCompliance}
              onToggleCompliance={toggleCompliance}
              onExportPdf={exportPdf}
              showTemplate={templateView.has(s.id)}
              onToggleTemplate={() => toggleTemplate(s.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}