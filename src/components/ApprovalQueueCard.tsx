'use client';

import { useState } from 'react';
import { clockCopy, t, tf, type Lang } from '@/lib/i18n/clock';
import RejectModal from '@/components/RejectModal';

const tokens = {
  colors: {
    primary: { 50: '#F5F3FF', 100: '#EDE9FE', 200: '#DDD6FE', 600: '#7C3AED', 700: '#6D28D9' },
    success: { 50: '#ECFDF5', 100: '#D1FAE5', 600: '#059669', 700: '#047857' },
    warning: { 50: '#FFFBEB', 100: '#FEF3C7', 200: '#FDE68A', 600: '#D97706', 700: '#B45309' },
    violet: { 50: '#F5F3FF', 700: '#6D28D9' },
    emerald: { 50: '#ECFDF5', 700: '#047857' },
    gray: { 50: '#F9FAFB', 100: '#F3F4F6', 200: '#E5E7EB', 300: '#D1D5DB', 400: '#9CA3AF', 500: '#6B7280', 600: '#4B5563', 700: '#374151', 900: '#111827' },
  },
  borderRadius: { sm: '6px', md: '8px', lg: '10px', xl: '12px' },
  shadows: { sm: '0 1px 2px rgba(0,0,0,0.05)', md: '0 4px 6px -1px rgba(0,0,0,0.08), 0 2px 4px -2px rgba(0,0,0,0.04)' },
};

export type PendingRequest = {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string | null;
  work_date: string;
  requested_clock_in: string | null;
  requested_clock_out: string | null;
  reason_code: string;
  reason_note: string | null;
  created_at: string;
};

type ApprovalQueueCardProps = {
  request: PendingRequest;
  lang: Lang;
  selected: boolean;
  onToggleSelect: (requestId: string) => void;
  onResolved: (requestId: string, action: 'approved' | 'rejected') => void;
  onError: (message: string) => void;
};

const REASON_LABELS: Record<string, { zh: string; en: string }> = {
  phone_dead: { zh: '手機沒電', en: 'Phone died' },
  forgot: { zh: '忘記打卡', en: 'Forgot to punch' },
  travel: { zh: '出差', en: 'Travel' },
  system_issue: { zh: '系統問題', en: 'System issue' },
  other: { zh: '其他', en: 'Other' },
};

function formatTaipeiTime(iso: string | null): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('zh-TW', {
      timeZone: 'Asia/Taipei',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return null;
  }
}

