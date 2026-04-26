// src/components/SuccessToast.tsx
// Bottom-right notification toast. Auto-dismisses after a configurable duration.
// Three variants: success, error, warning.

'use client';

import { useEffect } from 'react';
import { clockCopy, t, type Lang } from '@/lib/i18n/clock';

export type ToastVariant = 'success' | 'error' | 'warning';

export interface SuccessToastProps {
  open: boolean;
  lang: Lang;
  message: string;
  variant?: ToastVariant;
  /** Auto-dismiss duration in ms. 0 disables auto-dismiss. Default 4000. */
  duration?: number;
  onDismiss: () => void;
}

export default function SuccessToast({
  open,
  lang,
  message,
  variant = 'success',
  duration = 4000,
  onDismiss,
}: SuccessToastProps) {
  // Auto-dismiss timer — resets when message changes
  useEffect(() => {
    if (!open || duration === 0) return;
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
    // We intentionally include `message` so a new toast resets the timer
  }, [open, message, duration, onDismiss]);

  if (!open) return null;

  const styles = VARIANT_STYLES[variant];

  return (
    <div
      className="fixed bottom-4 right-4 z-50 max-w-sm sm:max-w-md"
      role="status"
      aria-live="polite"
    >
      <div
        className={`flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border ${styles.bg} ${styles.border}`}
      >
        <div className={`text-lg leading-none mt-0.5 ${styles.iconColor}`}>
          {styles.icon}
        </div>
        <div className={`flex-1 text-sm font-medium ${styles.text}`}>
          {message}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t(clockCopy.approval.toast_dismiss, lang)}
          className={`flex-shrink-0 -mr-1 -mt-1 p-1 rounded-md hover:bg-black/5 transition-colors ${styles.text}`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

type VariantStyle = {
  bg: string;
  border: string;
  text: string;
  iconColor: string;
  icon: string;
};

const VARIANT_STYLES: Record<ToastVariant, VariantStyle> = {
  success: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-900',
    iconColor: 'text-emerald-600',
    icon: '✓',
  },
  error: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-900',
    iconColor: 'text-red-600',
    icon: '✕',
  },
  warning: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-900',
    iconColor: 'text-amber-600',
    icon: '⚠',
  },
};
