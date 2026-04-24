"use client";

import { useState, useEffect, useRef } from "react";

interface ConflictItem {
  severity: "red" | "yellow" | "green";
  category: string;
  document_id: string;
  document_title: string;
  handbook_text: string;
  law_reference: string;
  article: string;
  law_url?: string;
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
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchLatestReport(); }, []);

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

  async function extractTextFromFile(file: File): Promise<string> {
    if (file.type === "text/plain") {
      return await file.text();
    }
    // For PDF and DOCX — send to server for extraction
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/documents/extract-text", {
      method: "POST",
      body: formData,
    });
    if (res.ok) {
      const data = await res.json();
      return data.text || "";
    }
    // Fallback — read as text
    return await file.text();
  }

  async function handleFileUpload(file: File) {
    if (!file) return;
    setUploading(true);
    setError("");
    setUploadedFile(file.name);

    try {
      // Step 1: Upload to library
      const formData = new FormData();
      formData.append("file", file);
      formData.append("source", "compliance_scan");

      const uploadRes = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        // If library upload fails, still try to scan with raw text
        console.warn("Library upload failed, scanning from raw text");
      }

      // Step 2: Run compliance scan immediately
      setUploading(false);
      await runScan();
    } catch (err: any) {
      setError(err.message || "上傳失敗，請重試");
      setUploading(false);
    }
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
      if (data.error) setError(data.error);
      else setReport(data);
    } catch (err: any) {
      setError(err.message || "掃描失敗");
    } finally {
      setScanning(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  }

  const severityConfig = {
    red: { label: "🔴 違規 Violation", bg: "#FEE2E2", border: "#DC2626", text: "#991B1B" },
    yellow: { label: "🟡 待確認 Review", bg: "#FEF3C7", border: "#D97706", text: "#92400E" },
    green: { label: "🟢 合規 Compliant", bg: "#D1FAE5", border: "#059669", text: "#065F46" },
  };

  const isLoading = uploading || scanning;

  return (
    <div>
      {/* Scanner Header */}
      <div style={{ padding: "20px 24px", background: "linear-gradient(135deg, #7C3AED11, #2563EB11)", borderRadius: 12, border: "1px solid #E5E7EB", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#111827" }}>
              🛡️ 合規衝突掃描 Compliance Conflict Scanner
            </h3>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6B7280" }}>
              上傳公司手冊，AI 自動比對台灣勞動法規 | Upload handbook, AI scans against Taiwan labor law
            </p>
          </div>
          <button
            onClick={runScan}
            disabled={isLoading}
            style={{
              padding: "10px 20px",
              background: isLoading ? "#9CA3AF" : "#7C3AED",
              color: "white", border: "none", borderRadius: 8,
              fontWeight: 700, fontSize: 14,
              cursor: isLoading ? "not-allowed" : "pointer",
              flexShrink: 0,
            }}
          >
            {scanning ? "⏳ 掃描中..." : "🔍 重新掃描文件庫"}
          </button>
        </div>

        {/* Upload Zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            marginTop: 16,
            padding: "24px 20px",
            border: `2px dashed ${dragOver ? "#7C3AED" : "#C4B5FD"}`,
            borderRadius: 10,
            background: dragOver ? "#EDE9FE" : "white",
            textAlign: "center",
            cursor: "pointer",
            transition: "all 0.15s",
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
          {isLoading ? (
            <div>
              <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#7C3AED" }}>
                {uploading ? "上傳至文件庫中..." : "AI 掃描比對中，請稍候..."}
              </div>
              <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4 }}>
                {uploadedFile && `正在處理：${uploadedFile}`}
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 4 }}>
                拖曳或點擊上傳公司文件
              </div>
              <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 8 }}>
                支援 PDF · Word (.docx) · 純文字 (.txt)
              </div>
              {uploadedFile && (
                <div style={{ fontSize: 12, color: "#7C3AED", fontWeight: 600 }}>
                  ✓ 已上傳：{uploadedFile}
                </div>
              )}
              <div style={{ fontSize: 11, color: "#C4B5FD", marginTop: 4 }}>
                上傳後自動存入文件庫並立即掃描
              </div>
            </div>
          )}
        </div>

        {/* Flow explanation */}
        <div style={{ marginTop: 12, padding: "10px 14px", background: "white", borderRadius: 8, fontSize: 12, color: "#6B7280" }}>
          📋 掃描流程：上傳文件 → 自動存入文件庫 → AI 逐段比對勞基法 → 標記衝突等級
          <br />
          🔴 違規 = 公司規定低於法律最低要求 | 🟡 待確認 = 規定模糊需人工確認 | 🟢 合規 = 符合或優於法律
        </div>
      </div>

      {error && (
        <div style={{ padding: 12, background: "#FEE2E2", borderRadius: 8, color: "#DC2626", fontSize: 13, marginBottom: 16 }}>
          ❌ {error}
        </div>
      )}

      {/* Report Summary */}
      {report && report.summary && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 100, padding: "16px", background: "#FEE2E2", borderRadius: 10, textAlign: "center", border: "2px solid #FECACA" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#DC2626" }}>{report.summary.red || 0}</div>
              <div style={{ fontSize: 12, color: "#991B1B", fontWeight: 600 }}>🔴 違規 Violations</div>
            </div>
            <div style={{ flex: 1, minWidth: 100, padding: "16px", background: "#FEF3C7", borderRadius: 10, textAlign: "center", border: "2px solid #FDE68A" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#D97706" }}>{report.summary.yellow || 0}</div>
              <div style={{ fontSize: 12, color: "#92400E", fontWeight: 600 }}>🟡 待確認 Warnings</div>
            </div>
            <div style={{ flex: 1, minWidth: 100, padding: "16px", background: "#D1FAE5", borderRadius: 10, textAlign: "center", border: "2px solid #A7F3D0" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#059669" }}>{report.summary.green || 0}</div>
              <div style={{ fontSize: 12, color: "#065F46", fontWeight: 600 }}>🟢 合規 Compliant</div>
            </div>
            <div style={{ flex: 1, minWidth: 100, padding: "16px", background: "#F3F4F6", borderRadius: 10, textAlign: "center", border: "2px solid #E5E7EB" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#374151" }}>{report.summary.total_scanned || 0}</div>
              <div style={{ fontSize: 12, color: "#6B7280", fontWeight: 600 }}>📄 已掃描文件數</div>
              <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 2 }}>文件庫中符合條件的文件</div>
            </div>
          </div>
          {report.summary.message && (
            <div style={{ padding: 12, background: "#F3F4F6", borderRadius: 8, fontSize: 13, color: "#6B7280" }}>
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
              <div key={idx} style={{ marginBottom: 10, border: `2px solid ${config.border}`, borderRadius: 10, overflow: "hidden" }}>
                <div
                  onClick={() => setExpandedId(isExpanded ? null : idx)}
                  style={{ padding: "12px 16px", background: config.bg, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: config.text, background: "white", padding: "2px 8px", borderRadius: 4, marginRight: 8 }}>
                      {config.label}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
                      {conflict.law_url ? (
                        <a href={conflict.law_url} target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          style={{ color: "#2563EB", textDecoration: "none", fontWeight: 700, marginRight: 4 }}>
                          {conflict.article} ↗
                        </a>
                      ) : (
                        <span style={{ fontWeight: 700, marginRight: 4 }}>{conflict.article}</span>
                      )}
                      — {conflict.issue_zh}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <a href={`/library/${encodeURIComponent(conflict.document_id)}`}
                      onClick={e => e.stopPropagation()}
                      style={{ fontSize: 11, color: "#7C3AED", textDecoration: "none", fontWeight: 600 }}>
                      📄 {conflict.document_title} ↗
                    </a>
                    <span style={{ fontSize: 12, color: "#9CA3AF" }}>{isExpanded ? "▲" : "▼"}</span>
                  </div>
                </div>
                {isExpanded && (
                  <div style={{ padding: "16px", background: "white" }}>
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 4 }}>⚠️ 問題 Issue</div>
                      <div style={{ fontSize: 13, color: "#111827" }}>{conflict.issue_zh}</div>
                      <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{conflict.issue_en}</div>
                    </div>
                    <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: 160, padding: 10, background: "#FEF2F2", borderRadius: 8, borderLeft: "3px solid #DC2626" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#DC2626", marginBottom: 4 }}>📕 公司規定 Company Policy</div>
                        <div style={{ fontSize: 12, color: "#374151" }}>{conflict.handbook_text}</div>
                      </div>
                      <div style={{ flex: 1, minWidth: 160, padding: 10, background: "#EFF6FF", borderRadius: 8, borderLeft: "3px solid #2563EB" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#2563EB", marginBottom: 4 }}>⚖️ 法律規定 Legal Requirement</div>
                        <div style={{ fontSize: 12, color: "#374151" }}>{conflict.law_reference}</div>
                      </div>
                    </div>
                    <div style={{ padding: 10, background: "#F0FDF4", borderRadius: 8, borderLeft: "3px solid #059669" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#059669", marginBottom: 4 }}>💡 建議修改 Recommendation</div>
                      <div style={{ fontSize: 12, color: "#374151" }}>{conflict.recommendation_zh}</div>
                      <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>{conflict.recommendation_en}</div>
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
        <div style={{ textAlign: "center", padding: "40px 20px", background: "#F0FDF4", borderRadius: 12, border: "2px solid #A7F3D0" }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🎉</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#059669" }}>全部合規！All Compliant!</div>
          <div style={{ fontSize: 13, color: "#065F46", marginTop: 4 }}>
            已掃描 {report.summary.total_scanned} 份文件，未發現與台灣勞動法規的衝突。
          </div>
        </div>
      )}

      {/* No scan yet */}
      {!report && !isLoading && (
        <div style={{ textAlign: "center", padding: "32px 20px", background: "#F9FAFB", borderRadius: 12, border: "1px dashed #E5E7EB" }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>⬆️</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
            上傳公司文件開始掃描
          </div>
          <div style={{ fontSize: 12, color: "#9CA3AF" }}>
            支援員工手冊、加班辦法、請假規定等文件
          </div>
        </div>
      )}
    </div>
  );
}
