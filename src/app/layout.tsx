import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { AuthProvider } from "@/lib/AuthContext";
import AppShell from "@/components/AppShell";
import { Analytics } from '@vercel/analytics/react';
import Script from 'next/script';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Atlas EIP — Enterprise Intelligence Platform",
  description: "AI-powered Enterprise Intelligence Platform for Taiwan businesses. 2026 Labor Standards compliance, knowledge management, and workflow automation.",
};

// Atlas EIP is an authed app; every route requires Clerk auth (headers/cookies).
// Routes are inherently dynamic. Declaring this here lets components like Sidebar
// use useSearchParams without per-component Suspense boundaries. See ADR 0002.
export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={inter.className}>
          <AuthProvider>
            <AppShell>{children}</AppShell>
          </AuthProvider>
          <Analytics />
          <Script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js" strategy="beforeInteractive" />
        </body>
      </html>
    </ClerkProvider>
  );
}