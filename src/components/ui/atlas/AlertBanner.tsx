import { Button } from "@/components/ui/button";

/**
 * AlertBanner — horizontal banner for inline alerts (trial expiry,
 * subscription warnings, system notices).
 *
 * Extracted from src/app/home/DashboardPage.tsx (Trial Banners section).
 * Visual: byte-perfect copy of the homepage's two inline banner instances.
 *
 * Variants share identical layout — only the color palette differs:
 *   - "warning" (blue):  upcoming attention required (e.g. trial ending)
 *   - "danger"  (red):   action required now (e.g. trial expired)
 *
 * The caller supplies icon, title, subtitle, and CTA. This keeps the
 * component free of i18n logic and business conditions.
 */

export type AlertVariant = "warning" | "danger";

const VARIANT_STYLES: Record<
  AlertVariant,
  {
    container: string;
    icon: string;
    title: string;
    subtitle: string;
    button: string;
  }
> = {
  warning: {
    container: "border-blue-200 bg-blue-50",
    icon: "text-blue-600",
    title: "text-blue-900",
    subtitle: "text-blue-700",
    button: "bg-blue-600 hover:bg-blue-700",
  },
  danger: {
    container: "border-red-200 bg-red-50",
    icon: "text-red-600",
    title: "text-red-900",
    subtitle: "text-red-700",
    button: "bg-red-600 hover:bg-red-700",
  },
};

export interface AlertBannerProps {
  variant: AlertVariant;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
}

export default function AlertBanner({
  variant,
  icon: Icon,
  title,
  subtitle,
  ctaLabel,
  ctaHref,
}: AlertBannerProps) {
  const s = VARIANT_STYLES[variant];

  return (
    <div className={`mt-6 flex items-center justify-between gap-4 rounded-lg border px-4 py-3 ${s.container}`}>
      <div className="flex items-center gap-3">
        <Icon className={`h-5 w-5 ${s.icon}`} />
        <div>
          <p className={`text-sm font-semibold ${s.title}`}>{title}</p>
          <p className={`text-xs ${s.subtitle}`}>{subtitle}</p>
        </div>
      </div>
      <Button size="sm" className={`h-8 text-xs ${s.button}`} asChild>
        <a href={ctaHref}>{ctaLabel}</a>
      </Button>
    </div>
  );
}
