"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Clock, AlertCircle, CheckCircle2, ChevronRight, Users, ScanLine } from "lucide-react";
import { clockCopy, t, tf, type Lang } from "@/lib/i18n/clock";

// ── Types matching /api/clock/today response ──
type PunchStatus = "in" | "out" | "not_in";

interface MyStatus {
  status: PunchStatus;
  clockInISO: string | null;
  clockOutISO: string | null;
  totalMinutes: number | null;
  lateMinutes: number | null;
  overtimeMinutes: number | null;
}

interface AdminSummary {
  total: number;
  in: number;
  late: number;
  notIn: number;
  overtime: number;
  attendanceRate: number;
}

interface TodayPayload {
  role: "owner" | "admin" | "member";
  isWorkDayToday: boolean;
  myStatus: MyStatus;
  incompletePrior: string | null;
  monthlyDays: number;
  summary?: AdminSummary;
  pendingRequests?: number;
  workStartTime: string;
  workEndTime: string;
  timezone: string;
}

interface ClockStatusBarProps {
  lang?: Lang;
  graceMinutes?: number; // default 5
}

// ── Helpers ──
function formatTime(iso: string | null, timezone: string = "Asia/Taipei"): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone,
    });
  } catch {
    return "—";
  }
}

function formatHours(minutes: number | null, lang: Lang): string {
  if (minutes === null || minutes === 0) return lang === "zh" ? "0 小時" : "0h";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (lang === "zh") return `${h} 小時 ${m} 分鐘`;
  return `${h}h ${m}m`;
}

function isMobileViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 768;
}

