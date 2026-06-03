"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import StatCard, { type StatColor } from "@/components/ui/atlas/StatCard";
import DocumentRow from "@/components/ui/atlas/DocumentRow";
import ActionRow, { type Priority } from "@/components/ui/atlas/ActionRow";
import AlertBanner from "@/components/ui/atlas/AlertBanner";
import OnboardingCard, { type OnboardingStep } from "@/components/ui/atlas/OnboardingCard";
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
  ArrowRight,
  AlertCircle,
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

type SmartAction = {
  id: string;
  priority: Priority;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  sublabel: string;
  href: string;
  badge?: number;
};

type StatCardData = {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  color: StatColor;
  pulse?: boolean;
  trend?: string;
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
          {statCards.map((stat) => (
            <StatCard
              key={stat.label}
              label={stat.label}
              value={stat.value}
              icon={stat.icon}
              color={stat.color}
              href={stat.href}
              pulse={stat.pulse}
              trend={stat.trend}
            />
          ))}
        </div>

        {/* Onboarding Checklist */}
        {isAdmin && data && !((data.totalDocs || 0) > 0 && (data.memberCount || 0) > 1) && (
          <OnboardingCard
            title={
              isZh
                ? "完成設定，解鎖完整 AI 功能"
                : "Complete setup to unlock all AI features"
            }
            subtitle={
              isZh
                ? "只需 3 個步驟，不到 5 分鐘"
                : "3 steps, less than 5 minutes"
            }
            steps={onboardingSteps}
          />
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
                    <CardTitle className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
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
                  {smartActions.map((action) => (
                    <ActionRow
                      key={action.id}
                      priority={action.priority}
                      icon={action.icon}
                      label={action.label}
                      sublabel={action.sublabel}
                      href={action.href}
                      badge={action.badge}
                    />
                  ))}
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
                    <CardTitle className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
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
                      <DocumentRow
                        key={doc.doc_id}
                        docId={doc.doc_id}
                        title={doc.title}
                        docType={doc.doc_type}
                        timeAgoLabel={
                          doc.updated_at
                            ? timeAgo(doc.updated_at, isZh ?? false)
                            : undefined
                        }
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Trial Banners */}
        {isAdmin && data.trialDaysRemaining > 0 && data.trialDaysRemaining <= 30 && data.trialDaysRemaining > 7 && (
          <AlertBanner
            variant="warning"
            icon={Clock}
            title={
              isZh
                ? `試用期還剩 ${data.trialDaysRemaining} 天`
                : `Trial ends in ${data.trialDaysRemaining} days`
            }
            subtitle={isZh ? "聯絡我們確保服務不中斷" : "Contact us to keep full access"}
            ctaLabel={isZh ? "聯絡我們" : "Contact Us"}
            ctaHref="mailto:hello@primestrideatlas.com?subject=Atlas EIP 續約"
          />
        )}

        {isAdmin &&
          (data.planId === "explorer" || data.planId === null) &&
          data.trialDaysRemaining === 0 &&
          data.subscriptionStatus === "expired" && (
            <AlertBanner
              variant="danger"
              icon={AlertCircle}
              title={isZh ? "試用期已結束" : "Your trial has ended"}
              subtitle={
                isZh
                  ? "升級至付費方案以繼續使用完整功能"
                  : "Upgrade to continue with full access"
              }
              ctaLabel={isZh ? "升級方案" : "Upgrade Plan"}
              ctaHref="mailto:hello@primestrideatlas.com?subject=Atlas EIP 升級方案"
            />
          )}
      </div>
    </ProtectedRoute>
  );
}
