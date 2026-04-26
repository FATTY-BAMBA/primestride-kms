'use client';

const tokens = {
  colors: {
    primary: { 50: '#F5F3FF', 100: '#EDE9FE', 600: '#7C3AED', 700: '#6D28D9' },
    gray: { 100: '#F3F4F6', 200: '#E5E7EB', 300: '#D1D5DB', 600: '#4B5563', 700: '#374151' },
  },
  borderRadius: { md: '8px', lg: '10px', xl: '12px', '2xl': '16px' },
  shadows: { xl: '0 20px 25px -5px rgba(0,0,0,0.08), 0 8px 10px -6px rgba(0,0,0,0.04)' },
};

type BulkActionBarProps = {
  lang: 'zh' | 'en';
  selectedCount: number;
  totalVisible: number;
  busy?: boolean;
  onSelectAll: () => void;
  onClear: () => void;
  onBulkApprove: () => void;
};

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

  const allSelected = selectedCount >= totalVisible;
  const labels = {
    zh: {
      selected: `已選 ${selectedCount} / ${totalVisible} 筆`,
      selectAll: '全選',
      clear: '取消選取',
      approve: `批次核准 ${selectedCount} 筆`,
      approving: '處理中…',
    },
    en: {
      selected: `${selectedCount} / ${totalVisible} selected`,
      selectAll: 'Select all',
      clear: 'Clear',
      approve: `Approve ${selectedCount}`,
      approving: 'Processing…',
    },
  }[lang];

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        width: 'calc(100% - 40px)',
        maxWidth: '720px',
        background: 'white',
        borderRadius: tokens.borderRadius['2xl'],
        border: `1px solid ${tokens.colors.gray[200]}`,
        boxShadow: tokens.shadows.xl,
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap',
      }}
    >
      {/* Count badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 14px',
          borderRadius: tokens.borderRadius.md,
          background: tokens.colors.primary[100],
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: '20px',
            height: '20px',
            borderRadius: '4px',
            background: tokens.colors.primary[600],
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-hidden="true"
        >
          <span style={{ color: 'white', fontSize: '11px', fontWeight: 800 }}>✓</span>
        </div>
        <span
          style={{
            fontSize: '13px',
            fontWeight: 700,
            color: tokens.colors.primary[700],
            whiteSpace: 'nowrap',
          }}
        >
          {labels.selected}
        </span>
      </div>

      {/* Spacer pushes buttons right on wide screens */}
      <div style={{ flex: 1, minWidth: 0 }} />

      {/* Select all (when not all selected) */}
      {!allSelected && (
        <button
          type="button"
          onClick={onSelectAll}
          disabled={busy}
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: tokens.colors.primary[600],
            background: 'none',
            border: 'none',
            cursor: busy ? 'not-allowed' : 'pointer',
            padding: '6px 10px',
            minHeight: '36px',
            opacity: busy ? 0.5 : 1,
          }}
        >
          {labels.selectAll}
        </button>
      )}

      {/* Clear */}
      <button
        type="button"
        onClick={onClear}
        disabled={busy}
        style={{
          fontSize: '12px',
          fontWeight: 600,
          color: tokens.colors.gray[600],
          background: 'none',
          border: 'none',
          cursor: busy ? 'not-allowed' : 'pointer',
          padding: '6px 10px',
          minHeight: '36px',
          opacity: busy ? 0.5 : 1,
        }}
      >
        {labels.clear}
      </button>

      {/* Bulk approve — primary */}
      <button
        type="button"
        onClick={onBulkApprove}
        disabled={busy}
        style={{
          padding: '10px 18px',
          fontSize: '13px',
          fontWeight: 700,
          color: 'white',
          background: tokens.colors.primary[600],
          border: 'none',
          borderRadius: tokens.borderRadius.lg,
          cursor: busy ? 'not-allowed' : 'pointer',
          opacity: busy ? 0.6 : 1,
          minHeight: '40px',
        }}
        onMouseEnter={(e) => {
          if (!busy) (e.currentTarget as HTMLButtonElement).style.background = tokens.colors.primary[700];
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = tokens.colors.primary[600];
        }}
      >
        {busy ? labels.approving : labels.approve}
      </button>
    </div>
  );
}
