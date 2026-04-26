'use client';

import { useEffect } from 'react';

const tokens = {
  colors: {
    primary: { 50: '#F5F3FF', 100: '#EDE9FE', 600: '#7C3AED', 700: '#6D28D9' },
    danger: { 50: '#FEF2F2', 600: '#DC2626', 700: '#B91C1C' },
    gray: { 50: '#F9FAFB', 200: '#E5E7EB', 300: '#D1D5DB', 500: '#6B7280', 600: '#4B5563', 700: '#374151', 900: '#111827' },
  },
  borderRadius: { md: '8px', lg: '10px', xl: '12px', '2xl': '16px' },
  shadows: { xl: '0 20px 25px -5px rgba(0,0,0,0.08), 0 8px 10px -6px rgba(0,0,0,0.04)' },
};

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  variant?: 'default' | 'danger';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  variant = 'default',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // ESC cancels, Enter confirms
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (busy) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, busy, onConfirm, onCancel]);

  if (!open) return null;

  const confirmBg =
    variant === 'danger' ? tokens.colors.danger[600] : tokens.colors.primary[600];
  const confirmHover =
    variant === 'danger' ? tokens.colors.danger[700] : tokens.colors.primary[700];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
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
          maxWidth: '420px',
          width: '100%',
          boxShadow: tokens.shadows.xl,
        }}
      >
        <h2
          id="confirm-dialog-title"
          style={{
            fontSize: '18px',
            fontWeight: 700,
            color: tokens.colors.gray[900],
            margin: 0,
            marginBottom: '12px',
          }}
        >
          {title}
        </h2>
        <p
          style={{
            fontSize: '14px',
            color: tokens.colors.gray[600],
            lineHeight: 1.6,
            margin: 0,
            marginBottom: '20px',
          }}
        >
          {body}
        </p>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
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
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            style={{
              padding: '10px 18px',
              fontSize: '13px',
              fontWeight: 600,
              color: 'white',
              background: confirmBg,
              border: 'none',
              borderRadius: tokens.borderRadius.lg,
              cursor: busy ? 'not-allowed' : 'pointer',
              opacity: busy ? 0.6 : 1,
              minHeight: '40px',
            }}
            onMouseEnter={(e) => {
              if (!busy) (e.currentTarget as HTMLButtonElement).style.background = confirmHover;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = confirmBg;
            }}
          >
            {busy ? '...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}