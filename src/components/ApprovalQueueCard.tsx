// src/components/ApprovalQueueCard.tsx
// One card per pending manual entry request.
// Owns its own approve/reject API calls; reports resolution via callbacks.

'use client';

import { useState } from 'react';
import { clockCopy, t, tf, type Lang } from '@/lib/i18n/clock';
import RejectModal from './RejectModal';

// Maps request shape returned from listing endpoint
export interface PendingRequest {
  id: string;
  user_id: string;
  user_name: string | null;
  work_date: string; // YYYY-MM-DD
  requested_clock_in: string | null; // ISO UTC
  requested_clock_out: string | null;
  reason_code: string;
  reason_note: string | null;
  created_at: string;
}

export interface ApprovalQueueCardProps {
  request: PendingRequest;
  lang: Lang;
  selected: boolean;
  onToggleSelect: (requestId: string) => void;
  /** Called when this request is successfully approved or rejected — parent removes it from the list. */
  onResolved: (requestId: string, action: 'approved' | 'rejected') => void;
  /** Called when an action fails — parent shows toast. */
  onError: (message: string) => void;
}

const REASON_LABELS: Record<string, { zh: string; en: string }> = {
  phone_dead: { zh: '手機沒電', en: 'Phone died' },
  forgot:     { zh: '忘記打卡', en: 'Forgot to punch' },
  travel:     { zh: '出差',     en: 'Travel / out of office' },
  system:     { zh: '系統問題', en: 'System issue' },
  other:      { zh: '其他',     en: 'Other' },
};

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

  const handleApprove = async () => {
    if (busy) return;
    setApproving(true);
    try {
      const res = await fetch(`/api/clock/manual/${request.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        const msg = mapErrorToMessage(json?.code, lang);
        onError(msg);
        setApproving(false);
        return;
      }
      onResolved(request.id, 'approved');
      // No setApproving(false) — card is about to unmount
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[approve] network error', e);
      onError(t(clockCopy.approval.toast_error_generic, lang));
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
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        const msg = mapErrorToMessage(json?.code, lang);
        onError(msg);
        setRejecting(false);
        return;
      }
      setRejectOpen(false);
      onResolved(request.id, 'rejected');
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[reject] network error', e);
      onError(t(clockCopy.approval.toast_error_generic, lang));
      setRejecting(false);
    }
  };

  // Format times for display (Taipei time)
  const clockInDisplay = formatTaipeiTime(request.requested_clock_in, lang);
  const clockOutDisplay = formatTaipeiTime(request.requested_clock_out, lang);
  const submittedAtDisplay = formatTaipeiDateTime(request.created_at, lang);

  // Reason label
  const reasonEntry = REASON_LABELS[request.reason_code];
  const reasonLabel = reasonEntry
    ? t(reasonEntry, lang)
    : request.reason_code;

  const employeeName =
    request.user_name && request.user_name.trim() !== ''
      ? request.user_name
      : request.user_id;

  return (
    <>
      <div
        className={`bg-white rounded-xl border transition-all ${
          selected
            ? 'border-violet-400 ring-2 ring-violet-100'
            : 'border-slate-200 hover:border-slate-300'
        } ${busy ? 'opacity-60 pointer-events-none' : ''}`}
      >
        <div className="p-4 sm:p-5">
          {/* Top row: checkbox + employee + work date */}
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelect(request.id)}
              disabled={busy}
              aria-label={t(clockCopy.approval.card_select, lang)}
              className="mt-1 w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500 cursor-pointer disabled:cursor-not-allowed"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2 flex-wrap">
                <h3 className="text-base font-bold text-slate-900 truncate">
                  {employeeName}
                </h3>
                <span className="text-sm font-semibold text-slate-700 whitespace-nowrap">
                  {request.work_date}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {tf(clockCopy.approval.card_submitted_at, lang, {
                  time: submittedAtDisplay,
                })}
              </p>
            </div>
          </div>

          {/* Times */}
          <div className="grid grid-cols-2 gap-3 mt-4 ml-7">
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
          <div className="mt-4 ml-7 space-y-2 text-sm">
            <div className="flex gap-2">
              <span className="text-slate-500 min-w-[3rem]">
                {t(clockCopy.approval.card_reason, lang)}
              </span>
              <span className="text-slate-700 font-medium">{reasonLabel}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-slate-500 min-w-[3rem]">
                {t(clockCopy.approval.card_note, lang)}
              </span>
              <span
                className={
                  request.reason_note && request.reason_note.trim() !== ''
                    ? 'text-slate-700'
                    : 'text-slate-400 italic'
                }
              >
                {request.reason_note?.trim() ||
                  t(clockCopy.approval.card_no_note, lang)}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 mt-5 ml-7">
            <button
              type="button"
              onClick={() => setRejectOpen(true)}
              disabled={busy}
              className="px-3 py-1.5 text-sm font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-amber-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              {rejecting
                ? t(clockCopy.approval.card_rejecting, lang)
                : t(clockCopy.approval.card_reject, lang)}
            </button>
            <button
              type="button"
              onClick={handleApprove}
              disabled={busy}
              className="px-4 py-1.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
            >
              {approving
                ? t(clockCopy.approval.card_approving, lang)
                : t(clockCopy.approval.card_approve, lang)}
            </button>
          </div>
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
  const accentBg = accent === 'emerald' ? 'bg-emerald-50' : 'bg-violet-50';
  const accentText =
    accent === 'emerald' ? 'text-emerald-700' : 'text-violet-700';
  return (
    <div className={`${accentBg} rounded-lg px-3 py-2`}>
      <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
        {label}
      </div>
      <div className={`text-sm font-bold ${accentText} mt-0.5 tabular-nums`}>
        {value}
      </div>
    </div>
  );
}

/** Format ISO UTC timestamp as HH:MM in Taipei time, or null if input is null. */
function formatTaipeiTime(iso: string | null, _lang: Lang): string | null {
  if (!iso) return null;
  try {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Taipei',
    }).format(date);
  } catch {
    return null;
  }
}

/** Format ISO UTC timestamp as MM/DD HH:MM in Taipei time. */
function formatTaipeiDateTime(iso: string, lang: Lang): string {
  try {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return iso;
    const locale = lang === 'zh' ? 'zh-TW' : 'en-GB';
    return new Intl.DateTimeFormat(locale, {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Taipei',
    }).format(date);
  } catch {
    return iso;
  }
}

function mapErrorToMessage(code: string | undefined, lang: Lang): string {
  switch (code) {
    case 'NOT_FOUND':
      return t(clockCopy.approval.toast_error_not_found, lang);
    case 'NOT_PENDING':
      return t(clockCopy.approval.toast_error_already, lang);
    default:
      return t(clockCopy.approval.toast_error_generic, lang);
  }
}
