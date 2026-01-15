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
};

export default function AdminHome() {
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/learning-summary");
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Failed to load docs");
        interface DocResponse {
          doc_id: string;
          title: string;
          current_version: string;
          status: string;
        }
        const rows = (data.documents ?? []).map((d: DocResponse) => ({
          doc_id: d.doc_id,
          title: d.title,
          current_version: d.current_version,
          status: d.status,
        }));
        setDocs(rows);
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : "Error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <ProtectedRoute requireAdmin>
      <main className="container">
        {/* Header */}
        <header style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 20,
                  }}
                >
                  ⚙️
                </div>
                <h1 style={{ margin: 0 }}>Admin</h1>
              </div>
              <p style={{ color: "var(--text-secondary)", margin: 0 }}>
                Publish new versions with change summary + hypothesis
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <Link href="/" className="btn">
                ← Library
              </Link>
              <Link href="/learning" className="btn">
                Learning →
              </Link>
              <UserMenu />
            </div>
          </div>
        </header>

        {loading && <div className="loading">Loading documents...</div>}
        {err && (
          <div className="card" style={{ borderColor: "var(--accent-red)", background: "var(--accent-red-soft)" }}>
            <p style={{ color: "var(--accent-red)", margin: 0 }}>Error: {err}</p>
          </div>
        )}

        {!loading && !err && (
          <>
            <h2 style={{ fontSize: 18, marginBottom: 16 }}>Documents</h2>
            <div style={{ display: "grid", gap: 12 }}>
              {docs.map((d, i) => (
                <div
                  key={d.doc_id}
                  className="card animate-in"
                  style={{
                    animationDelay: `${i * 0.05}s`,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 16,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>{d.title}</h3>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span className="badge mono">{d.doc_id}</span>
                      <span className="badge">Current: {d.current_version}</span>
                      <span className="badge badge-success">{d.status}</span>
                    </div>
                  </div>
                  <Link
                    href={`/admin/docs/${encodeURIComponent(d.doc_id)}`}
                    className="btn btn-primary"
                  >
                    Publish new version →
                  </Link>
                </div>
              ))}
            </div>

            {docs.length === 0 && (
              <div className="card" style={{ textAlign: "center", padding: 40 }}>
                <p style={{ color: "var(--text-muted)" }}>No documents found.</p>
              </div>
            )}
          </>
        )}

        {/* Info */}
        <div style={{ marginTop: 32, padding: 16, background: "var(--bg-secondary)", borderRadius: "var(--radius-md)" }}>
          <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>
            <strong>How versioning works:</strong> When you publish a new version (e.g., v1.1 → v1.2), 
            all future feedback will attach to the new version. The Learning dashboard will show 
            rollups for the current version, allowing you to track improvement over time.
          </p>
        </div>
      </main>
    </ProtectedRoute>
  );
}