"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import React from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import UserMenu from "@/components/UserMenu";
import { useAuth } from "@/lib/AuthContext";

type Doc = {
  doc_id: string;
  title: string;
  current_version: string;
};

interface VersionMeta {
  version: string;
  change_summary: string | null;
  hypothesis: string | null;
  created_at: string;
}

interface VersionCounts {
  view: number;
  open: number;
  reopen: number;
  feedback: {
    helped: number;
    not_confident: number;
    didnt_help: number;
  };
}

interface VersionSummary {
  version: string;
  counts: VersionCounts;
  topConfusionNotes: string[];
}

interface MetricsData {
  doc: { doc_id: string; title: string; status: string };
  currentVersion: string;
  previousVersion: string | null;
  currentMeta: VersionMeta | null;
  previousMeta: VersionMeta | null;
  current: VersionSummary | null;
  previous: VersionSummary | null;
  delta: {
    helped: number;
    not_confident: number;
    didnt_help: number;
    open: number;
    reopen: number;
    view: number;
  } | null;
  versions: VersionMeta[];
}

interface SnapshotData {
  doc_id: string;
  version: string;
  content_snapshot: string;
  content_format: string;
  created_at: string;
  change_summary: string | null;
  hypothesis: string | null;
}

interface LearningReview {
  review_id: string;
  doc_id: string;
  from_version: string;
  to_version: string;
  observed_signal: string;
  decision: string;
  hypothesis: string;
  owner_email: string | null;
  review_date: string;
  created_at: string;
}

interface DiffPart {
  value: string;
  added?: boolean;
  removed?: boolean;
}

