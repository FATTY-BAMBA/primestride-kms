"use client";

import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";

/**
 * ActionRow — single item in a list of priority-ordered actions
 * (the "Today's Focus" / "Smart Actions" pattern).
 *
 * Extracted from src/app/home/DashboardPage.tsx. Visual: byte-perfect
 * copy of the homepage's inline action row.
 *
 * Priority determines:
 *   - Icon container colors (border / bg / text)
 *   - Row background when "urgent" (subtle red tint)
 *
 * Optional badge appears as a small red number on the icon corner.
 */

export type Priority = "urgent" | "high" | "normal";

const PRIORITY_STYLES: Record<
  Priority,
  { border: string; bg: string; text: string }
> = {
  urgent: { border: "border-red-200", bg: "bg-red-50", text: "text-red-600" },
  high: { border: "border-amber-200", bg: "bg-amber-50", text: "text-amber-600" },
  normal: { border: "border-slate-200", bg: "bg-slate-50", text: "text-slate-600" },
};

export interface ActionRowProps {
  priority: Priority;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  sublabel: string;
  href: string;
  badge?: number;
}

export default function ActionRow({
  priority,
  icon: Icon,
  label,
  sublabel,
  href,
  badge,
}: ActionRowProps) {
  const router = useRouter();
  const pStyle = PRIORITY_STYLES[priority];

  return (
    <button
      onClick={() => router.push(href)}
      className={`group flex w-full items-center gap-3 rounded-lg p-3 text-left transition-all hover:bg-slate-50 ${
        priority === "urgent" ? "bg-red-50/50" : ""
      }`}
    >
      <div
        className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${pStyle.border} ${pStyle.bg} ${pStyle.text}`}
      >
        <Icon className="h-4 w-4" />
        {badge && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
            {badge}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <p className="truncate text-sm font-semibold text-slate-900">
            {label}
          </p>
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-purple-400" />
        </div>
        <p className="truncate text-xs text-slate-500">{sublabel}</p>
      </div>
    </button>
  );
}
