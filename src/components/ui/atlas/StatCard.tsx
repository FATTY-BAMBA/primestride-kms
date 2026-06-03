"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";

/**
 * StatCard — single hero metric card used on dashboards.
 *
 * Extracted from src/app/home/DashboardPage.tsx as part of the
 * ADR 0004 Known Debt: component extraction so subsequent page
 * redesigns compose primitives rather than re-implementing them.
 *
 * Visual: byte-perfect copy of the homepage's inline stat card.
 * Do not modify the visual treatment here without updating ADR 0004
 * and visually verifying every page that consumes this component.
 */

export type StatColor = "purple" | "danger" | "blue" | "success";

const COLOR_MAP: Record<StatColor, { bg: string; text: string }> = {
  purple: { bg: "bg-purple-50", text: "text-purple-600" },
  danger: { bg: "bg-red-50", text: "text-red-600" },
  blue: { bg: "bg-blue-50", text: "text-blue-600" },
  success: { bg: "bg-emerald-50", text: "text-emerald-600" },
};

export interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  color: StatColor;
  href?: string;
  pulse?: boolean;
  trend?: string;
}

export default function StatCard({
  label,
  value,
  icon: Icon,
  color,
  href,
  pulse,
  trend,
}: StatCardProps) {
  const router = useRouter();
  const colors = COLOR_MAP[color];

  return (
    <Card
      className={`group border-slate-200 transition-all duration-200 hover:border-slate-300 hover:shadow-md ${
        href ? "cursor-pointer" : ""
      }`}
      onClick={() => href && router.push(href)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-lg ${colors.bg}`}
          >
            <Icon className={`h-4 w-4 ${colors.text}`} />
          </div>
          {pulse && (
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500"></span>
            </span>
          )}
        </div>
        <div className="mt-3">
          <div className="text-2xl font-bold tabular-nums tracking-tight text-slate-900">
            {value ?? "—"}
          </div>
          <div className="mt-0.5 text-xs font-medium text-slate-500">
            {label}
          </div>
          {trend && (
            <div className="mt-0.5 text-[10px] text-slate-400">{trend}</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
