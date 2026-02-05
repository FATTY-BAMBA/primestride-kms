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

function SummaryCard({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="card">
      <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: color || "var(--text-primary)" }}>{value}</div>
    </div>
  );
}

export default function LearningPage() {
  const [data, setData] = useState<RollupResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    setErr(null);

    try {
      const res = await fetch("/api/learning-rollup");
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error ?? "Failed to load learning rollup");
      }
      setData(json);
    } catch (e: unknown) {
      if (e instanceof Error) {
        setErr(e.message);
      } else {
        setErr("Error");
      }
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
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: "linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 20,
                  }}
                >
                  📊
                </div>
                <h1 style={{ margin: 0 }}>Learning Dashboard</h1>
              </div>
              <p style={{ color: "var(--text-secondary)", margin: 0 }}>
                Feedback analytics per document — identify what needs improvement
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <Link href="/" className="btn">
                ← Library
              </Link>
              <Link href="/admin" className="btn btn-primary">
                Admin →
              </Link>
              <UserMenu />
            </div>
          </div>
        </header>

        {loading && <div className="loading">Loading learning data...</div>}

        {err && (
          <div className="card" style={{ borderColor: "var(--accent-red)", background: "var(--accent-red-soft)" }}>
            <p style={{ color: "var(--accent-red)", margin: 0 }}>Error: {err}</p>
            <button onClick={loadDashboard} className="btn" style={{ marginTop: 12 }}>
              Retry
            </button>
          </div>
        )}

        {!loading && !err && data && (
          <div>
            {/* Summary Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 32 }}>
              <SummaryCard label="📄 Total Documents" value={data.summary.totalDocs} />
              <SummaryCard label="💬 Total Feedback" value={data.summary.totalFeedback} color="var(--accent-blue)" />
              <SummaryCard label="👍 Helpful" value={data.summary.helpful} color="var(--accent-green)" />
              <SummaryCard label="👎 Not Helpful" value={data.summary.notHelpful} color="var(--accent-red)" />
              <SummaryCard
                label="📈 Helpfulness Rate"
                value={overallRate !== null ? `${overallRate}%` : "—"}
                color={
                  overallRate === null
                    ? "var(--text-muted)"
                    : overallRate >= 70
                    ? "var(--accent-green)"
                    : overallRate >= 40
                    ? "var(--accent-yellow)"
                    : "var(--accent-red)"
                }
              />
            </div>

            <h2 style={{ fontSize: 18, marginBottom: 16 }}>Documents Ranked by Need for Improvement</h2>
            <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: -12, marginBottom: 16 }}>
              Documents with the most negative feedback appear first
            </p>

            <div style={{ display: "grid", gap: 16 }}>
              {data.documents.map((d, i) => (
                <div key={d.doc_id} className="card animate-in" style={{ animationDelay: `${i * 0.05}s` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
                    <div>
                      <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>{d.title}</h3>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <span className="badge mono">{d.doc_id}</span>
                        <span className="badge">{d.version}</span>
                        <span className="badge badge-success">{d.status}</span>
                        {d.helpfulnessRate !== null && (
                          <span
                            style={{
                              padding: "4px 10px",
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: 700,
                              background: d.helpfulnessRate >= 70
                                ? "#D1FAE5"
                                : d.helpfulnessRate >= 40
                                ? "#FEF3C7"
                                : "#FEE2E2",
                              color: d.helpfulnessRate >= 70
                                ? "#065F46"
                                : d.helpfulnessRate >= 40
                                ? "#92400E"
                                : "#991B1B",
                            }}
                          >
                            {d.helpfulnessRate}% helpful
                          </span>
                        )}
                        {d.ambiguityScore > 0 && (
                          <span className="badge badge-warning">⚠ Needs attention</span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Link href={`/library/${encodeURIComponent(d.doc_id)}`} className="btn">
                        View →
                      </Link>
                    </div>
                  </div>

                  {/* Feedback Stats */}
                  <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: 14, marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span>💬</span>
                      <span style={{ color: "var(--text-muted)" }}>Total:</span>
                      <span style={{ fontWeight: 600 }}>{d.counts.totalFeedback}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span>👍</span>
                      <span style={{ color: "var(--text-muted)" }}>Helpful:</span>
                      <span style={{ fontWeight: 600, color: "var(--accent-green)" }}>{d.counts.helpful}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span>👎</span>
                      <span style={{ color: "var(--text-muted)" }}>Not helpful:</span>
                      <span style={{ fontWeight: 600, color: "var(--accent-red)" }}>{d.counts.notHelpful}</span>
                    </div>
                  </div>

                  {/* Feedback Bar */}
                  {d.counts.totalFeedback > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div
                        style={{
                          width: "100%",
                          height: 8,
                          borderRadius: 4,
                          background: "var(--bg-secondary)",
                          overflow: "hidden",
                          display: "flex",
                        }}
                      >
                        <div
                          style={{
                            width: `${(d.counts.helpful / d.counts.totalFeedback) * 100}%`,
                            background: "#10B981",
                            height: "100%",
                            transition: "width 0.5s ease",
                          }}
                        />
                        <div
                          style={{
                            width: `${(d.counts.notHelpful / d.counts.totalFeedback) * 100}%`,
                            background: "#EF4444",
                            height: "100%",
                            transition: "width 0.5s ease",
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Negative Comments */}
                  <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: 16 }}>
                    <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 14 }}>💬 Negative Feedback Comments</div>
                    {d.topNotes.length === 0 ? (
                      <p style={{ color: "var(--text-muted)", fontSize: 14, margin: 0 }}>
                        No negative comments yet — looking good!
                      </p>
                    ) : (
                      <ul style={{ margin: 0, paddingLeft: 20 }}>
                        {d.topNotes.map((n, idx) => (
                          <li key={idx} style={{ marginBottom: 8, color: "var(--text-secondary)", fontSize: 14 }}>
                            {n}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {data.documents.length === 0 && (
              <div className="card" style={{ textAlign: "center", padding: 40 }}>
                <p style={{ color: "var(--text-muted)" }}>No documents found. Create documents and collect feedback to see analytics.</p>
              </div>
            )}
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
}