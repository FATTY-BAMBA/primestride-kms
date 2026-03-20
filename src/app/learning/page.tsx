"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";

type RollupDoc = {
  doc_id: string;
  title: string;
  version: string;
  status: string;
  file_url: string | null;
  counts: { totalFeedback: number; helpful: number; notHelpful: number; };
  helpfulnessRate: number | null;
  ambiguityScore: number;
  topNotes: string[];
};

type RollupResponse = {
  summary: { totalDocs: number; totalFeedback: number; helpful: number; notHelpful: number; };
  documents: RollupDoc[];
};

export default function LearningPage() {
  const [data, setData] = useState<RollupResponse | null>(null);
  const [lang, setLang] = useState<"zh" | "en">("zh");
  const t = (zh: string, en: string) => lang === "zh" ? zh : en;
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { loadDashboard(); }, []);

  const loadDashboard = async () => {
    setLoading(true); setErr(null);
    try {
      fetch("/api/profile").then(r => r.json()).then(d => { if (d.language) setLang(d.language); }).catch(() => {});
      const res = await fetch("/api/learning-rollup");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to load");
      setData(json);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error");
      setData(null);
    } finally { setLoading(false); }
  };

  const overallRate = data && data.summary.totalFeedback > 0
    ? Math.round((data.summary.helpful / data.summary.totalFeedback) * 100)
    : null;

  const helpfulPct = data && data.summary.totalFeedback > 0
    ? Math.round((data.summary.helpful / data.summary.totalFeedback) * 100) : 0;
  const notHelpfulPct = data && data.summary.totalFeedback > 0
    ? Math.round((data.summary.notHelpful / data.summary.totalFeedback) * 100) : 0;

  return (
    <ProtectedRoute requireAdmin>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 20px 48px" }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, flexShrink: 0,
              background: "linear-gradient(135deg, #8B5CF6, #EC4899)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
            }}>📊</div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#0F172A", letterSpacing: "-0.02em" }}>
              {t("學習分析儀表板", "Learning Dashboard")}
            </h1>
          </div>
          <p style={{ margin: "0 0 0 52px", fontSize: 14, color: "#94A3B8" }}>
            {t("每份文件的回饋分析 — 找出需要改善的地方", "Feedback analytics per document — identify what needs improvement")}
          </p>
        </div>

        {/* ── Nav buttons ── */}
        <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
          <Link href="/library" style={{
            padding: "7px 14px", borderRadius: 8, border: "1px solid #E2E8F0",
            background: "white", fontSize: 13, fontWeight: 600, color: "#374151",
            textDecoration: "none", transition: "all 0.15s",
          }}>← {t("文件庫", "Library")}</Link>
          <Link href="/admin" style={{
            padding: "7px 14px", borderRadius: 8, border: "none",
            background: "#7C3AED", fontSize: 13, fontWeight: 600, color: "white",
            textDecoration: "none",
          }}>{t("管理 →", "Admin →")}</Link>
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div style={{ padding: "60px 0", textAlign: "center", color: "#94A3B8", fontSize: 14 }}>
            {t("載入中...", "Loading...")}
          </div>
        )}

        {/* ── Error ── */}
        {err && (
          <div style={{ padding: 16, borderRadius: 12, background: "#FEF2F2", border: "1px solid #FECACA", marginBottom: 20 }}>
            <p style={{ color: "#DC2626", margin: "0 0 8px", fontSize: 14 }}>錯誤: {err}</p>
            <button onClick={loadDashboard} style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid #E2E8F0", background: "white", fontSize: 13, cursor: "pointer" }}>
              重試
            </button>
          </div>
        )}

        {!loading && !err && data && (
          <>
            {/* ── Stats Overview ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.8fr", gap: 12, marginBottom: 24 }}>

              {/* Doc count */}
              <div style={{ background: "white", borderRadius: 14, border: "1px solid #E2E8F0", padding: "18px 20px" }}>
                <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                  {t("文件總數", "Documents")}
                </div>
                <div style={{ fontSize: 36, fontWeight: 800, color: "#7C3AED", lineHeight: 1, letterSpacing: "-0.03em" }}>
                  {data.summary.totalDocs}
                </div>
                <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 4 }}>{t("份已發布", "published")}</div>
              </div>

              {/* Feedback count */}
              <div style={{ background: "white", borderRadius: 14, border: "1px solid #E2E8F0", padding: "18px 20px" }}>
                <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                  {t("回饋總數", "Feedback")}
                </div>
                <div style={{ fontSize: 36, fontWeight: 800, color: "#2563EB", lineHeight: 1, letterSpacing: "-0.03em" }}>
                  {data.summary.totalFeedback}
                </div>
                <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 4 }}>{t("筆用戶回饋", "responses")}</div>
              </div>

              {/* Visual breakdown */}
              <div style={{ background: "white", borderRadius: 14, border: "1px solid #E2E8F0", padding: "18px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>
                    {t("回饋分佈", "Feedback Breakdown")}
                  </div>
                  {overallRate !== null && (
                    <span style={{
                      padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                      background: overallRate >= 70 ? "#D1FAE5" : overallRate >= 40 ? "#FEF3C7" : "#FEE2E2",
                      color: overallRate >= 70 ? "#065F46" : overallRate >= 40 ? "#92400E" : "#991B1B",
                    }}>
                      {overallRate}% {t("有幫助", "helpful")}
                    </span>
                  )}
                </div>

                {data.summary.totalFeedback === 0 ? (
                  <p style={{ fontSize: 13, color: "#94A3B8", margin: 0 }}>
                    {t("尚無回饋 — 分享文件給員工後即可收集", "No feedback yet — share docs with your team")}
                  </p>
                ) : (
                  <>
                    {/* Stacked bar */}
                    <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", marginBottom: 10, background: "#F1F5F9" }}>
                      <div style={{ width: `${helpfulPct}%`, background: "#10B981", transition: "width 0.6s ease" }} />
                      <div style={{ width: `${notHelpfulPct}%`, background: "#EF4444", transition: "width 0.6s ease" }} />
                    </div>
                    {/* Legend */}
                    <div style={{ display: "flex", gap: 16 }}>
                      {[
                        { dot: "#10B981", label: t("有幫助", "Helpful"), val: data.summary.helpful, color: "#059669" },
                        { dot: "#EF4444", label: t("無幫助", "Not helpful"), val: data.summary.notHelpful, color: "#DC2626" },
                      ].map(item => (
                        <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 8, height: 8, borderRadius: 2, background: item.dot, flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: "#94A3B8" }}>{item.label}</span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: item.color }}>{item.val}</span>
                        </div>
                      ))}
                    </div>
                    {/* Coverage */}
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #F1F5F9", display: "flex", gap: 14 }}>
                      {[
                        { dot: "#7C3AED", label: t("有回饋", "With feedback"), count: Math.min(data.summary.totalDocs, data.summary.totalFeedback) },
                        { dot: "#E2E8F0", label: t("尚無回饋", "No feedback"), count: Math.max(0, data.summary.totalDocs - Math.min(data.summary.totalDocs, data.summary.totalFeedback)) },
                      ].map(item => (
                        <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <div style={{ width: 7, height: 7, borderRadius: "50%", background: item.dot, border: "1px solid #E2E8F0" }} />
                          <span style={{ fontSize: 11, color: "#94A3B8" }}>{item.label}:</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>{item.count}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ── Section header ── */}
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", margin: "0 0 4px" }}>
                {t("文件回饋排名", "Documents Ranked by Need for Improvement")}
              </h2>
              <p style={{ fontSize: 13, color: "#94A3B8", margin: 0 }}>
                {t("負面回饋最多的文件優先顯示", "Documents with the most negative feedback appear first")}
              </p>
            </div>

            {/* ── Document cards ── */}
            <div style={{ display: "grid", gap: 12 }}>
              {data.documents.map((doc, i) => {
                const hp = doc.counts.totalFeedback > 0
                  ? Math.round((doc.counts.helpful / doc.counts.totalFeedback) * 100) : 0;
                const nhp = doc.counts.totalFeedback > 0
                  ? Math.round((doc.counts.notHelpful / doc.counts.totalFeedback) * 100) : 0;

                return (
                  <div key={doc.doc_id} style={{
                    background: "white", borderRadius: 14, border: "1px solid #E2E8F0",
                    padding: "18px 20px",
                    borderLeft: doc.ambiguityScore > 0 ? "4px solid #F59E0B" : doc.counts.notHelpful > 0 ? "4px solid #EF4444" : "4px solid #10B981",
                    transition: "box-shadow 0.2s",
                  }}>
                    {/* Card header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 14, flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", margin: "0 0 8px", lineHeight: 1.3 }}>
                          {doc.title}
                        </h3>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                          {/* version */}
                          <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: "#F1F5F9", color: "#64748B" }}>
                            {doc.version}
                          </span>
                          {/* status */}
                          <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: "#D1FAE5", color: "#065F46" }}>
                            {doc.status}
                          </span>
                          {/* helpfulness rate */}
                          {doc.helpfulnessRate !== null && doc.counts.totalFeedback > 0 && (
                            <span style={{
                              padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700,
                              background: doc.helpfulnessRate >= 70 ? "#D1FAE5" : doc.helpfulnessRate >= 40 ? "#FEF3C7" : "#FEE2E2",
                              color: doc.helpfulnessRate >= 70 ? "#065F46" : doc.helpfulnessRate >= 40 ? "#92400E" : "#991B1B",
                            }}>
                              {doc.helpfulnessRate}% {t("有幫助", "helpful")}
                            </span>
                          )}
                          {doc.counts.totalFeedback === 0 && (
                            <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: "#F8FAFC", color: "#94A3B8", border: "1px solid #E2E8F0" }}>
                              {t("尚無回饋", "No feedback yet")}
                            </span>
                          )}
                          {doc.ambiguityScore > 0 && (
                            <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700, background: "#FEF3C7", color: "#92400E" }}>
                              ⚠ {t("需要關注", "Needs attention")}
                            </span>
                          )}
                        </div>
                      </div>
                      <Link href={`/library/${encodeURIComponent(doc.doc_id)}`} style={{
                        padding: "7px 14px", borderRadius: 8, border: "1px solid #E2E8F0",
                        background: "white", fontSize: 13, fontWeight: 600, color: "#374151",
                        textDecoration: "none", flexShrink: 0, whiteSpace: "nowrap",
                      }}>
                        {t("查看 →", "View →")}
                      </Link>
                    </div>

                    {/* Feedback stats */}
                    {doc.counts.totalFeedback > 0 ? (
                      <>
                        <div style={{ display: "flex", gap: 20, fontSize: 13, marginBottom: 10, flexWrap: "wrap" }}>
                          {[
                            { emoji: "👍", label: t("有幫助", "Helpful"), val: doc.counts.helpful, color: "#059669" },
                            { emoji: "👎", label: t("無幫助", "Not helpful"), val: doc.counts.notHelpful, color: "#DC2626" },
                            { emoji: "💬", label: t("共", "Total"), val: doc.counts.totalFeedback, color: "#374151" },
                          ].map(item => (
                            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              <span>{item.emoji}</span>
                              <span style={{ color: "#94A3B8" }}>{item.label}</span>
                              <span style={{ fontWeight: 700, color: item.color }}>{item.val}</span>
                            </div>
                          ))}
                        </div>
                        {/* Mini bar */}
                        <div style={{ display: "flex", height: 5, borderRadius: 3, overflow: "hidden", background: "#F1F5F9", marginBottom: 16 }}>
                          <div style={{ width: `${hp}%`, background: "#10B981", transition: "width 0.5s ease" }} />
                          <div style={{ width: `${nhp}%`, background: "#EF4444", transition: "width 0.5s ease" }} />
                        </div>
                      </>
                    ) : (
                      <div style={{ marginBottom: 16, padding: "8px 12px", background: "#F8FAFC", borderRadius: 8, fontSize: 12, color: "#94A3B8", border: "1px solid #F1F5F9" }}>
                        {t("此文件尚未收到任何回饋。分享給員工後即可追蹤。", "No feedback yet. Share with your team to start tracking.")}
                      </div>
                    )}

                    {/* Negative comments */}
                    <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: 14 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8 }}>
                        💬 {t("負面回饋留言", "Negative Feedback")}
                      </div>
                      {doc.topNotes.length === 0 ? (
                        <p style={{ fontSize: 13, color: "#94A3B8", margin: 0 }}>
                          {t("尚無負面留言 — 表現良好！", "No negative comments yet — looking good!")}
                        </p>
                      ) : (
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                          {doc.topNotes.map((n, idx) => (
                            <li key={idx} style={{ marginBottom: 5, color: "#64748B", fontSize: 13 }}>{n}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {data.documents.length === 0 && (
              <div style={{ padding: 48, textAlign: "center", background: "white", borderRadius: 14, border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
                <p style={{ fontSize: 14, color: "#94A3B8", margin: 0 }}>
                  {t("尚無文件。請上傳文件並收集回饋後即可查看分析。", "No documents found. Upload documents and collect feedback to see analytics.")}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}