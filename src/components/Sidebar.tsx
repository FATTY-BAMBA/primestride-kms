"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Home,
  FileText,
  ClipboardList,
  Wallet,
  ClipboardCheck,
  Library,
  Search,
  Bot,
  Settings,
  Users,
  BarChart3,
  Key,
  Clock,
  Tag,
  Scale,
  Leaf,
  Zap,
  ChevronRight,
  ChevronLeft,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import UserMenu from "./UserMenu";
import OrgSwitcher from "./OrgSwitcher";

interface LinkItem {
  href: string;
  icon: React.ElementType;
  label: string;
  labelEn: string;
  adminOnly?: boolean;
  badge?: boolean;
}

interface Section {
  title: string;
  titleEn: string;
  links: LinkItem[];
  adminOnly?: boolean;
}

export default function Sidebar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab");
  const [collapsed, setCollapsed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [lang, setLang] = useState<"zh" | "en">("zh");
  const [pendingCount, setPendingCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => {
        if (d.role && ["owner", "admin"].includes(d.role)) setIsAdmin(true);
        if (d.language) setLang(d.language);
      })
      .catch(() => {});
    fetch("/api/workflows?view=all&status=pending")
      .then((r) => r.json())
      .then((d) => {
        if (d.submissions) setPendingCount(d.submissions.length);
      })
      .catch(() => {});
  }, []);

  const isActive = (href: string) => {
    if (href === "/library")
      return pathname === "/library" || pathname.startsWith("/library/");
    if (href.startsWith("/admin?tab=")) {
      const tab = href.split("tab=")[1];
      return pathname === "/admin" && currentTab === tab;
    }
    if (href === "/admin")
      return pathname === "/admin" && (!currentTab || currentTab === "overview");
    return pathname === href || pathname.startsWith(href + "/");
  };

  const sections: Section[] = [
    {
      title: "我的工作",
      titleEn: "MY WORK",
      links: [
        { href: "/workflows", icon: FileText, label: "表單申請", labelEn: "Requests", badge: true },
        { href: "/clock/manual", icon: ClipboardList, label: "我的打卡", labelEn: "My Clock-in" },
        { href: "/my-pay", icon: Wallet, label: "我的薪資", labelEn: "My Pay" },
        { href: "/todo", icon: ClipboardCheck, label: "待辦", labelEn: "To-Do" },
      ],
    },
    {
      title: "知識",
      titleEn: "KNOWLEDGE",
      links: [
        { href: "/library", icon: Library, label: "文件庫", labelEn: "Library" },
        { href: "/search", icon: Search, label: "搜尋", labelEn: "Ask Atlas" },
        { href: "/agent", icon: Bot, label: "AI 助手", labelEn: "Atlas Agent", adminOnly: true },
      ],
    },
    {
      title: "管理",
      titleEn: "MANAGE",
      adminOnly: true,
      links: [
        { href: "/admin", icon: Settings, label: "概覽", labelEn: "Overview" },
        { href: "/admin?tab=employees", icon: Users, label: "員工", labelEn: "Employees" },
        { href: "/admin?tab=wallchart", icon: ClipboardList, label: "出勤", labelEn: "Attendance" },
        { href: "/admin/payroll", icon: Wallet, label: "薪資", labelEn: "Payroll" },
        { href: "/admin?tab=compliance", icon: Scale, label: "合規", labelEn: "Compliance" },
        { href: "/admin?tab=esg", icon: Leaf, label: "ESG 報告", labelEn: "ESG Report" },
        { href: "/teams", icon: Users, label: "工作群組", labelEn: "Workspaces" },
        { href: "/team", icon: Users, label: "成員與權限", labelEn: "Members & Access" },
      ],
    },
    {
      title: "分析",
      titleEn: "ANALYTICS",
      adminOnly: true,
      links: [
        { href: "/learning", icon: BarChart3, label: "學習分析", labelEn: "Learning Insights" },
        { href: "/metrics", icon: BarChart3, label: "指標數據", labelEn: "Platform Metrics" },
      ],
    },
    {
      title: "設定",
      titleEn: "SETTINGS",
      adminOnly: true,
      links: [
        { href: "/developer", icon: Key, label: "API", labelEn: "Developer" },
        { href: "/audit-logs", icon: Clock, label: "操作紀錄", labelEn: "Audit Logs" },
        { href: "/branding", icon: Tag, label: "品牌設定", labelEn: "Branding" },
      ],
    },
  ];

  const NavLink = ({
    link,
    isCollapsed,
  }: {
    link: LinkItem;
    isCollapsed: boolean;
  }) => {
    if (link.adminOnly && !isAdmin) return null;
    const active = isActive(link.href);
    const Icon = link.icon;
    const showBadge = link.badge && pendingCount > 0 && isAdmin;

    return (
      <Link
        href={link.href}
        className={cn(
          "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150",
          isCollapsed ? "justify-center" : "justify-start",
          active
            ? "bg-purple-50 font-semibold text-purple-700"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        )}
        title={isCollapsed ? `${link.label} ${link.labelEn}` : undefined}
      >
        <span className="relative">
          <Icon
            className={cn(
              "h-4 w-4 flex-shrink-0",
              active
                ? "text-purple-600"
                : "text-slate-400 group-hover:text-slate-600"
            )}
          />
          {showBadge && isCollapsed && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
              {pendingCount}
            </span>
          )}
        </span>
        {!isCollapsed && (
          <span className="flex flex-1 items-center justify-between">
            <span>{lang === "zh" ? link.label : link.labelEn}</span>
            {showBadge && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
                {pendingCount}
              </span>
            )}
          </span>
        )}
        {active && !isCollapsed && (
          <div className="ml-auto h-5 w-0.5 rounded-full bg-purple-600" />
        )}
      </Link>
    );
  };

  const SidebarContent = ({
    forceExpanded = false,
  }: {
    forceExpanded?: boolean;
  }) => {
    const isCollapsed = forceExpanded ? false : collapsed;
    return (
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div
          className={cn(
            "flex items-center gap-3 border-b border-slate-100",
            isCollapsed ? "justify-center p-4" : "p-4"
          )}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600">
            <Zap className="h-4 w-4 text-white" />
          </div>
          {!isCollapsed && (
            <span className="text-sm font-bold tracking-tight text-slate-900 whitespace-nowrap">
              Atlas EIP
            </span>
          )}
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <div className="mb-4">
            <NavLink
              link={{
                href: "/home",
                icon: Home,
                label: "首頁",
                labelEn: "Home",
              }}
              isCollapsed={isCollapsed}
            />
          </div>

          {sections.map((section) => {
            if (section.adminOnly && !isAdmin) return null;
            const visibleLinks = section.links.filter(
              (l) => !l.adminOnly || isAdmin
            );
            if (visibleLinks.length === 0) return null;

            return (
              <div key={section.title} className="mb-4">
                {!isCollapsed && (
                  <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {lang === "zh" ? section.title : section.titleEn}
                  </p>
                )}
                <div className="space-y-0.5">
                  {visibleLinks.map((link) => (
                    <NavLink
                      key={link.href}
                      link={link}
                      isCollapsed={isCollapsed}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom: org switcher, user menu, collapse toggle */}
        <div className="border-t border-slate-100 p-4">
          {!isCollapsed && <OrgSwitcher />}
          <div className={cn("mt-3", isCollapsed && "flex justify-center")}>
            <UserMenu collapsed={isCollapsed} />
          </div>
          {!isCollapsed && !forceExpanded && (
            <button
              onClick={() => setCollapsed(true)}
              className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg py-1.5 text-xs text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <ChevronLeft className="h-3 w-3" />
              <span>{lang === "zh" ? "收合" : "Collapse"}</span>
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "fixed bottom-0 left-0 top-0 z-40 hidden flex-col border-r border-slate-200 bg-white transition-all duration-200 lg:flex",
          collapsed ? "w-[60px]" : "w-[200px]"
        )}
      >
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="absolute -right-3 top-5 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-100"
            title={lang === "zh" ? "展開" : "Expand"}
          >
            <ChevronRight className="h-3 w-3" />
          </button>
        )}
        <SidebarContent />
      </aside>

      {/* Mobile Header */}
      <div className="fixed left-0 right-0 top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 lg:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="-ml-2">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px] p-0">
            <SidebarContent forceExpanded />
          </SheetContent>
        </Sheet>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-600">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-bold">Atlas EIP</span>
        </div>
        <div className="w-10" />
      </div>

      {/* Main Content */}
      <main
        className={cn(
          "min-h-screen flex-1 bg-slate-50 transition-all duration-200",
          "pt-14 lg:pt-0",
          collapsed ? "lg:ml-[60px]" : "lg:ml-[200px]"
        )}
      >
        {children}
      </main>
    </div>
  );
}
