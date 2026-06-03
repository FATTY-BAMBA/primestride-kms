"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import {
  FileText,
  Clock,
  Users,
  Library,
  Bot,
  Upload,
  Zap,
  Bell,
  Shield,
  ChevronRight,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Inbox,
  BookOpen,
  PenLine,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ClockStatusBar from "@/components/ClockStatusBar";

// Types

type RecentDoc = {
  doc_id: string;
  title: string;
  doc_type: string | null;
  updated_at: string;
};

type DashboardData = {
  pendingFormsOrg: number;
  pendingFormsMine: number;
  totalDocs: number;
  recentDocs: RecentDoc[];
  memberCount: number;
  role: string;
  full_name: string;
  org_name: string;
  language: "zh" | "en";
  trialDaysRemaining: number;
  planId: string;
  subscriptionStatus: string;
  approvedThisMonth: number;
  overtimeHours: number;
  clockToday: {
    monthlyDays?: number;
    summary?: { attendanceRate: number; total: number };
  } | null;
};

type Priority = "urgent" | "high" | "normal";

type SmartAction = {
  id: string;
  priority: Priority;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  sublabel: string;
  href: string;
  badge?: number;
};

type StatColor = "purple" | "danger" | "blue" | "success";

type StatCardData = {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  color: StatColor;
  pulse?: boolean;
  trend?: string;
};

type OnboardingStep = {
  step: number;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  href: string;
  done: boolean;
};

// Helpers

