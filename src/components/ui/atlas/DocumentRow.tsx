import Link from "next/link";
import { FileText, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/**
 * DocumentRow — single document row used in document lists.
 *
 * Extracted from src/app/home/DashboardPage.tsx (Recent Documents
 * section). Visual: byte-perfect copy of the homepage's inline doc row.
 *
 * The caller is responsible for formatting the timestamp (i18n etc.).
 * This component is pure presentation; it does no date formatting and
 * no language detection.
 *
 * Routes to /library/{docId} via Next.js Link (prefetch-friendly).
 */

export interface DocumentRowProps {
  docId: string;
  title: string;
  docType: string | null;
  timeAgoLabel?: string;
}

export default function DocumentRow({
  docId,
  title,
  docType,
  timeAgoLabel,
}: DocumentRowProps) {
  return (
    <Link
      href={`/library/${encodeURIComponent(docId)}`}
      className="group flex items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-slate-50"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-purple-50">
        <FileText className="h-4 w-4 text-purple-600" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900 transition-colors group-hover:text-purple-700">
          {title}
        </p>
        <div className="mt-0.5 flex items-center gap-2">
          <Badge
            variant="secondary"
            className="h-4 px-1.5 text-[10px] font-medium"
          >
            {docType || "document"}
          </Badge>
          {timeAgoLabel && (
            <span className="text-xs text-slate-400">{timeAgoLabel}</span>
          )}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-purple-400" />
    </Link>
  );
}
