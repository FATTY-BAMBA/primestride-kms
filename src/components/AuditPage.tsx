"use client";

import { useState, useRef } from "react";

interface AuditFinding {
  severity: "critical" | "warning" | "info";
  category: string;
  title: string;
  title_zh: string;
  description: string;
  description_zh: string;
  law_reference: string;
  recommendation: string;
  recommendation_zh: string;
}

interface AuditResult {
  score: number;
  findings: AuditFinding[];
  summary: string;
  summary_zh: string;
  total_critical: number;
  total_warnings: number;
  total_info: number;
}

const severityConfig = {
  critical: { icon: "🚫", label: "違法風險", labelEn: "Legal Risk", color: "#DC2626", bg: "#FEF2F2", border: "#FECACA" },
  warning: { icon: "⚠️", label: "需要更新", labelEn: "Needs Update", color: "#D97706", bg: "#FFFBEB", border: "#FDE68A" },
  info: { icon: "ℹ️", label: "建議新增", labelEn: "Recommended", color: "#2563EB", bg: "#EFF6FF", border: "#BFDBFE" },
};

export default function AuditPage() {
  const [file, setFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);
    setError("");

    // Extract text from file
    setExtracting(true);
    try {
      const formData = new FormData();
      formData.append("file", f);
      const res = await fetch("/api/documents/parse", { method: "POST", body: formData });
      const data = await res.json();
      if (data.content) {
        setExtractedText(data.content);
      } else {
        setError("無法讀取文件內容。請確認文件為 PDF 或 Word 格式。");
      }
    } catch {
      setError("文件解析失敗，請重試。");
    } finally {
      setExtracting(false);
    }
  };

  const handleAnalyze = async () => {
    if (!extractedText) return;
    setAnalyzing(true);
    setError("");
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: extractedText }),
      });
      const data = await res.json();
      if (data.data) {
        setResult(data.data);
      } else {
        setError(data.error || "分析失敗，請重試。");
      }
    } catch {
      setError("分析失敗，請重試。");
    } finally {
      setAnalyzing(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "#059669";
    if (score >= 60) return "#D97706";
    return "#DC2626";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return { zh: "合規良好", en: "Good Compliance" };
    if (score >= 60) return { zh: "需要改善", en: "Needs Improvement" };
    return { zh: "嚴重風險", en: "Serious Risk" };
  };

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Instrument+Sans:wght@400;500;600;700&family=Noto+Sans+TC:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        body { margin: 0; font-family: 'Instrument Sans', 'Noto Sans TC', system-ui, sans-serif; background: #0a0e17; color: #e8e6e1; }
        * { box-sizing: border-box; }
      `}</style>

      {/* Nav */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, height: 64, background: "rgba(10,14,23,0.9)", backdropFilter: "blur(24px)", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px" }}>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "#e8e6e1" }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg, #2563eb, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, fontWeight: 700 }}>P</div>
          <span style={{ fontWeight: 700, fontSize: 17, fontFamily: "'DM Serif Display', serif" }}>Atlas EIP</span>
        </a>
        <div style={{ display: "flex", gap: 10 }}>
          <a href="/login" style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", color: "#e8e6e1", textDecoration: "none", fontSize: 14, fontWeight: 600 }}>登入</a>
          <a href="/signup" style={{ padding: "8px 18px", borderRadius: 8, background: "#2563eb", color: "#fff", textDecoration: "none", fontSize: 14, fontWeight: 700 }}>免費註冊 →</a>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ padding: "140px 24px 60px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -200, left: "50%", transform: "translateX(-50%)", width: 800, height: 800, background: "radial-gradient(circle, rgba(220,38,38,0.08) 0%, transparent 65%)", pointerEvents: "none" }} />
        <div style={{ maxWidth: 700, margin: "0 auto", position: "relative" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 16px", borderRadius: 100, fontSize: 13, fontWeight: 600, background: "rgba(220,38,38,0.1)", color: "#FCA5A5", border: "1px solid rgba(220,38,38,0.2)", marginBottom: 24 }}>
            🔍 Free 2026 Compliance Audit 免費合規掃描
          </div>
          <h1 style={{ fontFamily: "'DM Serif Display', 'Noto Sans TC', serif", fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 400, lineHeight: 1.15, marginBottom: 12 }}>
            你的員工手冊<br /><span style={{ color: "#FCA5A5" }}>符合 2026 勞基法嗎？</span>
          </h1>
          <p style={{ fontSize: 17, color: "#94a3b8", maxWidth: 550, margin: "0 auto 16px", lineHeight: 1.8 }}>
            上傳你的員工手冊，AI 自動掃描並標示所有違反 2026 年 1 月 1 日勞基法修正案的條款。<strong style={{ color: "#e8e6e1" }}>完全免費，無須註冊。</strong>
          </p>
          <p style={{ fontSize: 14, color: "#64748b", maxWidth: 500, margin: "0 auto" }}>
            Upload your Employee Handbook. Atlas AI scans for every clause that violates the Jan 1, 2026 Taiwan Labor Standards Act amendments. Free. No signup required.
          </p>
        </div>
      </section>

      {/* Upload Section */}
      <section style={{ maxWidth: 700, margin: "0 auto", padding: "0 24px 60px" }}>
        <div style={{ background: "#151b2b", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 32, marginBottom: 24 }}>
          {!result ? (
            <>
              {/* Upload Area */}
              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  border: "2px dashed rgba(255,255,255,0.12)", borderRadius: 12, padding: "48px 24px",
                  textAlign: "center", cursor: "pointer", transition: "all 0.2s",
                  background: file ? "rgba(37,99,235,0.05)" : "transparent",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#2563eb"; e.currentTarget.style.background = "rgba(37,99,235,0.05)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.background = file ? "rgba(37,99,235,0.05)" : "transparent"; }}
              >
                <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.txt" onChange={handleFileChange} style={{ display: "none" }} />
                <div style={{ fontSize: 40, marginBottom: 12 }}>{file ? "📄" : "📁"}</div>
                {file ? (
                  <>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "#e8e6e1", marginBottom: 4 }}>{file.name}</div>
                    <div style={{ fontSize: 13, color: "#64748b" }}>{(file.size / 1024).toFixed(0)} KB · {extractedText ? `${extractedText.length.toLocaleString()} 字元已擷取` : extracting ? "擷取中..." : "準備分析"}</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "#94a3b8", marginBottom: 4 }}>點擊或拖放上傳員工手冊</div>
                    <div style={{ fontSize: 13, color: "#64748b" }}>支援 PDF、Word (.docx)、純文字 (.txt)</div>
                  </>
                )}
              </div>

              {/* Analyze Button */}
              {extractedText && (
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  style={{
                    width: "100%", marginTop: 20, padding: "16px", borderRadius: 12, border: "none",
                    background: analyzing ? "#374151" : "linear-gradient(135deg, #DC2626, #B91C1C)",
                    color: "white", fontSize: 17, fontWeight: 700, cursor: analyzing ? "not-allowed" : "pointer",
                    boxShadow: analyzing ? "none" : "0 4px 20px rgba(220,38,38,0.3)",
                    transition: "all 0.2s",
                  }}
                >
                  {analyzing ? "🔍 AI 掃描中，請稍候約 15 秒..." : "🔍 開始 2026 合規掃描 Start Audit"}
                </button>
              )}

              {error && (
                <div style={{ marginTop: 16, padding: "12px 16px", borderRadius: 8, background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.2)", color: "#FCA5A5", fontSize: 14 }}>{error}</div>
              )}

              {/* What We Check */}
              <div style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#64748b", marginBottom: 14 }}>⚖️ 掃描項目 What We Check</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[
                    "家庭照顧假小時制 Hourly Family Care Leave",
                    "全勤獎金比例扣減 Pro-Rata Bonus Protection",
                    "育嬰假彈性制度 Flexible Parental Leave",
                    "加班時數上限 Overtime Caps (46/54/138hr)",
                    "基本工資 2026 Minimum Wage NT$29,500",
                    "特休假計算方式 Annual Leave Calculation",
                    "休息日/假日加班費率 Holiday OT Rates",
                    "醫師證明要求 Medical Certificate Rules",
                  ].map((item) => (
                    <div key={item} style={{ padding: "8px 12px", borderRadius: 6, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", fontSize: 12, color: "#94a3b8" }}>
                      ✓ {item}
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            /* ═══ RESULTS ═══ */
            <>
              {/* Score */}
              <div style={{ textAlign: "center", marginBottom: 32 }}>
                <div style={{ fontSize: 14, color: "#64748b", marginBottom: 8 }}>2026 勞基法合規分數</div>
                <div style={{
                  width: 120, height: 120, borderRadius: "50%", margin: "0 auto 12px",
                  background: `conic-gradient(${getScoreColor(result.score)} ${result.score * 3.6}deg, rgba(255,255,255,0.05) 0deg)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <div style={{ width: 96, height: 96, borderRadius: "50%", background: "#151b2b", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
                    <div style={{ fontSize: 36, fontWeight: 800, color: getScoreColor(result.score), fontFamily: "'JetBrains Mono', monospace" }}>{result.score}</div>
                  </div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: getScoreColor(result.score) }}>{getScoreLabel(result.score).zh}</div>
                <div style={{ fontSize: 13, color: "#64748b" }}>{getScoreLabel(result.score).en}</div>
              </div>

              {/* Summary Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 24 }}>
                <div style={{ padding: 16, borderRadius: 10, background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.15)", textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#DC2626" }}>{result.total_critical}</div>
                  <div style={{ fontSize: 12, color: "#FCA5A5" }}>違法風險 Critical</div>
                </div>
                <div style={{ padding: 16, borderRadius: 10, background: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.15)", textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#D97706" }}>{result.total_warnings}</div>
                  <div style={{ fontSize: 12, color: "#FBBF24" }}>需更新 Warnings</div>
                </div>
                <div style={{ padding: 16, borderRadius: 10, background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.15)", textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#2563EB" }}>{result.total_info}</div>
                  <div style={{ fontSize: 12, color: "#60A5FA" }}>建議新增 Info</div>
                </div>
              </div>

              {/* Summary */}
              <div style={{ padding: 16, borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", marginBottom: 24 }}>
                <div style={{ fontSize: 15, color: "#e8e6e1", lineHeight: 1.7, marginBottom: 8 }}>{result.summary_zh}</div>
                <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>{result.summary}</div>
              </div>

              {/* Findings */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#e8e6e1", marginBottom: 14 }}>📋 詳細發現 Detailed Findings</div>
                <div style={{ display: "grid", gap: 12 }}>
                  {result.findings.map((f, i) => {
                    const config = severityConfig[f.severity];
                    return (
                      <div key={i} style={{ padding: 18, borderRadius: 12, background: "rgba(255,255,255,0.02)", border: `1px solid ${config.border}40`, borderLeft: `4px solid ${config.color}` }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <span style={{ fontSize: 16 }}>{config.icon}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: `${config.color}15`, color: config.color }}>{config.label}</span>
                          <span style={{ fontSize: 11, color: "#64748b", fontFamily: "'JetBrains Mono', monospace" }}>{f.law_reference}</span>
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#e8e6e1", marginBottom: 4 }}>{f.title_zh}</div>
                        <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6, marginBottom: 10 }}>{f.description_zh}</div>
                        <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.12)" }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#10B981", marginBottom: 3 }}>💡 建議修正 Recommendation</div>
                          <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.5 }}>{f.recommendation_zh}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* CTA */}
              <div style={{ padding: 24, borderRadius: 12, background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(139,92,246,0.1))", border: "1px solid rgba(37,99,235,0.2)", textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#e8e6e1", marginBottom: 8 }}>讓 Atlas EIP 自動修正這些風險</div>
                <div style={{ fontSize: 14, color: "#94a3b8", marginBottom: 20, lineHeight: 1.7 }}>
                  上傳您的手冊到 Atlas，AI 會自動更新您的數位 SOP，<br />
                  並在每次員工申請時即時執行 2026 合規檢查。
                </div>
                <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                  <a href="/signup" style={{ padding: "14px 32px", borderRadius: 10, background: "#2563eb", color: "white", textDecoration: "none", fontSize: 16, fontWeight: 700, boxShadow: "0 4px 20px rgba(37,99,235,0.3)" }}>免費開始試用 →</a>
                  <button onClick={() => { setResult(null); setFile(null); setExtractedText(""); }} style={{ padding: "14px 24px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "#e8e6e1", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>重新掃描</button>
                </div>
                <div style={{ marginTop: 12, fontSize: 12, color: "#64748b" }}>3個月免費試用 · 最多5位使用者 · 不需信用卡</div>
              </div>
            </>
          )}
        </div>

        {/* Trust badges */}
        <div style={{ display: "flex", gap: 20, justifyContent: "center", flexWrap: "wrap", padding: "20px 0" }}>
          {["🔒 資料不會儲存", "⚡ 15秒完成掃描", "🇹🇼 台灣勞基法專用", "📊 AI 深度分析"].map(b => (
            <div key={b} style={{ fontSize: 13, color: "#64748b" }}>{b}</div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: 24, borderTop: "1px solid rgba(255,255,255,0.07)", textAlign: "center" }}>
        <div style={{ fontSize: 13, color: "#64748b" }}>© 2026 Atlas EIP by PrimeStride AI · hello@primestrideatlas.com</div>
      </footer>
    </>
  );
}