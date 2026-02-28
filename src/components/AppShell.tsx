"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";

// Pages that should NOT have the sidebar (public/auth pages)
const noSidebarPaths = [
  "/", "/login", "/sign-in", "/sign-up", "/signup",
  "/auth", "/invite", "/sso-callback", "/reset-password",
  "/update-password", "/contact",
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const shouldShowSidebar = !noSidebarPaths.some(p =>
    pathname === p || (p !== "/" && pathname.startsWith(p + "/"))
  );

  if (!shouldShowSidebar) {
    return <>{children}</>;
  }

  return <Sidebar>{children}</Sidebar>;
}
