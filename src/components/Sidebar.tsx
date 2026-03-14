"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Library, FolderKanban, Bot, Search, FileText,
  BarChart3, Share2, Settings, Users, UserCircle,
  Key, Clock, Tag, ChevronRight, ChevronLeft,
  Menu, X, LayoutDashboard
} from "lucide-react";
import { cn } from "@/lib/utils";
import UserMenu from "./UserMenu";
import OrgSwitcher from "./OrgSwitcher";

interface SidebarProps { children: React.ReactNode; }

interface LinkItem {
  href: string;
  icon: React.ElementType;
  labelZh: string;
  labelEn: string;
  adminOnly?: boolean;
  badge?: boolean;
}

type Language = "zh" | "en";

export default function Sidebar({ children }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [language, setLanguage] = useState<Language>("zh");
  const [branding, setBranding] = useState<{
    org_name?: string; logo_emoji?: string;
    primary_color?: string; accent_color?: string; tagline?: string;
  } | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    fetch("/api/profile")
      .then(r => r.json())
      .then(d => {
        if (d.role && ["owner", "admin"].includes(d.role)) setIsAdmin(true);
        if (d.language) setLanguage(d.language as Language);
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

  const t = (zh: string, en: string) => language === "zh" ? zh : en;

  const mainLinks: LinkItem[] = [
    { href: "/home",      icon: LayoutDashboard, labelZh: "首頁",   labelEn: "Home" },
    { href: "/library",   icon: Library,         labelZh: "文件庫", labelEn: "Library" },
    { href: "/projects",  icon: FolderKanban,    labelZh: "專案",   labelEn: "Projects" },
    { href: "/agent",     icon: Bot,             labelZh: "AI 助手", labelEn: "AI Agent" },
    { href: "/search",    icon: Search,          labelZh: "搜尋",   labelEn: "Search" },
    { href: "/workflows", icon: FileText,        labelZh: "表單申請", labelEn: "Forms", badge: true },
  ];

  const analyticsLinks: LinkItem[] = [
    { href: "/learning", icon: BarChart3, labelZh: "學習分析", labelEn: "Learning", adminOnly: true },
    { href: "/ai-graph",  icon: Share2,    labelZh: "知識圖譜", labelEn: "Graph" },
  ];

  const adminLinks: LinkItem[] = [
    { href: "/admin",      icon: Settings,   labelZh: "管理",    labelEn: "Admin" },
    { href: "/team",       icon: Users,      labelZh: "成員",    labelEn: "Members" },
    { href: "/teams",      icon: UserCircle, labelZh: "群組",    labelEn: "Groups" },
    { href: "/developer",  icon: Key,        labelZh: "API",     labelEn: "API" },
    { href: "/audit-logs", icon: Clock,      labelZh: "操作紀錄", labelEn: "Audit Logs" },
    { href: "/branding",   icon: Tag,        labelZh: "品牌設定", labelEn: "Branding" },
  ];

  const isActive = (href: string) => {
    if (href === "/library") return pathname === "/library" || pathname.startsWith("/library/");
    return pathname === href || pathname.startsWith(href + "/");
  };

  const primaryColor = branding?.primary_color || "#7C3AED";

  const NavLink = ({ link }: { link: LinkItem }) => {
    if (link.adminOnly && !isAdmin) return null;
    const active = isActive(link.href);
    const Icon = link.icon;
    const showBadge = link.badge && pendingCount > 0 && isAdmin;
    const label = language === "zh" ? link.labelZh : link.labelEn;

    return (
      <Link
        href={link.href}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 group",
          collapsed ? "justify-center" : "justify-start",
          active
            ? "bg-violet-50 text-violet-700 font-medium"
            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
        )}
        title={collapsed ? label : undefined}
      >
        <span className="relative flex-shrink-0">
          <Icon className={cn(
            "w-4 h-4",
            active ? "text-violet-600" : "text-slate-400 group-hover:text-slate-600"
          )} />
          {showBadge && collapsed && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
              {pendingCount}
            </span>
          )}
        </span>
        {!collapsed && (
          <span className="flex-1 flex items-center justify-between min-w-0">
            <span className="truncate">{label}</span>
            {showBadge && (
              <span className="ml-2 min-w-5 h-5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center px-1.5 flex-shrink-0">
                {pendingCount}
              </span>
            )}
          </span>
        )}
      </Link>
    );
  };

  const SectionHeader = ({ zh, en }: { zh: string; en: string }) => {
    if (collapsed) return null;
    return (
      <p className="px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2 mt-4 first:mt-0">
        {t(zh, en)}
      </p>
    );
  };

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className={cn(
        "border-b border-slate-100 flex items-center gap-3",
        collapsed ? "p-4 justify-center" : "p-4"
      )}>
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
          style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${branding?.accent_color || "#A78BFA"} 100%)` }}
        >
          <span className="text-lg">{branding?.logo_emoji || "📚"}</span>
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <h1 className="font-semibold text-slate-900 text-sm truncate">
              {branding?.org_name || "Atlas EIP"}
            </h1>
            <p className="text-xs text-slate-400 truncate">{branding?.tagline || "Enterprise Intelligence"}</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4 px-3">
        <SectionHeader zh="主要功能" en="Main" />
        <div className="space-y-0.5 mb-4">
          {mainLinks.map(link => <NavLink key={link.href} link={link} />)}
        </div>

        <SectionHeader zh="分析" en="Analytics" />
        <div className="space-y-0.5 mb-4">
          {analyticsLinks.map(link => <NavLink key={link.href} link={link} />)}
        </div>

        {isAdmin && (
          <>
            <SectionHeader zh="管理" en="Admin" />
            <div className="space-y-0.5">
              {adminLinks.map(link => <NavLink key={link.href} link={link} />)}
            </div>
          </>
        )}
      </div>

      {/* Bottom — no overflow:hidden so UserMenu dropdown can escape upward */}
      <div className="border-t border-slate-100 p-3">
        {!collapsed && (
          <div className="overflow-hidden mb-2">
            <OrgSwitcher />
          </div>
        )}
        <div className={cn(
          "flex items-center",
          collapsed ? "justify-center" : "justify-between gap-2"
        )}>
          <div className={cn("min-w-0", collapsed ? "" : "flex-1")}>
            <UserMenu />
          </div>
          <button
            onClick={() => setCollapsed(prev => !prev)}
            className="flex-shrink-0 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            title={collapsed ? t("展開", "Expand") : t("收合", "Collapse")}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
        {!collapsed && (
          <p className="text-[10px] text-slate-300 text-center mt-2 tracking-wide">
            Powered by PrimeStride
          </p>
        )}
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop Sidebar */}
      <aside className={cn(
        "bg-white border-r border-slate-200 flex flex-col fixed top-0 left-0 bottom-0 z-40 transition-all duration-200",
        collapsed ? "w-[60px]" : "w-60"
      )}>
        <SidebarContent />
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between z-30">
        <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2 hover:bg-slate-100 rounded-lg">
          <Menu className="w-5 h-5 text-slate-600" />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-lg">{branding?.logo_emoji || "📚"}</span>
          <span className="font-semibold text-sm">{branding?.org_name || "Atlas EIP"}</span>
        </div>
        <UserMenu />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute top-0 left-0 bottom-0 w-64 bg-white flex flex-col shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <span className="font-semibold">Menu</span>
              <button onClick={() => setMobileOpen(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <SidebarContent />
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className={cn(
        "flex-1 bg-slate-50 min-h-screen transition-all duration-200",
        "lg:pt-0 pt-14",
        collapsed ? "lg:ml-[60px]" : "lg:ml-60"
      )}>
        {children}
      </main>
    </div>
  );
}