function formatTaipeiDateTime(iso: string, lang: Lang): string {
  try {
    const d = new Date(iso);
    const locale = lang === 'zh' ? 'zh-TW' : 'en-US';
    return d.toLocaleString(locale, {
      timeZone: 'Asia/Taipei',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return iso;
  }
}

function mapErrorToMessage(code: string | undefined, status: number, lang: Lang): string {
  if (lang === 'zh') {
    if (status === 401 || status === 404) return '尚未登入或無權限';
    if (status === 403) return '需要管理員權限';
    if (code === 'ALREADY_RESOLVED') return '此申請已處理';
    if (code === 'CONFLICT') return '當日已有出勤記錄';
    if (code === 'NOT_FOUND') return '找不到此申請';
    return '操作失敗，請重試';
  }
  if (status === 401 || status === 404) return 'Not signed in or unauthorized';
  if (status === 403) return 'Admin role required';
  if (code === 'ALREADY_RESOLVED') return 'Request already resolved';
  if (code === 'CONFLICT') return 'Attendance record already exists for this date';
  if (code === 'NOT_FOUND') return 'Request not found';
  return 'Action failed, please retry';
}

export default function ApprovalQueueCard({
  request,
  lang,
  selected,
  onToggleSelect,
  onResolved,
  onError,
}: ApprovalQueueCardProps) {
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const busy = approving || rejecting;

  const employeeName = request.user_name || request.user_id.slice(0, 12);
  const reasonLabel =
    REASON_LABELS[request.reason_code]?.[lang] ?? request.reason_code;

  const clockInDisplay = formatTaipeiTime(request.requested_clock_in);
  const clockOutDisplay = formatTaipeiTime(request.requested_clock_out);
  const submittedAtDisplay = formatTaipeiDateTime(request.created_at, lang);

  const handleApprove = async () => {
    if (busy) return;
    setApproving(true);
    try {
      const res = await fetch(`/api/clock/manual/${request.id}/approve`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        onError(mapErrorToMessage(data?.code, res.status, lang));
        setApproving(false);
        return;
      }
      onResolved(request.id, 'approved');
    } catch {
      onError(mapErrorToMessage(undefined, 0, lang));
      setApproving(false);
    }
  };

  const handleRejectSubmit = async (note: string) => {
    if (busy) return;
    setRejecting(true);
    try {
      const res = await fetch(`/api/clock/manual/${request.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        onError(mapErrorToMessage(data?.code, res.status, lang));
        setRejecting(false);
        return;
      }
      setRejectOpen(false);
      onResolved(request.id, 'rejected');
    } catch {
      onError(mapErrorToMessage(undefined, 0, lang));
      setRejecting(false);
    }
  };

  return (
    <>
      <div
        style={{
          background: 'white',
          borderRadius: tokens.borderRadius.xl,
          border: `1px solid ${selected ? tokens.colors.primary[600] : tokens.colors.gray[200]}`,
          borderWidth: selected ? '2px' : '1px',
          boxShadow: selected ? `0 0 0 3px ${tokens.colors.primary[100]}` : tokens.shadows.sm,
          opacity: busy ? 0.6 : 1,
          pointerEvents: busy ? 'none' : 'auto',
          padding: '16px 18px',
          transition: 'all 150ms ease',
        }}
      >
        {/* Header row: checkbox + name + work date + submitted-at */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            marginBottom: '14px',
          }}
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(request.id)}
            disabled={busy}
            aria-label={t(clockCopy.approval.card_select, lang)}
            style={{
              width: '18px',
              height: '18px',
              minWidth: '18px',
              maxWidth: '18px',
              flexShrink: 0,
              marginTop: '2px',
              cursor: busy ? 'not-allowed' : 'pointer',
              accentColor: tokens.colors.primary[600],
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: '8px',
                flexWrap: 'wrap',
              }}
            >
              <h3
                style={{
                  fontSize: '15px',
                  fontWeight: 700,
                  color: tokens.colors.gray[900],
                  margin: 0,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {employeeName}
              </h3>
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: tokens.colors.gray[700],
                  whiteSpace: 'nowrap',
                }}
              >
                {request.work_date}
              </span>
            </div>
            <p
              style={{
                fontSize: '11px',
                color: tokens.colors.gray[400],
                margin: '2px 0 0',
              }}
            >
              {tf(clockCopy.approval.card_submitted_at, lang, {
                time: submittedAtDisplay,
              })}
            </p>
          </div>
        </div>

        {/* Times */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '10px',
            marginBottom: '14px',
            marginLeft: '30px',
          }}
        >
          <TimeBlock
            label={t(clockCopy.approval.card_clock_in, lang)}
            value={clockInDisplay ?? t(clockCopy.approval.card_no_clock_in, lang)}
            accent="emerald"
          />
          <TimeBlock
            label={t(clockCopy.approval.card_clock_out, lang)}
            value={clockOutDisplay ?? t(clockCopy.approval.card_no_clock_out, lang)}
            accent="violet"
          />
        </div>

        {/* Reason + note */}
        <div style={{ marginLeft: '30px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '6px' }}>
            <span
              style={{
                fontSize: '13px',
                color: tokens.colors.gray[500],
                minWidth: '48px',
                flexShrink: 0,
              }}
            >
              {t(clockCopy.approval.card_reason, lang)}
            </span>
            <span
              style={{
                fontSize: '13px',
                color: tokens.colors.gray[700],
                fontWeight: 500,
              }}
            >
              {reasonLabel}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <span
              style={{
                fontSize: '13px',
                color: tokens.colors.gray[500],
                minWidth: '48px',
                flexShrink: 0,
              }}
            >
              {t(clockCopy.approval.card_note, lang)}
            </span>
            <span
              style={{
                fontSize: '13px',
                color: request.reason_note?.trim() ? tokens.colors.gray[700] : tokens.colors.gray[400],
                fontStyle: request.reason_note?.trim() ? 'normal' : 'italic',
              }}
            >
              {request.reason_note?.trim() || t(clockCopy.approval.card_no_note, lang)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
            marginLeft: '30px',
          }}
        >
          <button
            type="button"
            onClick={() => setRejectOpen(true)}
            disabled={busy}
            style={{
              padding: '8px 14px',
              fontSize: '13px',
              fontWeight: 600,
              color: tokens.colors.warning[700],
              background: tokens.colors.warning[50],
              border: `1px solid ${tokens.colors.warning[200]}`,
              borderRadius: tokens.borderRadius.lg,
              cursor: busy ? 'not-allowed' : 'pointer',
              opacity: busy ? 0.6 : 1,
              minHeight: '36px',
              transition: 'background 150ms ease',
            }}
            onMouseEnter={(e) => {
              if (!busy) (e.currentTarget as HTMLButtonElement).style.background = tokens.colors.warning[100];
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = tokens.colors.warning[50];
            }}
          >
            {rejecting
              ? t(clockCopy.approval.card_rejecting, lang)
              : t(clockCopy.approval.card_reject, lang)}
          </button>
          <button
            type="button"
            onClick={handleApprove}
            disabled={busy}
            style={{
              padding: '8px 18px',
              fontSize: '13px',
              fontWeight: 600,
              color: 'white',
              background: tokens.colors.primary[600],
              border: 'none',
              borderRadius: tokens.borderRadius.lg,
              cursor: busy ? 'not-allowed' : 'pointer',
              opacity: busy ? 0.6 : 1,
              minHeight: '36px',
              transition: 'background 150ms ease',
            }}
            onMouseEnter={(e) => {
              if (!busy) (e.currentTarget as HTMLButtonElement).style.background = tokens.colors.primary[700];
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = tokens.colors.primary[600];
            }}
          >
            {approving
              ? t(clockCopy.approval.card_approving, lang)
              : t(clockCopy.approval.card_approve, lang)}
          </button>
        </div>
      </div>

      <RejectModal
        open={rejectOpen}
        lang={lang}
        employeeName={employeeName}
        workDate={request.work_date}
        busy={rejecting}
        onSubmit={handleRejectSubmit}
        onCancel={() => {
          if (!rejecting) setRejectOpen(false);
        }}
      />
    </>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function TimeBlock({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: 'emerald' | 'violet';
}) {
  const bg = accent === 'emerald' ? tokens.colors.emerald[50] : tokens.colors.violet[50];
  const valueColor =
    accent === 'emerald' ? tokens.colors.emerald[700] : tokens.colors.violet[700];

  return (
    <div
      style={{
        background: bg,
        borderRadius: tokens.borderRadius.lg,
        padding: '10px 14px',
      }}
    >
      <div
        style={{
          fontSize: '10px',
          fontWeight: 600,
          color: tokens.colors.gray[500],
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: '2px',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: '17px',
          fontWeight: 700,
          color: valueColor,
          fontFamily: 'JetBrains Mono, monospace',
          lineHeight: 1.2,
        }}
      >
        {value}
      </div>
    </div>
  );
}
