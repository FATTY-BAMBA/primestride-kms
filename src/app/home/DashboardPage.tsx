"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import {
  FileText, Clock, CheckCircle2, AlertTriangle,
  Upload, Link as LinkIcon, PenLine, ArrowRight,
  Users, Library, Bot, Zap
} from "lucide-react";

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
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Home — Atlas EIP";
    Promise.all([
      fetch("/api/profile").then(r => r.json()),
      fetch("/api/learning-summary").then(r => r.json()),
      fetch("/api/workflows?view=all&status=pending").then(r => r.json()),
      fetch("/api/workflows?status=pending").then(r => r.json()),
      fetch("/api/org-members").then(r => r.json()),
      fetch("/api/branding").then(r => r.json()),
    ]).then(([profile, docs, orgWorkflows, myWorkflows, members, branding]) => {
      setData({
        pendingFormsOrg: orgWorkflows.submissions?.length || 0,
        pendingFormsMine: myWorkflows.submissions?.length || 0,
        totalDocs: docs.documents?.length || 0,
        recentDocs: (docs.documents || [])
          .sort((a: any, b: any) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime())
          .slice(0, 5),
        memberCount: members.members?.length || 0,
        role: profile.role || "member",
        full_name: profile.full_name || profile.email?.split("@")[0] || "there",
        org_name: branding.branding?.org_name || "your organization",
        language: profile.language || "en",
      });
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const isAdmin = data && ["owner", "admin"].includes(data.role);
  const isZh = data?.language === "zh";
  const hour = new Date().getHours();

  // Localised greeting
  const greeting = isZh
    ? (hour < 12 ? "早安" : hour < 18 ? "午安" : "晚安")
    : (hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening");

  const firstName = data?.full_name?.split(" ")[0] || "";
  const subheading = isZh
    ? `以下是 ${data?.org_name || ""} 的最新動態`
    : `Here's what's happening at ${data?.org_name || "your organization"}`;

  const pendingCount = isAdmin ? data?.pendingFormsOrg : data?.pendingFormsMine;
  const pendingLabel = isZh
    ? (isAdmin ? "待審核表單" : "我的待審表單")
    : (isAdmin ? "Pending Reviews" : "My Pending Forms");

  return (
    <ProtectedRoute>
      <div className="p-6 lg:p-8 max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-slate-900">
            {greeting}{data ? `，${firstName}` : ""} 👋
          </h1>
          <p className="text-sm text-slate-500 mt-1">{subheading}</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            {isZh ? "載入中..." : "Loading..."}
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[
                { label: isZh ? "文件數" : "Documents", value: data?.totalDocs, icon: FileText, color: "text-violet-600", bg: "bg-violet-50", href: "/library" },
                { label: pendingLabel, value: pendingCount, icon: Clock, color: "text-amber-600", bg: "bg-amber-50", href: isAdmin ? "/admin" : "/workflows" },
                { label: isZh ? "團隊成員" : "Team Members", value: data?.memberCount, icon: Users, color: "text-blue-600", bg: "bg-blue-50", href: isAdmin ? "/team" : undefined },
                { label: isZh ? "AI 就緒" : "AI Ready", value: isZh ? "啟用" : "On", icon: Zap, color: "text-emerald-600", bg: "bg-emerald-50", href: "/search" },
              ].map(stat => (
                <div
                  key={stat.label}
                  onClick={() => stat.href && router.push(stat.href)}
                  className={`bg-white border border-slate-200 rounded-xl p-4 ${stat.href ? "cursor-pointer hover:border-violet-300 hover:shadow-sm" : ""} transition-all`}
                >
                  <div className={`w-9 h-9 rounded-lg ${stat.bg} flex items-center justify-center mb-3`}>
                    <stat.icon className={`w-4 h-4 ${stat.color}`} />
                  </div>
                  <div className="text-2xl font-semibold text-slate-900">{stat.value ?? "—"}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Quick Actions */}
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-violet-500" />
                  {isZh ? "快速操作" : "Quick Actions"}
                </h2>
                <div className="space-y-1">
                  {[
                    { label: isZh ? "詢問 Atlas" : "Ask Atlas", icon: Bot, href: "/search", color: "text-pink-600", bg: "bg-pink-50" },
                    { label: isZh ? "提交表單" : "Submit a form", icon: FileText, href: "/workflows", color: "text-amber-600", bg: "bg-amber-50" },
                    { label: isZh ? "瀏覽文件庫" : "Browse library", icon: Library, href: "/library", color: "text-violet-600", bg: "bg-violet-50" },
                    ...(isAdmin ? [
                      { label: isZh ? "上傳文件" : "Upload a document", icon: Upload, href: "/library/new", color: "text-blue-600", bg: "bg-blue-50" },
                      { label: isZh ? "匯入網址" : "Import from URL", icon: LinkIcon, href: "/library/new?mode=url", color: "text-blue-600", bg: "bg-blue-50" },
                      { label: isZh ? "新增筆記" : "Write a note", icon: PenLine, href: "/library/note/new", color: "text-emerald-600", bg: "bg-emerald-50" },
                      { label: isZh ? "審核待審表單" : "Review pending forms", icon: CheckCircle2, href: "/admin", color: "text-slate-600", bg: "bg-slate-100" },
                    ] : []),
                  ].map(action => (
                    <Link key={action.href + action.label} href={action.href}
                      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors group"
                    >
                      <span className={`w-7 h-7 rounded-md ${action.bg} flex items-center justify-center flex-shrink-0`}>
                        <action.icon className={`w-3.5 h-3.5 ${action.color}`} />
                      </span>
                      <span className="text-sm text-slate-700 group-hover:text-slate-900">{action.label}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-300 ml-auto group-hover:text-slate-500 transition-colors" />
                    </Link>
                  ))}
                </div>
              </div>

              {/* Recent Documents */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 lg:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <Library className="w-4 h-4 text-slate-400" />
                    {isZh ? "最近文件" : "Recent Documents"}
                  </h2>
                  <Link href="/library" className="text-xs text-violet-600 hover:text-violet-700 font-medium">
                    {isZh ? "查看全部 →" : "View all →"}
                  </Link>
                </div>

                {data?.recentDocs.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">{isZh ? "尚無文件" : "No documents yet"}</p>
                    {isAdmin && (
                      <Link href="/library/new" className="text-xs text-violet-600 hover:underline mt-1 inline-block">
                        {isZh ? "上傳第一份文件 →" : "Upload your first document →"}
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {data?.recentDocs.map(doc => (
                      <Link key={doc.doc_id} href={`/library/${encodeURIComponent(doc.doc_id)}`}
                        className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-4 h-4 text-violet-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate group-hover:text-violet-700">{doc.title}</p>
                          {doc.doc_type && <p className="text-xs text-slate-400">{doc.doc_type}</p>}
                        </div>
                        <span className="text-xs text-slate-400 flex-shrink-0">
                          {doc.updated_at ? timeAgo(doc.updated_at) : ""}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Admin alert */}
            {isAdmin && data && data.pendingFormsOrg > 0 && (
              <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">
                      {isZh
                        ? `${data.pendingFormsOrg} 份表單等待審核`
                        : `${data.pendingFormsOrg} form${data.pendingFormsOrg > 1 ? "s" : ""} waiting for review`}
                    </p>
                    <p className="text-xs text-amber-600 mt-0.5">
                      {isZh ? "員工正在等待您的審核" : "Employees are waiting for approval on their requests"}
                    </p>
                  </div>
                </div>
                <Link href="/admin"
                  className="flex-shrink-0 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  {isZh ? "立即審核" : "Review now"}
                </Link>
              </div>
            )}

            {/* Member alert */}
            {!isAdmin && data && data.pendingFormsMine > 0 && (
              <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-blue-500 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-blue-800">
                      {isZh
                        ? `您有 ${data.pendingFormsMine} 份表單待審中`
                        : `${data.pendingFormsMine} of your form${data.pendingFormsMine > 1 ? "s are" : " is"} pending approval`}
                    </p>
                    <p className="text-xs text-blue-600 mt-0.5">
                      {isZh ? "主管即將審核您的申請" : "Your manager will review them soon"}
                    </p>
                  </div>
                </div>
                <Link href="/workflows"
                  className="flex-shrink-0 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  {isZh ? "查看表單" : "View forms"}
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}