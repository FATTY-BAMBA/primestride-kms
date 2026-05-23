"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Library,
  Home,
  Bot, 
  Search, 
  FileText, 
  BarChart3, 
  Settings, 
  Users, 
  UserCircle,
  MoreVertical,
  Key,
  Clock,
  Tag,
  ClipboardList,
  ClipboardCheck,
  ChevronRight,
  ChevronLeft,
  Menu,
  X,
  Wallet,
  Scale,
  Leaf
} from "lucide-react";
import { cn } from "@/lib/utils";
import UserMenu from "./UserMenu";
import OrgSwitcher from "./OrgSwitcher";

interface SidebarProps {
  children: React.ReactNode;
}

interface LinkItem {
  href: string;
  icon: React.ElementType;
  label: string;
  labelEn: string;
  adminOnly?: boolean;
  badge?: boolean;
}

export default function Sidebar({ children }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [lang, setLang] = useState<"zh" | "en">("zh");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [branding, setBranding] = useState<{ 
    org_name?: string; 
    logo_emoji?: string; 
    primary_color?: string; 
    accent_color?: string; 
    tagline?: string 
  } | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    fetch("/api/profile")
      .then(r => r.json())
      .then(d => {
        if (d.role && ["owner", "admin"].includes(d.role)) setIsAdmin(true);
        if (d.language) setLang(d.language);
      })
      .catch(() => {});
    fetch("/api/branding")
      .then(r => r.json())
      .then(d => { if (d.branding) setBranding(d.branding); })
      .catch(() => {});
    fetch("/api/workflows?view=all&status=pending")
      .then(r => r.json())
      .then(d => { if (d.submissions) setPendingCount(d.submissions.length); })
      .catch(() => {});
  }, []);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const topLinks: LinkItem[] = [
    { href: "/home", icon: Home, label: "首頁", labelEn: "Home" },
  ];

  const myWorkLinks: LinkItem[] = [
    { href: "/workflows", icon: FileText, label: "表單申請", labelEn: "Requests", badge: true },
    { href: "/clock/manual", icon: ClipboardList, label: "我的打卡", labelEn: "My Clock-in" },
    { href: "/my-pay", icon: Wallet, label: "我的薪資", labelEn: "My Pay" },
    { href: "/todo", icon: ClipboardCheck, label: "待辦", labelEn: "To-Do" },
  ];

  const knowledgeLinks: LinkItem[] = [
    { href: "/library", icon: Library, label: "文件庫", labelEn: "Library" },
    { href: "/search", icon: Search, label: "搜尋", labelEn: "Ask Atlas" },
  ];

  const manageLinks: LinkItem[] = [
    { href: "/admin", icon: Settings, label: "概覽", labelEn: "Overview", adminOnly: true },
    { href: "/admin?tab=employees", icon: Users, label: "員工", labelEn: "Employees", adminOnly: true },
    { href: "/admin/attendance", icon: ClipboardCheck, label: "出勤", labelEn: "Attendance", adminOnly: true },
    { href: "/admin/payroll", icon: Wallet, label: "薪資", labelEn: "Payroll", adminOnly: true },
    { href: "/admin/compliance", icon: Scale, label: "合規", labelEn: "Compliance", adminOnly: true },
    { href: "/admin/esg", icon: Leaf, label: "ESG 報告", labelEn: "ESG Report", adminOnly: true },
    { href: "/agent", icon: Bot, label: "AI 助手", labelEn: "Atlas Agent", adminOnly: true },
    { href: "/teams", icon: UserCircle, label: "群組", labelEn: "Groups", adminOnly: true },
    { href: "/team", icon: Users, label: "成員", labelEn: "Members", adminOnly: true },
  ];

  const analyticsLinks: LinkItem[] = [
    { href: "/learning", icon: BarChart3, label: "學習分析", labelEn: "Learning Insights", adminOnly: true },
    { href: "/metrics", icon: BarChart3, label: "指標數據", labelEn: "Platform Metrics", adminOnly: true },
  ];

  const settingsLinks: LinkItem[] = [
    { href: "/developer", icon: Key, label: "API", labelEn: "Developer", adminOnly: true },
    { href: "/audit-logs", icon: Clock, label: "操作紀錄", labelEn: "Audit Logs", adminOnly: true },
    { href: "/branding", icon: Tag, label: "品牌設定", labelEn: "Branding", adminOnly: true },
  ];

  const isActive = (href: string) => {
    if (href === "/library") return pathname === "/library" || pathname.startsWith("/library/");
    return pathname === href || pathname.startsWith(href + "/");
  };

  const primaryColor = branding?.primary_color || "#7C3AED";
  const accentColor = branding?.accent_color || "#A78BFA";

  // ── NavLink: respects local isCollapsed prop, falls back to outer collapsed ──
  const NavLink = ({ link, isCollapsed }: { link: LinkItem; isCollapsed: boolean }) => {
    if (link.adminOnly && !isAdmin) return null;
    const active = isActive(link.href);
    const Icon = link.icon;
    const showBadge = link.badge && pendingCount > 0 && isAdmin;

    return (
      <Link
        href={link.href}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 group",
          isCollapsed ? "justify-center" : "justify-start",
          active 
            ? "bg-violet-50 text-violet-700 font-medium" 
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        )}
        title={isCollapsed ? `${link.label} ${link.labelEn}` : undefined}
      >
        <span className="relative">
          <Icon className={cn(
            "w-4 h-4 flex-shrink-0",
            active ? "text-violet-600" : "text-slate-400 group-hover:text-slate-700"
          )} />
          {showBadge && isCollapsed && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
              {pendingCount}
            </span>
          )}
        </span>
        
        {!isCollapsed && (
          <span className="flex-1 flex items-center justify-between">
            <span>
              {lang === "zh" ? link.label : link.labelEn}
            </span>
            {showBadge && (
              <span className="min-w-5 h-5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center px-1.5">
                {pendingCount}
              </span>
            )}
          </span>
        )}
      </Link>
    );
  };

  const SectionHeader = ({ title, isCollapsed }: { title: string; isCollapsed: boolean }) => {
    if (isCollapsed) return null;
    return (
      <p className="px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2 mt-4 first:mt-0">
        {title}
      </p>
    );
  };

  // ── SidebarContent: takes forceExpanded prop. Mobile drawer passes true. ──
  const SidebarContent = ({ forceExpanded = false, hideHeader = false }: { forceExpanded?: boolean; hideHeader?: boolean }) => {
    const isCollapsed = forceExpanded ? false : collapsed;
    return (
      <>
        {/* ── Logo / Product Identity ── */}
        {!hideHeader && (
          <div className={cn(
            "border-b border-slate-100 flex items-center gap-3",
            isCollapsed ? "p-4 justify-center" : "p-4"
          )}>
            <div 
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
              style={{ 
                background: `linear-gradient(135deg, ${primaryColor} 0%, ${accentColor} 100%)` 
              }}
            >
              <span className="text-lg">⚡</span>
            </div>
            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <h1 className="font-bold text-slate-900 leading-tight tracking-tight" style={{ fontSize: "15px" }}>
                  Atlas EIP
                </h1>
                <p className="text-[10px] font-semibold tracking-widest uppercase mt-0.5" style={{ color: primaryColor, opacity: 0.7 }}>
                  Enterprise Intelligence
                </p>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-4 px-3">
          {/* Top: Home alone, no section header */}
          <div className="space-y-0.5 mb-4">
            {topLinks.map((link) => (
              <NavLink key={link.href} link={link} isCollapsed={isCollapsed} />
            ))}
          </div>

          <SectionHeader title={lang === "zh" ? "我的工作" : "MY WORK"} isCollapsed={isCollapsed} />
          <div className="space-y-0.5 mb-4">
            {myWorkLinks.map((link) => (
              <NavLink key={link.href} link={link} isCollapsed={isCollapsed} />
            ))}
          </div>

          <SectionHeader title={lang === "zh" ? "知識" : "KNOWLEDGE"} isCollapsed={isCollapsed} />
          <div className="space-y-0.5 mb-4">
            {knowledgeLinks.map((link) => (
              <NavLink key={link.href} link={link} isCollapsed={isCollapsed} />
            ))}
          </div>

          {isAdmin && (
            <>
              <SectionHeader title={lang === "zh" ? "管理" : "MANAGE"} isCollapsed={isCollapsed} />
              <div className="space-y-0.5 mb-4">
                {manageLinks.map((link) => (
                  <NavLink key={link.href} link={link} isCollapsed={isCollapsed} />
                ))}
              </div>

              <SectionHeader title={lang === "zh" ? "分析" : "ANALYTICS"} isCollapsed={isCollapsed} />
              <div className="space-y-0.5 mb-4">
                {analyticsLinks.map((link) => (
                  <NavLink key={link.href} link={link} isCollapsed={isCollapsed} />
                ))}
              </div>

              <SectionHeader title={lang === "zh" ? "設定" : "SETTINGS"} isCollapsed={isCollapsed} />
              <div className="space-y-0.5">
                {settingsLinks.map((link) => (
                  <NavLink key={link.href} link={link} isCollapsed={isCollapsed} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── Bottom: Org switcher + User menu ── */}
        <div className="p-4 border-t border-slate-100 relative z-50">
          {!isCollapsed && <OrgSwitcher />}
          <div className={cn(
            "flex items-center mt-2",
            isCollapsed ? "justify-center" : "justify-between"
          )}>
            <UserMenu />
            {!isCollapsed && !forceExpanded && (
              <button
                onClick={() => setCollapsed(true)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                title="收合側邊欄 Collapse"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="flex min-h-screen">
      {/* Desktop Sidebar — hidden below lg breakpoint */}
      <aside 
        className={cn(
          "bg-white border-r border-slate-200 hidden lg:flex flex-col fixed top-0 left-0 bottom-0 z-40 transition-all duration-200",
          collapsed ? "w-[60px]" : "w-60"
        )}
      >
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="absolute top-5 -right-3 w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm hover:bg-slate-100 text-slate-500"
          >
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
        <SidebarContent />
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between z-30">
        <button 
          onClick={() => setMobileOpen(true)}
          className="p-2 -ml-2 hover:bg-slate-100 rounded-lg"
        >
          <Menu className="w-5 h-5 text-slate-600" />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-lg">⚡</span>
          <span className="font-bold text-sm">Atlas EIP</span>
        </div>
        <UserMenu />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div 
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)} 
          />
          <aside className="absolute top-0 left-0 bottom-0 w-64 bg-white flex flex-col shadow-xl">
            {/* Mobile drawer header with close button */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div 
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
                  style={{ 
                    background: `linear-gradient(135deg, ${primaryColor} 0%, ${accentColor} 100%)` 
                  }}
                >
                  <span className="text-lg">⚡</span>
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="font-bold text-slate-900 leading-tight tracking-tight" style={{ fontSize: "15px" }}>
                    Atlas EIP
                  </h1>
                  <p className="text-[10px] font-semibold tracking-widest uppercase mt-0.5" style={{ color: primaryColor, opacity: 0.7 }}>
                    Enterprise Intelligence
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setMobileOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-lg flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Render sidebar content with header hidden (we drew our own above) and forced expanded */}
            <SidebarContent forceExpanded hideHeader />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main 
        className={cn(
          "flex-1 bg-slate-50 min-h-screen transition-all duration-200",
          "lg:pt-0 pt-14",
          collapsed ? "lg:ml-[60px]" : "lg:ml-60"
        )}
      >
        {children}
      </main>
    </div>
  );
}