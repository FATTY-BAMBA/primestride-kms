"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import UserMenu from "@/components/UserMenu";

type RollupDoc = {
  doc_id: string;
  title: string;
  version: string;
  status: string;
  file_url: string | null;
  counts: {
    totalFeedback: number;
    helpful: number;
    notHelpful: number;
  };
  helpfulnessRate: number | null;
  ambiguityScore: number;
  topNotes: string[];
};

type RollupResponse = {
  summary: {
    totalDocs: number;
    totalFeedback: number;
    helpful: number;
    notHelpful: number;
  };
  documents: RollupDoc[];
};

// ── Fix 5: Visual feedback breakdown instead of raw stat cards ──
function FeedbackOverview({ summary, overallRate, lang }: {
  summary: RollupResponse["summary"];
  overallRate: number | null;
  lang: "zh" | "en";
}) {
  const t = (zh: string, en: string) => lang === "zh" ? zh : en;
  // withFeedback derived from totalFeedback > 0
  const helpfulPct = summary.totalFeedback > 0
    ? Math.round((summary.helpful / summary.totalFeedback) * 100)
    : 0;
  const notHelpfulPct = summary.totalFeedback > 0
    ? Math.round((summary.notHelpful / summary.totalFeedback) * 100)
    : 0;
  const noFeedbackCount = summary.totalDocs - (summary.totalFeedback > 0 ? Math.min(summary.totalDocs, summary.totalFeedback) : 0);

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr 1.6fr",
      gap: 16,
      marginBottom: 32,
    }}>
      {/* Left: key numbers */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{ padding: "16px", background: "var(--bg-secondary)", borderRadius: 12, border: "1px solid var(--border-color)" }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
            {t("文件總數", "Documents")}
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#A78BFA", lineHeight: 1 }}>{summary.totalDocs}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{t("份已發布", "published")}</div>
        </div>
        <div style={{ padding: "16px", background: "var(--bg-secondary)", borderRadius: 12, border: "1px solid var(--border-color)" }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
            {t("回饋總數", "Feedback")}
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#2563EB", lineHeight: 1 }}>{summary.totalFeedback}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
            {t("筆用戶回饋", "user responses")}
          </div>
        </div>
      </div>

      {/* Right: visual breakdown */}
      <div style={{ padding: "16px 20px", background: "var(--bg-secondary)", borderRadius: 12, border: "1px solid var(--border-color)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
            {t("回饋分佈", "Feedback Breakdown")}
          </div>
          {overallRate !== null && (
            <div style={{
              padding: "4px 12px", borderRadius: 20, fontSize: 13, fontWeight: 700,
              background: overallRate >= 70 ? "#D1FAE5" : overallRate >= 40 ? "#FEF3C7" : "#FEE2E2",
              color: overallRate >= 70 ? "#065F46" : overallRate >= 40 ? "#92400E" : "#991B1B",
            }}>
              {overallRate}% {t("有幫助", "helpful")}
            </div>
          )}
        </div>

        {summary.totalFeedback === 0 ? (
          <div style={{ color: "var(--text-muted)", fontSize: 13, paddingTop: 8 }}>
            {t("尚無回饋資料 — 分享文件給員工後即可收集", "No feedback yet — share documents with your team to start collecting")}
          </div>
        ) : (
          <>
            {/* Stacked bar */}
            <div style={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden", marginBottom: 12, gap: 2 }}>
              <div style={{ width: `${helpfulPct}%`, background: "#10B981", borderRadius: "6px 0 0 6px", transition: "width 0.6s ease" }} />
              <div style={{ width: `${notHelpfulPct}%`, background: "#EF4444", borderRadius: notHelpfulPct === 100 ? 6 : "0 6px 6px 0", transition: "width 0.6s ease" }} />
              {helpfulPct + notHelpfulPct < 100 && (
                <div style={{ flex: 1, background: "#E5E7EB", borderRadius: "0 6px 6px 0" }} />
              )}
            </div>

            {/* Legend */}
            <div style={{ display: "flex", gap: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: "#10B981" }} />
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  👍 {t("有幫助", "Helpful")}
                </span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#059669" }}>{summary.helpful}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: "#EF4444" }} />
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  👎 {t("無幫助", "Not helpful")}
                </span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#DC2626" }}>{summary.notHelpful}</span>
              </div>
            </div>

            {/* Per-doc coverage */}
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border-color)" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>
                {t("文件回饋覆蓋率", "Document feedback coverage")}
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                {[
                  { label: t("有回饋", "With feedback"), count: summary.totalFeedback > 0 ? Math.min(summary.totalDocs, summary.totalFeedback) : 0, color: "#7C3AED" },
                  { label: t("尚無回饋", "No feedback yet"), count: Math.max(0, summary.totalDocs - (summary.totalFeedback > 0 ? Math.min(summary.totalDocs, summary.totalFeedback) : 0)), color: "#D1D5DB" },
                ].map(item => (
                  <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: item.color }} />
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{item.label}:</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function LearningPage() {
  const [data, setData] = useState<RollupResponse | null>(null);
  const [lang, setLang] = useState<"zh" | "en">("zh");
  const t = (zh: string, en: string) => lang === "zh" ? zh : en;
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    setErr(null);
    try {
      fetch("/api/profile").then(r => r.json()).then(d => { if (d.language) setLang(d.language); }).catch(() => {});
      const res = await fetch("/api/learning-rollup");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to load learning rollup");
      setData(json);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const overallRate = data && data.summary.totalFeedback > 0
    ? Math.round((data.summary.helpful / data.summary.totalFeedback) * 100)
    : null;

  return (
    <ProtectedRoute requireAdmin>
      <main className="container">
        <header style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: "linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
                }}>
                  📊
                </div>
                {/* ── Fix 1: explicit color so title never goes white-on-white ── */}
                <h1 style={{ margin: 0, color: "var(--text-primary)", fontSize: 22, fontWeight: 700 }}>
                  {t("學習分析儀表板", "Learning Dashboard")}
                </h1>
              </div>
              <p style={{ color: "var(--text-muted)", margin: 0, fontSize: 14 }}>
                {t("每份文件的回饋分析 — 找出需要改善的地方", "Feedback analytics per document — identify what needs improvement")}
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {/* ── Fix 2: correct link to /library not / ── */}
              <Link href="/library" className="btn">
                {t("← 文件庫", "← Library")}
              </Link>
              <Link href="/admin" className="btn btn-primary">
                {t("管理 →", "Admin →")}
              </Link>
              <UserMenu />
            </div>
          </div>
        </header>

        {loading && <div className="loading">Loading learning data...</div>}

        {err && (
          <div className="card" style={{ borderColor: "#DC2626", background: "#FEE2E2" }}>
            <p style={{ color: "#DC2626", margin: 0 }}>Error: {err}</p>
            <button onClick={loadDashboard} className="btn" style={{ marginTop: 12 }}>Retry</button>
          </div>
        )}

        {!loading && !err && data && (
          <div>
            {/* ── Fix 5: Visual feedback overview ── */}
            <FeedbackOverview summary={data.summary} overallRate={overallRate} lang={lang} />

            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, color: "var(--text-primary)" }}>
              {t("文件回饋排名", "Documents Ranked by Need for Improvement")}
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 0, marginBottom: 20 }}>
              {t("負面回饋最多的文件優先顯示", "Documents with the most negative feedback appear first")}
            </p>

            <div style={{ display: "grid", gap: 16 }}>
              {data.documents.map((d, i) => (
                <div key={d.doc_id} className="card animate-in" style={{ animationDelay: `${i * 0.05}s` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "var(--text-primary)" }}>
                        {d.title}
                      </h3>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        {/* ── Fix 4: removed doc_id badge ── */}
                        <span className="badge">{d.version}</span>
                        <span className="badge badge-success">{d.status}</span>
                        {d.helpfulnessRate !== null && (
                          <span style={{
                            padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700,
                            background: d.helpfulnessRate >= 70 ? "#D1FAE5" : d.helpfulnessRate >= 40 ? "#FEF3C7" : "#FEE2E2",
                            color: d.helpfulnessRate >= 70 ? "#065F46" : d.helpfulnessRate >= 40 ? "#92400E" : "#991B1B",
                          }}>
                            {d.helpfulnessRate}% {t("有幫助", "helpful")}
                          </span>
                        )}
                        {d.counts.totalFeedback === 0 && (
                          <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, background: "#F3F4F6", color: "#9CA3AF" }}>
                            {t("尚無回饋", "No feedback yet")}
                          </span>
                        )}
                        {d.ambiguityScore > 0 && (
                          <span className="badge badge-warning">⚠ {t("需要關注", "Needs attention")}</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <Link href={`/library/${encodeURIComponent(d.doc_id)}`} className="btn">
                        {t("查看 →", "View →")}
                      </Link>
                    </div>
                  </div>

                  {/* Feedback stats + bar */}
                  {d.counts.totalFeedback > 0 ? (
                    <>
                      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 13, marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <span>👍</span>
                          <span style={{ color: "var(--text-muted)" }}>{t("有幫助", "Helpful")}</span>
                          <span style={{ fontWeight: 700, color: "#059669" }}>{d.counts.helpful}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <span>👎</span>
                          <span style={{ color: "var(--text-muted)" }}>{t("無幫助", "Not helpful")}</span>
                          <span style={{ fontWeight: 700, color: "#DC2626" }}>{d.counts.notHelpful}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <span style={{ color: "var(--text-muted)" }}>{t("共", "Total")}</span>
                          <span style={{ fontWeight: 700 }}>{d.counts.totalFeedback}</span>
                        </div>
                      </div>
                      <div style={{ width: "100%", height: 6, borderRadius: 3, background: "#F3F4F6", overflow: "hidden", display: "flex", marginBottom: 16 }}>
                        <div style={{ width: `${(d.counts.helpful / d.counts.totalFeedback) * 100}%`, background: "#10B981", height: "100%", transition: "width 0.5s ease" }} />
                        <div style={{ width: `${(d.counts.notHelpful / d.counts.totalFeedback) * 100}%`, background: "#EF4444", height: "100%", transition: "width 0.5s ease" }} />
                      </div>
                    </>
                  ) : (
                    <div style={{ marginBottom: 16, padding: "8px 12px", background: "#F9FAFB", borderRadius: 8, fontSize: 12, color: "#9CA3AF" }}>
                      {t("此文件尚未收到任何回饋。分享給員工後即可追蹤使用狀況。", "No feedback collected yet. Share this document with your team to start tracking.")}
                    </div>
                  )}

                  {/* Negative comments */}
                  <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: 14 }}>
                    <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13, color: "var(--text-primary)" }}>
                      💬 {t("負面回饋留言", "Negative Feedback Comments")}
                    </div>
                    {d.topNotes.length === 0 ? (
                      <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>
                        {t("尚無負面留言 — 表現良好！", "No negative comments yet — looking good!")}
                      </p>
                    ) : (
                      <ul style={{ margin: 0, paddingLeft: 20 }}>
                        {d.topNotes.map((n, idx) => (
                          <li key={idx} style={{ marginBottom: 6, color: "#6B7280", fontSize: 13 }}>{n}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {data.documents.length === 0 && (
              <div className="card" style={{ textAlign: "center", padding: 40 }}>
                <p style={{ color: "var(--text-muted)" }}>
                  {t("尚無文件。請上傳文件並收集回饋後即可查看分析。", "No documents found. Create documents and collect feedback to see analytics.")}
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
}