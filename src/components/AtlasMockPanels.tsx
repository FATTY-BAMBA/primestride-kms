"use client";

import React from "react";

function Badge({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return <span className={`badge${mono ? " mono" : ""}`}>{children}</span>;
}

export default function AtlasMockPanels() {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Panel 1 — Knowledge Library */}
      <div className="card" style={{ padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>
              Learning-Enabled Knowledge Library
            </div>
            <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
              Documents evolve with evidence — versioned, measurable, improvable.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Badge>Learning-enabled</Badge>
            <Badge mono>v1.1</Badge>
          </div>
        </div>

        <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 14,
                alignItems: "center",
                flexWrap: "wrap",
                padding: 14,
                border: "1px solid var(--border-color)",
                borderRadius: "var(--radius-lg)",
                background: "var(--bg-secondary)",
              }}
            >
              <div style={{ minWidth: 240 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>
                  {i === 1
                    ? "Diagnostic → Problem Framing"
                    : i === 2
                    ? "Pitch Narrative"
                    : "Atlas Orientation & Operating Guide"}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <Badge mono>
                    {i === 1 ? "PS-DIAG-001" : i === 2 ? "PS-PITCH-001" : "PS-ORIENT-001"}
                  </Badge>
                  <Badge>v1.1</Badge>
                  <Badge>learning-enabled</Badge>
                </div>
              </div>

              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                <div style={{ display: "flex", gap: 12, fontSize: 14 }}>
                  <span style={{ color: "var(--accent-green)" }}>
                    ✓ {i === 1 ? 2 : 1}
                  </span>
                  <span style={{ color: "var(--accent-yellow)" }}>
                    ⚠ {i === 1 ? 1 : 0}
                  </span>
                  <span style={{ color: "var(--accent-red)" }}>✗ 0</span>
                </div>

                <button className="btn btn-primary" type="button">
                  View & Feedback <span>→</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Panel 2 — Document View */}
      <div className="card" style={{ padding: 18 }}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>
          Capture Feedback at the Moment of Use
        </div>
        <div style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 14 }}>
          Readers signal understanding instantly — feedback becomes improvement input.
        </div>

        <div
          style={{
            padding: 16,
            border: "1px solid var(--border-color)",
            borderRadius: "var(--radius-lg)",
            background: "var(--bg-secondary)",
          }}
        >
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
            <Badge mono>PS-ORIENT-001</Badge>
            <Badge>v1.1</Badge>
            <Badge>learning-enabled</Badge>
          </div>

          <div style={{ fontWeight: 800, marginBottom: 10 }}>
            PrimeStride Atlas — Orientation & Operating Guide
          </div>

          <div style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 14 }}>
            “Did this section help you do the work?”
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn" style={{ borderColor: "var(--accent-green)" }}>
              ✓ This helped
            </button>
            <button className="btn" style={{ borderColor: "var(--accent-yellow)" }}>
              ⚠ Not confident
            </button>
            <button className="btn" style={{ borderColor: "var(--accent-red)" }}>
              ✗ Didn’t help
            </button>
          </div>
        </div>
      </div>

      {/* Panel 3 — Learning Dashboard */}
      <div className="card" style={{ padding: 18 }}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>
          See Where Knowledge Breaks Down
        </div>
        <div style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 14 }}>
          Rank documents by ambiguity — focus improvement where it matters most.
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {[
            { id: "PS-DIAG-001", title: "Diagnostic → Problem Framing", score: 1, helped: 2, not: 1, no: 0 },
            { id: "PS-PITCH-001", title: "Pitch Narrative", score: 0, helped: 1, not: 0, no: 0 },
            { id: "PS-ORIENT-001", title: "Atlas Orientation & Operating Guide", score: 0, helped: 1, not: 0, no: 0 },
          ].map((d) => (
            <div
              key={d.id}
              style={{
                padding: 14,
                border: "1px solid var(--border-color)",
                borderRadius: "var(--radius-lg)",
                background: "var(--bg-secondary)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>{d.title}</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <Badge mono>{d.id}</Badge>
                    <Badge>v1.1</Badge>
                    <Badge>learning-enabled</Badge>
                    <Badge>Ambiguity: {d.score}</Badge>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span style={{ color: "var(--accent-green)" }}>✓ {d.helped}</span>
                  <span style={{ color: "var(--accent-yellow)" }}>⚠ {d.not}</span>
                  <span style={{ color: "var(--accent-red)" }}>✗ {d.no}</span>
                </div>
              </div>

              <div style={{ marginTop: 10, color: "var(--text-muted)", fontSize: 13 }}>
                Top confusion notes:{" "}
                <span style={{ color: "var(--text-secondary)" }}>None yet</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
