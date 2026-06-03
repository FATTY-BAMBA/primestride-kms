"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Users,
  ScanLine,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { clockCopy, t, tf, type Lang } from "@/lib/i18n/clock";

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
  graceMinutes?: number;
}

function formatTime(
  iso: string | null,
  timezone: string = "Asia/Taipei"
): string {
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
  if (minutes === null || minutes === 0)
    return lang === "zh" ? "0 小時" : "0h";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (lang === "zh") return `${h} 小時 ${m} 分鐘`;
  return `${h}h ${m}m`;
}

export default function ClockStatusBar({
  lang = "zh",
  graceMinutes = 5,
}: ClockStatusBarProps) {
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

  if (loading) {
    return (
      <div className="mb-6">
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !data) return null;

  const isAdmin = data.role === "owner" || data.role === "admin";

  // Non-work day
  if (!data.isWorkDayToday) {
    return (
      <Card className="mb-6 border-slate-200 bg-slate-50">
        <CardContent className="flex items-center gap-3 py-3.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white">
            <Clock className="h-4 w-4 text-slate-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">
              {lang === "zh" ? "今日非工作日" : "Today is a non-work day"}
            </p>
            <p className="text-xs text-slate-500">
              {lang === "zh" ? "祝您假期愉快" : "Enjoy your day off"}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Build status config
  let statusConfig: {
    variant: "success" | "warning" | "info" | "neutral";
    icon: typeof Clock;
    title: string;
    subtitle: string;
    actionLabel: string;
    actionHref: string;
  };

  if (isAdmin && data.summary) {
    const { total, in: inCount, late, notIn } = data.summary;
    // Concerning only when day has actually started (someone in or late)
    // AND there are real issues (late or absent). Avoids amber-by-default at 6am.
    const dayHasStarted = inCount > 0 || late > 0;
    const hasIssues = late > 0 || notIn > 0;
    const isConcerning = dayHasStarted && hasIssues;

    statusConfig = {
      variant: isConcerning ? "warning" : "neutral",
      icon: Users,
      title:
        lang === "zh"
          ? `今日 ${total} 人應到 · ${inCount} 在崗 · ${late} 遲到 · ${notIn} 未到`
          : `Today: ${total} expected · ${inCount} in · ${late} late · ${notIn} not in`,
      subtitle:
        data.summary.attendanceRate >= 0
          ? `${t(clockCopy.home.admin_attendance_rate, lang)} ${
              data.summary.attendanceRate
            }%`
          : "",
      actionLabel: t(clockCopy.home.admin_view_details, lang),
      actionHref: "/admin?tab=attendance",
    };
  } else {
    const { status, clockInISO, totalMinutes, lateMinutes } = data.myStatus;
    const isLate = (lateMinutes ?? 0) > graceMinutes;

    if (status === "not_in") {
      statusConfig = {
        variant: "neutral",
        icon: Clock,
        title: t(clockCopy.home.employee_status_not_in, lang),
        subtitle:
          lang === "zh"
            ? `應上班時間 ${data.workStartTime.slice(0, 5)}`
            : `Work starts ${data.workStartTime.slice(0, 5)}`,
        actionLabel: t(clockCopy.home.employee_clock_in_now, lang),
        actionHref: "/clock/manual",
      };
    } else if (status === "in") {
      if (isLate) {
        statusConfig = {
          variant: "warning",
          icon: AlertCircle,
          title: t(clockCopy.home.employee_status_in, lang),
          subtitle: tf(clockCopy.home.employee_late_today, lang, {
            minutes: lateMinutes ?? 0,
          }),
          actionLabel: t(clockCopy.home.employee_clock_out_now, lang),
          actionHref: "/clock/manual",
        };
      } else {
        statusConfig = {
          variant: "success",
          icon: CheckCircle2,
          title: t(clockCopy.home.employee_status_in, lang),
          subtitle: tf(clockCopy.home.employee_clock_in_at, lang, {
            time: formatTime(clockInISO, data.timezone),
          }),
          actionLabel: t(clockCopy.home.employee_clock_out_now, lang),
          actionHref: "/clock/manual",
        };
      }
    } else {
      statusConfig = {
        variant: "info",
        icon: CheckCircle2,
        title: t(clockCopy.home.employee_status_out, lang),
        subtitle: tf(clockCopy.home.employee_total_today, lang, {
          hours: formatHours(totalMinutes, lang),
        }),
        actionLabel: t(clockCopy.home.employee_view_today, lang),
        actionHref: "/clock/manual",
      };
    }
  }

  const variantStyles = {
    success: {
      card: "border-emerald-200 bg-emerald-50",
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-600",
    },
    warning: {
      card: "border-amber-200 bg-amber-50",
      iconBg: "bg-amber-100",
      iconColor: "text-amber-600",
    },
    info: {
      card: "border-blue-200 bg-blue-50",
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
    },
    neutral: {
      card: "border-slate-200 bg-white",
      iconBg: "bg-slate-100",
      iconColor: "text-slate-600",
    },
  };

  const styles = variantStyles[statusConfig.variant];
  const StatusIcon = statusConfig.icon;

  return (
    <Card
      className={`mb-6 cursor-pointer border transition-all duration-200 hover:shadow-md ${styles.card}`}
      onClick={() => router.push(statusConfig.actionHref)}
    >
      <CardContent className="flex items-center gap-4 py-3.5">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${styles.iconBg}`}
        >
          <StatusIcon className={`h-5 w-5 ${styles.iconColor}`} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">
            {statusConfig.title}
          </p>
          {statusConfig.subtitle && (
            <p className="mt-0.5 text-xs text-slate-600">
              {statusConfig.subtitle}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <ScanLine className="h-4 w-4 text-slate-400 sm:hidden" />

          <Button
            size="sm"
            className="h-8 gap-1 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700"
          >
            <span className="hidden sm:inline">{statusConfig.actionLabel}</span>
            <span className="sm:hidden">
              {lang === "zh" ? "打卡" : "Clock"}
            </span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
