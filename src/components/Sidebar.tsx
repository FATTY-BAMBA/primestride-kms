"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import UserMenu from "./UserMenu";
import OrgSwitcher from "./OrgSwitcher";

export default function Sidebar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    fetch("/api/profile")
      .then(r => r.json())
      .then(d => {
        if (d.role && ["owner", "admin"].includes(d.role)) setIsAdmin(true);
      })
      .catch(() => {});
  }, []);

  // Close mobile sidebar on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const mainLinks = [
    { href: "/library", icon: "📄", label: "文件庫", labelEn: "Library" },
    { href: "/projects", icon: "🎯", label: "專案", labelEn: "Projects" },
    { href: "/agent", icon: "🤖", label: "AI 助手", labelEn: "AI Agent" },
    { href: "/search", icon: "🔍", label: "搜尋", labelEn: "Search" },
  ];

  const analyticsLinks = [
    { href: "/learning", icon: "📊", label: "學習分析", labelEn: "Learning", adminOnly: true },
    { href: "/ai-graph", icon: "🧠", label: "知識圖譜", labelEn: "Graph" },
  ];

  const adminLinks = [
    { href: "/admin", icon: "⚙️", label: "管理", labelEn: "Admin" },
    { href: "/team", icon: "👤", label: "成員", labelEn: "Members" },
    { href: "/teams", icon: "🏷️", label: "群組", labelEn: "Groups" },
    { href: "/developer", icon: "🔑", label: "API", labelEn: "Developer" },
  ];

  const isActive = (href: string) => {
    if (href === "/library") return pathname === "/library" || pathname.startsWith("/library/");
    return pathname === href || pathname.startsWith(href + "/");
  };

  const renderLink = (link: { href: string; icon: string; label: string; labelEn: string; adminOnly?: boolean }) => {
    if (link.adminOnly && !isAdmin) return null;
    const active = isActive(link.href);
    return (
      <Link
        key={link.href}
        href={link.href}
        style={{
          display: "flex", alignItems: "center", gap: collapsed ? 0 : 10,
          padding: collapsed ? "10px 0" : "10px 14px",
          justifyContent: collapsed ? "center" : "flex-start",
          borderRadius: 8, textDecoration: "none",
          background: active ? "#EDE9FE" : "transparent",
          color: active ? "#7C3AED" : "#4B5563",
          fontWeight: active ? 700 : 500,
          fontSize: 14, transition: "all 0.15s",
        }}
        onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "#F3F4F6"; }}
        onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
        title={collapsed ? `${link.label} ${link.labelEn}` : undefined}
      >
        <span style={{ fontSize: 18, flexShrink: 0 }}>{link.icon}</span>
        {!collapsed && (
          <span style={{ overflow: "hidden", whiteSpace: "nowrap" }}>
            {link.label}
            <span style={{ color: "#9CA3AF", fontWeight: 400, marginLeft: 4, fontSize: 12 }}>{link.labelEn}</span>
          </span>
        )}
      </Link>
    );
  };

  const sidebarContent = (
    <>
      {/* Logo */}
      <div style={{
        padding: collapsed ? "20px 8px" : "20px 16px",
        borderBottom: "1px solid #E5E7EB",
        display: "flex", alignItems: "center", gap: 10,
        justifyContent: collapsed ? "center" : "flex-start",
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: "linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, flexShrink: 0,
        }}>📚</div>
        {!collapsed && (
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: "#111827" }}>PS Atlas</div>
            <div style={{ fontSize: 10, color: "#9CA3AF" }}>Knowledge System</div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div style={{ flex: 1, overflowY: "auto", padding: collapsed ? "12px 6px" : "12px" }}>
        {/* Main */}
        {!collapsed && (
          <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", padding: "8px 14px 4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            主要功能 Main
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 16 }}>
          {mainLinks.map(renderLink)}
        </div>

        {/* Analytics */}
        {!collapsed && (
          <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", padding: "8px 14px 4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            分析 Analytics
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 16 }}>
          {analyticsLinks.map(renderLink)}
        </div>

        {/* Admin */}
        {isAdmin && (
          <>
            {!collapsed && (
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", padding: "8px 14px 4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                管理 Admin
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {adminLinks.map(renderLink)}
            </div>
          </>
        )}
      </div>

      {/* Bottom — Org Switcher + User */}
      <div style={{
        padding: collapsed ? "12px 6px" : "12px 16px",
        borderTop: "1px solid #E5E7EB",
        display: "flex", flexDirection: "column", gap: 8,
      }}>
        {!collapsed && <OrgSwitcher />}
        <div style={{ display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "space-between" }}>
          <UserMenu />
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "#9CA3AF", fontSize: 16, padding: 4,
              }}
              title="收合側邊欄 Collapse"
            >◀</button>
          )}
        </div>
      </div>
    </>
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Desktop Sidebar */}
      <aside style={{
        width: collapsed ? 60 : 240,
        background: "white",
        borderRight: "1px solid #E5E7EB",
        display: "flex", flexDirection: "column",
        transition: "width 0.2s ease",
        position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 30,
      }}
        className="sidebar-desktop"
      >
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            style={{
              position: "absolute", top: 20, right: -12,
              width: 24, height: 24, borderRadius: "50%",
              background: "white", border: "1px solid #E5E7EB",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", fontSize: 10, color: "#6B7280",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)", zIndex: 31,
            }}
          >▶</button>
        )}
        {sidebarContent}
      </aside>

      {/* Mobile Header */}
      <div className="mobile-header" style={{
        display: "none", position: "fixed", top: 0, left: 0, right: 0,
        height: 56, background: "white", borderBottom: "1px solid #E5E7EB",
        padding: "0 16px", alignItems: "center", justifyContent: "space-between",
        zIndex: 30,
      }}>
        <button onClick={() => setMobileOpen(true)} style={{
          background: "none", border: "none", fontSize: 24, cursor: "pointer", padding: 4,
        }}>☰</button>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>📚</span>
          <span style={{ fontWeight: 800, fontSize: 15 }}>PS Atlas</span>
        </div>
        <UserMenu />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50 }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }}
            onClick={() => setMobileOpen(false)} />
          <aside style={{
            position: "absolute", top: 0, left: 0, bottom: 0,
            width: 260, background: "white",
            display: "flex", flexDirection: "column",
            boxShadow: "4px 0 12px rgba(0,0,0,0.1)",
          }}>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main style={{
        flex: 1,
        marginLeft: collapsed ? 60 : 240,
        transition: "margin-left 0.2s ease",
        background: "#F9FAFB",
        minHeight: "100vh",
      }}
        className="main-content"
      >
        {children}
      </main>

      <style jsx global>{`
        @media (max-width: 768px) {
          .sidebar-desktop { display: none !important; }
          .mobile-header { display: flex !important; }
          .main-content { margin-left: 0 !important; padding-top: 56px !important; }
        }
      `}</style>
    </div>
  );
}