export default function PublishDocVersionPage() {
  const params = useParams();
  const docId = decodeURIComponent(String(params.docId));
  const { user, profile } = useAuth();

  const [doc, setDoc] = useState<Doc | null>(null);
  const [loading, setLoading] = useState(true);

  const [newVersion, setNewVersion] = useState("");
  const [changeSummary, setChangeSummary] = useState("");
  const [hypothesis, setHypothesis] = useState("");
  const [contentSnapshot, setContentSnapshot] = useState("");
  const [observedSignal, setObservedSignal] = useState("");
  const [decisionText, setDecisionText] = useState("");
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"success" | "error" | "">("");

  // Version comparison metrics
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [metricsErr, setMetricsErr] = useState<string>("");
  const [metricsLoading, setMetricsLoading] = useState(false);

  // Snapshot preview
  const [snapshot, setSnapshot] = useState<SnapshotData | null>(null);
  const [snapshotErr, setSnapshotErr] = useState<string>("");
  const [snapshotVersion, setSnapshotVersion] = useState<string>("");
  const [snapshotMode, setSnapshotMode] = useState<"rendered" | "raw">("rendered");

  // Diff
  const [diffA, setDiffA] = useState<string>("");
  const [diffB, setDiffB] = useState<string>("");
  const [diffParts, setDiffParts] = useState<DiffPart[]>([]);
  const [diffErr, setDiffErr] = useState<string>("");

  // Learning reviews
  const [reviews, setReviews] = useState<LearningReview[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setMsg("");
      setMsgType("");
      const res = await fetch("/api/learning-summary");
      const data = await res.json();
      interface DocResponse {
        doc_id: string;
        title: string;
        current_version: string;
      }
      const found = (data.documents ?? []).find((d: DocResponse) => d.doc_id === docId);
      setDoc(found ? { doc_id: found.doc_id, title: found.title, current_version: found.current_version } : null);
      setLoading(false);
    })();
  }, [docId]);

  // Load metrics
  const loadMetrics = async () => {
    setMetricsLoading(true);
    setMetricsErr("");

    const res = await fetch("/api/doc-version-metrics?doc_id=" + encodeURIComponent(docId));

    const data = await res.json();
    setMetricsLoading(false);

    if (!res.ok) {
      setMetrics(null);
      setMetricsErr(data?.error ?? "Failed to load metrics.");
      return;
    }
    setMetrics(data);
  };

  // Load snapshot
  const loadSnapshot = async (version?: string) => {
    if (!doc) return;

    const v = version || doc.current_version;

    setSnapshotErr("");
    const res = await fetch(
      "/api/doc-snapshot?doc_id=" + encodeURIComponent(doc.doc_id) + "&version=" + encodeURIComponent(v)
    );

    const data = await res.json();
    if (!res.ok) {
      setSnapshot(null);
      setSnapshotErr(data?.error ?? "Failed to load snapshot.");
      return;
    }

    setSnapshot(data);
    setSnapshotVersion(v);
  };

  // Load learning reviews
  const loadReviews = async () => {
    const res = await fetch("/api/learning-reviews?doc_id=" + encodeURIComponent(docId));
    const data = await res.json();
    if (res.ok) setReviews(data.reviews ?? []);
  };

  // Fetch snapshot text for diff
  const fetchSnapshotText = async (version: string): Promise<string> => {
    const res = await fetch(
      "/api/doc-snapshot?doc_id=" + encodeURIComponent(docId) + "&version=" + encodeURIComponent(version)
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? "Failed to load snapshot");
    return (data?.content_snapshot ?? "") as string;
  };

  // Run diff (simple line-based)
  const runDiff = async () => {
    try {
      setDiffErr("");
      setDiffParts([]);

      if (!diffA.trim() || !diffB.trim()) {
        setDiffErr("Please enter both Version A and Version B.");
        return;
      }

      const aText = await fetchSnapshotText(diffA.trim());
      const bText = await fetchSnapshotText(diffB.trim());

      // Simple line-based diff
      const parts = simpleDiff(aText, bText);
      setDiffParts(parts);
    } catch (e: unknown) {
      setDiffParts([]);
      setDiffErr(e instanceof Error ? e.message : "Diff failed");
    }
  };

  // Simple diff implementation (line-based)
  const simpleDiff = (a: string, b: string): DiffPart[] => {
    const aLines = a.split("\n");
    const bLines = b.split("\n");
    const parts: DiffPart[] = [];

    const aSet = new Set(aLines);
    const bSet = new Set(bLines);

    // Lines removed (in A but not in B)
    aLines.forEach((line) => {
      if (!bSet.has(line)) {
        parts.push({ value: "- " + line + "\n", removed: true });
      }
    });

    // Lines added (in B but not in A)
    bLines.forEach((line) => {
      if (!aSet.has(line)) {
        parts.push({ value: "+ " + line + "\n", added: true });
      }
    });

    if (parts.length === 0) {
      parts.push({ value: "(No differences found)" });
    }

    return parts;
  };

  useEffect(() => {
    if (!doc) return;
    loadMetrics();
    loadSnapshot(doc.current_version);
    loadReviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.doc_id, doc?.current_version]);

  const publish = async () => {
    if (!doc) return;

    // Client-side validation
    if (!newVersion.trim()) {
      setMsg("Please enter a new version (e.g., v1.2).");
      setMsgType("error");
      return;
    }
    if (!contentSnapshot.trim() || contentSnapshot.trim().length < 50) {
      setMsg("Please paste the content snapshot (min ~50 characters).");
      setMsgType("error");
      return;
    }
    if (!observedSignal.trim() || !decisionText.trim() || !hypothesis.trim()) {
      setMsg("Observed signal, decision, and hypothesis are required (learning discipline).");
      setMsgType("error");
      return;
    }

    setMsg("Publishing…");
    setMsgType("");

    const res = await fetch("/api/publish-bundle", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        doc_id: doc.doc_id,
        new_version: newVersion.trim(),
        change_summary: changeSummary.trim() || null,
        hypothesis: hypothesis.trim(),
        content_snapshot: contentSnapshot,
        content_format: "markdown",
        observed_signal: observedSignal.trim(),
        decision: decisionText.trim(),
        review_owner_email: user?.email || null,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setMsg("Error: " + (data?.error ?? "Failed to publish"));
      setMsgType("error");
      return;
    }

    setMsg("✓ Published " + data.doc_id + ": " + data.from_version + " → " + data.to_version + " (with learning review)");
    setMsgType("success");
    setDoc({ ...doc, current_version: data.to_version });
    setNewVersion("");
    setChangeSummary("");
    setHypothesis("");
    setContentSnapshot("");
    setObservedSignal("");
    setDecisionText("");

    // Reload data after publishing
    setTimeout(() => {
      loadMetrics();
      loadSnapshot(data.to_version);
      loadReviews();
    }, 500);
  };

  return (
    <ProtectedRoute requireAdmin>
      <main className="container">
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <Link
            href="/admin"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              color: "var(--text-secondary)",
              fontSize: 14,
            }}
          >
            <span>←</span>
            <span>Back to Admin</span>
          </Link>
          <UserMenu />
        </div>

        <header style={{ marginBottom: 32 }}>
          <h1 style={{ marginBottom: 8 }}>Publish Version</h1>
          <p style={{ color: "var(--text-secondary)", margin: 0 }}>
            Create a new version for <span className="mono">{docId}</span>
          </p>
        </header>

        {loading && <div className="loading">Loading document...</div>}
        {!loading && !doc && (
          <div className="card">
            <p style={{ color: "var(--accent-red)" }}>Document not found.</p>
            <Link href="/admin" className="btn" style={{ marginTop: 12 }}>
              Return to Admin
            </Link>
          </div>
        )}

        {!loading && doc && (
          <div className="animate-in">
            {/* Current doc info */}
            <div className="card" style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>{doc.title}</h3>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                <span className="badge mono">{doc.doc_id}</span>
                <span className="badge">Current: {doc.current_version}</span>
              </div>
              {/* Show logged in user */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  paddingTop: 12,
                  borderTop: "1px solid var(--border-color)",
                }}
              >
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt=""
                    style={{ width: 32, height: 32, borderRadius: "50%" }}
                  />
                ) : (
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "white",
                    }}
                  >
                    {(profile?.full_name || user?.email || "A").charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>
                    Publishing as: {profile?.full_name || "Admin"}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{user?.email}</div>
                </div>
              </div>
            </div>

            {/* Publish form with Learning Review fields */}
            <div className="card" style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>📦 Publish New Version + Learning Review</h3>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
                Every publish requires evidence → decision → hypothesis. This is what makes learning auditable.
              </p>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 14, color: "var(--text-secondary)", marginBottom: 6 }}>
                  New Version *
                </label>
                <input
                  value={newVersion}
                  onChange={(e) => setNewVersion(e.target.value)}
                  placeholder="e.g., v1.2"
                  style={{ width: "100%" }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 14, color: "var(--text-secondary)", marginBottom: 6 }}>
                  Observed Signal (evidence) *
                </label>
                <textarea
                  value={observedSignal}
                  onChange={(e) => setObservedSignal(e.target.value)}
                  placeholder="What did we observe? (e.g., repeated ⚠️ about scope confusion in v1.1; reopen spikes; notes mention X.)"
                  rows={3}
                  style={{ resize: "vertical" }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 14, color: "var(--text-secondary)", marginBottom: 6 }}>
                  Decision (what we changed) *
                </label>
                <textarea
                  value={decisionText}
                  onChange={(e) => setDecisionText(e.target.value)}
                  placeholder="What are we changing in the doc/system as a response to the evidence?"
                  rows={3}
                  style={{ resize: "vertical" }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 14, color: "var(--text-secondary)", marginBottom: 6 }}>
                  Hypothesis (what should improve) *
                </label>
                <textarea
                  value={hypothesis}
                  onChange={(e) => setHypothesis(e.target.value)}
                  placeholder="e.g., Reduce 'not_confident' feedback related to scope confusion."
                  rows={3}
                  style={{ resize: "vertical" }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 14, color: "var(--text-secondary)", marginBottom: 6 }}>
                  Change Summary (optional notes)
                </label>
                <textarea
                  value={changeSummary}
                  onChange={(e) => setChangeSummary(e.target.value)}
                  placeholder="e.g., Added clarification differentiating ecosystem design vs tooling."
                  rows={2}
                  style={{ resize: "vertical" }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 14, color: "var(--text-secondary)", marginBottom: 6 }}>
                  Content Snapshot * (Markdown preferred)
                </label>
                <textarea
                  value={contentSnapshot}
                  onChange={(e) => setContentSnapshot(e.target.value)}
                  placeholder="Paste the full content for this version here. This becomes the version truth."
                  rows={8}
                  style={{ resize: "vertical", fontFamily: "monospace", fontSize: 13 }}
                />
                <p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 6, marginBottom: 0 }}>
                  Copy from Google Docs and paste here. This content will be stored and searchable.
                </p>
              </div>

              <button onClick={publish} className="btn btn-primary">
                Publish Version + Log Review →
              </button>

              {msg && (
                <div
                  style={{
                    marginTop: 16,
                    padding: 12,
                    borderRadius: "var(--radius-md)",
                    background:
                      msgType === "success"
                        ? "var(--accent-green-soft)"
                        : msgType === "error"
                        ? "var(--accent-red-soft)"
                        : "var(--bg-secondary)",
                    color:
                      msgType === "success"
                        ? "var(--accent-green)"
                        : msgType === "error"
                        ? "var(--accent-red)"
                        : "var(--text-secondary)",
                    fontSize: 14,
                  }}
                >
                  {msg}
                </div>
              )}
            </div>

            {/* Learning Reviews History */}
            <div className="card" style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>📜 Learning Reviews History</h3>

              {reviews.length === 0 ? (
                <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No learning reviews logged yet.</p>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {reviews.slice(0, 10).map((r) => (
                    <div
                      key={r.review_id}
                      style={{
                        background: "var(--bg-secondary)",
                        borderRadius: "var(--radius-sm)",
                        padding: 14,
                      }}
                    >
                      <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>
                        {r.from_version} → {r.to_version}
                        <span style={{ fontWeight: 400, color: "var(--text-muted)", marginLeft: 12 }}>
                          {r.review_date}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 6 }}>
                        <strong>Signal:</strong> {r.observed_signal}
                      </div>
                      <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 6 }}>
                        <strong>Decision:</strong> {r.decision}
                      </div>
                      <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                        <strong>Hypothesis:</strong> {r.hypothesis}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Version Comparison Panel */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>📊 Version Comparison</h3>
                <button onClick={loadMetrics} className="btn">
                  Refresh Metrics
                </button>
              </div>

              {metricsLoading && <p style={{ color: "var(--text-muted)" }}>Loading metrics...</p>}
              {metricsErr && <p style={{ color: "var(--accent-red)" }}>{metricsErr}</p>}

              {!metricsLoading && !metricsErr && !metrics && (
                <p style={{ color: "var(--text-muted)" }}>
                  Click &quot;Refresh Metrics&quot; to load comparison data.
                </p>
              )}

              {metrics && (
                <>
                  <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 16 }}>
                    Comparing <span className="badge">{metrics.previousVersion ?? "—"}</span>
                    {" → "}
                    <span className="badge badge-success">{metrics.currentVersion}</span>
                  </div>

                  {/* Version metadata */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                    <VersionMetaBox label="Previous Version" meta={metrics.previousMeta} />
                    <VersionMetaBox label="Current Version" meta={metrics.currentMeta} />
                  </div>

                  {/* Counts comparison table */}
                  <div style={{ overflowX: "auto", marginBottom: 16 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          <th style={thStyle}>Metric</th>
                          <th style={thStyle}>Previous</th>
                          <th style={thStyle}>Current</th>
                          <th style={thStyle}>Δ Delta</th>
                        </tr>
                      </thead>
                      <tbody>
                        <MetricRow label="👁️ Views" prev={metrics.previous?.counts?.view} curr={metrics.current?.counts?.view} delta={metrics.delta?.view} />
                        <MetricRow label="📖 Opens" prev={metrics.previous?.counts?.open} curr={metrics.current?.counts?.open} delta={metrics.delta?.open} />
                        <MetricRow label="🔁 Reopens" prev={metrics.previous?.counts?.reopen} curr={metrics.current?.counts?.reopen} delta={metrics.delta?.reopen} />
                        <MetricRow label="✓ Helped" prev={metrics.previous?.counts?.feedback?.helped} curr={metrics.current?.counts?.feedback?.helped} delta={metrics.delta?.helped} goodIfPositive />
                        <MetricRow label="⚠ Not confident" prev={metrics.previous?.counts?.feedback?.not_confident} curr={metrics.current?.counts?.feedback?.not_confident} delta={metrics.delta?.not_confident} goodIfNegative />
                        <MetricRow label="✗ Didn't help" prev={metrics.previous?.counts?.feedback?.didnt_help} curr={metrics.current?.counts?.feedback?.didnt_help} delta={metrics.delta?.didnt_help} goodIfNegative />
                      </tbody>
                    </table>
                  </div>

                  {/* Confusion notes comparison */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <NotesBox label={"Confusion Notes (" + (metrics.previousVersion ?? "—") + ")"} notes={metrics.previous?.topConfusionNotes ?? []} />
                    <NotesBox label={"Confusion Notes (" + metrics.currentVersion + ")"} notes={metrics.current?.topConfusionNotes ?? []} />
                  </div>
                </>
              )}
            </div>

            {/* Snapshot Preview Panel */}
            <div className="card" style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>📄 Snapshot Preview</h3>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
                <label style={{ fontSize: 13, color: "var(--text-muted)" }}>Version:</label>
                <input
                  value={snapshotVersion || (doc?.current_version ?? "")}
                  onChange={(e) => setSnapshotVersion(e.target.value)}
                  placeholder="e.g., v1.1"
                  style={{ width: 120 }}
                />
                <button onClick={() => loadSnapshot(snapshotVersion || doc?.current_version)} className="btn">
                  Load Snapshot
                </button>
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    onClick={() => setSnapshotMode("rendered")}
                    className="btn"
                    style={{ opacity: snapshotMode === "rendered" ? 1 : 0.6 }}
                  >
                    Rendered
                  </button>
                  <button
                    onClick={() => setSnapshotMode("raw")}
                    className="btn"
                    style={{ opacity: snapshotMode === "raw" ? 1 : 0.6 }}
                  >
                    Raw
                  </button>
                </div>
              </div>

              {snapshotErr && <p style={{ color: "var(--accent-red)" }}>{snapshotErr}</p>}

              {!snapshot && !snapshotErr && (
                <p style={{ color: "var(--text-muted)" }}>Loading snapshot...</p>
              )}

              {snapshot && (
                <>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>
                    Loaded: <strong>{snapshot.version}</strong> • Format: <strong>{snapshot.content_format}</strong>
                  </div>

                  <div
                    style={{
                      background: "var(--bg-secondary)",
                      borderRadius: "var(--radius-sm)",
                      padding: 16,
                      maxHeight: 400,
                      overflow: "auto",
                    }}
                  >
                    {snapshotMode === "raw" ? (
                      <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 13 }}>
                        {snapshot.content_snapshot || "(empty)"}
                      </pre>
                    ) : (
                      <div style={{ fontSize: 14, lineHeight: 1.6 }}>
                        {snapshot.content_snapshot ? (
                          snapshot.content_snapshot.split("\n").map((line, i) => (
                            <p key={i} style={{ margin: "0 0 8px 0" }}>
                              {line || <br />}
                            </p>
                          ))
                        ) : (
                          "(empty)"
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Diff Panel */}
            <div className="card" style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>🔀 Snapshot Diff</h3>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
                <label style={{ fontSize: 13, color: "var(--text-muted)" }}>Version A:</label>
                <input
                  value={diffA}
                  onChange={(e) => setDiffA(e.target.value)}
                  placeholder="e.g., v1.1"
                  style={{ width: 120 }}
                />
                <label style={{ fontSize: 13, color: "var(--text-muted)" }}>Version B:</label>
                <input
                  value={diffB}
                  onChange={(e) => setDiffB(e.target.value)}
                  placeholder="e.g., v1.2"
                  style={{ width: 120 }}
                />
                <button onClick={runDiff} className="btn btn-primary">
                  Run Diff
                </button>
                {doc?.current_version && (
                  <button onClick={() => setDiffB(doc.current_version)} className="btn">
                    Set B = current
                  </button>
                )}
              </div>

              {diffErr && <p style={{ color: "var(--accent-red)" }}>{diffErr}</p>}

              {diffParts.length > 0 && (
                <div
                  style={{
                    background: "var(--bg-secondary)",
                    borderRadius: "var(--radius-sm)",
                    padding: 16,
                    maxHeight: 400,
                    overflow: "auto",
                  }}
                >
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
                    Legend: <span style={{ color: "var(--accent-green)" }}>+ added</span> •{" "}
                    <span style={{ color: "var(--accent-red)" }}>- removed</span>
                  </div>

                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 13 }}>
                    {diffParts.map((p, i) => {
                      const style: React.CSSProperties = p.added
                        ? { color: "var(--accent-green)", background: "var(--accent-green-soft)" }
                        : p.removed
                        ? { color: "var(--accent-red)", background: "var(--accent-red-soft)" }
                        : {};

                      return (
                        <span key={i} style={style}>
                          {p.value}
                        </span>
                      );
                    })}
                  </pre>
                </div>
              )}

              {diffParts.length === 0 && !diffErr && (
                <p style={{ color: "var(--text-muted)" }}>
                  Enter two versions (that have snapshots stored) and run diff.
                </p>
              )}
            </div>

            {/* Info */}
            <p style={{ marginTop: 20, fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>
              After publishing, new feedback will attach to the new version.
              Visit the Learning dashboard to track improvement.
            </p>
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
}

// Helper components
function VersionMetaBox({ label, meta }: { label: string; meta: VersionMeta | null }) {
  return (
    <div style={{ background: "var(--bg-secondary)", borderRadius: "var(--radius-sm)", padding: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 13 }}>{label}</div>
      {!meta ? (
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>No metadata recorded.</div>
      ) : (
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          <div><strong>Change:</strong> {meta.change_summary || "—"}</div>
          <div><strong>Hypothesis:</strong> {meta.hypothesis || "—"}</div>
        </div>
      )}
    </div>
  );
}

function NotesBox({ label, notes }: { label: string; notes: string[] }) {
  return (
    <div style={{ background: "var(--bg-secondary)", borderRadius: "var(--radius-sm)", padding: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>{label}</div>
      {notes.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>No confusion notes.</div>
      ) : (
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {notes.slice(0, 5).map((n, i) => (
            <li key={i} style={{ marginBottom: 6, fontSize: 13, color: "var(--text-secondary)" }}>
              {n}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MetricRow({
  label,
  prev,
  curr,
  delta,
  goodIfPositive,
  goodIfNegative,
}: {
  label: string;
  prev: number | undefined;
  curr: number | undefined;
  delta: number | undefined | null;
  goodIfPositive?: boolean;
  goodIfNegative?: boolean;
}) {
  const deltaNum = delta ?? 0;
  let deltaColor = "var(--text-secondary)";

  if (goodIfPositive && deltaNum > 0) deltaColor = "var(--accent-green)";
  if (goodIfPositive && deltaNum < 0) deltaColor = "var(--accent-red)";
  if (goodIfNegative && deltaNum < 0) deltaColor = "var(--accent-green)";
  if (goodIfNegative && deltaNum > 0) deltaColor = "var(--accent-red)";

  return (
    <tr>
      <td style={tdStyle}>{label}</td>
      <td style={tdStyle}>{prev ?? 0}</td>
      <td style={tdStyle}>{curr ?? 0}</td>
      <td style={{ ...tdStyle, color: deltaColor, fontWeight: 600 }}>
        {delta === null || delta === undefined ? "—" : deltaNum > 0 ? "+" + deltaNum : String(deltaNum)}
      </td>
    </tr>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid var(--border-color)",
  padding: 10,
  fontSize: 13,
  color: "var(--text-muted)",
};

const tdStyle: React.CSSProperties = {
  borderBottom: "1px solid var(--border-color)",
  padding: 10,
  fontSize: 14,
};