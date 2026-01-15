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
  google_doc_url: string;
  counts: {
    view: number;
    open: number;
    reopen: number;
    feedback: {
      helped: number;
      not_confident: number;
      didnt_help: number;
    };
  };
  ambiguityScore: number;
  topNotes: string[];
};

type RollupResponse = {
  summary: {
    totalDocs: number;
    views: number;
    opens: number;
    reopens: number;
    helped: number;
    not_confident: number;
    didnt_help: number;
  };
  documents: RollupDoc[];
};

function SummaryCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="card">
      <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: color || "var(--text-primary)" }}>{value}</div>
    </div>
  );
}

function StatItem({ icon, label, value, color }: { icon: string; label: string; value: number; color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span>{icon}</span>
      <span style={{ color: "var(--text-muted)" }}>{label}:</span>
      <span style={{ fontWeight: 600, color: color || "var(--text-primary)" }}>{value}</span>
    </div>
  );
}

export default function LearningPage() {
  const [data, setData] = useState<RollupResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Auto-load dashboard on mount (admin access is handled by ProtectedRoute)
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
                Intent + feedback rollups per document (current version)
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
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 12 }}>
              <SummaryCard label="Documents" value={data.summary.totalDocs} />
              <SummaryCard label="👁️ Views" value={data.summary.views} color="var(--text-secondary)" />
              <SummaryCard label="📖 Intent Opens" value={data.summary.opens} color="var(--accent-blue)" />
              <SummaryCard label="🔁 Reopens" value={data.summary.reopens} color="var(--accent-yellow)" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 32 }}>
              <SummaryCard label="✓ Helped" value={data.summary.helped} color="var(--accent-green)" />
              <SummaryCard label="⚠ Not confident" value={data.summary.not_confident} color="var(--accent-yellow)" />
              <SummaryCard label="✗ Didn't help" value={data.summary.didnt_help} color="var(--accent-red)" />
            </div>

            <h2 style={{ fontSize: 18, marginBottom: 16 }}>Documents Ranked by Ambiguity</h2>
            <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: -12, marginBottom: 16 }}>
              Ambiguity score = not_confident + 2×didnt_help (higher = needs attention)
            </p>

            <div style={{ display: "grid", gap: 16 }}>
              {data.documents.map((d, i) => (
                <div key={d.doc_id} className="card animate-in" style={{ animationDelay: `${i * 0.05}s` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
                    <div>
                      <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>{d.title}</h3>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <span className="badge mono">{d.doc_id}</span>
                        <span className="badge">{d.version}</span>
                        <span className="badge badge-success">{d.status}</span>
                        {d.ambiguityScore > 0 && (
                          <span className="badge badge-warning">Ambiguity: {d.ambiguityScore}</span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Link href={`/docs/${encodeURIComponent(d.doc_id)}`} className="btn">
                        View →
                      </Link>
                      <a href={d.google_doc_url} target="_blank" rel="noopener noreferrer" className="btn">
                        Open Doc ↗
                      </a>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 14, marginBottom: 16 }}>
                    <StatItem icon="👁️" label="Views" value={d.counts.view} />
                    <StatItem icon="📖" label="Opens" value={d.counts.open} color="var(--accent-blue)" />
                    <StatItem icon="🔁" label="Reopens" value={d.counts.reopen} color="var(--accent-yellow)" />
                    <StatItem icon="✓" label="Helped" value={d.counts.feedback.helped} color="var(--accent-green)" />
                    <StatItem icon="⚠" label="Not confident" value={d.counts.feedback.not_confident} color="var(--accent-yellow)" />
                    <StatItem icon="✗" label="Didn't help" value={d.counts.feedback.didnt_help} color="var(--accent-red)" />
                  </div>

                  <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: 16 }}>
                    <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 14 }}>💬 Top Confusion Notes</div>
                    {d.topNotes.length === 0 ? (
                      <p style={{ color: "var(--text-muted)", fontSize: 14, margin: 0 }}>
                        No confusion notes logged yet.
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
                <p style={{ color: "var(--text-muted)" }}>No documents found.</p>
              </div>
            )}
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
}