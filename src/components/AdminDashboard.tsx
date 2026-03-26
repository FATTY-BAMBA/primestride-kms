"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import ComplianceConflictScanner from "@/components/ComplianceConflictScanner";
import { FormTemplate } from "@/components/FormTemplates";

// ═══════════════════════════════════════════════════════════════════════════════
// DESIGN TOKENS - Centralized styling system
// ═══════════════════════════════════════════════════════════════════════════════

const tokens = {
  colors: {
    // Primary (Violet)
    primary: {
      50: "#F5F3FF",
      100: "#EDE9FE",
      200: "#DDD6FE",
      500: "#8B5CF6",
      600: "#7C3AED",
      700: "#6D28D9",
    },
    // Success (Emerald) - Fixed contrast ratios
    success: {
      50: "#ECFDF5",
      100: "#D1FAE5",
      200: "#A7F3D0",
      500: "#10B981",
      600: "#059669",
      700: "#047857",
      800: "#065F46",
    },
    // Warning (Amber) - Fixed contrast ratios
    warning: {
      50: "#FFFBEB",
      100: "#FEF3C7",
      200: "#FDE68A",
      500: "#F59E0B",
      600: "#D97706",
      700: "#B45309",
      800: "#92400E",
    },
    // Danger (Red) - Fixed contrast ratios
    danger: {
      50: "#FEF2F2",
      100: "#FEE2E2",
      200: "#FECACA",
      500: "#EF4444",
      600: "#DC2626",
      700: "#B91C1C",
      800: "#991B1B",
    },
    // Info (Blue)
    info: {
      50: "#EFF6FF",
      100: "#DBEAFE",
      200: "#BFDBFE",
      500: "#3B82F6",
      600: "#2563EB",
      700: "#1D4ED8",
      800: "#1E40AF",
    },
    // Gray scale
    gray: {
      50: "#F9FAFB",
      100: "#F3F4F6",
      200: "#E5E7EB",
      300: "#D1D5DB",
      400: "#9CA3AF",
      500: "#6B7280",
      600: "#4B5563",
      700: "#374151",
      800: "#1F2937",
      900: "#111827",
    },
  },
  spacing: {
    0: "0",
    1: "4px",
    2: "8px",
    3: "12px",
    4: "16px",
    5: "20px",
    6: "24px",
    8: "32px",
    10: "40px",
  },
  borderRadius: {
    sm: "6px",
    md: "8px",
    lg: "10px",
    xl: "12px",
    "2xl": "16px",
    full: "9999px",
  },
  typography: {
    h1: { fontSize: "24px", fontWeight: 800, lineHeight: 1.3 },
    h2: { fontSize: "18px", fontWeight: 700, lineHeight: 1.4 },
    h3: { fontSize: "15px", fontWeight: 700, lineHeight: 1.5 },
    body: { fontSize: "14px", fontWeight: 400, lineHeight: 1.6 },
    small: { fontSize: "13px", fontWeight: 400, lineHeight: 1.5 },
    caption: { fontSize: "12px", fontWeight: 500, lineHeight: 1.5 },
    xs: { fontSize: "11px", fontWeight: 500, lineHeight: 1.4 },
  },
  shadows: {
    sm: "0 1px 2px rgba(0,0,0,0.05)",
    md: "0 4px 6px -1px rgba(0,0,0,0.08), 0 2px 4px -2px rgba(0,0,0,0.04)",
    lg: "0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -4px rgba(0,0,0,0.04)",
    xl: "0 20px 25px -5px rgba(0,0,0,0.08), 0 8px 10px -6px rgba(0,0,0,0.04)",
  },
  transitions: {
    fast: "150ms ease",
    normal: "200ms ease",
    slow: "300ms ease",
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface Submission {
  id: string;
  form_type: string;
  form_data: Record<string, any>;
  status: string;
  submitted_by: string;
  submitter_name: string;
  original_text: string | null;
  ai_parsed: boolean;
  reviewed_by: string | null;
  reviewer_name: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  compliance_result: {
    status: "pass" | "warning" | "blocked";
    checks: {
      check_type: string;
      status: string;
      rule_reference: string;
      message_zh: string;
      message: string;
    }[];
    ai_analysis_zh?: string;
  } | null;
}

interface EmployeeSummary {
  user_id: string;
  name: string;
  email: string;
  total_submissions: number;
  pending: number;
  approved: number;
  rejected: number;
  leave_days_taken: number;
  overtime_hours: number;
  leave_balance: {
    annual_total: number;
    annual_used: number;
    sick_total: number;
    sick_used: number;
    personal_total: number;
    personal_used: number;
    family_care_total: number;
    family_care_used: number;
    family_care_hours_total: number;
    family_care_hours_used: number;
    maternity_total: number;
    maternity_used: number;
    paternity_total: number;
    paternity_used: number;
    marriage_total: number;
    marriage_used: number;
    bereavement_total: number;
    bereavement_used: number;
    comp_time_total: number;
    comp_time_used: number;
  } | null;
}

interface ComplianceSyncStatus {
  last_sync: string | null;
  total_rules: number;
  status: string;
}

interface Toast {
  id: string;
  type: "success" | "error" | "info" | "warning";
  message: string;
  duration?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOM HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

function useLocalStorage<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item) setValue(JSON.parse(item));
    } catch {}
  }, [key]);
  const setStoredValue = (v: T) => {
    setValue(v);
    try {
      window.localStorage.setItem(key, JSON.stringify(v));
    } catch {}
  };
  return [value, setStoredValue];
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);
    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [query]);
  return matches;
}

function useFocusTrap(isOpen: boolean, containerRef: React.RefObject<HTMLElement | null>) {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      const container = containerRef.current;
      if (container) {
        const focusableElements = container.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        firstElement?.focus();
      }
    } else {
      previousFocusRef.current?.focus();
    }
  }, [isOpen, containerRef]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const formMeta: Record<string, { icon: string; name_zh: string; color: string }> = {
  leave: { icon: "📝", name_zh: "請假", color: tokens.colors.primary[600] },
  overtime: { icon: "🕐", name_zh: "加班", color: tokens.colors.info[600] },
  business_trip: { icon: "✈️", name_zh: "出差", color: tokens.colors.success[600] },
};

const statusConfig: Record<string, { label: string; color: string; bg: string; borderColor: string }> = {
  pending: { 
    label: "⏳ 待審核", 
    color: tokens.colors.warning[800], 
    bg: tokens.colors.warning[100],
    borderColor: tokens.colors.warning[200]
  },
  approved: { 
    label: "✅ 已核准", 
    color: tokens.colors.success[800], 
    bg: tokens.colors.success[100],
    borderColor: tokens.colors.success[200]
  },
  rejected: { 
    label: "❌ 已駁回", 
    color: tokens.colors.danger[800], 
    bg: tokens.colors.danger[100],
    borderColor: tokens.colors.danger[200]
  },
  cancelled: { 
    label: "🚫 已取消", 
    color: tokens.colors.gray[600], 
    bg: tokens.colors.gray[100],
    borderColor: tokens.colors.gray[200]
  },
};

const fieldLabels: Record<string, string> = {
  leave_type: "假別",
  start_date: "開始",
  end_date: "結束",
  days: "天數",
  reason: "事由",
  proxy: "代理人",
  date: "日期",
  start_time: "開始",
  end_time: "結束",
  hours: "時數",
  overtime_type: "類別",
  project: "專案",
  destination: "地點",
  purpose: "目的",
  transport: "交通",
  budget: "預算",
  accommodation: "住宿",
};

// ═══════════════════════════════════════════════════════════════════════════════
// UI COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

// Button Component with variants
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "success" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  leftIcon,
  rightIcon,
  children,
  style,
  disabled,
  ...props
}: ButtonProps) {
  const variantStyles = {
    primary: {
      background: tokens.colors.primary[600],
      color: "white",
      border: "none",
      hoverBg: tokens.colors.primary[700],
    },
    secondary: {
      background: "white",
      color: tokens.colors.gray[700],
      border: `1px solid ${tokens.colors.gray[300]}`,
      hoverBg: tokens.colors.gray[50],
    },
    success: {
      background: tokens.colors.success[600],
      color: "white",
      border: "none",
      hoverBg: tokens.colors.success[700],
    },
    danger: {
      background: tokens.colors.danger[600],
      color: "white",
      border: "none",
      hoverBg: tokens.colors.danger[700],
    },
    ghost: {
      background: "transparent",
      color: tokens.colors.gray[600],
      border: "none",
      hoverBg: tokens.colors.gray[100],
    },
  };

  const sizeStyles = {
    sm: { padding: "6px 12px", fontSize: "12px" },
    md: { padding: "10px 16px", fontSize: "13px" },
    lg: { padding: "12px 20px", fontSize: "14px" },
  };

  const v = variantStyles[variant];
  const s = sizeStyles[size];

  return (
    <button
      disabled={disabled || isLoading}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "6px",
        borderRadius: tokens.borderRadius.lg,
        fontWeight: 600,
        cursor: disabled || isLoading ? "not-allowed" : "pointer",
        opacity: disabled || isLoading ? 0.6 : 1,
        transition: `all ${tokens.transitions.fast}`,
        minHeight: "44px",
        ...v,
        ...s,
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!disabled && !isLoading) {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = v.hoverBg;
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.backgroundColor = v.background;
      }}
      {...props}
    >
      {isLoading && (
        <span
          style={{
            width: "14px",
            height: "14px",
            border: "2px solid currentColor",
            borderTopColor: "transparent",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
      )}
      {!isLoading && leftIcon}
      {children}
      {!isLoading && rightIcon}
    </button>
  );
}

// Card Component
interface CardProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  hoverable?: boolean;
  padding?: "sm" | "md" | "lg";
}

function Card({ children, style, hoverable = false, padding = "md" }: CardProps) {
  const paddingSizes = {
    sm: "12px",
    md: "20px",
    lg: "24px",
  };

  return (
    <div
      style={{
        background: "white",
        borderRadius: tokens.borderRadius.xl,
        border: `1px solid ${tokens.colors.gray[200]}`,
        boxShadow: tokens.shadows.sm,
        padding: paddingSizes[padding],
        transition: `all ${tokens.transitions.normal}`,
        ...style,
      }}
      onMouseEnter={(e) => {
        if (hoverable) {
          (e.currentTarget as HTMLDivElement).style.boxShadow = tokens.shadows.md;
          (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = tokens.shadows.sm;
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
      }}
    >
      {children}
    </div>
  );
}

// Stat Card Component
interface StatCardProps {
  label: string;
  value: number | string;
  icon: string;
  color: "primary" | "success" | "warning" | "danger" | "info";
  onClick?: () => void;
  unit?: string;
}

function StatCard({ label, value, icon, color, onClick, unit = "" }: StatCardProps) {
  const colorMap = {
    primary: { bg: tokens.colors.primary[50], text: tokens.colors.primary[700] },
    success: { bg: tokens.colors.success[50], text: tokens.colors.success[800] },
    warning: { bg: tokens.colors.warning[50], text: tokens.colors.warning[800] },
    danger: { bg: tokens.colors.danger[50], text: tokens.colors.danger[800] },
    info: { bg: tokens.colors.info[50], text: tokens.colors.info[800] },
  };

  const c = colorMap[color];

  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      style={{
        padding: "18px 16px",
        background: c.bg,
        borderRadius: tokens.borderRadius.xl,
        textAlign: "center",
        cursor: onClick ? "pointer" : "default",
        transition: `all ${tokens.transitions.fast}`,
        border: `1px solid transparent`,
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          (e.currentTarget as HTMLDivElement).style.borderColor = c.text + "30";
          (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "transparent";
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
      }}
    >
      <div style={{ fontSize: "20px", marginBottom: "4px" }} aria-hidden="true">
        {icon}
      </div>
      <div
        style={{
          fontSize: "28px",
          fontWeight: 800,
          color: c.text,
          lineHeight: 1.2,
        }}
      >
        {value}
        {unit && (
          <span
            style={{
              fontSize: "14px",
              fontWeight: 500,
              marginLeft: "4px",
            }}
          >
            {unit}
          </span>
        )}
      </div>
      <div
        style={{
          fontSize: "12px",
          color: c.text,
          opacity: 0.85,
          marginTop: "4px",
          fontWeight: 500,
        }}
      >
        {label}
      </div>
    </div>
  );
}

// Badge Component
interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info";
  size?: "sm" | "md";
}

function Badge({ children, variant = "default", size = "md" }: BadgeProps) {
  const variantStyles = {
    default: { bg: tokens.colors.gray[100], color: tokens.colors.gray[700] },
    success: { bg: tokens.colors.success[100], color: tokens.colors.success[800] },
    warning: { bg: tokens.colors.warning[100], color: tokens.colors.warning[800] },
    danger: { bg: tokens.colors.danger[100], color: tokens.colors.danger[800] },
    info: { bg: tokens.colors.info[100], color: tokens.colors.info[800] },
  };

  const v = variantStyles[variant];
  const fontSize = size === "sm" ? "10px" : "11px";
  const padding = size === "sm" ? "2px 8px" : "3px 10px";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding,
        borderRadius: tokens.borderRadius.full,
        fontSize,
        fontWeight: 700,
        background: v.bg,
        color: v.color,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

// Input Component
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: React.ReactNode;
  error?: string;
}

function Input({ leftIcon, error, style, ...props }: InputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "10px 14px",
          border: `1px solid ${error ? tokens.colors.danger[300] : isFocused ? tokens.colors.primary[500] : tokens.colors.gray[300]}`,
          borderRadius: tokens.borderRadius.lg,
          background: isFocused ? "white" : tokens.colors.gray[50],
          transition: `all ${tokens.transitions.fast}`,
          minHeight: "44px",
          ...style,
        }}
      >
        {leftIcon && <span style={{ color: tokens.colors.gray[400], flexShrink: 0 }}>{leftIcon}</span>}
        <input
          {...props}
          style={{
            flex: 1,
            border: "none",
            background: "transparent",
            fontSize: "14px",
            color: tokens.colors.gray[900],
            outline: "none",
            width: "100%",
            minWidth: 0,
          }}
          onFocus={(e) => {
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            props.onBlur?.(e);
          }}
        />
      </div>
      {error && (
        <div
          style={{
            fontSize: "12px",
            color: tokens.colors.danger[600],
            marginTop: "4px",
            marginLeft: "4px",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

// Skeleton Components
function SkeletonCard() {
  return (
    <Card padding="md">
      <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
        <div
          style={{
            width: "44px",
            height: "44px",
            borderRadius: tokens.borderRadius.lg,
            background: tokens.colors.gray[200],
            animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
          }}
        />
        <div style={{ flex: 1 }}>
          <div
            style={{
              height: "16px",
              width: "60%",
              background: tokens.colors.gray[200],
              borderRadius: tokens.borderRadius.sm,
              marginBottom: "8px",
              animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
            }}
          />
          <div
            style={{
              height: "12px",
              width: "40%",
              background: tokens.colors.gray[200],
              borderRadius: tokens.borderRadius.sm,
              animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
            }}
          />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              height: "50px",
              background: tokens.colors.gray[100],
              borderRadius: tokens.borderRadius.md,
              animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
            }}
          />
        ))}
      </div>
    </Card>
  );
}

