"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import UserMenu from "@/components/UserMenu";

type DocRow = {
  doc_id: string;
  title: string;
  current_version: string;
  status: string;
  google_doc_url: string;
  source_url: string | null;
  doc_type: string | null;
  domain: string | null;
  tags: string[] | null;
  feedback_counts: {
    helped: number;
    not_confident: number;
    didnt_help: number;
  };
};

export default function HomePage() {
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/learning-summary");
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Failed to load");
        setDocs(data.documents ?? []);
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : "Error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalFeedback = docs.reduce(
    (sum, d) =>
      sum +
      d.feedback_counts.helped +
      d.feedback_counts.not_confident +
      d.feedback_counts.didnt_help,
    0
  );

  return (
    <ProtectedRoute>
      <main className="container">
        {/* Header */}
        <header style={{ marginBottom: 40 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
              marginBottom: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 20,
                }}
              >
                📚
              </div>
              <h1>PrimeStrideAI KMS</h1>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <Link href="/search" className="btn">
                🔍 Search
              </Link>
              <Link href="/learning" className="btn">
                📊 Learning
              </Link>
              <Link href="/admin" className="btn">
                ⚙️ Admin
              </Link>
              <Link href="/team" className="btn">
                👥 Team
              </Link>
              <Link href="/ai-graph" className="btn">
                🧠 AI Graph
              </Link>
              <UserMenu />
            </div>
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: 15 }}>
            Learning-enabled docs with feedback → weekly improvements
          </p>
        </header>

        {/* Stats bar */}
        {!loading && !err && (
          <div
            style={{
              display: "flex",
              gap: 16,
              marginBottom: 32,
              flexWrap: "wrap",
            }}
          >
            <div className="card" style={{ flex: "1 1 150px", minWidth: 150 }}>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  marginBottom: 4,
                }}
              >
                {docs.length}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                Documents
              </div>
            </div>
            <div className="card" style={{ flex: "1 1 150px", minWidth: 150 }}>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  marginBottom: 4,
                  color: "var(--accent-blue)",
                }}
              >
                {totalFeedback}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                Total Feedback
              </div>
            </div>
            <div className="card" style={{ flex: "1 1 150px", minWidth: 150 }}>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  marginBottom: 4,
                  color: "var(--accent-green)",
                }}
              >
                v1.1
              </div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                Current Version
              </div>
            </div>
          </div>
        )}

        {/* Document list */}
        <section>
          <h2 style={{ marginBottom: 20, fontSize: 18 }}>Knowledge Library</h2>

          {loading && (
            <div className="loading">
              <span>Loading documents...</span>
            </div>
          )}

          {err && (
            <div
              className="card"
              style={{
                borderColor: "var(--accent-red)",
                background: "var(--accent-red-soft)",
              }}
            >
              <p style={{ color: "var(--accent-red)" }}>Error: {err}</p>
            </div>
          )}

          {!loading && !err && (
            <div style={{ display: "grid", gap: 16 }}>
              {docs.map((d, i) => (
                <div
                  key={d.doc_id}
                  className="card animate-in"
                  style={{
                    animationDelay: `${i * 0.05}s`,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 20,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <h3
                      style={{
                        fontSize: 17,
                        fontWeight: 600,
                        marginBottom: 8,
                      }}
                    >
                      {d.title}
                    </h3>
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                        alignItems: "center",
                      }}
                    >
                      <span className="badge mono">{d.doc_id}</span>
                      <span className="badge">{d.current_version}</span>
                      <span className="badge badge-success">{d.status}</span>
                      {d.doc_type && <span className="badge">{d.doc_type}</span>}
                      {d.domain && <span className="badge">{d.domain}</span>}
                    </div>
                    {d.tags && d.tags.length > 0 && (
                      <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-muted)" }}>
                        Tags: {d.tags.join(", ")}
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 24,
                      flexWrap: "wrap",
                    }}
                  >
                    {/* Feedback counts */}
                    <div
                      style={{
                        display: "flex",
                        gap: 16,
                        fontSize: 14,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          color: "var(--accent-green)",
                        }}
                      >
                        <span>✓</span>
                        <span style={{ fontWeight: 600 }}>
                          {d.feedback_counts.helped}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          color: "var(--accent-yellow)",
                        }}
                      >
                        <span>⚠</span>
                        <span style={{ fontWeight: 600 }}>
                          {d.feedback_counts.not_confident}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          color: "var(--accent-red)",
                        }}
                      >
                        <span>✗</span>
                        <span style={{ fontWeight: 600 }}>
                          {d.feedback_counts.didnt_help}
                        </span>
                      </div>
                    </div>

                    <Link
                      href={`/docs/${encodeURIComponent(d.doc_id)}`}
                      className="btn btn-primary"
                    >
                      View & Feedback
                      <span>→</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && !err && docs.length === 0 && (
            <div className="card" style={{ textAlign: "center", padding: 40 }}>
              <p style={{ color: "var(--text-muted)" }}>
                No documents found. Add documents to your Supabase database.
              </p>
            </div>
          )}
        </section>

        {/* Footer */}
        <footer
          style={{
            marginTop: 48,
            paddingTop: 24,
            borderTop: "1px solid var(--border-color)",
            color: "var(--text-muted)",
            fontSize: 13,
          }}
        >
          <p>
            PrimeStrideAI KMS v1.0 • Feedback drives weekly doc improvements
          </p>
        </footer>
      </main>
    </ProtectedRoute>
  );
}