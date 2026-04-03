"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import {
  FileText, Clock, Users, Library, Bot,
  Upload, Link as LinkIcon, PenLine,
  AlertTriangle, CheckCircle2, TrendingUp,
  ArrowRight, ChevronRight, Zap, Shield,
  DollarSign, Calendar, Bell, Search
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
  trialDaysRemaining: number;
  planId: string;
  subscriptionStatus: string;
  approvedThisMonth: number;
  overtimeHours: number;
};

type SmartAction = {
  id: string;
  priority: "urgent" | "high" | "normal";
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  href: string;
  accentColor: string;
  bgColor: string;
  badge?: string;
};

function timeAgo(dateStr: string, isZh: boolean) {
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

function PulsingDot({ color }: { color: string }) {
  return (
    <span style={{ position: "relative", display: "inline-flex", width: 8, height: 8 }}>
      <span style={{
        position: "absolute", inset: 0, borderRadius: "50%",
        background: color, opacity: 0.4,
        animation: "ping 1.5s cubic-bezier(0,0,0.2,1) infinite",
      }} />
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, position: "relative" }} />
    </span>
  );
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
      fetch("/api/organizations").then(r => r.json()),
      fetch("/api/subscription").then(r => r.json()),
      fetch("/api/workflows?view=all").then(r => r.json()),
    ]).then(([profile, docs, orgWorkflows, myWorkflows, members, branding, orgs, sub, allWorkflows]) => {
      const actualOrgName = orgs.organizations?.[0]?.name || "";
      const orgName = branding.branding?.org_name || actualOrgName || (profile.language === "zh" ? "貴公司" : "your organization");

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const allSubs = allWorkflows.submissions || [];
      const approvedThisMonth = allSubs.filter((s: any) => s.status === "approved" && s.created_at >= monthStart).length;
      const overtimeHours = allSubs
        .filter((s: any) => s.form_type === "overtime" && s.status === "approved" && s.created_at >= monthStart)
        .reduce((sum: number, s: any) => sum + (Number(s.form_data?.hours) || 0), 0);

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
        org_name: orgName,
        language: profile.language || "en",
        trialDaysRemaining: sub.trial_days_remaining || 0,
        planId: sub.subscription?.plan_id || "explorer",
        subscriptionStatus: sub.status || "free",
        approvedThisMonth,
        overtimeHours,
      });
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const isAdmin = data && ["owner", "admin"].includes(data.role);
  const isZh = data?.language === "zh";
  const hour = new Date().getHours();

  const greeting = isZh
    ? (hour < 5 ? "夜深了" : hour < 12 ? "早安" : hour < 18 ? "午安" : "晚安")
    : (hour < 5 ? "Still up?" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening");

  const firstName = data?.full_name?.split(" ")[0] || "";

  // ── Smart Actions: context-aware, priority-sorted ──
  const buildSmartActions = (): SmartAction[] => {
    if (!data) return [];
    const actions: SmartAction[] = [];

    // URGENT: pending reviews (admin)
    if (isAdmin && data.pendingFormsOrg > 0) {
      actions.push({
        id: "pending-review",
        priority: "urgent",
        icon: <Bell className="w-4 h-4" />,
        label: isZh ? `${data.pendingFormsOrg} 份表單等待審核` : `${data.pendingFormsOrg} form${data.pendingFormsOrg > 1 ? "s" : ""} need review`,
        sublabel: isZh ? "員工正在等待您的決定" : "Employees are waiting on your decision",
        href: "/admin",
        accentColor: "#DC2626",
        bgColor: "#FEF2F2",
        badge: String(data.pendingFormsOrg),
      });
    }

    // URGENT: trial expiring soon
    if (isAdmin && data.trialDaysRemaining > 0 && data.trialDaysRemaining <= 7) {
      actions.push({
        id: "trial-expiry",
        priority: "urgent",
        icon: <Clock className="w-4 h-4" />,
        label: isZh ? `試用期還剩 ${data.trialDaysRemaining} 天` : `Trial ends in ${data.trialDaysRemaining} days`,
        sublabel: isZh ? "聯絡我們確保服務不中斷" : "Contact us to keep full access",
        href: "mailto:hello@primestrideatlas.com?subject=Atlas EIP 續約",
        accentColor: "#D97706",
        bgColor: "#FFFBEB",
      });
    }

    // HIGH: no documents yet (admin)
    if (isAdmin && data.totalDocs === 0) {
      actions.push({
        id: "upload-first",
        priority: "high",
        icon: <Upload className="w-4 h-4" />,
        label: isZh ? "上傳您的第一份員工手冊" : "Upload your first employee handbook",
        sublabel: isZh ? "讓 Ask Atlas 開始回答員工問題" : "Enable Ask Atlas to answer employee questions",
        href: "/library/new",
        accentColor: "#7C3AED",
        bgColor: "#F5F3FF",
      });
    }

    // HIGH: pending my own forms (member)
    if (!isAdmin && data.pendingFormsMine > 0) {
      actions.push({
        id: "my-pending",
        priority: "high",
        icon: <Clock className="w-4 h-4" />,
        label: isZh ? `${data.pendingFormsMine} 份申請等待主管審核` : `${data.pendingFormsMine} request${data.pendingFormsMine > 1 ? "s" : ""} awaiting approval`,
        sublabel: isZh ? "主管即將審核您的申請" : "Your manager will review soon",
        href: "/workflows",
        accentColor: "#2563EB",
        bgColor: "#EFF6FF",
      });
    }

    // HIGH: overtime high this month (admin)
    if (isAdmin && data.overtimeHours >= 30) {
      actions.push({
        id: "overtime-alert",
        priority: "high",
        icon: <Shield className="w-4 h-4" />,
        label: isZh ? `本月加班已達 ${data.overtimeHours} 小時` : `${data.overtimeHours}h overtime this month`,
        sublabel: isZh ? "查看 Shadow Audit 了解風險詳情" : "Check Shadow Audit for risk details",
        href: "/admin",
        accentColor: "#DC2626",
        bgColor: "#FEF2F2",
      });
    }

    // NORMAL: submit a request
    actions.push({
      id: "submit-request",
      priority: "normal",
      icon: <FileText className="w-4 h-4" />,
      label: isZh ? "用一句話提交申請" : "Submit a request in one sentence",
      sublabel: isZh ? "請假、加班、出差 — AI 自動辨識" : "Leave, overtime, business trip — AI parses it",
      href: "/workflows",
      accentColor: "#7C3AED",
      bgColor: "#F5F3FF",
    });

    // NORMAL: ask atlas
    actions.push({
      id: "ask-atlas",
      priority: "normal",
      icon: <Bot className="w-4 h-4" />,
      label: isZh ? "詢問 Atlas 關於公司政策" : "Ask Atlas about company policy",
      sublabel: isZh ? "AI 即時回答，有來源引用" : "Instant AI answers with source citations",
      href: "/search",
      accentColor: "#EC4899",
      bgColor: "#FDF2F8",
    });

    // NORMAL: browse library
    if (data.totalDocs > 0) {
      actions.push({
        id: "browse-library",
        priority: "normal",
        icon: <Library className="w-4 h-4" />,
        label: isZh ? `瀏覽知識庫 (${data.totalDocs} 份文件)` : `Browse knowledge base (${data.totalDocs} docs)`,
        sublabel: isZh ? "搜尋公司政策和規章" : "Search company policies and documents",
        href: "/library",
        accentColor: "#0891B2",
        bgColor: "#ECFEFF",
      });
    }

    // NORMAL: admin-specific
    if (isAdmin) {
      actions.push({
        id: "upload-doc",
        priority: "normal",
        icon: <Upload className="w-4 h-4" />,
        label: isZh ? "上傳或匯入文件" : "Upload or import a document",
        sublabel: isZh ? "PDF、Word、網址、YouTube 均支援" : "PDF, Word, URL, YouTube supported",
        href: "/library/new",
        accentColor: "#059669",
        bgColor: "#F0FDF4",
      });
    }

    // Sort: urgent first, then high, then normal
    const order = { urgent: 0, high: 1, normal: 2 };
    return actions.sort((a, b) => order[a.priority] - order[b.priority]).slice(0, 5);
  };

  const smartActions = buildSmartActions();

  // ── Stat cards: meaningful metrics only ──
  const statCards = data ? [
    {
      label: isZh ? "文件數" : "Documents",
      value: data.totalDocs,
      icon: FileText,
      color: "#7C3AED",
      bg: "#F5F3FF",
      href: "/library",
      trend: data.totalDocs > 0 ? undefined : (isZh ? "尚無文件" : "Upload your first"),
    },
    {
      label: isZh ? (isAdmin ? "待審核" : "我的待審") : (isAdmin ? "Pending Reviews" : "My Pending"),
      value: isAdmin ? data.pendingFormsOrg : data.pendingFormsMine,
      icon: Clock,
      color: (isAdmin ? data.pendingFormsOrg : data.pendingFormsMine) > 0 ? "#DC2626" : "#059669",
      bg: (isAdmin ? data.pendingFormsOrg : data.pendingFormsMine) > 0 ? "#FEF2F2" : "#F0FDF4",
      href: isAdmin ? "/admin" : "/workflows",
      pulse: (isAdmin ? data.pendingFormsOrg : data.pendingFormsMine) > 0,
    },
    {
      label: isZh ? "團隊成員" : "Team Members",
      value: data.memberCount,
      icon: Users,
      color: "#2563EB",
      bg: "#EFF6FF",
      href: isAdmin ? "/team" : undefined,
    },
    {
      label: isZh ? "本月核准" : "Approved This Month",
      value: data.approvedThisMonth,
      icon: CheckCircle2,
      color: "#059669",
      bg: "#F0FDF4",
      href: isAdmin ? "/admin" : "/workflows",
      trend: data.approvedThisMonth > 0 ? undefined : (isZh ? "本月尚無" : "None yet"),
    },
  ] : [];

  return (
    <ProtectedRoute>
      <style>{`
        @keyframes ping {
          75%, 100% { transform: scale(2); opacity: 0; }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .atlas-card {
          animation: fadeSlideUp 0.35s ease forwards;
        }
        .atlas-card:nth-child(1) { animation-delay: 0.05s; opacity: 0; }
        .atlas-card:nth-child(2) { animation-delay: 0.10s; opacity: 0; }
        .atlas-card:nth-child(3) { animation-delay: 0.15s; opacity: 0; }
        .atlas-card:nth-child(4) { animation-delay: 0.20s; opacity: 0; }
        .action-row:hover .action-arrow { transform: translateX(3px); }
        .action-arrow { transition: transform 0.15s ease; }
        .doc-row:hover .doc-title { color: #7C3AED; }
        .doc-title { transition: color 0.15s ease; }
      `}</style>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 20px 48px" }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: "#0F172A", margin: 0, letterSpacing: "-0.02em" }}>
              {greeting}{data ? `，${firstName}` : ""} 👋
            </h1>
          </div>
          <p style={{ fontSize: 14, color: "#94A3B8", margin: "6px 0 0", fontWeight: 400 }}>
            {data
              ? (isZh ? `以下是 ${data.org_name} 的最新動態` : `Here's what's happening at ${data.org_name}`)
              : (isZh ? "載入中..." : "Loading...")}
          </p>
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ height: 80, borderRadius: 12, background: "linear-gradient(90deg, #F8FAFC 25%, #F1F5F9 50%, #F8FAFC 75%)", backgroundSize: "400% 100%", animation: "shimmer 1.5s infinite" }} />
            ))}
          </div>
        ) : (
          <>
            {/* ── Stat Cards ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 24 }}
              className="lg:grid-cols-4">
              {statCards.map((stat, i) => (
                <div
                  key={stat.label}
                  className="atlas-card"
                  onClick={() => stat.href && router.push(stat.href)}
                  style={{
                    background: "white",
                    border: "1px solid #E2E8F0",
                    borderRadius: 14,
                    padding: "16px 18px",
                    cursor: stat.href ? "pointer" : "default",
                    transition: "box-shadow 0.2s, border-color 0.2s, transform 0.2s",
                    animationDelay: `${i * 0.05}s`,
                    position: "relative",
                    overflow: "hidden",
                  }}
                  onMouseEnter={e => {
                    if (stat.href) {
                      (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)";
                      (e.currentTarget as HTMLElement).style.borderColor = "#CBD5E1";
                      (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
                    }
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.boxShadow = "none";
                    (e.currentTarget as HTMLElement).style.borderColor = "#E2E8F0";
                    (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: stat.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <stat.icon style={{ width: 16, height: 16, color: stat.color }} />
                    </div>
                    {(stat as any).pulse && <PulsingDot color={stat.color} />}
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: stat.color, lineHeight: 1, marginBottom: 4, letterSpacing: "-0.03em" }}>
                    {stat.value ?? "—"}
                  </div>
                  <div style={{ fontSize: 12, color: "#94A3B8", fontWeight: 500 }}>{stat.label}</div>
                  {(stat as any).trend && (
                    <div style={{ fontSize: 10, color: "#CBD5E1", marginTop: 3 }}>{(stat as any).trend}</div>
                  )}
                </div>
              ))}
            </div>

            {/* ── Onboarding checklist (first-time orgs) ── */}
            {isAdmin && data && !((data.totalDocs || 0) > 0 && (data.memberCount || 0) > 1) && (
              <div style={{
                background: "linear-gradient(135deg, #7C3AED08 0%, #2563EB06 100%)",
                border: "1px solid #DDD6FE",
                borderRadius: 16, padding: 20, marginBottom: 20,
              }} className="atlas-card">
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #7C3AED, #6D28D9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Zap style={{ width: 18, height: 18, color: "white" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#1E1B4B" }}>
                      {isZh ? "完成設定，解鎖完整 AI 功能" : "Complete setup to unlock all AI features"}
                    </div>
                    <div style={{ fontSize: 12, color: "#8B5CF6" }}>
                      {isZh ? "只需 3 個步驟，不到 5 分鐘" : "3 steps, less than 5 minutes"}
                    </div>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
                  {[
                    { step: 1, icon: "📚", title: isZh ? "上傳公司文件" : "Upload Documents", desc: isZh ? "員工手冊、規章制度、公司政策" : "Handbook, policies, regulations", href: "/library/new", done: (data?.totalDocs || 0) > 0 },
                    { step: 2, icon: "👥", title: isZh ? "邀請團隊成員" : "Invite Team", desc: isZh ? "讓員工開始使用" : "Get employees onboard", href: "/team", done: (data?.memberCount || 0) > 1 },
                    { step: 3, icon: "💬", title: isZh ? "提交第一筆申請" : "First Request", desc: isZh ? "體驗 AI 自動填寫" : "Experience AI parsing", href: "/workflows", done: false },
                  ].map(item => (
                    <a key={item.step} href={item.href} style={{ textDecoration: "none" }}>
                      <div style={{
                        display: "flex", gap: 12, padding: "12px 14px",
                        background: "white", borderRadius: 10,
                        border: `1px solid ${item.done ? "#BBF7D0" : "#E8E3FF"}`,
                        cursor: "pointer", transition: "all 0.15s",
                      }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#7C3AED"; (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 8px rgba(124,58,237,0.1)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = item.done ? "#BBF7D0" : "#E8E3FF"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
                      >
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: item.done ? "#D1FAE5" : "#EDE9FE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                          {item.done ? "✓" : item.icon}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#1E1B4B", marginBottom: 2 }}>{item.title}</div>
                          <div style={{ fontSize: 11, color: "#94A3B8" }}>{item.desc}</div>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* ── Main content grid ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 16, alignItems: "start" }}>

              {/* ── Smart Actions ── */}
              <div style={{ background: "white", border: "1px solid #E2E8F0", borderRadius: 16, overflow: "hidden" }} className="atlas-card">
                <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid #F8FAFC", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: "#F5F3FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Zap style={{ width: 14, height: 14, color: "#7C3AED" }} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>
                      {isZh ? "今日重點" : "Today's Focus"}
                    </span>
                  </div>
                  {smartActions.some(a => a.priority === "urgent") && (
                    <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 20, background: "#FEF2F2", color: "#DC2626", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {isZh ? "需要處理" : "Action needed"}
                    </span>
                  )}
                </div>

                <div style={{ padding: "6px 0" }}>
                  {smartActions.map((action, i) => (
                    <div
                      key={action.id}
                      className="action-row"
                      onClick={() => router.push(action.href)}
                      style={{
                        display: "flex", alignItems: "center", gap: 12,
                        padding: "11px 18px", cursor: "pointer",
                        borderBottom: i < smartActions.length - 1 ? "1px solid #F8FAFC" : "none",
                        transition: "background 0.15s",
                        background: action.priority === "urgent" ? `${action.bgColor}` : "transparent",
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = action.bgColor; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = action.priority === "urgent" ? action.bgColor : "transparent"; }}
                    >
                      <div style={{ width: 34, height: 34, borderRadius: 9, background: action.bgColor, border: `1px solid ${action.accentColor}20`, display: "flex", alignItems: "center", justifyContent: "center", color: action.accentColor, flexShrink: 0, position: "relative" }}>
                        {action.icon}
                        {action.badge && (
                          <span style={{ position: "absolute", top: -5, right: -5, width: 16, height: 16, borderRadius: "50%", background: action.accentColor, color: "white", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {action.badge}
                          </span>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", marginBottom: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {action.label}
                        </div>
                        <div style={{ fontSize: 11, color: "#94A3B8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {action.sublabel}
                        </div>
                      </div>
                      <ChevronRight className="action-arrow" style={{ width: 14, height: 14, color: "#CBD5E1", flexShrink: 0 }} />
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Recent Documents ── */}
              <div style={{ background: "white", border: "1px solid #E2E8F0", borderRadius: 16, overflow: "hidden" }} className="atlas-card">
                <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid #F8FAFC", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: "#F0FDF4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Library style={{ width: 14, height: 14, color: "#059669" }} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>
                      {isZh ? "最近文件" : "Recent Documents"}
                    </span>
                  </div>
                  <Link href="/library" style={{ fontSize: 12, color: "#7C3AED", fontWeight: 600, textDecoration: "none", display: "flex", alignItems: "center", gap: 3 }}>
                    {isZh ? "查看全部" : "View all"} <ArrowRight style={{ width: 12, height: 12 }} />
                  </Link>
                </div>

                {data?.recentDocs.length === 0 ? (
                  <div style={{ padding: "36px 20px", textAlign: "center" }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: "#F8FAFC", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                      <Library style={{ width: 22, height: 22, color: "#CBD5E1" }} />
                    </div>
                    <p style={{ fontSize: 13, color: "#94A3B8", margin: "0 0 8px", fontWeight: 500 }}>
                      {isZh ? "知識庫尚無文件" : "No documents yet"}
                    </p>
                    {isAdmin && (
                      <Link href="/library/new" style={{ fontSize: 12, color: "#7C3AED", fontWeight: 600, textDecoration: "none" }}>
                        {isZh ? "上傳第一份文件 →" : "Upload your first document →"}
                      </Link>
                    )}
                  </div>
                ) : (
                  <div style={{ padding: "4px 0" }}>
                    {data?.recentDocs.map((doc, i) => (
                      <Link key={doc.doc_id} href={`/library/${encodeURIComponent(doc.doc_id)}`} style={{ textDecoration: "none" }}>
                        <div
                          className="doc-row"
                          style={{
                            display: "flex", alignItems: "center", gap: 12, padding: "11px 18px",
                            borderBottom: i < (data?.recentDocs.length || 0) - 1 ? "1px solid #F8FAFC" : "none",
                            transition: "background 0.15s", cursor: "pointer",
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#FAFBFF"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                        >
                          <div style={{ width: 36, height: 36, borderRadius: 9, background: "#F5F3FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <FileText style={{ width: 16, height: 16, color: "#7C3AED" }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p className="doc-title" style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {doc.title}
                            </p>
                            <p style={{ fontSize: 11, color: "#94A3B8", margin: 0 }}>
                              {doc.doc_type || "document"} · {doc.updated_at ? timeAgo(doc.updated_at, isZh ?? false) : ""}
                            </p>
                          </div>
                          <ChevronRight style={{ width: 14, height: 14, color: "#E2E8F0", flexShrink: 0 }} />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Trial banners ── */}
            {isAdmin && data && data.trialDaysRemaining > 0 && data.trialDaysRemaining <= 30 && data.trialDaysRemaining > 7 && (
              <div style={{ marginTop: 16, background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 18 }}>⏳</span>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#1E40AF", margin: 0 }}>
                      {isZh ? `試用期還剩 ${data.trialDaysRemaining} 天` : `Trial ends in ${data.trialDaysRemaining} days`}
                    </p>
                    <p style={{ fontSize: 11, color: "#3B82F6", margin: 0 }}>
                      {isZh ? "聯絡我們確保服務不中斷" : "Contact us to keep full access"}
                    </p>
                  </div>
                </div>
                <a href="mailto:hello@primestrideatlas.com?subject=Atlas EIP 續約" style={{ padding: "8px 16px", background: "#2563EB", color: "white", borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: "none", flexShrink: 0 }}>
                  {isZh ? "聯絡我們" : "Contact Us"}
                </a>
              </div>
            )}

            {isAdmin && data && (data.planId === "explorer" || data.planId === null) && data.trialDaysRemaining === 0 && data.subscriptionStatus === "expired" && (
              <div style={{ marginTop: 16, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 18 }}>🔒</span>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#991B1B", margin: 0 }}>
                      {isZh ? "試用期已結束" : "Your trial has ended"}
                    </p>
                    <p style={{ fontSize: 11, color: "#DC2626", margin: 0 }}>
                      {isZh ? "升級至付費方案以繼續使用完整功能" : "Upgrade to continue with full access"}
                    </p>
                  </div>
                </div>
                <a href="mailto:hello@primestrideatlas.com?subject=Atlas EIP 升級方案" style={{ padding: "8px 16px", background: "#DC2626", color: "white", borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: "none", flexShrink: 0 }}>
                  {isZh ? "升級方案" : "Upgrade Plan"}
                </a>
              </div>
            )}
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}