function SkeletonStat() {
  return (
    <div
      style={{
        padding: "18px 16px",
        background: tokens.colors.gray[50],
        borderRadius: tokens.borderRadius.xl,
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: "32px",
          height: "32px",
          background: tokens.colors.gray[200],
          borderRadius: tokens.borderRadius.md,
          margin: "0 auto 10px",
          animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        }}
      />
      <div
        style={{
          height: "28px",
          width: "50%",
          background: tokens.colors.gray[200],
          borderRadius: tokens.borderRadius.sm,
          margin: "0 auto 6px",
          animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        }}
      />
      <div
        style={{
          height: "12px",
          width: "70%",
          background: tokens.colors.gray[200],
          borderRadius: tokens.borderRadius.sm,
          margin: "0 auto",
          animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        }}
      />
    </div>
  );
}

// Toast Components
function ToastContainer({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: string) => void }) {
  return (
    <div
      role="region"
      aria-live="polite"
      aria-label="Notifications"
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        maxWidth: "400px",
        width: "calc(100% - 48px)",
      }}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onClose={() => removeToast(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, toast.duration || 4000);
    return () => clearTimeout(timer);
  }, [onClose, toast.duration]);

  const config = {
    success: {
      bg: tokens.colors.success[100],
      border: tokens.colors.success[200],
      text: tokens.colors.success[800],
      icon: "✓",
    },
    error: {
      bg: tokens.colors.danger[100],
      border: tokens.colors.danger[200],
      text: tokens.colors.danger[800],
      icon: "✕",
    },
    warning: {
      bg: tokens.colors.warning[100],
      border: tokens.colors.warning[200],
      text: tokens.colors.warning[800],
      icon: "!",
    },
    info: {
      bg: tokens.colors.info[100],
      border: tokens.colors.info[200],
      text: tokens.colors.info[800],
      icon: "i",
    },
  }[toast.type];

  return (
    <div
      role="alert"
      style={{
        padding: "14px 18px",
        background: config.bg,
        border: `1px solid ${config.border}`,
        borderRadius: tokens.borderRadius.lg,
        display: "flex",
        alignItems: "center",
        gap: "12px",
        boxShadow: tokens.shadows.lg,
        animation: "slideIn 0.3s ease-out",
        cursor: "pointer",
      }}
      onClick={onClose}
    >
      <span
        style={{
          width: "22px",
          height: "22px",
          borderRadius: "50%",
          background: config.text,
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "12px",
          fontWeight: 700,
          flexShrink: 0,
        }}
        aria-hidden="true"
      >
        {config.icon}
      </span>
      <span
        style={{
          fontSize: "13px",
          fontWeight: 600,
          color: config.text,
          flex: 1,
          lineHeight: 1.5,
        }}
      >
        {toast.message}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Close notification"
        style={{
          background: "none",
          border: "none",
          color: config.text,
          cursor: "pointer",
          fontSize: "18px",
          padding: "4px",
          minWidth: "28px",
          minHeight: "28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: tokens.borderRadius.md,
        }}
      >
        ×
      </button>
    </div>
  );
}

