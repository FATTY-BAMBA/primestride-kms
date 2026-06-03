import Link from "next/link";
import { Zap, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/**
 * OnboardingCard - first-time setup checklist with completion tracking.
 *
 * Extracted from src/app/home/DashboardPage.tsx (Onboarding Checklist
 * section). Visual: byte-perfect copy of the homepage's inline card.
 *
 * The card is intentionally gated by the caller (visibility logic stays
 * in the page that owns the business rules). This component just renders.
 *
 * Each step shows either a checkmark (when done) or its own icon. Step
 * cards route to their href via Next.js Link.
 */

export type OnboardingStep = {
  step: number;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  href: string;
  done: boolean;
};

export interface OnboardingCardProps {
  title: string;
  subtitle: string;
  steps: OnboardingStep[];
}

export default function OnboardingCard({
  title,
  subtitle,
  steps,
}: OnboardingCardProps) {
  return (
    <Card className="mb-6 border-purple-200 bg-gradient-to-br from-purple-50/50 to-blue-50/30">
      <CardContent className="p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-600">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">{title}</h3>
            <p className="text-xs text-purple-600">{subtitle}</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {steps.map((item) => (
            <Link
              key={item.step}
              href={item.href}
              className={`group flex items-start gap-3 rounded-lg border p-3 transition-all hover:border-purple-300 hover:shadow-sm ${
                item.done ? "border-emerald-200" : "border-purple-100"
              } bg-white`}
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                  item.done ? "bg-emerald-100" : "bg-purple-50"
                }`}
              >
                {item.done ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <item.icon className="h-4 w-4 text-purple-600" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {item.title}
                </p>
                <p className="text-xs text-slate-500">{item.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
