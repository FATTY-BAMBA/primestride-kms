'use client';

import { useEffect, useRef } from 'react';

const tokens = {
  colors: {
    success: { 50: '#ECFDF5', 200: '#A7F3D0', 600: '#059669', 800: '#065F46' },
    danger: { 50: '#FEF2F2', 200: '#FECACA', 600: '#DC2626', 800: '#991B1B' },
    warning: { 50: '#FFFBEB', 200: '#FDE68A', 600: '#D97706', 800: '#92400E' },
    gray: { 100: '#F3F4F6', 500: '#6B7280' },
  },
  borderRadius: { md: '8px', lg: '10px' },
  shadows: { lg: '0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -4px rgba(0,0,0,0.04)' },
};

type ToastVariant = 'success' | 'error' | 'warning';

type VariantStyle = {
  bg: string;
  border: string;
  text: string;
  iconBg: string;
  icon: string;
};

const VARIANT_STYLES: Record<ToastVariant, VariantStyle> = {
  success: {
    bg: tokens.colors.success[50],
    border: tokens.colors.success[200],
    text: tokens.colors.success[800],
    iconBg: tokens.colors.success[600],
    icon: '✓',
  },
  error: {
    bg: tokens.colors.danger[50],
    border: tokens.colors.danger[200],
    text: tokens.colors.danger[800],
    iconBg: tokens.colors.danger[600],
    icon: '✕',
  },
  warning: {
    bg: tokens.colors.warning[50],
    border: tokens.colors.warning[200],
    text: tokens.colors.warning[800],
    iconBg: tokens.colors.warning[600],
    icon: '⚠',
  },
};

type SuccessToastProps = {
  open: boolean;
  lang: 'zh' | 'en';
  message: string;
  variant?: ToastVariant;
  duration?: number;
  onDismiss: () => void;
};

export default function SuccessToast({
  open,
  lang,
  message,
  variant = 'success',
  duration = 4000,
  onDismiss,
}: SuccessToastProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!open || duration <= 0) return;
    timerRef.current = setTimeout(() => {
      onDismiss();
    }, duration);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [open, message, duration, onDismiss]);

  if (!open) return null;

  const style = VARIANT_STYLES[variant];
  const closeLabel = lang === 'zh' ? '關閉' : 'Close';

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        maxWidth: '400px',
        width: 'calc(100% - 48px)',
        padding: '14px 18px',
        background: style.bg,
        border: `1px solid ${style.border}`,
        borderRadius: tokens.borderRadius.lg,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        boxShadow: tokens.shadows.lg,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          background: style.iconBg,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '13px',
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {style.icon}
      </span>
      <span
        style={{
          fontSize: '13px',
          fontWeight: 600,
          color: style.text,
          flex: 1,
          lineHeight: 1.5,
        }}
      >
        {message}
      </span>
      <button
        type="button"
        aria-label={closeLabel}
        onClick={onDismiss}
        style={{
          background: 'none',
          border: 'none',
          color: style.text,
          cursor: 'pointer',
          fontSize: '18px',
          padding: '4px',
          minWidth: '28px',
          minHeight: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: tokens.borderRadius.md,
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = tokens.colors.gray[100];
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
        }}
      >
        ×
      </button>
    </div>
  );
}
