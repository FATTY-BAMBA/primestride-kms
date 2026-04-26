"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import Sidebar from "@/components/Sidebar";

// Pages that should NOT have the sidebar (public/auth pages)
const noSidebarPaths = [
  "/", "/login", "/sign-in", "/sign-up", "/signup",
  "/auth", "/invite", "/sso-callback", "/reset-password",
  "/update-password", "/contact", "/audit", "/onboarding", 
  "/terms", "/privacy", "/clock",
];

// Pages that use the dark theme (slate-900 bg, light text)
// Used to scope CSS overrides like dark-mode picker icons
const darkThemePaths = ["/clock"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const shouldShowSidebar = !noSidebarPaths.some(p =>
    pathname === p || (p !== "/" && pathname.startsWith(p + "/"))
  );

  const isDarkTheme = darkThemePaths.some(p =>
    pathname === p || pathname.startsWith(p + "/")
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (isDarkTheme) {
      document.body.setAttribute("data-theme", "clock-dark");
    } else {
      document.body.removeAttribute("data-theme");
    }
    return () => {
      document.body.removeAttribute("data-theme");
    };
  }, [isDarkTheme]);

  if (!shouldShowSidebar) {
    return <>{children}</>;
  }

  return <Sidebar>{children}</Sidebar>;
}