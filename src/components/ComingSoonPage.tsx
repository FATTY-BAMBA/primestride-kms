"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface ComingSoonPageProps {
  titleZh: string;
  titleEn: string;
}

export default function ComingSoonPage({ titleZh, titleEn }: ComingSoonPageProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-slate-50">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
        <div className="text-5xl mb-4">🚧</div>

        <h1 className="text-xl font-bold text-slate-900 mb-2">
          即將推出
        </h1>
        <p className="text-sm text-slate-500 mb-6">
          Coming Soon
        </p>

        <div className="mb-6 pb-6 border-b border-slate-100">
          <p className="text-base font-medium text-slate-700">
            {titleZh}
          </p>
          <p className="text-sm text-slate-400 mt-1">
            {titleEn}
          </p>
        </div>

        <p className="text-sm text-slate-600 leading-relaxed mb-6">
          此功能將在 Phase C(約 1-2 週內)完成。
        </p>
        <p className="text-sm text-slate-500 leading-relaxed mb-8">
          This feature will be ready in Phase C (~1-2 weeks).
        </p>

        <Link
          href="/home"
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-violet-700 bg-violet-50 rounded-lg hover:bg-violet-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回首頁 Back to Home
        </Link>
      </div>
    </div>
  );
}
