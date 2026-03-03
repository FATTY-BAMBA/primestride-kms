"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Library, 
  FolderKanban, 
  Bot, 
  Search, 
  FileText, 
  BarChart3, 
  Share2, 
  Settings, 
  Users, 
  UserCircle,
  MoreVertical,
  Key,
  Clock,
  Tag,
  ChevronRight,
  ChevronLeft,
  Menu,
  X
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

  const mainLinks: LinkItem[] = [
    { href: "/library", icon: Library, label: "文件庫", labelEn: "Library" },
    { href: "/projects", icon: FolderKanban, label: "專案", labelEn: "Projects" },
    { href: "/agent", icon: Bot, label: "AI 助手", labelEn: "AI Agent" },
    { href: "/search", icon: Search, label: "搜尋", labelEn: "Search" },
    { href: "/workflows", icon: FileText, label: "表單申請", labelEn: "Forms", badge: true },
  ];

  const analyticsLinks: LinkItem[] = [
    { href: "/learning", icon: BarChart3, label: "學習分析", labelEn: "Learning", adminOnly: true },
    { href: "/ai-graph", icon: Share2, label: "知識圖譜", labelEn: "Graph" },
  ];

  const adminLinks: LinkItem[] = [
    { href: "/admin", icon: Settings, label: "管理", labelEn: "Admin" },
    { href: "/team", icon: Users, label: "成員", labelEn: "Members" },
    { href: "/teams", icon: UserCircle, label: "群組", labelEn: "Groups" },
    { href: "/developer", icon: Key, label: "API", labelEn: "Developer" },
    { href: "/audit-logs", icon: Clock, label: "操作紀錄", labelEn: "Audit Logs" },
    { href: "/branding", icon: Tag, label: "品牌設定", labelEn: "Branding" },
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
        title={collapsed ? `${link.label} ${link.labelEn}` : undefined}
      >
        <span className="relative">
          <Icon className={cn(
            "w-4 h-4 flex-shrink-0",
            active ? "text-violet-600" : "text-slate-400 group-hover:text-slate-600"
          )} />
          {showBadge && collapsed && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
              {pendingCount}
            </span>
          )}
        </span>
        
        {!collapsed && (
          <span className="flex-1 flex items-center justify-between">
            <span>
              {link.label}
              <span className="text-slate-400 font-normal ml-1.5 text-xs">{link.labelEn}</span>
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

  const SectionHeader = ({ title }: { title: string }) => {
    if (collapsed) return null;
    return (
      <p className="px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2 mt-4 first:mt-0">
        {title}
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
          style={{ 
            background: `linear-gradient(135deg, ${primaryColor} 0%, ${branding?.accent_color || "#A78BFA"} 100%)` 
          }}
        >
          <span className="text-lg">{branding?.logo_emoji || "📚"}</span>
        </div>
        {!collapsed && (
          <div>
            <h1 className="font-semibold text-slate-900 text-sm">
              {branding?.org_name || "PS Atlas"}
            </h1>
            <p className="text-xs text-slate-400">{branding?.tagline || "Knowledge System"}</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4 px-3">
        <SectionHeader title="主要功能 Main" />
        <div className="space-y-0.5 mb-4">
          {mainLinks.map((link) => (
            <NavLink key={link.href} link={link} />
          ))}
        </div>

        <SectionHeader title="分析 Analytics" />
        <div className="space-y-0.5 mb-4">
          {analyticsLinks.map((link) => (
            <NavLink key={link.href} link={link} />
          ))}
        </div>

        {isAdmin && (
          <>
            <SectionHeader title="管理 Admin" />
            <div className="space-y-0.5">
              {adminLinks.map((link) => (
                <NavLink key={link.href} link={link} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Bottom */}
      <div className="p-4 border-t border-slate-100 relative z-50">
        {!collapsed && <OrgSwitcher />}
        <div className={cn(
          "flex items-center mt-2",
          collapsed ? "justify-center" : "justify-between"
        )}>
          <UserMenu />
          {!collapsed && (
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

  return (
    <div className="flex min-h-screen">
      {/* Desktop Sidebar */}
      <aside 
        className={cn(
          "bg-white border-r border-slate-200 flex flex-col fixed top-0 left-0 bottom-0 z-40 transition-all duration-200",
          collapsed ? "w-[60px]" : "w-60"
        )}
      >
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="absolute top-5 -right-3 w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm hover:bg-slate-50 text-slate-500"
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
          <span className="text-lg">{branding?.logo_emoji || "📚"}</span>
          <span className="font-semibold text-sm">{branding?.org_name || "PS Atlas"}</span>
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
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <span className="font-semibold">Menu</span>
              <button 
                onClick={() => setMobileOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
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