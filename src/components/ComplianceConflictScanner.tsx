"use client";

import { useState, useEffect } from "react";

interface ConflictItem {
  severity: "red" | "yellow" | "green";
  category: string;
  document_id: string;
  document_title: string;
  handbook_text: string;
  law_reference: string;
  article: string;
  issue_zh: string;
  issue_en: string;
  recommendation_zh: string;
  recommendation_en: string;
}

interface ScanReport {
  report_id?: string;
  conflicts: ConflictItem[];
  summary: {
    total_scanned: number;
    total_conflicts: number;
    red: number;
    yellow: number;
    green: number;
    documents?: { id: string; title: string }[];
    message?: string;
  };
}

export default function ComplianceConflictScanner() {
  const [scanning, setScanning] = useState(false);
  const [report, setReport] = useState<ScanReport | null>(null);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Load latest report on mount
  useEffect(() => {
    fetchLatestReport();
  }, []);

  async function fetchLatestReport() {
    try {
      const res = await fetch("/api/compliance/conflicts");
      const data = await res.json();
      if (data.report) {
        setReport({
          report_id: data.report.id,
          conflicts: data.report.conflicts || [],
          summary: data.report.summary || {},
        });
      }
    } catch {}
  }

  async function runScan() {
    setScanning(true);
    setError("");
    try {
      const res = await fetch("/api/compliance/conflicts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setReport(data);
      }
    } catch (err: any) {
      setError(err.message || "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  const severityConfig = {
    red: { label: "🔴 違規 Violation", bg: "#FEE2E2", border: "#DC2626", text: "#991B1B" },
    yellow: { label: "🟡 待確認 Review", bg: "#FEF3C7", border: "#D97706", text: "#92400E" },
    green: { label: "🟢 合規 Compliant", bg: "#D1FAE5", border: "#059669", text: "#065F46" },
  };

  return (
    <div>
      {/* Scanner Header */}
      <div
        style={{
          padding: "20px 24px",
          background: "linear-gradient(135deg, #7C3AED11, #2563EB11)",
          borderRadius: 12,
          border: "1px solid #E5E7EB",
          marginBottom: 20,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#111827" }}>
              🛡️ 合規衝突掃描 Compliance Conflict Scanner
            </h3>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6B7280" }}>
              掃描公司手冊與台灣勞動法規的衝突 | Scan company handbook against Taiwan labor law
            </p>
          </div>
          <button
            onClick={runScan}
            disabled={scanning}
            style={{
              padding: "10px 20px",
              background: scanning ? "#9CA3AF" : "#7C3AED",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 14,
              cursor: scanning ? "not-allowed" : "pointer",
            }}
          >
            {scanning ? "⏳ 掃描中..." : "🔍 開始掃描 Scan Now"}
          </button>
        </div>

        {/* How it works */}
        <div
          style={{
            marginTop: 12,
            padding: "10px 14px",
            background: "white",
            borderRadius: 8,
            fontSize: 12,
            color: "#6B7280",
          }}
        >
          📋 掃描流程: 自動搜尋含「手冊/規章/辦法/policy」的文件 → AI 逐段比對勞基法 → 標記衝突等級
          <br />
          🔴 違規 = 公司規定低於法律最低要求 | 🟡 待確認 = 規定模糊需人工確認 | 🟢 合規 = 符合或優於法律
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: 12,
            background: "#FEE2E2",
            borderRadius: 8,
            color: "#DC2626",
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          ❌ {error}
        </div>
      )}

      {/* Report Summary */}
      {report && report.summary && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            {/* Red */}
            <div
              style={{
                flex: 1,
                padding: "16px",
                background: "#FEE2E2",
                borderRadius: 10,
                textAlign: "center",
                border: "2px solid #FECACA",
              }}
            >
              <div style={{ fontSize: 28, fontWeight: 800, color: "#DC2626" }}>
                {report.summary.red || 0}
              </div>
              <div style={{ fontSize: 12, color: "#991B1B", fontWeight: 600 }}>🔴 違規 Violations</div>
            </div>

            {/* Yellow */}
            <div
              style={{
                flex: 1,
                padding: "16px",
                background: "#FEF3C7",
                borderRadius: 10,
                textAlign: "center",
                border: "2px solid #FDE68A",
              }}
            >
              <div style={{ fontSize: 28, fontWeight: 800, color: "#D97706" }}>
                {report.summary.yellow || 0}
              </div>
              <div style={{ fontSize: 12, color: "#92400E", fontWeight: 600 }}>🟡 待確認 Warnings</div>
            </div>

            {/* Green */}
            <div
              style={{
                flex: 1,
                padding: "16px",
                background: "#D1FAE5",
                borderRadius: 10,
                textAlign: "center",
                border: "2px solid #A7F3D0",
              }}
            >
              <div style={{ fontSize: 28, fontWeight: 800, color: "#059669" }}>
                {report.summary.green || 0}
              </div>
              <div style={{ fontSize: 12, color: "#065F46", fontWeight: 600 }}>🟢 合規 Compliant</div>
            </div>

            {/* Scanned */}
            <div
              style={{
                flex: 1,
                padding: "16px",
                background: "#F3F4F6",
                borderRadius: 10,
                textAlign: "center",
                border: "2px solid #E5E7EB",
              }}
            >
              <div style={{ fontSize: 28, fontWeight: 800, color: "#374151" }}>
                {report.summary.total_scanned || 0}
              </div>
              <div style={{ fontSize: 12, color: "#6B7280", fontWeight: 600 }}>📄 已掃描 Scanned</div>
            </div>
          </div>

          {report.summary.message && (
            <div
              style={{
                padding: 12,
                background: "#F3F4F6",
                borderRadius: 8,
                fontSize: 13,
                color: "#6B7280",
              }}
            >
              ℹ️ {report.summary.message}
            </div>
          )}
        </div>
      )}

      {/* Conflict List */}
      {report && report.conflicts && report.conflicts.length > 0 && (
        <div>
          <h4 style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 12 }}>
            📋 衝突明細 Conflict Details ({report.conflicts.length})
          </h4>

          {report.conflicts.map((conflict, idx) => {
            const config = severityConfig[conflict.severity] || severityConfig.yellow;
            const isExpanded = expandedId === idx;

            return (
              <div
                key={idx}
                style={{
                  marginBottom: 10,
                  border: `2px solid ${config.border}`,
                  borderRadius: 10,
                  overflow: "hidden",
                }}
              >
                {/* Header — clickable */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : idx)}
                  style={{
                    padding: "12px 16px",
                    background: config.bg,
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: config.text,
                        background: "white",
                        padding: "2px 8px",
                        borderRadius: 4,
                        marginRight: 8,
                      }}
                    >
                      {config.label}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
                      {conflict.article} — {conflict.issue_zh}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "#6B7280" }}>
                    📄 {conflict.document_title} {isExpanded ? "▲" : "▼"}
                  </div>
                </div>

                {/* Detail — expandable */}
                {isExpanded && (
                  <div style={{ padding: "16px", background: "white" }}>
                    {/* Issue */}
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 4 }}>
                        ⚠️ 問題 Issue
                      </div>
                      <div style={{ fontSize: 13, color: "#111827" }}>{conflict.issue_zh}</div>
                      <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{conflict.issue_en}</div>
                    </div>

                    {/* Handbook vs Law */}
                    <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                      <div
                        style={{
                          flex: 1,
                          padding: 10,
                          background: "#FEF2F2",
                          borderRadius: 8,
                          borderLeft: "3px solid #DC2626",
                        }}
                      >
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#DC2626", marginBottom: 4 }}>
                          📕 公司規定 Company Policy
                        </div>
                        <div style={{ fontSize: 12, color: "#374151" }}>{conflict.handbook_text}</div>
                      </div>
                      <div
                        style={{
                          flex: 1,
                          padding: 10,
                          background: "#EFF6FF",
                          borderRadius: 8,
                          borderLeft: "3px solid #2563EB",
                        }}
                      >
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#2563EB", marginBottom: 4 }}>
                          ⚖️ 法律規定 Legal Requirement
                        </div>
                        <div style={{ fontSize: 12, color: "#374151" }}>{conflict.law_reference}</div>
                      </div>
                    </div>

                    {/* Recommendation */}
                    <div
                      style={{
                        padding: 10,
                        background: "#F0FDF4",
                        borderRadius: 8,
                        borderLeft: "3px solid #059669",
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#059669", marginBottom: 4 }}>
                        💡 建議修改 Recommendation
                      </div>
                      <div style={{ fontSize: 12, color: "#374151" }}>{conflict.recommendation_zh}</div>
                      <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>
                        {conflict.recommendation_en}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {report && report.conflicts && report.conflicts.length === 0 && report.summary.total_scanned > 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "40px 20px",
            background: "#F0FDF4",
            borderRadius: 12,
            border: "2px solid #A7F3D0",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 8 }}>🎉</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#059669" }}>
            全部合規！All Compliant!
          </div>
          <div style={{ fontSize: 13, color: "#065F46", marginTop: 4 }}>
            已掃描 {report.summary.total_scanned} 份文件，未發現與台灣勞動法規的衝突。
          </div>
        </div>
      )}
    </div>
  );
}
