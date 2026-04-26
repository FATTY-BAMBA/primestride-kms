// src/components/BulkActionBar.tsx
// Sticky bottom bar that appears when one or more requests are selected.
// Pure UI — parent component handles confirm flow and API call.

'use client';

import { clockCopy, t, tf, type Lang } from '@/lib/i18n/clock';

export interface BulkActionBarProps {
  lang: Lang;
  selectedCount: number;
  totalVisible: number;
  busy?: boolean;
  onSelectAll: () => void;
  onClear: () => void;
  onBulkApprove: () => void;
}

export default function BulkActionBar({
  lang,
  selectedCount,
  totalVisible,
  busy = false,
  onSelectAll,
  onClear,
  onBulkApprove,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  const allSelected = selectedCount >= totalVisible && totalVisible > 0;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-30 lg:left-60"
      role="region"
      aria-label="Bulk actions"
    >
      <div className="bg-white border-t border-slate-200 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
        <div className="max-w-5xl mx-auto px-4 py-3 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            {/* Count + selection shortcuts */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-bold text-slate-900">
                {tf(clockCopy.approval.bulk_selected, lang, {
                  count: selectedCount,
                })}
              </span>
              <div className="flex gap-3 text-xs">
                {!allSelected && (
                  <button
                    type="button"
                    onClick={onSelectAll}
                    disabled={busy}
                    className="text-violet-600 hover:text-violet-700 hover:underline font-medium disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:underline"
                  >
                    {t(clockCopy.approval.bulk_select_all, lang)}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClear}
                  disabled={busy}
                  className="text-slate-500 hover:text-slate-700 hover:underline disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:underline"
                >
                  {t(clockCopy.approval.bulk_clear, lang)}
                </button>
              </div>
            </div>

            {/* Spacer (desktop only) */}
            <div className="hidden sm:block flex-1" />

            {/* Primary action */}
            <button
              type="button"
              onClick={onBulkApprove}
              disabled={busy}
              className="w-full sm:w-auto px-5 py-2.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 shadow-sm"
            >
              {busy
                ? t(clockCopy.approval.bulk_approving, lang)
                : t(clockCopy.approval.bulk_approve, lang)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