// ── Component ──
export default function ClockStatusBar({ lang = "zh", graceMinutes = 5 }: ClockStatusBarProps) {
  const router = useRouter();
  const [data, setData] = useState<TodayPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/clock/today", { cache: "no-store" });
      if (!res.ok) {
        setError(true);
        return;
      }
      const json = (await res.json()) as TodayPayload;
      setData(json);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + polling + focus refresh
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60_000);
    const onFocus = () => fetchData();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") fetchData();
    });
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [fetchData]);

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div
        style={{
          height: 64,
          marginBottom: 24,
          borderRadius: 14,
          background: "linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%)",
          backgroundSize: "400% 100%",
          animation: "shimmer 1.5s infinite",
        }}
      >
        <style>{`@keyframes shimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }`}</style>
      </div>
    );
  }

  // ── Error state — silent, don't block dashboard ──
  if (error || !data) return null;

  // ── Non-work-day banner (subtle, doesn't take up space if employee) ──
  const isAdmin = data.role === "owner" || data.role === "admin";

  if (!data.isWorkDayToday) {
    return (
      <div
        style={{
          marginBottom: 24,
          padding: "14px 18px",
          borderRadius: 14,
          background: "linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)",
          border: "1px solid #E2E8F0",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid #E2E8F0",
          }}
        >
          <Clock style={{ width: 16, height: 16, color: "#64748B" }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#475569" }}>
            {lang === "zh" ? "今日非工作日" : "Today is a non-work day"}
          </div>
          <div style={{ fontSize: 12, color: "#94A3B8" }}>
            {lang === "zh" ? "祝您假期愉快 ☕" : "Enjoy your day off ☕"}
          </div>
        </div>
      </div>
    );
  }

  // ── Build status visual based on role + state ──
  let bgGradient: string;
  let borderColor: string;
  let iconBg: string;
  let iconColor: string;
  let StatusIcon: typeof Clock;
  let primaryText: string;
  let secondaryText: string;
  let buttonLabel: string;
  let buttonHref: string;
  let buttonColor: string;

  if (isAdmin && data.summary) {
    // ── Admin view: org summary ──
    const { total, in: inCount, late, notIn } = data.summary;
    const hasIssues = late > 0 || notIn > 0;

    bgGradient = hasIssues
      ? "linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)"
      : "linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)";
    borderColor = hasIssues ? "#FDE68A" : "#BBF7D0";
    iconBg = hasIssues ? "#FCD34D" : "#86EFAC";
    iconColor = hasIssues ? "#92400E" : "#166534";
    StatusIcon = Users;

    primaryText =
      lang === "zh"
        ? `今日 ${total} 人應到 · ${inCount} 在崗 · ${late} 遲到 · ${notIn} 未到`
        : `Today: ${total} expected · ${inCount} in · ${late} late · ${notIn} not in`;

    secondaryText =
      data.summary.attendanceRate >= 0
        ? `${t(clockCopy.home.admin_attendance_rate, lang)} ${data.summary.attendanceRate}%`
        : "";

    buttonLabel = t(clockCopy.home.admin_view_details, lang);
    buttonHref = "/admin?tab=attendance";
    buttonColor = hasIssues ? "#92400E" : "#166534";
  } else {
    // ── Employee view: my status ──
    const { status, clockInISO, totalMinutes, lateMinutes } = data.myStatus;
    const isLate = (lateMinutes ?? 0) > graceMinutes;

    if (status === "not_in") {
      bgGradient = "linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)";
      borderColor = "#E2E8F0";
      iconBg = "#CBD5E1";
      iconColor = "#475569";
      StatusIcon = Clock;
      primaryText = t(clockCopy.home.employee_status_not_in, lang);
      secondaryText =
        lang === "zh"
          ? `應上班時間 ${data.workStartTime.slice(0, 5)}`
          : `Work starts ${data.workStartTime.slice(0, 5)}`;
      buttonLabel = t(clockCopy.home.employee_clock_in_now, lang);
      buttonHref = isMobileViewport() ? "/clock/manual" : "/clock/manual";
      buttonColor = "#7C3AED";
    } else if (status === "in") {
      if (isLate) {
        bgGradient = "linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)";
        borderColor = "#FDE68A";
        iconBg = "#FCD34D";
        iconColor = "#92400E";
        StatusIcon = AlertCircle;
        secondaryText = tf(clockCopy.home.employee_late_today, lang, {
          minutes: lateMinutes ?? 0,
        });
        buttonColor = "#92400E";
      } else {
        bgGradient = "linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)";
        borderColor = "#BBF7D0";
        iconBg = "#86EFAC";
        iconColor = "#166534";
        StatusIcon = CheckCircle2;
        secondaryText = tf(clockCopy.home.employee_clock_in_at, lang, {
          time: formatTime(clockInISO, data.timezone),
        });
        buttonColor = "#166534";
      }
      primaryText = t(clockCopy.home.employee_status_in, lang);
      buttonLabel = t(clockCopy.home.employee_clock_out_now, lang);
      buttonHref = isMobileViewport() ? "/clock/manual" : "/clock/manual";
    } else {
      // status === 'out'
      bgGradient = "linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)";
      borderColor = "#BFDBFE";
      iconBg = "#93C5FD";
      iconColor = "#1E40AF";
      StatusIcon = CheckCircle2;
      primaryText = t(clockCopy.home.employee_status_out, lang);
      secondaryText = tf(clockCopy.home.employee_total_today, lang, {
        hours: formatHours(totalMinutes, lang),
      });
      buttonLabel = t(clockCopy.home.employee_view_today, lang);
      buttonHref = "/clock/manual";
      buttonColor = "#1E40AF";
    }
  }

  // ── Render ──
  return (
    <div
      onClick={() => router.push(buttonHref)}
      style={{
        marginBottom: 24,
        padding: "14px 18px",
        borderRadius: 14,
        background: bgGradient,
        border: `1px solid ${borderColor}`,
        display: "flex",
        alignItems: "center",
        gap: 14,
        cursor: "pointer",
        transition: "transform 0.2s, box-shadow 0.2s",
        animation: "fadeSlideUp 0.4s ease forwards",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
        (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.06)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
        (e.currentTarget as HTMLElement).style.boxShadow = "none";
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: iconBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <StatusIcon style={{ width: 20, height: 20, color: iconColor }} />
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "#0F172A",
            letterSpacing: "-0.01em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {primaryText}
        </div>
        {secondaryText && (
          <div style={{ fontSize: 12, color: "#64748B", marginTop: 1 }}>{secondaryText}</div>
        )}
      </div>

      {/* Action button */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "8px 14px",
          borderRadius: 8,
          background: "rgba(255,255,255,0.7)",
          color: buttonColor,
          fontSize: 13,
          fontWeight: 600,
          flexShrink: 0,
          whiteSpace: "nowrap",
        }}
      >
        {!isAdmin && data.myStatus.status === "not_in" && isMobileViewport() && (
          <ScanLine style={{ width: 14, height: 14 }} />
        )}
        <span>{buttonLabel}</span>
        <ChevronRight style={{ width: 14, height: 14 }} />
      </div>

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 640px) {
          .clock-bar-mobile {
            flex-wrap: wrap;
          }
        }
      `}</style>

      {/* Incomplete prior-day warning — small inline alert */}
      {data.incompletePrior && !isAdmin && (
        <div
          style={{
            position: "absolute",
            // This div is rendered conditionally above the bar in the actual DashboardPage,
            // but since we're inside the bar, we'll display it as a subtle dot indicator
          }}
        />
      )}
    </div>
  );
}