// Empty State Component
function EmptyState({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: string;
  title: string;
  subtitle: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <Card
      padding="lg"
      style={{
        textAlign: "center",
        padding: "60px 40px",
      }}
    >
      <div style={{ fontSize: "48px", marginBottom: "16px" }} aria-hidden="true">
        {icon}
      </div>
      <div
        style={{
          fontSize: "16px",
          fontWeight: 700,
          color: tokens.colors.gray[800],
          marginBottom: "8px",
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: "13px",
          color: tokens.colors.gray[500],
          marginBottom: action ? "20px" : 0,
          lineHeight: 1.6,
        }}
      >
        {subtitle}
      </div>
      {action && (
        <Button variant="secondary" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </Card>
  );
}

// Modal Component with focus trap
function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(isOpen, modalRef);

  if (!isOpen) return null;

  const sizeStyles = {
    sm: { maxWidth: "360px" },
    md: { maxWidth: "480px" },
    lg: { maxWidth: "640px" },
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
        padding: "20px",
      }}
      onClick={onClose}
    >
      <div
        ref={modalRef}
        style={{
          background: "white",
          borderRadius: tokens.borderRadius["2xl"],
          padding: "24px",
          maxWidth: sizeStyles[size].maxWidth,
          width: "100%",
          boxShadow: tokens.shadows.xl,
          animation: "fadeIn 0.2s ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          id="modal-title"
          style={{
            fontSize: "18px",
            fontWeight: 700,
            color: tokens.colors.gray[900],
            marginBottom: "16px",
          }}
        >
          {title}
        </div>
        <div style={{ marginBottom: footer ? "20px" : 0 }}>{children}</div>
        {footer && (
          <div
            style={{
              display: "flex",
              gap: "10px",
              justifyContent: "flex-end",
              paddingTop: "16px",
              borderTop: `1px solid ${tokens.colors.gray[200]}`,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// Data Freshness Component
function DataFreshness({
  lastUpdate,
  onRefresh,
  isRefreshing,
}: {
  lastUpdate: Date | null;
  onRefresh: () => void;
  isRefreshing: boolean;
}) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const diff = lastUpdate ? Math.floor((now.getTime() - lastUpdate.getTime()) / 60000) : -1;
  const ago =
    diff < 0 ? "尚未更新" : diff < 1 ? "剛剛" : diff < 60 ? `${diff} 分鐘前` : `${Math.floor(diff / 60)} 小時前`;
  const isFresh = lastUpdate && now.getTime() - lastUpdate.getTime() < 300000;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        fontSize: "12px",
        color: tokens.colors.gray[500],
      }}
    >
      <span
        style={{
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          background: isFresh ? tokens.colors.success[500] : tokens.colors.warning[500],
          display: "inline-block",
        }}
        aria-hidden="true"
      />
      <span>上次更新: {ago}</span>
      <button
        onClick={onRefresh}
        disabled={isRefreshing}
        aria-label={isRefreshing ? "Refreshing data" : "Refresh data"}
        style={{
          background: "none",
          border: "none",
          color: tokens.colors.primary[600],
          cursor: isRefreshing ? "not-allowed" : "pointer",
          fontSize: "12px",
          fontWeight: 600,
          opacity: isRefreshing ? 0.5 : 1,
          display: "flex",
          alignItems: "center",
          gap: "4px",
          minHeight: "32px",
          padding: "4px 8px",
          borderRadius: tokens.borderRadius.md,
        }}
      >
        <span
          style={{
            display: "inline-block",
            animation: isRefreshing ? "spin 1s linear infinite" : "none",
          }}
          aria-hidden="true"
        >
          ↻
        </span>
        刷新
      </button>
    </div>
  );
}

// Balance Bar Component
function BalanceBar({ used, total, color }: { used: number; total: number; color: string }) {
  const remaining = total - used;
  const percentage = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const barColor = remaining <= 0 ? tokens.colors.danger[500] : percentage >= 80 ? tokens.colors.warning[500] : color;

  return (
    <div style={{ minWidth: "70px" }}>
      <div
        style={{
          height: "5px",
          background: tokens.colors.gray[200],
          borderRadius: tokens.borderRadius.full,
          overflow: "hidden",
          marginBottom: "4px",
        }}
        role="progressbar"
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`Used ${used} out of ${total}`}
      >
        <div
          style={{
            height: "100%",
            width: `${percentage}%`,
            background: barColor,
            borderRadius: tokens.borderRadius.full,
            transition: `width ${tokens.transitions.slow}`,
          }}
        />
      </div>
      <div
        style={{
          fontSize: "11px",
          fontWeight: 700,
          color: remaining <= 0 ? tokens.colors.danger[600] : tokens.colors.gray[700],
        }}
      >
        {remaining}
        <span style={{ fontWeight: 400, color: tokens.colors.gray[400], fontSize: "10px" }}>/{total}</span>
      </div>
    </div>
  );
}

// Compliance Panel Component
function CompliancePanel({
  result,
  id,
  expandedId,
  setExpandedId,
}: {
  result: Submission["compliance_result"];
  id: string;
  expandedId: string | null;
  setExpandedId: (v: string | null) => void;
}) {
  if (!result) return null;

  const nonPass = result.checks.filter((c) => c.status !== "pass");
  const isExpanded = expandedId === id;

  const statusConfig = {
    blocked: {
      borderColor: tokens.colors.danger[200],
      bg: tokens.colors.danger[50],
      textColor: tokens.colors.danger[800],
      icon: "🚫",
      label: "合規未通過",
    },
    warning: {
      borderColor: tokens.colors.warning[200],
      bg: tokens.colors.warning[50],
      textColor: tokens.colors.warning[800],
      icon: "⚠️",
      label: "合規提醒",
    },
    pass: {
      borderColor: tokens.colors.success[200],
      bg: tokens.colors.success[50],
      textColor: tokens.colors.success[800],
      icon: "✅",
      label: "合規通過",
    },
  }[result.status];

  return (
    <div
      style={{
        margin: "0 0 12px",
        padding: "10px 14px",
        borderRadius: tokens.borderRadius.md,
        background: statusConfig.bg,
        border: `1px solid ${statusConfig.borderColor}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "12px" }} aria-hidden="true">
            {statusConfig.icon}
          </span>
          <span
            style={{
              fontSize: "12px",
              fontWeight: 700,
              color: statusConfig.textColor,
            }}
          >
            {statusConfig.label}
            <span
              style={{
                fontSize: "11px",
                fontWeight: 400,
                marginLeft: "6px",
                color: tokens.colors.gray[400],
              }}
            >
              申請時合規狀態
            </span>
          </span>
        </div>
        {result.checks.length > 0 && (
          <button
            onClick={() => setExpandedId(isExpanded ? null : id)}
            aria-expanded={isExpanded}
            aria-controls={`compliance-details-${id}`}
            style={{
              fontSize: "11px",
              fontWeight: 600,
              padding: "4px 10px",
              borderRadius: tokens.borderRadius.md,
              cursor: "pointer",
              border: `1px solid ${statusConfig.borderColor}`,
              background: "white",
              color: statusConfig.textColor,
              minHeight: "32px",
            }}
          >
            {isExpanded ? "收合 ▲" : "查看法條 ▼"}
          </button>
        )}
      </div>

      {nonPass.length > 0 && (
        <div style={{ marginTop: "8px" }}>
          {nonPass.map((check, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: "8px",
                alignItems: "flex-start",
                marginBottom: "6px",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  color: check.status === "blocked" ? tokens.colors.danger[500] : tokens.colors.warning[600],
                  flexShrink: 0,
                  marginTop: "2px",
                }}
                aria-hidden="true"
              >
                {check.status === "blocked" ? "✕" : "!"}
              </span>
              <div>
                <div style={{ fontSize: "12px", color: tokens.colors.gray[700], lineHeight: 1.5 }}>
                  {check.message_zh}
                </div>
                <div
                  style={{
                    fontSize: "10px",
                    color: tokens.colors.primary[600],
                    fontWeight: 600,
                    marginTop: "2px",
                  }}
                >
                  📖 {check.rule_reference}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isExpanded && (
        <div
          id={`compliance-details-${id}`}
          style={{
            marginTop: "12px",
            paddingTop: "12px",
            borderTop: `1px solid ${statusConfig.borderColor}`,
          }}
        >
          {result.checks.map((check, i) => {
            const checkStyle =
              check.status === "blocked"
                ? { bg: tokens.colors.danger[50], border: tokens.colors.danger[200], text: tokens.colors.danger[600] }
                : check.status === "warning"
                ? { bg: tokens.colors.warning[50], border: tokens.colors.warning[200], text: tokens.colors.warning[600] }
                : { bg: "rgba(255,255,255,0.7)", border: tokens.colors.gray[200], text: tokens.colors.success[600] };

            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: "10px",
                  alignItems: "flex-start",
                  marginBottom: "8px",
                  padding: "8px 10px",
                  borderRadius: tokens.borderRadius.md,
                  background: checkStyle.bg,
                  border: `1px solid ${checkStyle.border}`,
                }}
              >
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    flexShrink: 0,
                    marginTop: "2px",
                    color: checkStyle.text,
                  }}
                  aria-hidden="true"
                >
                  {check.status === "blocked" ? "✕" : check.status === "warning" ? "!" : "✓"}
                </span>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: "12px",
                      color: tokens.colors.gray[800],
                      marginBottom: "4px",
                      lineHeight: 1.5,
                    }}
                  >
                    {check.message_zh}
                  </div>
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "2px 8px",
                      borderRadius: tokens.borderRadius.sm,
                      fontSize: "10px",
                      fontWeight: 700,
                      background: tokens.colors.primary[100],
                      color: tokens.colors.primary[700],
                      border: `1px solid ${tokens.colors.primary[200]}`,
                    }}
                  >
                    📖 {check.rule_reference}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {result.ai_analysis_zh && (
        <div
          style={{
            fontSize: "11px",
            color: tokens.colors.gray[500],
            marginTop: "10px",
            paddingTop: "10px",
            borderTop: `1px solid ${statusConfig.borderColor}`,
            lineHeight: 1.5,
          }}
        >
          🤖 {result.ai_analysis_zh}
        </div>
      )}
    </div>
  );
}

// Shortcuts Help Modal
function ShortcutsHelp({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const shortcuts = [
    { key: "⌘/Ctrl + 1-6", action: "切換分頁" },
    { key: "⌘/Ctrl + A", action: "全選待審" },
    { key: "Shift + 點擊", action: "範圍選取" },
    { key: "Esc", action: "取消選取/關閉" },
    { key: "?", action: "顯示說明" },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="⌨️ 鍵盤快捷鍵"
      footer={<Button onClick={onClose}>關閉</Button>}
    >
      <div style={{ display: "grid", gap: "12px" }}>
        {shortcuts.map(({ key, action }) => (
          <div
            key={key}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "8px 0",
              borderBottom: `1px solid ${tokens.colors.gray[100]}`,
            }}
          >
            <kbd
              style={{
                padding: "6px 12px",
                background: tokens.colors.gray[100],
                border: `1px solid ${tokens.colors.gray[200]}`,
                borderRadius: tokens.borderRadius.md,
                fontSize: "12px",
                fontFamily: "monospace",
                fontWeight: 600,
                color: tokens.colors.gray[700],
                minWidth: "100px",
                textAlign: "center",
              }}
            >
              {key}
            </kbd>
            <span style={{ fontSize: "13px", color: tokens.colors.gray[600] }}>{action}</span>
          </div>
        ))}
      </div>
    </Modal>
  );
}

// Avatar Component
function Avatar({ name, color, size = "md" }: { name: string; color?: string; size?: "sm" | "md" | "lg" }) {
  const initial = (name || "?")[0].toUpperCase();
  const sizeStyles = {
    sm: { width: "28px", height: "28px", fontSize: "11px" },
    md: { width: "38px", height: "38px", fontSize: "15px" },
    lg: { width: "48px", height: "48px", fontSize: "18px" },
  };
  const s = sizeStyles[size];

  // Generate consistent color from name if not provided
  const avatarColor =
    color ||
    [
      tokens.colors.primary[600],
      tokens.colors.info[600],
      tokens.colors.success[600],
      tokens.colors.warning[600],
      tokens.colors.danger[600],
    ][name.charCodeAt(0) % 5];

  return (
    <div
      style={{
        ...s,
        borderRadius: tokens.borderRadius.lg,
        background: avatarColor + "20",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        color: avatarColor,
        flexShrink: 0,
      }}
      aria-label={`Avatar for ${name}`}
    >
      {initial}
    </div>
  );
}

// Tab Component
interface Tab {
  key: string;
  label: string;
  count?: number;
}

function Tabs({
  tabs,
  activeTab,
  onChange,
  variant = "default",
}: {
  tabs: Tab[];
  activeTab: string;
  onChange: (key: string) => void;
  variant?: "default" | "pills";
}) {
  const isMobile = useMediaQuery("(max-width: 640px)");

  return (
    <div
      role="tablist"
      aria-label="Dashboard sections"
      style={{
        display: "flex",
        gap: variant === "pills" ? "4px" : "0",
        marginBottom: "20px",
        borderBottom: variant === "default" ? `2px solid ${tokens.colors.gray[200]}` : "none",
        overflowX: "auto",
        position: "sticky",
        top: 0,
        background: "white",
        zIndex: 20,
        paddingTop: "8px",
        paddingBottom: variant === "default" ? "0" : "8px",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={isActive}
            aria-controls={`panel-${tab.key}`}
            id={`tab-${tab.key}`}
            onClick={() => onChange(tab.key)}
            style={{
              padding: isMobile ? "10px 14px" : "10px 18px",
              border: "none",
              background: variant === "pills" ? (isActive ? tokens.colors.primary[100] : "transparent") : "none",
              fontSize: isMobile ? "13px" : "14px",
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
              color: isActive ? tokens.colors.primary[600] : tokens.colors.gray[500],
              borderBottom:
                variant === "default"
                  ? isActive
                    ? `2px solid ${tokens.colors.primary[600]}`
                    : "2px solid transparent"
                  : "none",
              marginBottom: variant === "default" ? "-2px" : "0",
              borderRadius: variant === "pills" ? tokens.borderRadius.lg : "0",
              transition: `all ${tokens.transitions.fast}`,
              minHeight: "44px",
            }}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                style={{
                  marginLeft: "6px",
                  padding: "2px 8px",
                  borderRadius: tokens.borderRadius.full,
                  fontSize: "10px",
                  fontWeight: 700,
                  background: isActive ? tokens.colors.primary[100] : tokens.colors.gray[100],
                  color: isActive ? tokens.colors.primary[600] : tokens.colors.gray[500],
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// MAIN ADMIN DASHBOARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function AdminDashboard() {
  // State management
  const [tab, setTab] = useLocalStorage<"overview" | "pending" | "employees" | "leave" | "compliance" | "esg">(
    "admin_last_tab",
    "overview"
  );
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [allSubmissions, setAllSubmissions] = useState<Submission[]>([]);
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [complianceStatus, setComplianceStatus] = useState<ComplianceSyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);
  const [employeeSubmissions, setEmployeeSubmissions] = useState<Submission[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [empSearch, setEmpSearch] = useState("");
  const debouncedEmpSearch = useDebounce(empSearch, 300);
  const [empSort, setEmpSort] = useState<"name" | "pending" | "leave" | "overtime">("name");
  const [shadowRisks, setShadowRisks] = useState<any[]>([]);
  const [subsidies, setSubsidies] = useState<any[]>([]);
  const [subsidySummary, setSubsidySummary] = useState<any>(null);
  const [showSubsidyDetail, setShowSubsidyDetail] = useState<string | null>(null);
  const [expandedCompliance, setExpandedCompliance] = useState<string | null>(null);
  const [templateView, setTemplateView] = useState<Set<string>>(new Set());
  const [leaveSearch, setLeaveSearch] = useState("");
  const [requestSubTab, setRequestSubTab] = useState<"leave" | "overtime" | "business_trip">("leave");
  const [overtimeSearch, setOvertimeSearch] = useState("");
  const [tripSearch, setTripSearch] = useState("");
  const [adminMonthFilter, setAdminMonthFilter] = useState<string>(new Date().toISOString().slice(0, 7));
  const debouncedLeaveSearch = useDebounce(leaveSearch, 300);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; action: string; count: number }>({
    isOpen: false,
    action: "",
    count: 0,
  });
  const lastSelectedRef = useRef<string | null>(null);

  // Responsive detection
  const isMobile = useMediaQuery("(max-width: 640px)");
  const isTablet = useMediaQuery("(max-width: 768px)");

  // Toast helpers
  const addToast = useCallback((type: Toast["type"], message: string, duration?: number) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, type, message, duration }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Data fetching
  const fetchData = useCallback(
    async (showLoading = true) => {
      if (showLoading) setLoading(true);
      else setRefreshing(true);

      try {
        const [subRes, allSubRes, empRes, compRes, shadowRes, subsidyRes] = await Promise.all([
          fetch("/api/workflows?view=all&status=pending"),
          fetch("/api/workflows?view=all"),
          fetch("/api/admin/employees"),
          fetch("/api/compliance/sync"),
          fetch("/api/shadow-audit"),
          fetch("/api/subsidy-hunter"),
        ]);

        setSubmissions((await subRes.json()).submissions || []);
        setAllSubmissions((await allSubRes.json()).submissions || []);
        if (empRes.ok) setEmployees((await empRes.json()).employees || []);
        if (compRes.ok) setComplianceStatus(await compRes.json());
        if (shadowRes.ok) setShadowRisks((await shadowRes.json()).risks || []);
        if (subsidyRes.ok) {
          const d = await subsidyRes.json();
          setSubsidies(d.subsidies || []);
          setSubsidySummary(d.summary || null);
        }
        setLastUpdate(new Date());
      } catch {
        addToast("error", "❌ 載入失敗，請檢查網路連線");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [addToast]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "?" && !e.metaKey && !e.ctrlKey) {
        setShowShortcuts(true);
        return;
      }
      if (e.key === "Escape") {
        setSelectedIds(new Set());
        setReviewingId(null);
        setShowShortcuts(false);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key >= "1" && e.key <= "6") {
        const tabs = ["overview", "pending", "employees", "leave", "compliance", "esg"] as const;
        setTab(tabs[parseInt(e.key) - 1]);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a" && tab === "pending") {
        e.preventDefault();
        setSelectedIds(new Set(submissions.map((s) => s.id)));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [tab, submissions, setTab]);

  // Review handlers
  const handleReview = async (id: string, action: "approved" | "rejected") => {
    const sub = submissions.find((s) => s.id === id);
    if (!sub) return;

    setSubmissions((prev) => prev.filter((s) => s.id !== id));
    addToast("success", `✅ 已${action === "approved" ? "核准" : "駁回"} ${sub.submitter_name} 的申請`);

    try {
      await fetch("/api/workflows", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, review_note: reviewNote }),
      });
      setReviewingId(null);
      setReviewNote("");
      fetchData(false);
    } catch {
      setSubmissions((prev) => [...prev, sub]);
      addToast("error", "❌ 操作失敗，請重試");
    }
  };

  const executeBatch = async (action: "approved" | "rejected") => {
    const count = selectedIds.size;
    const ids = Array.from(selectedIds);

    setSubmissions((prev) => prev.filter((s) => !ids.includes(s.id)));
    setSelectedIds(new Set());
    addToast("success", `✅ 已${action === "approved" ? "核准" : "駁回"} ${count} 筆申請`);

    try {
      await fetch("/api/workflows", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action, review_note: reviewNote }),
      });
      setReviewNote("");
      fetchData(false);
    } catch {
      addToast("error", "❌ 批次操作失敗");
      fetchData(false);
    }
    setConfirmModal({ isOpen: false, action: "", count: 0 });
  };

  const handleBatch = (action: "approved" | "rejected") => {
    if (selectedIds.size === 0) return;
    if (selectedIds.size > 3 && action === "rejected") {
      setConfirmModal({ isOpen: true, action, count: selectedIds.size });
      return;
    }
    executeBatch(action);
  };

  const loadEmployeeDetail = async (userId: string) => {
    if (expandedEmployee === userId) {
      setExpandedEmployee(null);
      return;
    }
    setExpandedEmployee(userId);
    try {
      const res = await fetch(`/api/workflows?view=all&user_id=${userId}`);
      setEmployeeSubmissions((await res.json()).submissions || []);
    } catch {
      setEmployeeSubmissions([]);
      addToast("error", "❌ 無法載入員工詳情");
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/compliance/sync", { method: "POST" });
      const d = await res.json();
      if (d.success) {
        addToast("success", "✅ 合規規則同步完成！");
        setComplianceStatus({
          last_sync: d.synced_at,
          total_rules: complianceStatus?.total_rules || 0,
          status: "synced",
        });
      } else {
        addToast("error", "❌ 同步失敗");
      }
    } catch {
      addToast("error", "❌ 同步失敗");
    } finally {
      setSyncing(false);
    }
  };

  const toggleSelect = (id: string, e?: React.MouseEvent) => {
    const newSet = new Set(selectedIds);
    if (e?.shiftKey && lastSelectedRef.current) {
      const ids = submissions.map((s) => s.id);
      const startIdx = ids.indexOf(lastSelectedRef.current);
      const endIdx = ids.indexOf(id);
      for (let i = Math.min(startIdx, endIdx); i <= Math.max(startIdx, endIdx); i++) {
        newSet.add(ids[i]);
      }
    } else {
      newSet.has(id) ? newSet.delete(id) : newSet.add(id);
    }
    lastSelectedRef.current = id;
    setSelectedIds(newSet);
  };

  const toggleTemplate = (id: string) => {
    const newSet = new Set(templateView);
    newSet.has(id) ? newSet.delete(id) : newSet.add(id);
    setTemplateView(newSet);
  };

  // Derived data
  const pendingCount = submissions.length;
  const todayStr = new Date().toISOString().split("T")[0];

  const onLeaveToday = useMemo(
    () =>
      allSubmissions.filter(
        (s) =>
          s.form_type === "leave" &&
          s.status === "approved" &&
          s.form_data.start_date <= todayStr &&
          (s.form_data.end_date || s.form_data.start_date) >= todayStr
      ),
    [allSubmissions, todayStr]
  );

  const thisMonthApproved = useMemo(() => {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    return allSubmissions.filter((s) => s.status === "approved" && s.created_at >= monthStart).length;
  }, [allSubmissions]);

  const thisMonthOvertime = useMemo(() => {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    return allSubmissions
      .filter((s) => s.form_type === "overtime" && s.status === "approved" && s.created_at >= monthStart)
      .reduce((sum, s) => sum + (Number(s.form_data.hours) || 0), 0);
  }, [allSubmissions]);

  const employeesLowLeave = useMemo(
    () =>
      employees.filter((emp) => {
        if (!emp.leave_balance) return false;
        const remaining = emp.leave_balance.annual_total - emp.leave_balance.annual_used;
        return remaining <= 2 && emp.leave_balance.annual_total > 0;
      }),
    [employees]
  );

  const filteredEmployees = useMemo(() => {
    let result = employees;
    if (debouncedEmpSearch.trim()) {
      const query = debouncedEmpSearch.toLowerCase();
      result = result.filter(
        (e) => (e.name || "").toLowerCase().includes(query) || (e.email || "").toLowerCase().includes(query)
      );
    }
    return [...result].sort((a, b) => {
      switch (empSort) {
        case "pending":
          return b.pending - a.pending;
        case "leave":
          return b.leave_days_taken - a.leave_days_taken;
        case "overtime":
          return b.overtime_hours - a.overtime_hours;
        default:
          return (a.name || "").localeCompare(b.name || "");
      }
    });
  }, [employees, debouncedEmpSearch, empSort]);

  const leaveOverviewEmployees = useMemo(() => {
    let result = employees.filter((e) => e.leave_balance);
    if (debouncedLeaveSearch.trim()) {
      const query = debouncedLeaveSearch.toLowerCase();
      result = result.filter(
        (e) => (e.name || "").toLowerCase().includes(query) || (e.email || "").toLowerCase().includes(query)
      );
    }
    return [...result].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [employees, debouncedLeaveSearch]);

  const leaveStats = useMemo(() => {
    const withBalance = employees.filter((e) => e.leave_balance);
    const exhausted = withBalance.filter(
      (e) => e.leave_balance!.annual_used >= e.leave_balance!.annual_total && e.leave_balance!.annual_total > 0
    );
    const lowLeave = withBalance.filter((e) => {
      const remaining = e.leave_balance!.annual_total - e.leave_balance!.annual_used;
      return remaining > 0 && remaining <= 2;
    });
    return { exhausted: exhausted.length, lowLeave: lowLeave.length, withBalance: withBalance.length };
  }, [employees]);

  const pendingLeave = useMemo(() => submissions.filter((s) => s.form_type === "leave"), [submissions]);
  const allOvertime = useMemo(() => allSubmissions.filter((s) => s.form_type === "overtime"), [allSubmissions]);
  const allTrips = useMemo(() => allSubmissions.filter((s) => s.form_type === "business_trip"), [allSubmissions]);

  const monthlyLeaveDays = useMemo(
    () =>
      allSubmissions
        .filter((s) => s.form_type === "leave" && s.created_at.startsWith(adminMonthFilter))
        .reduce((sum, s) => sum + (Number(s.form_data.days) || 0), 0),
    [allSubmissions, adminMonthFilter]
  );

  const monthlyLeaveCount = useMemo(
    () => allSubmissions.filter((s) => s.form_type === "leave" && s.created_at.startsWith(adminMonthFilter)).length,
    [allSubmissions, adminMonthFilter]
  );

  const monthlyOTHours = useMemo(
    () =>
      allSubmissions
        .filter((s) => s.form_type === "overtime" && s.created_at.startsWith(adminMonthFilter) && s.status === "approved")
        .reduce((sum, s) => sum + (Number(s.form_data.hours) || 0), 0),
    [allSubmissions, adminMonthFilter]
  );

  const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const upcomingLeave = useMemo(
    () =>
      allSubmissions
        .filter(
          (s) => s.form_type === "leave" && s.status === "approved" && s.form_data.start_date > todayStr && s.form_data.start_date <= in7Days
        )
        .sort((a, b) => a.form_data.start_date.localeCompare(b.form_data.start_date)),
    [allSubmissions, in7Days]
  );

  const exportMonthlyCSV = () => {
    const monthSubs = allSubmissions.filter((s) => s.created_at.startsWith(adminMonthFilter));
    const headers = [
      "申請日期",
      "申請人",
      "類型",
      "假別/類別",
      "開始日期",
      "結束日期",
      "天數/時數",
      "狀態",
      "事由",
      "審核人",
      "審核日期",
      "備註",
    ];
    const rows = monthSubs.map((s) => [
      new Date(s.created_at).toLocaleDateString("zh-TW"),
      s.submitter_name,
      s.form_type === "leave" ? "請假" : s.form_type === "overtime" ? "加班" : "出差",
      s.form_data.leave_type || s.form_data.overtime_type || "-",
      s.form_data.start_date || s.form_data.date || "-",
      s.form_data.end_date || "-",
      s.form_data.days || s.form_data.hours || "-",
      s.status === "approved" ? "已核准" : s.status === "rejected" ? "已駁回" : s.status === "pending" ? "待審核" : "已取消",
      s.form_data.reason || s.form_data.purpose || "-",
      s.reviewer_name || "-",
      s.reviewed_at ? new Date(s.reviewed_at).toLocaleDateString("zh-TW") : "-",
      s.review_note || "-",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `假勤報表_${adminMonthFilter}.csv`;
    link.click();
  };

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("zh-TW", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  // Tab configuration
  const mainTabs = [
    { key: "overview", label: "📊 總覽" },
    { key: "pending", label: "📋 待審核", count: pendingCount },
    { key: "employees", label: "👥 員工", count: employees.length },
    { key: "leave", label: "📋 申請總覽" },
    { key: "compliance", label: "⚖️ 合規" },
    { key: "esg", label: "🌿 ESG 報告" },
  ];

  return (
    <div
      style={{
        maxWidth: "960px",
        margin: "0 auto",
        padding: isMobile ? "0 12px 30px" : "0 20px 40px",
      }}
    >
      {/* Global Styles */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        * {
          box-sizing: border-box;
        }
        button:focus-visible,
        input:focus-visible,
        [tabindex]:focus-visible {
          outline: 2px solid ${tokens.colors.primary[500]};
          outline-offset: 2px;
        }
      `}</style>

      {/* Toast Container */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Confirm Modal */}
      <Modal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, action: "", count: 0 })}
        title="確認批次駁回"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmModal({ isOpen: false, action: "", count: 0 })}>
              取消
            </Button>
            <Button variant="danger" onClick={() => executeBatch("rejected")}>
              確定駁回
            </Button>
          </>
        }
      >
        <p style={{ fontSize: "14px", color: tokens.colors.gray[600], lineHeight: 1.6 }}>
          確定要駁回 <strong>{confirmModal.count}</strong> 筆申請嗎？此操作無法復原。
        </p>
      </Modal>

      {/* Shortcuts Help */}
      <ShortcutsHelp isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />

      {/* Header */}
      <header
        style={{
          marginBottom: "24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: isMobile ? "20px" : "24px",
              fontWeight: 800,
              color: tokens.colors.gray[900],
              margin: 0,
              lineHeight: 1.3,
            }}
          >
            ⚙️ 管理員儀表板
          </h1>
          <p
            style={{
              fontSize: "13px",
              color: tokens.colors.gray[500],
              margin: "6px 0 0",
              lineHeight: 1.5,
            }}
          >
            Admin Dashboard — 總覽、審核、員工管理、合規管理
          </p>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <DataFreshness lastUpdate={lastUpdate} onRefresh={() => fetchData(false)} isRefreshing={refreshing} />
          <button
            onClick={() => setShowShortcuts(true)}
            aria-label="Show keyboard shortcuts"
            style={{
              width: "36px",
              height: "36px",
              borderRadius: tokens.borderRadius.md,
              border: `1px solid ${tokens.colors.gray[300]}`,
              background: "white",
              cursor: "pointer",
              fontSize: "14px",
              color: tokens.colors.gray[500],
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: `all ${tokens.transitions.fast}`,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = tokens.colors.primary[300];
              (e.currentTarget as HTMLButtonElement).style.color = tokens.colors.primary[600];
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = tokens.colors.gray[300];
              (e.currentTarget as HTMLButtonElement).style.color = tokens.colors.gray[500];
            }}
          >
            ?
          </button>
        </div>
      </header>

      {/* Tab Navigation */}
      <Tabs tabs={mainTabs} activeTab={tab} onChange={(key) => setTab(key as typeof tab)} />

      {/* Loading State */}
      {loading && (
        <div style={{ animation: "fadeIn 0.4s" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
              gap: "12px",
              marginBottom: "24px",
            }}
          >
            {[1, 2, 3, 4].map((i) => (
              <SkeletonStat key={i} />
            ))}
          </div>
          <div style={{ display: "grid", gap: "12px" }}>
            {[1, 2, 3].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      )}

      {/* OVERVIEW TAB */}
      {!loading && tab === "overview" && (
        <main role="tabpanel" id="panel-overview" aria-labelledby="tab-overview" style={{ animation: "fadeIn 0.4s" }}>
          {/* Stats Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
              gap: "12px",
              marginBottom: "24px",
            }}
          >
            <StatCard
              label="待審核"
              value={pendingCount}
              icon="📋"
              color="warning"
              onClick={() => setTab("pending")}
            />
            <StatCard
              label="今日請假"
              value={onLeaveToday.length}
              icon="🏖️"
              color="primary"
              onClick={() => setTab("leave")}
            />
            <StatCard label="本月核准" value={thisMonthApproved} icon="✅" color="success" />
            <StatCard label="本月加班時數" value={thisMonthOvertime} icon="🕐" color="info" unit="hr" />
          </div>

          {/* Today's Leave Section */}
          <Card style={{ marginBottom: "20px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
                flexWrap: "wrap",
                gap: "8px",
              }}
            >
              <h2
                style={{
                  fontSize: "15px",
                  fontWeight: 700,
                  color: tokens.colors.gray[900],
                  margin: 0,
                }}
              >
                🏖️ 今日請假人員
              </h2>
              <button
                onClick={() => setTab("leave")}
                style={{
                  fontSize: "12px",
                  color: tokens.colors.primary[600],
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 600,
                  minHeight: "32px",
                  padding: "4px 8px",
                }}
              >
                假期總覽 →
              </button>
            </div>

            {onLeaveToday.length === 0 ? (
              <div
                style={{
                  fontSize: "14px",
                  color: tokens.colors.success[600],
                  padding: "16px 0",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span>✓</span> 今天沒有人請假
              </div>
            ) : (
              <div style={{ display: "grid", gap: "10px" }}>
                {onLeaveToday.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 16px",
                      background: tokens.colors.gray[50],
                      borderRadius: tokens.borderRadius.md,
                      borderLeft: `4px solid ${tokens.colors.primary[600]}`,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: "14px",
                          fontWeight: 600,
                          color: tokens.colors.gray[900],
                        }}
                      >
                        {s.submitter_name || s.submitted_by.slice(0, 12)}
                      </div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: tokens.colors.gray[500],
                          marginTop: "2px",
                        }}
                      >
                        {s.form_data.leave_type} · {s.form_data.start_date} → {s.form_data.end_date || s.form_data.start_date}
                      </div>
                    </div>
                    <Badge variant="primary">{s.form_data.days || 1} 天</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Two Column Layout */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isTablet ? "1fr" : "repeat(2, 1fr)",
              gap: "16px",
              marginBottom: "20px",
            }}
          >
            {/* Pending Queue */}
            <Card>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "16px",
                }}
              >
                <h2
                  style={{
                    fontSize: "15px",
                    fontWeight: 700,
                    color: tokens.colors.gray[900],
                    margin: 0,
                  }}
                >
                  📋 待審核隊列
                </h2>
                {pendingCount > 0 && (
                  <button
                    onClick={() => setTab("pending")}
                    style={{
                      fontSize: "12px",
                      color: tokens.colors.primary[600],
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    查看全部 →
                  </button>
                )}
              </div>

              {submissions.length === 0 ? (
                <div
                  style={{
                    fontSize: "14px",
                    color: tokens.colors.success[600],
                    padding: "12px 0",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span>🎉</span> 全部審核完畢！
                </div>
              ) : (
                <div style={{ display: "grid", gap: "8px" }}>
                  {submissions.slice(0, 5).map((s) => {
                    const ft = formMeta[s.form_type];
                    return (
                      <div
                        key={s.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          padding: "10px 12px",
                          background: tokens.colors.gray[50],
                          borderRadius: tokens.borderRadius.md,
                        }}
                      >
                        <span style={{ fontSize: "18px" }} aria-hidden="true">
                          {ft?.icon}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: "13px",
                              fontWeight: 600,
                              color: tokens.colors.gray[900],
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {s.submitter_name || s.submitted_by.slice(0, 10)}
                          </div>
                          <div
                            style={{
                              fontSize: "11px",
                              color: tokens.colors.gray[400],
                            }}
                          >
                            {ft?.name_zh} · {fmt(s.created_at)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {submissions.length > 5 && (
                    <div
                      style={{
                        fontSize: "11px",
                        color: tokens.colors.gray[400],
                        textAlign: "center",
                        padding: "6px 0",
                      }}
                    >
                      +{submissions.length - 5} 筆更多
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* Low Leave Alert */}
            <Card>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "16px",
                }}
              >
                <h2
                  style={{
                    fontSize: "15px",
                    fontWeight: 700,
                    color: tokens.colors.gray[900],
                    margin: 0,
                  }}
                >
                  ⚠️ 假期餘額不足提醒
                </h2>
                {employeesLowLeave.length > 0 && (
                  <button
                    onClick={() => setTab("leave")}
                    style={{
                      fontSize: "12px",
                      color: tokens.colors.primary[600],
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    查看全部 →
                  </button>
                )}
              </div>

              {employeesLowLeave.length === 0 ? (
                <div
                  style={{
                    fontSize: "14px",
                    color: tokens.colors.success[600],
                    padding: "12px 0",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span>✓</span> 所有員工假期餘額充足
                </div>
              ) : (
                <div style={{ display: "grid", gap: "8px" }}>
                  {employeesLowLeave.slice(0, 5).map((emp) => {
                    const remaining = (emp.leave_balance?.annual_total || 0) - (emp.leave_balance?.annual_used || 0);
                    return (
                      <div
                        key={emp.user_id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "10px 12px",
                          background: remaining <= 0 ? tokens.colors.danger[50] : tokens.colors.warning[50],
                          borderRadius: tokens.borderRadius.md,
                          border: `1px solid ${remaining <= 0 ? tokens.colors.danger[200] : tokens.colors.warning[200]}`,
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: "13px",
                              fontWeight: 600,
                              color: tokens.colors.gray[900],
                            }}
                          >
                            {emp.name || emp.email}
                          </div>
                          <div
                            style={{
                              fontSize: "11px",
                              color: tokens.colors.gray[400],
                            }}
                          >
                            特休 Annual Leave
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: "16px",
                            fontWeight: 800,
                            color: remaining <= 0 ? tokens.colors.danger[600] : tokens.colors.warning[700],
                          }}
                        >
                          {remaining} 天
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* Shadow Audit Risks */}
          {shadowRisks.length > 0 && (
            <Card
              style={{
                marginBottom: "20px",
                borderColor: tokens.colors.danger[200],
                padding: 0,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "14px 18px",
                  background: tokens.colors.danger[50],
                  borderBottom: `1px solid ${tokens.colors.danger[200]}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "20px" }} aria-hidden="true">
                    🔍
                  </span>
                  <div>
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: 700,
                        color: tokens.colors.danger[800],
                      }}
                    >
                      Shadow Audit — 加班風險預警
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: tokens.colors.danger[600],
                        marginTop: "2px",
                      }}
                    >
                      {shadowRisks.filter((r) => r.risk_level === "critical").length} 名員工超標 ·{" "}
                      {shadowRisks.filter((r) => r.risk_level === "warning").length} 名員工接近上限
                    </div>
                  </div>
                </div>
                <Badge variant="default">依 LSA Art. 32 即時監控</Badge>
              </div>

              <div style={{ padding: "14px 18px", display: "grid", gap: "10px" }}>
                {shadowRisks.map((risk) => (
                  <div
                    key={risk.user_id}
                    style={{
                      padding: "12px 16px",
                      borderRadius: tokens.borderRadius.md,
                      background: risk.risk_level === "critical" ? tokens.colors.danger[50] : tokens.colors.warning[50],
                      border: `1px solid ${risk.risk_level === "critical" ? tokens.colors.danger[200] : tokens.colors.warning[200]}`,
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "12px",
                    }}
                  >
                    <Avatar name={risk.name} size="md" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: "14px",
                          fontWeight: 700,
                          color: tokens.colors.gray[900],
                          marginBottom: "6px",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          flexWrap: "wrap",
                        }}
                      >
                        {risk.name}
                        <Badge variant={risk.risk_level === "critical" ? "danger" : "warning"}>
                          {risk.risk_level === "critical" ? "🚨 超標" : "⚠️ 接近上限"}
                        </Badge>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: "16px",
                          flexWrap: "wrap",
                          marginBottom: "8px",
                        }}
                      >
                        <span style={{ fontSize: "12px", color: tokens.colors.gray[500] }}>
                          本月{" "}
                          <strong
                            style={{
                              color: risk.monthly_hours >= 46 ? tokens.colors.danger[600] : tokens.colors.gray[900],
                            }}
                          >
                            {risk.monthly_hours}h
                          </strong>
                          /46h
                        </span>
                        <span style={{ fontSize: "12px", color: tokens.colors.gray[500] }}>
                          近3月{" "}
                          <strong
                            style={{
                              color: risk.quarterly_hours >= 138 ? tokens.colors.danger[600] : tokens.colors.gray[900],
                            }}
                          >
                            {risk.quarterly_hours}h
                          </strong>
                          /138h
                        </span>
                      </div>
                      {risk.alerts.map((a: any, i: number) => (
                        <div
                          key={i}
                          style={{
                            fontSize: "12px",
                            color: risk.risk_level === "critical" ? tokens.colors.danger[800] : tokens.colors.warning[800],
                            marginBottom: "4px",
                            lineHeight: 1.5,
                          }}
                        >
                          {a.message_zh}{" "}
                          <span
                            style={{
                              marginLeft: "6px",
                              padding: "2px 6px",
                              borderRadius: tokens.borderRadius.sm,
                              fontSize: "10px",
                              fontWeight: 600,
                              background: "white",
                              border: `1px solid ${risk.risk_level === "critical" ? tokens.colors.danger[200] : tokens.colors.warning[200]}`,
                              color: risk.risk_level === "critical" ? tokens.colors.danger[600] : tokens.colors.warning[700],
                            }}
                          >
                            📖 {a.law}
                            {a.fine && ` · 罰款 ${a.fine}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Subsidies Section */}
          {subsidies.length > 0 && (
            <Card
              style={{
                marginBottom: "20px",
                borderColor: tokens.colors.success[200],
                padding: 0,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "14px 18px",
                  background: `linear-gradient(135deg, ${tokens.colors.success[50]}, #ECFDF5)`,
                  borderBottom: `1px solid ${tokens.colors.success[200]}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "20px" }} aria-hidden="true">
                    💰
                  </span>
                  <div>
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: 700,
                        color: tokens.colors.success[800],
                      }}
                    >
                      補助獵人 Subsidy Hunter — {subsidies.length} 項可申請補助
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: tokens.colors.success[600],
                        marginTop: "2px",
                      }}
                    >
                      最高可申請 NT${subsidySummary?.total_potential_nt?.toLocaleString() || "—"} 政府補助
                    </div>
                  </div>
                </div>
                <Badge variant="success">自動掃描</Badge>
              </div>

              <div style={{ padding: "14px 18px", display: "grid", gap: "10px" }}>
                {subsidies.map((sub) => (
                  <div
                    key={sub.id}
                    style={{
                      padding: "14px 16px",
                      borderRadius: tokens.borderRadius.md,
                      background: sub.urgency === "high" ? tokens.colors.success[50] : tokens.colors.gray[50],
                      border: `1px solid ${sub.urgency === "high" ? tokens.colors.success[200] : tokens.colors.gray[200]}`,
                      cursor: "pointer",
                      transition: `all ${tokens.transitions.fast}`,
                    }}
                    onClick={() => setShowSubsidyDetail(showSubsidyDetail === sub.id ? null : sub.id)}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.borderColor = tokens.colors.primary[200];
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.borderColor =
                        sub.urgency === "high" ? tokens.colors.success[200] : tokens.colors.gray[200];
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                      <span style={{ fontSize: "22px", flexShrink: 0 }} aria-hidden="true">
                        {sub.icon}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: "6px",
                            flexWrap: "wrap",
                            gap: "6px",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "14px",
                              fontWeight: 700,
                              color: tokens.colors.gray[900],
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                            }}
                          >
                            {sub.name_zh}
                            {sub.urgency === "high" && <Badge variant="success">高優先</Badge>}
                          </div>
                          <span
                            style={{
                              fontSize: "14px",
                              fontWeight: 800,
                              color: tokens.colors.success[600],
                            }}
                          >
                            {sub.amount}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: "12px",
                            color: tokens.colors.gray[500],
                            marginBottom: "6px",
                            lineHeight: 1.5,
                          }}
                        >
                          {sub.description_zh}
                        </div>

                        {showSubsidyDetail === sub.id && (
                          <div
                            style={{
                              marginTop: "12px",
                              padding: "12px 14px",
                              background: "white",
                              borderRadius: tokens.borderRadius.md,
                              border: `1px solid ${tokens.colors.gray[200]}`,
                            }}
                          >
                            <div
                              style={{
                                fontSize: "12px",
                                color: tokens.colors.gray[700],
                                marginBottom: "6px",
                              }}
                            >
                              📅 <strong>截止：</strong>
                              {sub.deadline}
                            </div>
                            <div
                              style={{
                                fontSize: "12px",
                                color: tokens.colors.gray[700],
                                marginBottom: "6px",
                              }}
                            >
                              🏛️ <strong>主管機關：</strong>
                              {sub.source}
                            </div>
                            <div
                              style={{
                                fontSize: "12px",
                                color: tokens.colors.success[600],
                                marginBottom: "8px",
                              }}
                            >
                              ✅ <strong>行動：</strong>
                              {sub.action_zh}
                            </div>
                            {sub.portal_url && (
                              <a
                                href={sub.portal_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  marginTop: "8px",
                                  padding: "8px 14px",
                                  borderRadius: tokens.borderRadius.md,
                                  fontSize: "12px",
                                  fontWeight: 700,
                                  background: tokens.colors.success[600],
                                  color: "white",
                                  textDecoration: "none",
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                🔗 前往申請官網
                              </a>
                            )}
                            {sub.eligible_employees?.length > 0 && (
                              <div style={{ marginTop: "12px" }}>
                                <div
                                  style={{
                                    fontSize: "12px",
                                    fontWeight: 600,
                                    color: tokens.colors.gray[700],
                                    marginBottom: "6px",
                                  }}
                                >
                                  符合資格員工：
                                </div>
                                {sub.eligible_employees.map((e: any) => (
                                  <div
                                    key={e.user_id}
                                    style={{
                                      fontSize: "11px",
                                      color: tokens.colors.gray[500],
                                      padding: "4px 8px",
                                      background: tokens.colors.gray[50],
                                      borderRadius: tokens.borderRadius.sm,
                                      marginBottom: "4px",
                                    }}
                                  >
                                    👤 {e.name} — {e.reason}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        <div
                          style={{
                            fontSize: "11px",
                            color: tokens.colors.gray[400],
                            marginTop: "8px",
                          }}
                        >
                          {showSubsidyDetail === sub.id ? "▲ 收合" : "▼ 查看詳情"}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </main>
      )}


      {/* PENDING TAB */}
      {!loading && tab === "pending" && (
        <main role="tabpanel" id="panel-pending" aria-labelledby="tab-pending" style={{ animation: "fadeIn 0.4s" }}>
          {/* Selection Bar */}
          <div
            style={{
              position: "sticky",
              top: isMobile ? "50px" : "60px",
              zIndex: 15,
              background: "white",
              padding: "12px 0",
              borderBottom: `1px solid ${tokens.colors.gray[200]}`,
              marginBottom: "16px",
            }}
          >
            {submissions.length > 0 && selectedIds.size === 0 && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set(submissions.map((s) => s.id)))}>
                全選 ({submissions.length})
              </Button>
            )}
            {selectedIds.size > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: 600,
                    color: tokens.colors.primary[600],
                  }}
                >
                  {selectedIds.size} 筆已選
                </span>
                <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                  取消
                </Button>
              </div>
            )}
          </div>

          {submissions.length === 0 ? (
            <EmptyState
              icon="🎉"
              title="沒有待審核的申請"
              subtitle="All caught up!"
              action={{ label: "查看總覽", onClick: () => setTab("overview") }}
            />
          ) : (
            <div style={{ display: "grid", gap: "12px", paddingBottom: selectedIds.size > 0 ? "100px" : "0" }}>
              {submissions.map((s) => {
                const ft = formMeta[s.form_type];
                const isSelected = selectedIds.has(s.id);

                return (
                  <Card
                    key={s.id}
                    style={{
                      background: isSelected ? tokens.colors.primary[50] : "white",
                      borderColor: isSelected ? tokens.colors.primary[500] : tokens.colors.gray[200],
                      borderWidth: isSelected ? "2px" : "1px",
                      borderLeftWidth: "4px",
                      borderLeftColor: ft?.color || tokens.colors.gray[500],
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        marginBottom: "14px",
                        flexWrap: "wrap",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => toggleSelect(s.id, e as any)}
                        aria-label={`Select submission from ${s.submitter_name}`}
                        style={{
                          width: "20px",
                          height: "20px",
                          cursor: "pointer",
                          accentColor: tokens.colors.primary[600],
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontSize: "24px" }} aria-hidden="true">
                        {ft?.icon}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: "15px",
                            color: tokens.colors.gray[900],
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {ft?.name_zh} — {s.submitter_name || s.submitted_by.slice(0, 16)}
                        </div>
                        <div
                          style={{
                            fontSize: "12px",
                            color: tokens.colors.gray[400],
                            marginTop: "2px",
                          }}
                        >
                          {fmt(s.created_at)}
                          {s.ai_parsed && (
                            <Badge variant="default" size="sm">
                              AI
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        variant={templateView.has(s.id) ? "primary" : "secondary"}
                        size="sm"
                        onClick={() => toggleTemplate(s.id)}
                      >
                        {templateView.has(s.id) ? "📄 一般" : "📋 表單格式"}
                      </Button>
                    </div>

                    {templateView.has(s.id) ? (
                      <div style={{ marginBottom: "14px" }}>
                        <FormTemplate submission={s} />
                      </div>
                    ) : (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(160px, 1fr))",
                          gap: "8px",
                          marginBottom: "14px",
                        }}
                      >
                        {Object.entries(s.form_data)
                          .filter(([k]) => !k.startsWith("_"))
                          .map(([key, val]) => (
                            <div
                              key={key}
                              style={{
                                padding: "8px 10px",
                                background: tokens.colors.gray[50],
                                borderRadius: tokens.borderRadius.md,
                              }}
                            >
                              <div
                                style={{
                                  fontSize: "11px",
                                  color: tokens.colors.gray[400],
                                  fontWeight: 600,
                                  marginBottom: "2px",
                                }}
                              >
                                {fieldLabels[key] || key}
                              </div>
                              <div
                                style={{
                                  fontSize: "13px",
                                  color: tokens.colors.gray[900],
                                  fontWeight: 500,
                                  wordBreak: "break-word",
                                }}
                              >
                                {String(val || "—")}
                              </div>
                            </div>
                          ))}
                      </div>
                    )}

                    {s.original_text && (
                      <div
                        style={{
                          fontSize: "12px",
                          color: tokens.colors.gray[500],
                          padding: "8px 12px",
                          background: tokens.colors.primary[50],
                          borderRadius: tokens.borderRadius.md,
                          marginBottom: "12px",
                          lineHeight: 1.5,
                        }}
                      >
                        💬 {s.original_text}
                      </div>
                    )}

                    <CompliancePanel
                      result={s.compliance_result}
                      id={s.id}
                      expandedId={expandedCompliance}
                      setExpandedId={setExpandedCompliance}
                    />

                    {reviewingId === s.id ? (
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <Input
                          value={reviewNote}
                          onChange={(e) => setReviewNote(e.target.value)}
                          placeholder="備註"
                          style={{ flex: 1, minWidth: "200px" }}
                          autoFocus
                        />
                        <Button variant="success" size="sm" onClick={() => handleReview(s.id, "approved")}>
                          ✅ 核准
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => handleReview(s.id, "rejected")}>
                          ❌ 駁回
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => setReviewingId(null)}>
                          取消
                        </Button>
                      </div>
                    ) : (
                      <Button variant="primary" size="sm" onClick={() => setReviewingId(s.id)}>
                        📋 審核
                      </Button>
                    )}
                  </Card>
                );
              })}
            </div>
          )}

          {/* Batch Action Bar */}
          {selectedIds.size > 0 && (
            <div
              style={{
                position: "fixed",
                bottom: "20px",
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 50,
                width: "calc(100% - 40px)",
                maxWidth: "720px",
                background: "white",
                borderRadius: tokens.borderRadius["2xl"],
                border: `1px solid ${tokens.colors.gray[200]}`,
                boxShadow: tokens.shadows.xl,
                padding: "14px 18px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                flexWrap: "wrap",
                animation: "slideIn 0.3s ease-out",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 14px",
                  borderRadius: tokens.borderRadius.md,
                  background: tokens.colors.primary[100],
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: tokens.borderRadius.sm,
                    background: tokens.colors.primary[600],
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span style={{ color: "white", fontSize: "11px", fontWeight: 800 }}>✓</span>
                </div>
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: 700,
                    color: tokens.colors.primary[800],
                  }}
                >
                  {selectedIds.size} 筆已選
                </span>
              </div>

              <Input
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder="備註（選填）"
                style={{ flex: 1, minWidth: "150px" }}
              />

              <Button variant="success" size="sm" onClick={() => handleBatch("approved")}>
                ✓ 批次核准
              </Button>
              <Button variant="danger" size="sm" onClick={() => handleBatch("rejected")}>
                ✕ 批次駁回
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setSelectedIds(new Set())}>
                × 取消
              </Button>
            </div>
          )}
        </main>
      )}

      {/* EMPLOYEES TAB */}
      {!loading && tab === "employees" && (
        <main role="tabpanel" id="panel-employees" aria-labelledby="tab-employees" style={{ animation: "fadeIn 0.4s" }}>
          {/* Search and Sort */}
          <div
            style={{
              display: "flex",
              gap: "12px",
              marginBottom: "18px",
              flexWrap: "wrap",
            }}
          >
            <Input
              value={empSearch}
              onChange={(e) => setEmpSearch(e.target.value)}
              placeholder="🔍 搜尋員工姓名或 email..."
              style={{ flex: 1, minWidth: "200px" }}
              leftIcon="🔍"
            />
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {[
                { key: "name", label: "姓名" },
                { key: "pending", label: "待審" },
                { key: "leave", label: "請假多" },
                { key: "overtime", label: "加班多" },
              ].map((s) => (
                <Button
                  key={s.key}
                  variant={empSort === s.key ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => setEmpSort(s.key as typeof empSort)}
                >
                  {s.label}
                </Button>
              ))}
            </div>
          </div>

          <div
            style={{
              fontSize: "12px",
              color: tokens.colors.gray[400],
              marginBottom: "14px",
            }}
          >
            顯示 {filteredEmployees.length} / {employees.length} 位員工
          </div>

          {filteredEmployees.length === 0 ? (
            <EmptyState
              icon="👥"
              title={debouncedEmpSearch ? "找不到符合的員工" : "尚無員工資料"}
              subtitle={debouncedEmpSearch ? "請嘗試其他關鍵字" : "員工登入後會自動建立資料"}
            />
          ) : (
            <div style={{ display: "grid", gap: "12px" }}>
              {filteredEmployees.map((emp) => {
                const isExpanded = expandedEmployee === emp.user_id;
                const lb = emp.leave_balance;

                return (
                  <Card key={emp.user_id} padding="sm" style={{ padding: 0, overflow: "hidden" }}>
                    <div
                      onClick={() => loadEmployeeDetail(emp.user_id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          loadEmployeeDetail(emp.user_id);
                        }
                      }}
                      style={{
                        padding: "16px 18px",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "12px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                        <Avatar name={emp.name || "?"} />
                        <div>
                          <div
                            style={{
                              fontWeight: 700,
                              fontSize: "14px",
                              color: tokens.colors.gray[900],
                            }}
                          >
                            {emp.name || emp.user_id.slice(0, 12)}
                          </div>
                          <div
                            style={{
                              fontSize: "12px",
                              color: tokens.colors.gray[400],
                              marginTop: "2px",
                            }}
                          >
                            {emp.email}
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: "12px",
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        {emp.pending > 0 && <Badge variant="warning">{emp.pending} 待審</Badge>}
                        <div
                          style={{
                            display: "flex",
                            gap: "12px",
                            fontSize: "12px",
                            color: tokens.colors.gray[500],
                          }}
                        >
                          <span>📝{emp.leave_days_taken}天</span>
                          <span>🕐{emp.overtime_hours}hr</span>
                        </div>
                        <span
                          style={{
                            fontSize: "16px",
                            color: tokens.colors.gray[400],
                            transition: "transform 0.2s",
                            transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                          }}
                          aria-hidden="true"
                        >
                          ▼
                        </span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{ borderTop: `1px solid ${tokens.colors.gray[200]}` }}>
                        {lb && (
                          <div
                            style={{
                              padding: "18px",
                              background: tokens.colors.gray[50],
                            }}
                          >
                            <h3
                              style={{
                                fontSize: "14px",
                                fontWeight: 700,
                                color: tokens.colors.gray[900],
                                marginBottom: "14px",
                              }}
                            >
                              🏖️ 假期餘額
                            </h3>
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(150px, 1fr))",
                                gap: "10px",
                              }}
                            >
                              {[
                                {
                                  label: "特休 Annual",
                                  used: lb.annual_used,
                                  total: lb.annual_total,
                                  color: tokens.colors.primary[600],
                                  tag: "有薪",
                                  tagColor: "success" as const,
                                },
                                {
                                  label: "病假 Sick",
                                  used: lb.sick_used,
                                  total: lb.sick_total,
                                  color: tokens.colors.info[600],
                                  tag: "半薪",
                                  tagColor: "warning" as const,
                                },
                                {
                                  label: "事假 Personal",
                                  used: lb.personal_used,
                                  total: lb.personal_total,
                                  color: tokens.colors.warning[600],
                                  tag: "無薪",
                                  tagColor: "danger" as const,
                                },
                                {
                                  label: "家庭照顧",
                                  used: lb.family_care_used,
                                  total: lb.family_care_total,
                                  color: tokens.colors.success[600],
                                  tag: "有薪",
                                  tagColor: "success" as const,
                                },
                              ].map((b) => {
                                const remaining = b.total - b.used;
                                const percentage = b.total > 0 ? Math.min((b.used / b.total) * 100, 100) : 0;
                                const isLow = b.total > 0 && remaining / b.total <= 0.2;

                                return (
                                  <div
                                    key={b.label}
                                    style={{
                                      padding: "12px",
                                      background: "white",
                                      borderRadius: tokens.borderRadius.md,
                                      border: `1px solid ${tokens.colors.gray[200]}`,
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        marginBottom: "6px",
                                      }}
                                    >
                                      <div
                                        style={{
                                          fontSize: "11px",
                                          color: tokens.colors.gray[500],
                                          fontWeight: 600,
                                        }}
                                      >
                                        {b.label}
                                      </div>
                                      <Badge variant={b.tagColor} size="sm">
                                        {b.tag}
                                      </Badge>
                                    </div>
                                    <div
                                      style={{
                                        height: "6px",
                                        background: tokens.colors.gray[200],
                                        borderRadius: tokens.borderRadius.full,
                                        overflow: "hidden",
                                        marginBottom: "6px",
                                      }}
                                    >
                                      <div
                                        style={{
                                          height: "100%",
                                          width: `${percentage}%`,
                                          background:
                                            remaining <= 0
                                              ? tokens.colors.danger[500]
                                              : isLow
                                              ? tokens.colors.warning[500]
                                              : b.color,
                                          borderRadius: tokens.borderRadius.full,
                                          transition: `width ${tokens.transitions.slow}`,
                                        }}
                                      />
                                    </div>
                                    <div
                                      style={{
                                        fontSize: "15px",
                                        fontWeight: 700,
                                        color: remaining <= 0 ? tokens.colors.danger[600] : tokens.colors.gray[800],
                                      }}
                                    >
                                      {remaining}
                                      <span
                                        style={{
                                          fontWeight: 400,
                                          color: tokens.colors.gray[400],
                                          fontSize: "12px",
                                        }}
                                      >
                                        /{b.total}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <div style={{ padding: "18px" }}>
                          <h3
                            style={{
                              fontSize: "14px",
                              fontWeight: 700,
                              color: tokens.colors.gray[900],
                              marginBottom: "14px",
                            }}
                          >
                            📜 近期申請
                          </h3>
                          {employeeSubmissions.length === 0 ? (
                            <div
                              style={{
                                fontSize: "14px",
                                color: tokens.colors.gray[400],
                              }}
                            >
                              無申請紀錄
                            </div>
                          ) : (
                            <div style={{ display: "grid", gap: "8px" }}>
                              {employeeSubmissions.slice(0, 10).map((s) => {
                                const ft = formMeta[s.form_type];
                                const st = statusConfig[s.status] || statusConfig.pending;

                                return (
                                  <div
                                    key={s.id}
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                      padding: "10px 14px",
                                      background: tokens.colors.gray[50],
                                      borderRadius: tokens.borderRadius.md,
                                      borderLeft: `3px solid ${ft?.color || tokens.colors.gray[500]}`,
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "10px",
                                      }}
                                    >
                                      <span style={{ fontSize: "18px" }} aria-hidden="true">
                                        {ft?.icon}
                                      </span>
                                      <div>
                                        <div
                                          style={{
                                            fontSize: "13px",
                                            fontWeight: 600,
                                            color: tokens.colors.gray[900],
                                          }}
                                        >
                                          {ft?.name_zh} — {s.form_data.leave_type || s.form_data.overtime_type || s.form_data.destination || ""}
                                        </div>
                                        <div
                                          style={{
                                            fontSize: "11px",
                                            color: tokens.colors.gray[400],
                                          }}
                                        >
                                          {s.form_data.start_date || s.form_data.date || ""} ·{" "}
                                          {s.form_data.days
                                            ? `${s.form_data.days}天`
                                            : s.form_data.hours
                                            ? `${s.form_data.hours}hr`
                                            : ""}
                                        </div>
                                      </div>
                                    </div>
                                    <span
                                      style={{
                                        padding: "3px 10px",
                                        borderRadius: tokens.borderRadius.md,
                                        fontSize: "11px",
                                        fontWeight: 600,
                                        background: st.bg,
                                        color: st.color,
                                      }}
                                    >
                                      {st.label}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </main>
      )}


      {/* LEAVE TAB (Requests Overview) */}
      {!loading && tab === "leave" && (
        <main role="tabpanel" id="panel-leave" aria-labelledby="tab-leave" style={{ animation: "fadeIn 0.4s" }}>
          {/* Month picker + CSV export */}
          <Card style={{ marginBottom: "20px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "14px", fontWeight: 600, color: tokens.colors.gray[700] }}>📅</span>
                <input
                  type="month"
                  value={adminMonthFilter}
                  onChange={(e) => setAdminMonthFilter(e.target.value)}
                  style={{
                    padding: "8px 12px",
                    border: `1px solid ${tokens.colors.gray[300]}`,
                    borderRadius: tokens.borderRadius.md,
                    fontSize: "14px",
                    outline: "none",
                    color: tokens.colors.gray[900],
                    background: "white",
                  }}
                />
              </div>
              <Button variant="secondary" onClick={exportMonthlyCSV} leftIcon="📥">
                匯出 {adminMonthFilter} 報表 (CSV)
              </Button>
            </div>
          </Card>

          {/* Sub-tabs */}
          <Tabs
            tabs={[
              { key: "leave", label: "📝 請假", count: allSubmissions.filter((s) => s.form_type === "leave").length },
              { key: "overtime", label: "🕐 加班", count: allOvertime.length },
              { key: "business_trip", label: "✈️ 出差", count: allTrips.length },
            ]}
            activeTab={requestSubTab}
            onChange={(key) => setRequestSubTab(key as typeof requestSubTab)}
            variant="pills"
          />

          {/* LEAVE SUB-TAB */}
          {requestSubTab === "leave" && (
            <div>
              {/* Monthly stats cards */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
                  gap: "12px",
                  marginBottom: "20px",
                }}
              >
                <StatCard
                  label={`${adminMonthFilter} 請假天數`}
                  value={monthlyLeaveDays}
                  icon="📝"
                  color="warning"
                  unit="天"
                />
                <StatCard
                  label={`${adminMonthFilter} 加班時數`}
                  value={monthlyOTHours}
                  icon="🕐"
                  color="info"
                  unit="小時"
                />
                <StatCard label="特休用盡員工" value={leaveStats.exhausted} icon="⚠️" color="success" unit="人" />
              </div>

              {/* Today's Status */}
              <Card style={{ marginBottom: "20px", padding: 0, overflow: "hidden" }}>
                <div
                  style={{
                    padding: "14px 18px",
                    background: tokens.colors.gray[50],
                    borderBottom: `1px solid ${tokens.colors.gray[200]}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "10px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "18px" }} aria-hidden="true">
                      📍
                    </span>
                    <span style={{ fontSize: "14px", fontWeight: 700, color: tokens.colors.gray[900] }}>今日請假</span>
                    <Badge variant={onLeaveToday.length > 0 ? "danger" : "success"}>{onLeaveToday.length} 人</Badge>
                  </div>
                  {upcomingLeave.length > 0 && (
                    <span style={{ fontSize: "12px", color: tokens.colors.gray[500] }}>
                      未來7天還有 {upcomingLeave.length} 人請假
                    </span>
                  )}
                </div>

                {onLeaveToday.length === 0 ? (
                  <div
                    style={{
                      padding: "24px 18px",
                      textAlign: "center",
                      color: tokens.colors.success[600],
                      fontSize: "14px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                    }}
                  >
                    <span>✅</span> 今日全員出勤
                  </div>
                ) : (
                  <div style={{ padding: "12px", display: "grid", gap: "8px" }}>
                    {onLeaveToday.map((s) => (
                      <div
                        key={s.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "12px 14px",
                          background: tokens.colors.danger[50],
                          borderRadius: tokens.borderRadius.md,
                          borderLeft: `4px solid ${tokens.colors.danger[500]}`,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <Avatar name={s.submitter_name || "?"} color={tokens.colors.danger[500]} size="sm" />
                          <div>
                            <div style={{ fontSize: "14px", fontWeight: 600, color: tokens.colors.gray[900] }}>
                              {s.submitter_name}
                            </div>
                            <div style={{ fontSize: "12px", color: tokens.colors.gray[500], marginTop: "2px" }}>
                              {s.form_data.leave_type} · {s.form_data.start_date} →{" "}
                              {s.form_data.end_date || s.form_data.start_date}
                            </div>
                          </div>
                        </div>
                        <Badge variant="danger">請假中</Badge>
                      </div>
                    ))}
                  </div>
                )}

                {upcomingLeave.length > 0 && (
                  <div style={{ borderTop: `1px solid ${tokens.colors.gray[100]}` }}>
                    <div
                      style={{
                        padding: "12px 18px 8px",
                        fontSize: "12px",
                        fontWeight: 700,
                        color: tokens.colors.gray[500],
                      }}
                    >
                      📅 即將請假 (7天內)
                    </div>
                    <div style={{ padding: "0 12px 12px", display: "grid", gap: "6px" }}>
                      {upcomingLeave.slice(0, 5).map((s) => (
                        <div
                          key={s.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "10px 14px",
                            background: tokens.colors.warning[50],
                            borderRadius: tokens.borderRadius.md,
                            borderLeft: `4px solid ${tokens.colors.warning[500]}`,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <Avatar name={s.submitter_name || "?"} color={tokens.colors.warning[500]} size="sm" />
                            <div>
                              <div style={{ fontSize: "13px", fontWeight: 600, color: tokens.colors.gray[900] }}>
                                {s.submitter_name}
                              </div>
                              <div style={{ fontSize: "11px", color: tokens.colors.gray[500], marginTop: "2px" }}>
                                {s.form_data.leave_type} · {s.form_data.start_date} →{" "}
                                {s.form_data.end_date || s.form_data.start_date}
                              </div>
                            </div>
                          </div>
                          <span
                            style={{
                              fontSize: "12px",
                              color: tokens.colors.warning[700],
                              fontWeight: 600,
                            }}
                          >
                            {s.form_data.days}天
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>

              {/* Stats Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
                  gap: "12px",
                  marginBottom: "20px",
                }}
              >
                <StatCard
                  label="全勤員工"
                  value={leaveStats.withBalance - leaveStats.exhausted - leaveStats.lowLeave}
                  icon="✅"
                  color="success"
                />
                <StatCard label="餘額不足 (≤2天)" value={leaveStats.lowLeave} icon="⚠️" color="warning" />
                <StatCard label="特休已用盡" value={leaveStats.exhausted} icon="🚨" color="danger" />
                <StatCard
                  label="待審請假申請"
                  value={pendingLeave.length}
                  icon="📋"
                  color="primary"
                  onClick={() => setTab("pending")}
                />
              </div>

              {/* Pending Leave Alert */}
              {pendingLeave.length > 0 && (
                <Card
                  style={{
                    marginBottom: "20px",
                    background: tokens.colors.warning[50],
                    borderColor: tokens.colors.warning[200],
                  }}
                >
                  <h3
                    style={{
                      fontSize: "14px",
                      fontWeight: 700,
                      color: tokens.colors.warning[800],
                      marginBottom: "12px",
                    }}
                  >
                    ⏳ 待審請假 — 通過後將扣減餘額
                  </h3>
                  <div style={{ display: "grid", gap: "8px" }}>
                    {pendingLeave.map((s) => (
                      <div
                        key={s.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "10px 14px",
                          background: "white",
                          borderRadius: tokens.borderRadius.md,
                        }}
                      >
                        <div>
                          <span style={{ fontSize: "14px", fontWeight: 600, color: tokens.colors.gray[900] }}>
                            {s.submitter_name}
                          </span>
                          <span
                            style={{
                              fontSize: "13px",
                              color: tokens.colors.gray[500],
                              marginLeft: "10px",
                            }}
                          >
                            {s.form_data.leave_type} · {s.form_data.days} 天
                          </span>
                        </div>
                        <button
                          onClick={() => setTab("pending")}
                          style={{
                            fontSize: "12px",
                            color: tokens.colors.primary[600],
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            fontWeight: 600,
                            minHeight: "32px",
                            padding: "4px 8px",
                          }}
                        >
                          審核 →
                        </button>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Search */}
              <Input
                value={leaveSearch}
                onChange={(e) => setLeaveSearch(e.target.value)}
                placeholder="🔍 搜尋員工..."
                style={{ marginBottom: "16px" }}
                leftIcon="🔍"
              />

              {/* Leave Balance Table */}
              {leaveOverviewEmployees.length === 0 ? (
                <EmptyState
                  icon="🏖️"
                  title="尚無假期資料"
                  subtitle="員工登入後系統會自動建立假期餘額"
                />
              ) : (
                <Card padding="sm" style={{ padding: 0, overflow: "hidden" }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: isMobile ? "2fr 1fr 1fr" : "1.5fr 1fr 1fr 1fr 1fr",
                      padding: "12px 16px",
                      background: tokens.colors.gray[50],
                      borderBottom: `1px solid ${tokens.colors.gray[200]}`,
                      gap: "8px",
                    }}
                  >
                    {["員工", "特休 Annual", "病假 Sick", "事假 Personal", "家庭照顧"]
                      .slice(0, isMobile ? 3 : 5)
                      .map((h, i) => (
                        <div
                          key={h}
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            color: tokens.colors.gray[500],
                            textAlign: i === 0 ? "left" : "center",
                          }}
                        >
                          {h}
                        </div>
                      ))}
                  </div>
                  {leaveOverviewEmployees.map((emp, idx) => {
                    const lb = emp.leave_balance!;
                    const remaining = lb.annual_total - lb.annual_used;
                    const isExhausted = remaining <= 0 && lb.annual_total > 0;
                    const isLow = remaining > 0 && remaining <= 2;

                    return (
                      <div
                        key={emp.user_id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: isMobile ? "2fr 1fr 1fr" : "1.5fr 1fr 1fr 1fr 1fr",
                          padding: "14px 16px",
                          alignItems: "center",
                          background: isExhausted
                            ? tokens.colors.danger[50]
                            : isLow
                            ? tokens.colors.warning[50]
                            : idx % 2 === 0
                            ? "white"
                            : tokens.colors.gray[50],
                          borderBottom: `1px solid ${tokens.colors.gray[100]}`,
                          gap: "8px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <Avatar
                            name={emp.name || "?"}
                            color={isExhausted ? tokens.colors.danger[500] : undefined}
                            size="sm"
                          />
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: "13px",
                                fontWeight: 600,
                                color: tokens.colors.gray[900],
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {emp.name || emp.email}
                            </div>
                            {isExhausted && (
                              <div
                                style={{
                                  fontSize: "10px",
                                  color: tokens.colors.danger[600],
                                  fontWeight: 600,
                                }}
                              >
                                特休已用盡
                              </div>
                            )}
                            {isLow && !isExhausted && (
                              <div
                                style={{
                                  fontSize: "10px",
                                  color: tokens.colors.warning[700],
                                  fontWeight: 600,
                                }}
                              >
                                餘額不足
                              </div>
                            )}
                          </div>
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <BalanceBar used={lb.annual_used} total={lb.annual_total} color={tokens.colors.primary[600]} />
                        </div>
                        {!isMobile && (
                          <>
                            <div style={{ textAlign: "center" }}>
                              <BalanceBar used={lb.sick_used} total={lb.sick_total} color={tokens.colors.info[600]} />
                            </div>
                            <div style={{ textAlign: "center" }}>
                              <BalanceBar
                                used={lb.personal_used}
                                total={lb.personal_total}
                                color={tokens.colors.warning[600]}
                              />
                            </div>
                            <div style={{ textAlign: "center" }}>
                              <BalanceBar
                                used={lb.family_care_used}
                                total={lb.family_care_total}
                                color={tokens.colors.success[600]}
                              />
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                  <div
                    style={{
                      padding: "12px 16px",
                      background: tokens.colors.gray[50],
                      borderTop: `1px solid ${tokens.colors.gray[200]}`,
                      fontSize: "11px",
                      color: tokens.colors.gray[400],
                    }}
                  >
                    {new Date().getFullYear()} 年度假期餘額 · 顯示 {leaveOverviewEmployees.length} 位員工
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* OVERTIME SUB-TAB */}
          {requestSubTab === "overtime" && (
            <div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
                  gap: "12px",
                  marginBottom: "20px",
                }}
              >
                <StatCard label="總加班申請" value={allOvertime.length} icon="🕐" color="info" />
                <StatCard
                  label="已核准"
                  value={allOvertime.filter((s) => s.status === "approved").length}
                  icon="✅"
                  color="success"
                />
                <StatCard label="本月加班時數" value={thisMonthOvertime} icon="⏱️" color="warning" unit="hr" />
              </div>

              <Input
                value={overtimeSearch}
                onChange={(e) => setOvertimeSearch(e.target.value)}
                placeholder="🔍 搜尋員工姓名..."
                style={{ marginBottom: "16px" }}
                leftIcon="🔍"
              />

              {allOvertime.filter(
                (s) => !overtimeSearch || s.submitter_name?.toLowerCase().includes(overtimeSearch.toLowerCase())
              ).length === 0 ? (
                <EmptyState icon="🕐" title="尚無加班申請" subtitle="員工提交加班申請後會顯示在這裡" />
              ) : (
                <Card padding="sm" style={{ padding: 0, overflow: "hidden" }}>
                  {allOvertime
                    .filter(
                      (s) => !overtimeSearch || s.submitter_name?.toLowerCase().includes(overtimeSearch.toLowerCase())
                    )
                    .map((s, idx, arr) => {
                      const st = statusConfig[s.status] || statusConfig.pending;

                      return (
                        <div
                          key={s.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "14px 18px",
                            borderBottom: idx < arr.length - 1 ? `1px solid ${tokens.colors.gray[100]}` : "none",
                            background: idx % 2 === 0 ? "white" : tokens.colors.gray[50],
                            borderLeft: `4px solid ${tokens.colors.info[600]}`,
                            flexWrap: "wrap",
                            gap: "10px",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <span style={{ fontSize: "20px" }} aria-hidden="true">
                              🕐
                            </span>
                            <div>
                              <div style={{ fontSize: "14px", fontWeight: 600, color: tokens.colors.gray[900] }}>
                                {s.submitter_name}
                              </div>
                              <div style={{ fontSize: "12px", color: tokens.colors.gray[500], marginTop: "2px" }}>
                                {s.form_data.date || s.form_data.start_date || "—"} ·{" "}
                                {s.form_data.hours ? `${s.form_data.hours} 小時` : "—"}
                                {s.form_data.overtime_type && (
                                  <span style={{ marginLeft: "8px", color: tokens.colors.gray[400] }}>
                                    {s.form_data.overtime_type}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <span style={{ fontSize: "12px", color: tokens.colors.gray[400] }}>{fmt(s.created_at)}</span>
                            <span
                              style={{
                                padding: "3px 10px",
                                borderRadius: tokens.borderRadius.full,
                                fontSize: "11px",
                                fontWeight: 700,
                                background: st.bg,
                                color: st.color,
                              }}
                            >
                              {st.label}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </Card>
              )}
            </div>
          )}

          {/* BUSINESS TRIP SUB-TAB */}
          {requestSubTab === "business_trip" && (
            <div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
                  gap: "12px",
                  marginBottom: "20px",
                }}
              >
                <StatCard label="總出差申請" value={allTrips.length} icon="✈️" color="success" />
                <StatCard
                  label="已核准"
                  value={allTrips.filter((s) => s.status === "approved").length}
                  icon="✅"
                  color="success"
                />
                <StatCard
                  label="待審核"
                  value={allTrips.filter((s) => s.status === "pending").length}
                  icon="⏳"
                  color="warning"
                />
              </div>

              <Input
                value={tripSearch}
                onChange={(e) => setTripSearch(e.target.value)}
                placeholder="🔍 搜尋員工姓名或地點..."
                style={{ marginBottom: "16px" }}
                leftIcon="🔍"
              />

              {allTrips.filter(
                (s) =>
                  !tripSearch ||
                  s.submitter_name?.toLowerCase().includes(tripSearch.toLowerCase()) ||
                  s.form_data?.destination?.toLowerCase().includes(tripSearch.toLowerCase())
              ).length === 0 ? (
                <EmptyState icon="✈️" title="尚無出差申請" subtitle="員工提交出差申請後會顯示在這裡" />
              ) : (
                <Card padding="sm" style={{ padding: 0, overflow: "hidden" }}>
                  {allTrips
                    .filter(
                      (s) =>
                        !tripSearch ||
                        s.submitter_name?.toLowerCase().includes(tripSearch.toLowerCase()) ||
                        s.form_data?.destination?.toLowerCase().includes(tripSearch.toLowerCase())
                    )
                    .map((s, idx, arr) => {
                      const st = statusConfig[s.status] || statusConfig.pending;

                      return (
                        <div
                          key={s.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "14px 18px",
                            borderBottom: idx < arr.length - 1 ? `1px solid ${tokens.colors.gray[100]}` : "none",
                            background: idx % 2 === 0 ? "white" : tokens.colors.gray[50],
                            borderLeft: `4px solid ${tokens.colors.success[600]}`,
                            flexWrap: "wrap",
                            gap: "10px",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <span style={{ fontSize: "20px" }} aria-hidden="true">
                              ✈️
                            </span>
                            <div>
                              <div style={{ fontSize: "14px", fontWeight: 600, color: tokens.colors.gray[900] }}>
                                {s.submitter_name}
                              </div>
                              <div style={{ fontSize: "12px", color: tokens.colors.gray[500], marginTop: "2px" }}>
                                {s.form_data.destination || "—"} · {s.form_data.start_date || "—"} →{" "}
                                {s.form_data.end_date || "—"}
                                {s.form_data.transport && (
                                  <span style={{ marginLeft: "8px", color: tokens.colors.gray[400] }}>
                                    {s.form_data.transport}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <span style={{ fontSize: "12px", color: tokens.colors.gray[400] }}>{fmt(s.created_at)}</span>
                            <span
                              style={{
                                padding: "3px 10px",
                                borderRadius: tokens.borderRadius.full,
                                fontSize: "11px",
                                fontWeight: 700,
                                background: st.bg,
                                color: st.color,
                              }}
                            >
                              {st.label}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </Card>
              )}
            </div>
          )}
        </main>
      )}


      {/* COMPLIANCE TAB */}
      {!loading && tab === "compliance" && (
        <main role="tabpanel" id="panel-compliance" aria-labelledby="tab-compliance" style={{ animation: "fadeIn 0.4s" }}>
          {/* Sync Status Card */}
          <Card style={{ marginBottom: "20px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "16px",
              }}
            >
              <div>
                <h2
                  style={{
                    fontSize: "16px",
                    fontWeight: 700,
                    color: tokens.colors.gray[900],
                    marginBottom: "6px",
                  }}
                >
                  ⚖️ 合規規則資料庫
                </h2>
                <p
                  style={{
                    fontSize: "13px",
                    color: tokens.colors.gray[500],
                    marginBottom: "4px",
                  }}
                >
                  {complianceStatus?.total_rules || 0} 條勞基法規則已載入
                  {complianceStatus?.last_sync
                    ? ` · 上次更新：${new Date(complianceStatus.last_sync).toLocaleDateString("zh-TW", {
                        month: "short",
                        day: "numeric",
                      })}`
                    : " · 尚未同步"}
                </p>
                <p
                  style={{
                    fontSize: "12px",
                    color: tokens.colors.gray[400],
                  }}
                >
                  資料來源：勞動部開放資料 API（apiservice.mol.gov.tw）
                </p>
              </div>
              <Button onClick={handleSync} isLoading={syncing} disabled={syncing}>
                {syncing ? "⏳ 同步中..." : "🔄 立即同步"}
              </Button>
            </div>
          </Card>

          {/* Rules List */}
          <Card style={{ marginBottom: "20px" }}>
            <h2
              style={{
                fontSize: "16px",
                fontWeight: 700,
                color: tokens.colors.gray[900],
                marginBottom: "18px",
              }}
            >
              📖 主要合規規則
            </h2>
            <div style={{ display: "grid", gap: "10px" }}>
              {[
                {
                  art: "LSA Art. 30/32",
                  rule: "每日工時上限12小時，每月加班上限46-54小時",
                  color: tokens.colors.info[600],
                  url: "https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=N0030001&flno=30",
                },
                {
                  art: "LSA Art. 24",
                  rule: "加班費率：前2小時 1.34x，後2小時 1.67x，假日 2x",
                  color: tokens.colors.warning[600],
                  url: "https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=N0030001&flno=24",
                },
                {
                  art: "LSA Art. 38",
                  rule: "特休：滿半年3天，滿1年7天，逐年遞增至30天",
                  color: tokens.colors.primary[600],
                  url: "https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=N0030001&flno=38",
                },
                {
                  art: "LSA Art. 50",
                  rule: "產假56天，滿6個月全薪",
                  color: tokens.colors.danger[600],
                  url: "https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=N0030001&flno=50",
                },
                {
                  art: "2026 更新",
                  rule: "家庭照顧假可按小時請假（56小時/年），全勤獎金比例扣減",
                  color: tokens.colors.success[600],
                  url: "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=N0030036",
                },
                {
                  art: "2026 基本工資",
                  rule: "月薪 NT$29,500 / 時薪 NT$196",
                  color: tokens.colors.success[600],
                  url: "https://www.mol.gov.tw/1607/1632/1633/56601/",
                },
              ].map((r) => (
                <div
                  key={r.art}
                  style={{
                    display: "flex",
                    gap: "12px",
                    alignItems: "center",
                    padding: "12px 14px",
                    background: tokens.colors.gray[50],
                    borderRadius: tokens.borderRadius.md,
                    borderLeft: `3px solid ${r.color}`,
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "10px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: "12px",
                      alignItems: "flex-start",
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        color: r.color,
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}
                    >
                      {r.art}
                    </span>
                    <span
                      style={{
                        fontSize: "14px",
                        color: tokens.colors.gray[700],
                        lineHeight: 1.5,
                      }}
                    >
                      {r.rule}
                    </span>
                  </div>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      color: r.color,
                      textDecoration: "none",
                      whiteSpace: "nowrap",
                      padding: "4px 10px",
                      borderRadius: tokens.borderRadius.md,
                      border: `1px solid ${r.color}30`,
                      background: "white",
                      flexShrink: 0,
                    }}
                  >
                    查看全文 →
                  </a>
                </div>
              ))}
            </div>
          </Card>

          {/* Data Sources */}
          <Card
            style={{
              background: tokens.colors.gray[50],
              marginBottom: "20px",
            }}
          >
            <h3
              style={{
                fontSize: "14px",
                fontWeight: 700,
                color: tokens.colors.gray[600],
                marginBottom: "10px",
              }}
            >
              🔗 資料來源
            </h3>
            <p
              style={{
                fontSize: "13px",
                color: tokens.colors.gray[500],
                lineHeight: 1.8,
              }}
            >
              勞動部開放資料 API: apiservice.mol.gov.tw
              <br />
              全國法規資料庫: law.moj.gov.tw
              <br />
              更新頻率: 可手動同步，建議每週一次
            </p>
          </Card>

          <ComplianceConflictScanner />
        </main>
      )}

      {/* ESG TAB */}
      {!loading && tab === "esg" && (
        <main role="tabpanel" id="panel-esg" aria-labelledby="tab-esg" style={{ animation: "fadeIn 0.4s" }}>
          {/* Header + Export */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: "24px",
              flexWrap: "wrap",
              gap: "16px",
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: "18px",
                  fontWeight: 800,
                  color: tokens.colors.gray[900],
                  marginBottom: "6px",
                }}
              >
                🌿 ESG 社會面報告 — S-Pillar
              </h2>
              <p
                style={{
                  fontSize: "13px",
                  color: tokens.colors.gray[500],
                  lineHeight: 1.5,
                }}
              >
                資料來源：Atlas EIP 即時工作流程與合規記錄 · 自動彙整，無需人工填報
              </p>
            </div>
            <Button variant="success" onClick={() => window.print()} leftIcon="📄">
              匯出報告
            </Button>
          </div>

          {/* Section 1: Workforce Overview */}
          <Card style={{ marginBottom: "20px" }}>
            <h3
              style={{
                fontSize: "15px",
                fontWeight: 700,
                color: tokens.colors.gray[900],
                marginBottom: "18px",
              }}
            >
              👥 勞動力概況 Workforce Overview
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(auto-fill, minmax(160px, 1fr))",
                gap: "12px",
              }}
            >
              {[
                {
                  label: "全體員工數",
                  value: employees.length,
                  unit: "人",
                  color: "primary" as const,
                },
                {
                  label: "本月核准申請",
                  value: thisMonthApproved,
                  unit: "件",
                  color: "info" as const,
                },
                {
                  label: "本月加班時數",
                  value: thisMonthOvertime,
                  unit: "小時",
                  color: "warning" as const,
                },
                {
                  label: "加班超標人數",
                  value: shadowRisks.filter((r) => r.risk_level === "critical").length,
                  unit: "人",
                  color: "danger" as const,
                },
              ].map((s) => (
                <StatCard key={s.label} label={s.label} value={s.value} icon="" color={s.color} unit={s.unit} />
              ))}
            </div>
          </Card>

          {/* Section 2: Overtime Compliance */}
          <Card style={{ marginBottom: "20px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "18px",
                flexWrap: "wrap",
                gap: "10px",
              }}
            >
              <h3
                style={{
                  fontSize: "15px",
                  fontWeight: 700,
                  color: tokens.colors.gray[900],
                }}
              >
                🕐 加班合規率 Overtime Compliance
              </h3>
              <Badge variant="success">依 LSA Art. 32</Badge>
            </div>

            {(() => {
              const total = employees.length;
              const critical = shadowRisks.filter((r) => r.risk_level === "critical").length;
              const warning = shadowRisks.filter((r) => r.risk_level === "warning").length;
              const compliant = Math.max(0, total - critical - warning);
              const complianceRate = total > 0 ? Math.round((compliant / total) * 100) : 100;

              return (
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "16px",
                      marginBottom: "18px",
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        height: "14px",
                        background: tokens.colors.gray[200],
                        borderRadius: tokens.borderRadius.full,
                        overflow: "hidden",
                      }}
                      role="progressbar"
                      aria-valuenow={complianceRate}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`Compliance rate: ${complianceRate}%`}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${complianceRate}%`,
                          background:
                            complianceRate >= 90
                              ? tokens.colors.success[500]
                              : complianceRate >= 70
                              ? tokens.colors.warning[500]
                              : tokens.colors.danger[500],
                          borderRadius: tokens.borderRadius.full,
                          transition: `width ${tokens.transitions.slow}`,
                        }}
                      />
                    </div>
                    <div
                      style={{
                        fontSize: "24px",
                        fontWeight: 800,
                        color:
                          complianceRate >= 90
                            ? tokens.colors.success[600]
                            : complianceRate >= 70
                            ? tokens.colors.warning[600]
                            : tokens.colors.danger[600],
                        minWidth: "70px",
                        textAlign: "right",
                      }}
                    >
                      {complianceRate}%
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
                      gap: "10px",
                    }}
                  >
                    {[
                      { label: "✅ 合規", value: compliant, color: "success" as const },
                      { label: "⚠️ 接近上限", value: warning, color: "warning" as const },
                      { label: "🚨 超標", value: critical, color: "danger" as const },
                    ].map((s) => (
                      <div
                        key={s.label}
                        style={{
                          padding: "14px",
                          background:
                            s.color === "success"
                              ? tokens.colors.success[50]
                              : s.color === "warning"
                              ? tokens.colors.warning[50]
                              : tokens.colors.danger[50],
                          borderRadius: tokens.borderRadius.md,
                          textAlign: "center",
                          border: `1px solid ${
                            s.color === "success"
                              ? tokens.colors.success[200]
                              : s.color === "warning"
                              ? tokens.colors.warning[200]
                              : tokens.colors.danger[200]
                          }`,
                        }}
                      >
                        <div
                          style={{
                            fontSize: "22px",
                            fontWeight: 800,
                            color:
                              s.color === "success"
                                ? tokens.colors.success[700]
                                : s.color === "warning"
                                ? tokens.colors.warning[700]
                                : tokens.colors.danger[700],
                          }}
                        >
                          {s.value}
                        </div>
                        <div
                          style={{
                            fontSize: "12px",
                            color:
                              s.color === "success"
                                ? tokens.colors.success[700]
                                : s.color === "warning"
                                ? tokens.colors.warning[700]
                                : tokens.colors.danger[700],
                            opacity: 0.85,
                            marginTop: "4px",
                          }}
                        >
                          {s.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </Card>

          {/* Section 3: Leave Approval Rates */}
          <Card style={{ marginBottom: "20px" }}>
            <h3
              style={{
                fontSize: "15px",
                fontWeight: 700,
                color: tokens.colors.gray[900],
                marginBottom: "18px",
              }}
            >
              📝 請假核准率 Leave Approval Rates
            </h3>

            {(() => {
              const leaveSubmissions = allSubmissions.filter((s) => s.form_type === "leave");
              const approved = leaveSubmissions.filter((s) => s.status === "approved").length;
              const total = leaveSubmissions.length;
              const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;

              const byType: Record<string, { approved: number; total: number }> = {};
              leaveSubmissions.forEach((s) => {
                const t = s.form_data.leave_type || "其他";
                if (!byType[t]) byType[t] = { approved: 0, total: 0 };
                byType[t].total++;
                if (s.status === "approved") byType[t].approved++;
              });

              return (
                <div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
                      gap: "10px",
                      marginBottom: "18px",
                    }}
                  >
                    {[
                      { label: "總申請數", value: total, color: "primary" as const },
                      { label: "已核准", value: approved, color: "success" as const },
                      { label: "核准率", value: `${approvalRate}%`, color: "info" as const },
                    ].map((s) => (
                      <div
                        key={s.label}
                        style={{
                          padding: "16px",
                          background:
                            s.color === "primary"
                              ? tokens.colors.primary[50]
                              : s.color === "success"
                              ? tokens.colors.success[50]
                              : tokens.colors.info[50],
                          borderRadius: tokens.borderRadius.md,
                          textAlign: "center",
                          border: `1px solid ${
                            s.color === "primary"
                              ? tokens.colors.primary[200]
                              : s.color === "success"
                              ? tokens.colors.success[200]
                              : tokens.colors.info[200]
                          }`,
                        }}
                      >
                        <div
                          style={{
                            fontSize: "24px",
                            fontWeight: 800,
                            color:
                              s.color === "primary"
                                ? tokens.colors.primary[700]
                                : s.color === "success"
                                ? tokens.colors.success[700]
                                : tokens.colors.info[700],
                          }}
                        >
                          {s.value}
                        </div>
                        <div
                          style={{
                            fontSize: "12px",
                            color:
                              s.color === "primary"
                                ? tokens.colors.primary[700]
                                : s.color === "success"
                                ? tokens.colors.success[700]
                                : tokens.colors.info[700],
                            opacity: 0.8,
                            marginTop: "4px",
                          }}
                        >
                          {s.label}
                        </div>
                      </div>
                    ))}
                  </div>

                  {Object.keys(byType).length > 0 && (
                    <div>
                      <h4
                        style={{
                          fontSize: "13px",
                          fontWeight: 600,
                          color: tokens.colors.gray[600],
                          marginBottom: "12px",
                        }}
                      >
                        假別核准率明細
                      </h4>
                      <div style={{ display: "grid", gap: "8px" }}>
                        {Object.entries(byType).map(([type, data]) => {
                          const rate = data.total > 0 ? Math.round((data.approved / data.total) * 100) : 0;
                          return (
                            <div
                              key={type}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "12px",
                                padding: "10px 14px",
                                background: tokens.colors.gray[50],
                                borderRadius: tokens.borderRadius.md,
                              }}
                            >
                              <div
                                style={{
                                  fontSize: "14px",
                                  fontWeight: 600,
                                  color: tokens.colors.gray[700],
                                  minWidth: "90px",
                                }}
                              >
                                {type}
                              </div>
                              <div
                                style={{
                                  flex: 1,
                                  height: "8px",
                                  background: tokens.colors.gray[200],
                                  borderRadius: tokens.borderRadius.full,
                                  overflow: "hidden",
                                }}
                                role="progressbar"
                                aria-valuenow={rate}
                                aria-valuemin={0}
                                aria-valuemax={100}
                              >
                                <div
                                  style={{
                                    height: "100%",
                                    width: `${rate}%`,
                                    background: tokens.colors.primary[500],
                                    borderRadius: tokens.borderRadius.full,
                                  }}
                                />
                              </div>
                              <div
                                style={{
                                  fontSize: "13px",
                                  fontWeight: 700,
                                  color: tokens.colors.primary[600],
                                  minWidth: "50px",
                                  textAlign: "right",
                                }}
                              >
                                {rate}%
                              </div>
                              <div
                                style={{
                                  fontSize: "12px",
                                  color: tokens.colors.gray[400],
                                  minWidth: "60px",
                                  textAlign: "right",
                                }}
                              >
                                {data.approved}/{data.total} 件
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </Card>

          {/* Section 4: Compliance Health */}
          <Card style={{ marginBottom: "20px" }}>
            <h3
              style={{
                fontSize: "15px",
                fontWeight: 700,
                color: tokens.colors.gray[900],
                marginBottom: "18px",
              }}
            >
              ⚖️ 合規健康度 Compliance Health
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(200px, 1fr))",
                gap: "12px",
              }}
            >
              {[
                {
                  label: "勞基法規則已載入",
                  value: complianceStatus?.total_rules || 0,
                  unit: "條",
                  icon: "📖",
                  color: "primary" as const,
                  note: "全條文即時比對",
                },
                {
                  label: "合規引擎狀態",
                  value: complianceStatus?.status === "synced" ? "正常" : "待同步",
                  unit: "",
                  icon: complianceStatus?.status === "synced" ? "✅" : "⚠️",
                  color: complianceStatus?.status === "synced" ? "success" : "warning",
                  note: complianceStatus?.last_sync
                    ? `上次同步：${new Date(complianceStatus.last_sync).toLocaleDateString("zh-TW")}`
                    : "尚未同步",
                },
                {
                  label: "加班預警人數",
                  value: shadowRisks.length,
                  unit: "人",
                  icon: "🔍",
                  color: shadowRisks.length === 0 ? "success" : "danger",
                  note: shadowRisks.length === 0 ? "無超標員工" : `${shadowRisks.filter((r) => r.risk_level === "critical").length} 人超標`,
                },
              ].map((s) => (
                <div
                  key={s.label}
                  style={{
                    padding: "18px",
                    background:
                      s.color === "primary"
                        ? tokens.colors.primary[50]
                        : s.color === "success"
                        ? tokens.colors.success[50]
                        : s.color === "warning"
                        ? tokens.colors.warning[50]
                        : tokens.colors.danger[50],
                    borderRadius: tokens.borderRadius.md,
                    border: `1px solid ${
                      s.color === "primary"
                        ? tokens.colors.primary[200]
                        : s.color === "success"
                        ? tokens.colors.success[200]
                        : s.color === "warning"
                        ? tokens.colors.warning[200]
                        : tokens.colors.danger[200]
                    }`,
                  }}
                >
                  <div style={{ fontSize: "22px", marginBottom: "8px" }} aria-hidden="true">
                    {s.icon}
                  </div>
                  <div
                    style={{
                      fontSize: "24px",
                      fontWeight: 800,
                      color:
                        s.color === "primary"
                          ? tokens.colors.primary[700]
                          : s.color === "success"
                          ? tokens.colors.success[700]
                          : s.color === "warning"
                          ? tokens.colors.warning[700]
                          : tokens.colors.danger[700],
                    }}
                  >
                    {s.value}
                    {s.unit && (
                      <span
                        style={{
                          fontSize: "14px",
                          fontWeight: 600,
                          marginLeft: "4px",
                        }}
                      >
                        {s.unit}
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: 700,
                      color:
                        s.color === "primary"
                          ? tokens.colors.primary[700]
                          : s.color === "success"
                          ? tokens.colors.success[700]
                          : s.color === "warning"
                          ? tokens.colors.warning[700]
                          : tokens.colors.danger[700],
                      marginTop: "4px",
                    }}
                  >
                    {s.label}
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      color:
                        s.color === "primary"
                          ? tokens.colors.primary[600]
                          : s.color === "success"
                          ? tokens.colors.success[600]
                          : s.color === "warning"
                          ? tokens.colors.warning[600]
                          : tokens.colors.danger[600],
                      opacity: 0.8,
                      marginTop: "6px",
                      lineHeight: 1.4,
                    }}
                  >
                    {s.note}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Section 5: Audit Trail */}
          <Card
            style={{
              background: tokens.colors.success[50],
              borderColor: tokens.colors.success[200],
              marginBottom: "20px",
            }}
          >
            <h3
              style={{
                fontSize: "14px",
                fontWeight: 700,
                color: tokens.colors.success[800],
                marginBottom: "10px",
              }}
            >
              🔒 資料可稽核性聲明 Audit Trail
            </h3>
            <p
              style={{
                fontSize: "13px",
                color: tokens.colors.success[800],
                lineHeight: 1.8,
              }}
            >
              本報告所有數據均源自 Atlas EIP 系統內的即時結構化記錄，包含：工作流程申請記錄（workflow_submissions）、員工假期餘額（leave_balances）、加班監控記錄（shadow_audit_logs）及合規掃描結果（compliance_checks）。每筆資料均附有時間戳記與操作人員資訊，可供內部稽核或外部查核使用。
              <br />
              <br />
              <strong>注意：</strong>本報告由 Atlas EIP 自動彙整產出，企業對報告內容之準確性與法律責任負最終責任。
            </p>
          </Card>

          {/* Footer */}
          <Card
            style={{
              padding: "14px 18px",
              background: tokens.colors.gray[50],
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "10px",
              }}
            >
              <div style={{ fontSize: "12px", color: tokens.colors.gray[400] }}>
                報告產生時間：
                {new Date().toLocaleDateString("zh-TW", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                · 由 Atlas EIP 自動產出
              </div>
              <div style={{ fontSize: "12px", color: tokens.colors.gray[400] }}>PrimeStride AI · primestrideatlas.com</div>
            </div>
          </Card>
        </main>
      )}
    </div>
  );
}