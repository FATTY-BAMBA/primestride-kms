'use client';

import { useEffect, useRef, useState } from 'react';

const tokens = {
  colors: {
    warning: { 50: '#FFFBEB', 100: '#FEF3C7', 200: '#FDE68A', 600: '#D97706', 700: '#B45309', 800: '#92400E' },
    gray: { 50: '#F9FAFB', 100: '#F3F4F6', 200: '#E5E7EB', 300: '#D1D5DB', 500: '#6B7280', 600: '#4B5563', 700: '#374151', 900: '#111827' },
  },
  borderRadius: { sm: '6px', md: '8px', lg: '10px', xl: '12px', '2xl': '16px' },
  shadows: { xl: '0 20px 25px -5px rgba(0,0,0,0.08), 0 8px 10px -6px rgba(0,0,0,0.04)' },
};

const MAX_NOTE_LENGTH = 1000;
const WARN_THRESHOLD = 0.9; // 90% of max

type RejectModalProps = {
  open: boolean;
  lang: 'zh' | 'en';
  employeeName: string;
  workDate: string;
  busy?: boolean;
  onSubmit: (note: string) => void;
  onCancel: () => void;
};

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
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Reset note + auto-focus on open
  useEffect(() => {
    if (open) {
      setNote('');
      // Defer to next tick so the modal is in the DOM
      const id = setTimeout(() => textareaRef.current?.focus(), 0);
      return () => clearTimeout(id);
    }
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

  if (!open) return null;

  const trimmed = note.trim();
  const isValid = trimmed.length > 0;
  const charCount = note.length;
  const showWarning = charCount >= MAX_NOTE_LENGTH * WARN_THRESHOLD;

  const labels = {
    zh: {
      title: '駁回原因',
      subtitle: `${employeeName} · ${workDate}`,
      placeholder: '請填寫駁回原因（必填）',
      cancel: '取消',
      reject: '確定駁回',
      rejecting: '駁回中…',
      noteRequired: '駁回原因為必填項目',
      charsRemaining: (n: number) => `剩餘 ${n} 字`,
    },
    en: {
      title: 'Rejection Reason',
      subtitle: `${employeeName} · ${workDate}`,
      placeholder: 'Please provide a reason (required)',
      cancel: 'Cancel',
      reject: 'Reject',
      rejecting: 'Rejecting…',
      noteRequired: 'A rejection reason is required',
      charsRemaining: (n: number) => `${n} chars remaining`,
    },
  }[lang];

  const handleSubmit = () => {
    if (!isValid || busy) return;
    onSubmit(trimmed);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reject-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px',
      }}
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: tokens.borderRadius['2xl'],
          padding: '24px',
          maxWidth: '480px',
          width: '100%',
          boxShadow: tokens.shadows.xl,
          borderTop: `4px solid ${tokens.colors.warning[600]}`,
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: '16px' }}>
          <h2
            id="reject-modal-title"
            style={{
              fontSize: '18px',
              fontWeight: 700,
              color: tokens.colors.gray[900],
              margin: 0,
              marginBottom: '4px',
            }}
          >
            {labels.title}
          </h2>
          <p
            style={{
              fontSize: '13px',
              color: tokens.colors.gray[500],
              margin: 0,
            }}
          >
            {labels.subtitle}
          </p>
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, MAX_NOTE_LENGTH))}
          disabled={busy}
          placeholder={labels.placeholder}
          rows={4}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '10px 12px',
            fontSize: '14px',
            fontFamily: 'inherit',
            color: tokens.colors.gray[900],
            background: busy ? tokens.colors.gray[50] : 'white',
            border: `1px solid ${tokens.colors.warning[200]}`,
            borderRadius: tokens.borderRadius.lg,
            resize: 'vertical',
            outline: 'none',
            lineHeight: 1.5,
            minHeight: '100px',
          }}
          onFocus={(e) => {
            (e.currentTarget as HTMLTextAreaElement).style.borderColor = tokens.colors.warning[600];
            (e.currentTarget as HTMLTextAreaElement).style.boxShadow = `0 0 0 3px ${tokens.colors.warning[100]}`;
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLTextAreaElement).style.borderColor = tokens.colors.warning[200];
            (e.currentTarget as HTMLTextAreaElement).style.boxShadow = 'none';
          }}
        />

        {/* Char counter / warning */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '6px',
            minHeight: '18px',
          }}
        >
          <span
            style={{
              fontSize: '11px',
              color: !isValid && charCount > 0 ? tokens.colors.warning[700] : tokens.colors.gray[500],
            }}
          >
            {!isValid && charCount === 0 ? '' : ''}
          </span>
          <span
            style={{
              fontSize: '11px',
              color: showWarning ? tokens.colors.warning[700] : tokens.colors.gray[500],
              fontWeight: showWarning ? 600 : 400,
            }}
          >
            {labels.charsRemaining(MAX_NOTE_LENGTH - charCount)}
          </span>
        </div>

        {/* Actions */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            marginTop: '16px',
            paddingTop: '16px',
            borderTop: `1px solid ${tokens.colors.gray[200]}`,
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={{
              padding: '10px 16px',
              fontSize: '13px',
              fontWeight: 600,
              color: tokens.colors.gray[700],
              background: 'white',
              border: `1px solid ${tokens.colors.gray[300]}`,
              borderRadius: tokens.borderRadius.lg,
              cursor: busy ? 'not-allowed' : 'pointer',
              opacity: busy ? 0.6 : 1,
              minHeight: '40px',
            }}
            onMouseEnter={(e) => {
              if (!busy) (e.currentTarget as HTMLButtonElement).style.background = tokens.colors.gray[50];
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'white';
            }}
          >
            {labels.cancel}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid || busy}
            style={{
              padding: '10px 18px',
              fontSize: '13px',
              fontWeight: 600,
              color: 'white',
              background: tokens.colors.warning[600],
              border: 'none',
              borderRadius: tokens.borderRadius.lg,
              cursor: !isValid || busy ? 'not-allowed' : 'pointer',
              opacity: !isValid || busy ? 0.5 : 1,
              minHeight: '40px',
            }}
            onMouseEnter={(e) => {
              if (isValid && !busy) (e.currentTarget as HTMLButtonElement).style.background = tokens.colors.warning[700];
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = tokens.colors.warning[600];
            }}
          >
            {busy ? labels.rejecting : labels.reject}
          </button>
        </div>
      </div>
    </div>
  );
}
