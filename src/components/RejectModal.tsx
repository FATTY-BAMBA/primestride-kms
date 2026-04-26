// src/components/RejectModal.tsx
// Modal for rejecting a manual entry request with a required reason.
// The note is mandatory — submit button stays disabled until non-empty.

'use client';

import { useEffect, useState } from 'react';
import { clockCopy, t, type Lang } from '@/lib/i18n/clock';

const MAX_NOTE_LENGTH = 1000;

export interface RejectModalProps {
  open: boolean;
  lang: Lang;
  /** Display context shown at top of modal */
  employeeName: string;
  workDate: string; // YYYY-MM-DD
  busy?: boolean;
  onSubmit: (note: string) => void;
  onCancel: () => void;
}

export default function RejectModal({
  open,
  lang,
  employeeName,
  workDate,
  busy = false,
  onSubmit,
  onCancel,
}: RejectModalProps) {
  const [note, setNote] = useState('');

  // Reset note when modal opens (clean slate per request)
  useEffect(() => {
    if (open) setNote('');
  }, [open]);

  // ESC cancels
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (busy) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, busy, onCancel]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  if (!open) return null;

  const trimmed = note.trim();
  const canSubmit = trimmed.length > 0 && !busy;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit(trimmed.slice(0, MAX_NOTE_LENGTH));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reject-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={busy ? undefined : onCancel}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 z-10">
        <h2
          id="reject-modal-title"
          className="text-lg font-bold text-slate-900 mb-1"
        >
          {t(clockCopy.approval.reject_modal_title, lang)}
        </h2>
        <p className="text-sm text-slate-500 mb-4">
          {t(clockCopy.approval.reject_modal_subtitle, lang)}
        </p>

        {/* Context: who + when */}
        <div className="bg-slate-50 rounded-lg px-4 py-3 mb-4 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">
              {t(clockCopy.approval.card_employee, lang)}
            </span>
            <span className="font-semibold text-slate-900">{employeeName}</span>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-slate-500">
              {t(clockCopy.approval.card_work_date, lang)}
            </span>
            <span className="font-semibold text-slate-900">{workDate}</span>
          </div>
        </div>

        {/* Note input */}
        <label className="block mb-4">
          <div className="flex justify-between items-baseline mb-1.5">
            <span className="text-sm font-semibold text-slate-700">
              {t(clockCopy.approval.reject_note_label, lang)}
              <span className="ml-1.5 text-xs text-red-600 font-normal">
                {t(clockCopy.approval.reject_note_required, lang)}
              </span>
            </span>
            <span
              className={`text-xs ${
                note.length > MAX_NOTE_LENGTH * 0.9
                  ? 'text-amber-600'
                  : 'text-slate-400'
              }`}
            >
              {note.length} / {MAX_NOTE_LENGTH}
            </span>
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, MAX_NOTE_LENGTH))}
            disabled={busy}
            autoFocus
            rows={4}
            placeholder={t(clockCopy.approval.reject_note_placeholder, lang)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent disabled:bg-slate-50 disabled:cursor-not-allowed resize-none"
          />
        </label>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            {t(clockCopy.approval.reject_cancel, lang)}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-4 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
          >
            {busy
              ? t(clockCopy.approval.reject_submitting, lang)
              : t(clockCopy.approval.reject_submit, lang)}
          </button>
        </div>
      </div>
    </div>
  );
}
