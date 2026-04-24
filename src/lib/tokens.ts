// src/lib/tokens.ts
// Atlas EIP design tokens — single source of truth for colors, spacing, typography.
// Phase 1 components use inline hex values; new features use these tokens.
// Gradually migrate Phase 1 when touched.

export const tokens = {
  colors: {
    // Brand
    primary: '#7C3AED',
    primaryLight: '#EDE9FE',
    primaryDark: '#6D28D9',

    // Semantic
    success: '#059669',
    successLight: '#D1FAE5',
    warning: '#D97706',
    warningLight: '#FEF3C7',
    danger: '#DC2626',
    dangerLight: '#FEE2E2',
    info: '#2563EB',
    infoLight: '#DBEAFE',

    // Neutrals
    bg: '#F9FAFB',
    surface: '#FFFFFF',
    border: '#E5E7EB',
    borderStrong: '#D1D5DB',

    // Text
    text: '#111827',
    textMuted: '#6B7280',
    textSubtle: '#9CA3AF',
    textInverse: '#FFFFFF',

    // Dark (tablet display)
    darkBg: '#0B1020',
    darkSurface: '#1E293B',
    darkText: '#F8FAFC',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
    '3xl': 32,
    '4xl': 48,
  },
  radii: {
    sm: 6,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },
  font: {
    family: 'system-ui, -apple-system, "PingFang TC", "Microsoft JhengHei", sans-serif',
    size: {
      xs: 12,
      sm: 13,
      base: 14,
      md: 15,
      lg: 18,
      xl: 22,
      '2xl': 28,
      '3xl': 36,
      '4xl': 56,
      display: 96,
    },
    weight: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },
  shadow: {
    sm: '0 1px 2px rgba(0,0,0,0.05)',
    md: '0 4px 6px rgba(0,0,0,0.07)',
    lg: '0 10px 20px rgba(0,0,0,0.1)',
    display: '0 20px 60px rgba(0,0,0,0.4)',
  },
  duration: {
    fast: '0.15s',
    normal: '0.25s',
  },
} as const;

export type Tokens = typeof tokens;