function timeAgo(dateStr: string, isZh: boolean): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 60) return isZh ? `${mins} 分鐘前` : `${mins}m ago`;
  if (hours < 24) return isZh ? `${hours} 小時前` : `${hours}h ago`;
  if (days === 1) return isZh ? "昨天" : "Yesterday";
  if (days < 7) return isZh ? `${days} 天前` : `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function getGreeting(hour: number, isZh: boolean): string {
  if (isZh) {
    if (hour < 5) return "夜深了";
    if (hour < 12) return "早安";
    if (hour < 18) return "午安";
    return "晚安";
  }
  if (hour < 5) return "Still up?";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// Design Tokens (ADR 0004)

const COLOR_MAP: Record<StatColor, { bg: string; text: string }> = {
  purple: { bg: "bg-purple-50", text: "text-purple-600" },
  danger: { bg: "bg-red-50", text: "text-red-600" },
  blue: { bg: "bg-blue-50", text: "text-blue-600" },
  success: { bg: "bg-emerald-50", text: "text-emerald-600" },
};

const PRIORITY_STYLES: Record<Priority, { border: string; bg: string; text: string }> = {
  urgent: { border: "border-red-200", bg: "bg-red-50", text: "text-red-600" },
  high: { border: "border-amber-200", bg: "bg-amber-50", text: "text-amber-600" },
  normal: { border: "border-slate-200", bg: "bg-slate-50", text: "text-slate-600" },
};

// Component

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Home — Atlas EIP";
    Promise.all([
      fetch("/api/profile").then((r) => r.json()),
      fetch("/api/learning-summary").then((r) => r.json()),
      fetch("/api/workflows?view=all&status=pending").then((r) => r.json()),
      fetch("/api/workflows?status=pending").then((r) => r.json()),
      fetch("/api/org-members").then((r) => r.json()),
      fetch("/api/branding").then((r) => r.json()),
      fetch("/api/organizations").then((r) => r.json()),
      fetch("/api/subscription").then((r) => r.json()),
      fetch("/api/workflows?view=all").then((r) => r.json()),
      fetch("/api/clock/today")
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]).then(
      ([
        profile,
        docs,
        orgWorkflows,
        myWorkflows,
        members,
        branding,
        orgs,
        sub,
        allWorkflows,
        clockToday,
      ]) => {
        const actualOrgName = orgs.organizations?.[0]?.name || "";
        const orgName =
          branding.branding?.org_name ||
          actualOrgName ||
          (profile.language === "zh" ? "貴公司" : "your organization");

        const now = new Date();
        const monthStart = new Date(
          now.getFullYear(),
          now.getMonth(),
          1
        ).toISOString();
        const allSubs = allWorkflows.submissions || [];
        const approvedThisMonth = allSubs.filter(
          (s: { status: string; created_at: string }) =>
            s.status === "approved" && s.created_at >= monthStart
        ).length;
        const overtimeHours = allSubs
          .filter(
            (s: { form_type: string; status: string; created_at: string }) =>
              s.form_type === "overtime" &&
              s.status === "approved" &&
              s.created_at >= monthStart
          )
          .reduce(
            (sum: number, s: { form_data?: { hours?: number } }) =>
              sum + (Number(s.form_data?.hours) || 0),
            0
          );

        setData({
          pendingFormsOrg: orgWorkflows.submissions?.length || 0,
          pendingFormsMine: myWorkflows.submissions?.length || 0,
          totalDocs: docs.documents?.length || 0,
          recentDocs: (docs.documents || [])
            .sort(
              (a: { updated_at?: string }, b: { updated_at?: string }) =>
                new Date(b.updated_at || 0).getTime() -
                new Date(a.updated_at || 0).getTime()
            )
            .slice(0, 5),
          memberCount: members.members?.length || 0,
          role: profile.role || "member",
          full_name:
            profile.full_name ||
            profile.email?.split("@")[0] ||
            "there",
          org_name: orgName,
          language: profile.language || "en",
          trialDaysRemaining: sub.trial_days_remaining || 0,
          planId: sub.subscription?.plan_id || "explorer",
          subscriptionStatus: sub.status || "free",
          approvedThisMonth,
          overtimeHours,
          clockToday,
        });
      }
    ).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const isAdmin = data ? ["owner", "admin"].includes(data.role) : false;
  const isZh = data?.language === "zh";
  const hour = new Date().getHours();
  const greeting = getGreeting(hour, isZh ?? false);
  const firstName = data?.full_name?.split(" ")[0] || "";

  // Smart Actions
  const buildSmartActions = (): SmartAction[] => {
    if (!data) return [];
    const actions: SmartAction[] = [];

    if (isAdmin && data.pendingFormsOrg > 0) {
      actions.push({
        id: "pending-review",
        priority: "urgent",
        icon: Bell,
        label: isZh
          ? `${data.pendingFormsOrg} 份表單等待審核`
          : `${data.pendingFormsOrg} form${data.pendingFormsOrg > 1 ? "s" : ""} need review`,
        sublabel: isZh
          ? "員工正在等待您的決定"
          : "Employees are waiting on your decision",
        href: "/admin",
        badge: data.pendingFormsOrg,
      });
    }

    if (isAdmin && data.trialDaysRemaining > 0 && data.trialDaysRemaining <= 7) {
      actions.push({
        id: "trial-expiry",
        priority: "urgent",
        icon: Clock,
        label: isZh
          ? `試用期還剩 ${data.trialDaysRemaining} 天`
          : `Trial ends in ${data.trialDaysRemaining} days`,
        sublabel: isZh
          ? "聯絡我們確保服務不中斷"
          : "Contact us to keep full access",
        href: "mailto:hello@primestrideatlas.com?subject=Atlas EIP 續約",
      });
    }

    if (isAdmin && data.totalDocs === 0) {
      actions.push({
        id: "upload-first",
        priority: "high",
        icon: Upload,
        label: isZh
          ? "上傳您的第一份員工手冊"
          : "Upload your first employee handbook",
        sublabel: isZh
          ? "讓 Ask Atlas 開始回答員工問題"
          : "Enable Ask Atlas to answer employee questions",
        href: "/library/new",
      });
    }

    if (!isAdmin && data.pendingFormsMine > 0) {
      actions.push({
        id: "my-pending",
        priority: "high",
        icon: Inbox,
        label: isZh
          ? `${data.pendingFormsMine} 份申請等待主管審核`
          : `${data.pendingFormsMine} request${data.pendingFormsMine > 1 ? "s" : ""} awaiting approval`,
        sublabel: isZh
          ? "主管即將審核您的申請"
          : "Your manager will review soon",
        href: "/workflows",
      });
    }

    if (isAdmin && data.overtimeHours >= 30) {
      actions.push({
        id: "overtime-alert",
        priority: "high",
        icon: Shield,
        label: isZh
          ? `本月加班已達 ${data.overtimeHours} 小時`
          : `${data.overtimeHours}h overtime this month`,
        sublabel: isZh
          ? "查看 Shadow Audit 了解風險詳情"
          : "Check Shadow Audit for risk details",
        href: "/admin",
      });
    }

    actions.push({
      id: "submit-request",
      priority: "normal",
      icon: PenLine,
      label: isZh
        ? "用一句話提交申請"
        : "Submit a request in one sentence",
      sublabel: isZh
        ? "請假、加班、出差 — AI 自動辨識"
        : "Leave, overtime, business trip — AI parses it",
      href: "/workflows",
    });

    actions.push({
      id: "ask-atlas",
      priority: "normal",
      icon: Bot,
      label: isZh
        ? "詢問 Atlas 關於公司政策"
        : "Ask Atlas about company policy",
      sublabel: isZh
        ? "AI 即時回答，有來源引用"
        : "Instant AI answers with source citations",
      href: "/search",
    });

    if (data.totalDocs > 0) {
      actions.push({
        id: "browse-library",
        priority: "normal",
        icon: BookOpen,
        label: isZh
          ? `瀏覽知識庫 (${data.totalDocs} 份文件)`
          : `Browse knowledge base (${data.totalDocs} docs)`,
        sublabel: isZh
          ? "搜尋公司政策和規章"
          : "Search company policies and documents",
        href: "/library",
      });
    }

    if (isAdmin) {
      actions.push({
        id: "upload-doc",
        priority: "normal",
        icon: Upload,
        label: isZh
          ? "上傳或匯入文件"
          : "Upload or import a document",
        sublabel: isZh
          ? "PDF、Word、網址、YouTube 均支援"
          : "PDF, Word, URL, YouTube supported",
        href: "/library/new",
      });
    }

    const order: Record<Priority, number> = { urgent: 0, high: 1, normal: 2 };
    return actions
      .sort((a, b) => order[a.priority] - order[b.priority])
      .slice(0, 5);
  };

  const smartActions = buildSmartActions();

  // Stat Cards
  const statCards: StatCardData[] = data
    ? [
        {
          label: isZh ? "文件數" : "Documents",
          value: data.totalDocs,
          icon: FileText,
          href: "/library",
          color: "purple",
          trend: data.totalDocs > 0 ? undefined : isZh ? "尚無文件" : "Upload your first",
        },
        {
          label: isZh
            ? isAdmin
              ? "待審核"
              : "我的待審"
            : isAdmin
            ? "Pending Reviews"
            : "My Pending",
          value: isAdmin ? data.pendingFormsOrg : data.pendingFormsMine,
          icon: Clock,
          href: isAdmin ? "/admin" : "/workflows",
          color: "danger",
          pulse: (isAdmin ? data.pendingFormsOrg : data.pendingFormsMine) > 0,
        },
        {
          label: isZh ? "團隊成員" : "Team Members",
          value: data.memberCount,
          icon: Users,
          href: isAdmin ? "/team" : undefined,
          color: "blue",
        },
        {
          label: isAdmin
            ? isZh
              ? "今日出勤率"
              : "Today's Attendance"
            : isZh
            ? "本月打卡天數"
            : "Days Clocked",
          value: isAdmin
            ? `${data.clockToday?.summary?.attendanceRate ?? 0}%`
            : data.clockToday?.monthlyDays ?? 0,
          icon: Clock,
          href: isAdmin ? "/admin?tab=attendance" : "/clock/manual",
          color: "success",
          trend:
            isAdmin && data.clockToday?.summary
              ? isZh
                ? `${data.clockToday.summary.total} 人應到`
                : `${data.clockToday.summary.total} expected`
              : undefined,
        },
      ]
    : [];

  // Onboarding Steps
  const onboardingSteps: OnboardingStep[] = data
    ? [
        {
          step: 1,
          icon: Upload,
          title: isZh ? "上傳公司文件" : "Upload Documents",
          desc: isZh
            ? "員工手冊、規章制度、公司政策"
            : "Handbook, policies, regulations",
          href: "/library/new",
          done: (data.totalDocs || 0) > 0,
        },
        {
          step: 2,
          icon: Users,
          title: isZh ? "邀請團隊成員" : "Invite Team",
          desc: isZh ? "讓員工開始使用" : "Get employees onboard",
          href: "/team",
          done: (data.memberCount || 0) > 1,
        },
        {
          step: 3,
          icon: PenLine,
          title: isZh ? "提交第一筆申請" : "First Request",
          desc: isZh ? "體驗 AI 自動填寫" : "Experience AI parsing",
          href: "/workflows",
          done: false,
        },
      ]
    : [];

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="space-y-6">
            <Skeleton className="h-16 w-full rounded-xl" />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
              <Skeleton className="h-80 rounded-xl lg:col-span-2" />
              <Skeleton className="h-80 rounded-xl lg:col-span-3" />
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (!data) {
    return (
      <ProtectedRoute>
        <div className="mx-auto max-w-5xl px-4 py-12 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-red-400" />
          <h3 className="mt-4 text-lg font-semibold text-slate-900">
            {isZh ? "載入失敗" : "Failed to load"}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {isZh ? "請重新整理頁面" : "Please refresh the page"}
          </p>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Clock Status Bar */}
        <ClockStatusBar lang={data.language} />

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {greeting}
            {data ? `，${firstName}` : ""}
          </h1>
          <p className="mt-1 text-sm text-slate-500 sm:text-base">
            {isZh
              ? `以下是 ${data.org_name} 的最新動態`
              : `Here's what's happening at ${data.org_name}`}
          </p>
        </div>

        {/* Stat Cards */}
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {statCards.map((stat) => {
            const colors = COLOR_MAP[stat.color];
            return (
              <Card
                key={stat.label}
                className={`group border-slate-200 transition-all duration-200 hover:border-slate-300 hover:shadow-md ${
                  stat.href ? "cursor-pointer" : ""
                }`}
                onClick={() => stat.href && router.push(stat.href)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-lg ${colors.bg}`}
                    >
                      <stat.icon
                        className={`h-4 w-4 ${colors.text}`}
                      />
                    </div>
                    {stat.pulse && (
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500"></span>
                      </span>
                    )}
                  </div>
                  <div className="mt-3">
                    <div className="text-2xl font-bold tabular-nums tracking-tight text-slate-900">
                      {stat.value ?? "—"}
                    </div>
                    <div className="mt-0.5 flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500">
                        {stat.label}
                      </span>
                      {stat.trend && (
                        <span className="text-[10px] text-slate-400">
                          {stat.trend}
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Onboarding Checklist */}
        {isAdmin && data && !((data.totalDocs || 0) > 0 && (data.memberCount || 0) > 1) && (
          <Card className="mb-6 border-purple-200 bg-gradient-to-br from-purple-50/50 to-blue-50/30">
            <CardContent className="p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-600">
                  <Zap className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">
                    {isZh
                      ? "完成設定，解鎖完整 AI 功能"
                      : "Complete setup to unlock all AI features"}
                  </h3>
                  <p className="text-xs text-purple-600">
                    {isZh
                      ? "只需 3 個步驟，不到 5 分鐘"
                      : "3 steps, less than 5 minutes"}
                  </p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {onboardingSteps.map((item) => (
                  <Link
                    key={item.step}
                    href={item.href}
                    className={`group flex items-start gap-3 rounded-lg border p-3 transition-all hover:border-purple-300 hover:shadow-sm ${
                      item.done ? "border-emerald-200" : "border-purple-100"
                    } bg-white`}
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                        item.done ? "bg-emerald-100" : "bg-purple-50"
                      }`}
                    >
                      {item.done ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <item.icon className="h-4 w-4 text-purple-600" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {item.title}
                      </p>
                      <p className="text-xs text-slate-500">{item.desc}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* Smart Actions */}
          <div className="lg:col-span-2">
            <Card className="border-slate-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-purple-50">
                      <Zap className="h-4 w-4 text-purple-600" />
                    </div>
                    <CardTitle className="text-sm font-semibold text-slate-900">
                      {isZh ? "今日重點" : "Today's Focus"}
                    </CardTitle>
                  </div>
                  {smartActions.some((a) => a.priority === "urgent") && (
                    <Badge
                      variant="destructive"
                      className="h-5 text-[10px] font-semibold uppercase tracking-wider"
                    >
                      {isZh ? "需要處理" : "Action needed"}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-1">
                  {smartActions.map((action) => {
                    const pStyle = PRIORITY_STYLES[action.priority];
                    return (
                      <button
                        key={action.id}
                        onClick={() => router.push(action.href)}
                        className={`group flex w-full items-center gap-3 rounded-lg p-3 text-left transition-all hover:bg-slate-50 ${
                          action.priority === "urgent" ? "bg-red-50/50" : ""
                        }`}
                      >
                        <div
                          className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${pStyle.border} ${pStyle.bg} ${pStyle.text}`}
                        >
                          <action.icon className="h-4 w-4" />
                          {action.badge && (
                            <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                              {action.badge}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {action.label}
                            </p>
                            <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-purple-400" />
                          </div>
                          <p className="truncate text-xs text-slate-500">
                            {action.sublabel}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Documents */}
          <div className="lg:col-span-3">
            <Card className="border-slate-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50">
                      <Library className="h-4 w-4 text-emerald-600" />
                    </div>
                    <CardTitle className="text-sm font-semibold text-slate-900">
                      {isZh ? "最近文件" : "Recent Documents"}
                    </CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs font-semibold text-purple-600 hover:bg-purple-50 hover:text-purple-700"
                    onClick={() => router.push("/library")}
                  >
                    {isZh ? "查看全部" : "View all"}
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {data.recentDocs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                      <Library className="h-5 w-5 text-slate-400" />
                    </div>
                    <p className="mt-3 text-sm font-medium text-slate-900">
                      {isZh ? "知識庫尚無文件" : "No documents yet"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {isZh
                        ? "上傳文件後將顯示於此"
                        : "Files will appear here after upload"}
                    </p>
                    {isAdmin && (
                      <Button
                        className="mt-3 h-8 bg-purple-600 text-xs hover:bg-purple-700"
                        onClick={() => router.push("/library/new")}
                      >
                        {isZh ? "上傳第一份文件" : "Upload your first"}
                        <ArrowRight className="ml-1 h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {data.recentDocs.map((doc) => (
                      <Link
                        key={doc.doc_id}
                        href={`/library/${encodeURIComponent(doc.doc_id)}`}
                        className="group flex items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-slate-50"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-purple-50">
                          <FileText className="h-4 w-4 text-purple-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900 transition-colors group-hover:text-purple-700">
                            {doc.title}
                          </p>
                          <div className="mt-0.5 flex items-center gap-2">
                            <Badge
                              variant="secondary"
                              className="h-4 px-1.5 text-[10px] font-medium"
                            >
                              {doc.doc_type || "document"}
                            </Badge>
                            <span className="text-xs text-slate-400">
                              {doc.updated_at
                                ? timeAgo(doc.updated_at, isZh ?? false)
                                : ""}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-purple-400" />
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Trial Banners */}
        {isAdmin && data.trialDaysRemaining > 0 && data.trialDaysRemaining <= 30 && data.trialDaysRemaining > 7 && (
          <div className="mt-6 flex items-center justify-between gap-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-semibold text-blue-900">
                  {isZh
                    ? `試用期還剩 ${data.trialDaysRemaining} 天`
                    : `Trial ends in ${data.trialDaysRemaining} days`}
                </p>
                <p className="text-xs text-blue-700">
                  {isZh
                    ? "聯絡我們確保服務不中斷"
                    : "Contact us to keep full access"}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              className="h-8 bg-blue-600 text-xs hover:bg-blue-700"
              asChild
            >
              <a href="mailto:hello@primestrideatlas.com?subject=Atlas EIP 續約">
                {isZh ? "聯絡我們" : "Contact Us"}
              </a>
            </Button>
          </div>
        )}

        {isAdmin &&
          (data.planId === "explorer" || data.planId === null) &&
          data.trialDaysRemaining === 0 &&
          data.subscriptionStatus === "expired" && (
            <div className="mt-6 flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <div>
                  <p className="text-sm font-semibold text-red-900">
                    {isZh ? "試用期已結束" : "Your trial has ended"}
                  </p>
                  <p className="text-xs text-red-700">
                    {isZh
                      ? "升級至付費方案以繼續使用完整功能"
                      : "Upgrade to continue with full access"}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                className="h-8 bg-red-600 text-xs hover:bg-red-700"
                asChild
              >
                <a href="mailto:hello@primestrideatlas.com?subject=Atlas EIP 升級方案">
                  {isZh ? "升級方案" : "Upgrade Plan"}
                </a>
              </Button>
            </div>
          )}
      </div>
    </ProtectedRoute>
  );
}
