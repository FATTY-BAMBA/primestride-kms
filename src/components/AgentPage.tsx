"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  actions?: string[];
  createdItems?: { type: string; id: string; title: string }[];
}

export default function AgentPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg: ChatMessage = { role: "user", content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg.content, history: messages.slice(-10) }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.reply || "I couldn't process that.",
        actions: data.actions || [],
        createdItems: data.createdItems || [],
      }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "❌ Something went wrong. Please try again." }]);
    } finally { setLoading(false); }
  };

  const suggestions = [
    { text: "建立本週會議紀錄模板", en: "Create meeting notes template", icon: "📝", color: "#059669" },
    { text: "整理未分類的文件到資料夾", en: "Organize unfiled documents", icon: "📂", color: "#2563EB" },
    { text: "自動標記所有文件", en: "Auto-tag all documents", icon: "🏷️", color: "#7C3AED" },
    { text: "摘要所有文件的重點", en: "Summarize all documents", icon: "📊", color: "#D97706" },
    { text: "建立 Q1 專案簡報", en: "Create Q1 project brief", icon: "📋", color: "#DC2626" },
    { text: "分析上季的績效報告", en: "Analyze last quarter reviews", icon: "🧠", color: "#EC4899" },
  ];

  const actionColors: Record<string, { bg: string; color: string }> = {
    CREATE: { bg: "#D1FAE5", color: "#065F46" },
    MOVE: { bg: "#DBEAFE", color: "#1E40AF" },
    SEARCH: { bg: "#FEF3C7", color: "#92400E" },
    TAG: { bg: "#EDE9FE", color: "#5B21B6" },
    SUMMARIZE: { bg: "#FCE7F3", color: "#9D174D" },
    ANALYZE: { bg: "#FFF7ED", color: "#9A3412" },
  };

  const getActionStyle = (action: string) => {
    const key = Object.keys(actionColors).find(k => (action || "").includes(k));
    return key ? actionColors[key] : { bg: "#F3F4F6", color: "#374151" };
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F9FAFB", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{
        padding: "12px 24px", background: "white", borderBottom: "1px solid #E5E7EB",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: "linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20, boxShadow: "0 2px 8px rgba(124, 58, 237, 0.3)",
          }}>⚡</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#111827", lineHeight: 1.2 }}>Atlas Agent</div>
            <div style={{ fontSize: 12, color: "#9CA3AF" }}>管理員專用 · Admin Tool · 文件自動化</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {messages.length > 0 && (
            <button onClick={() => setMessages([])}
              style={{
                padding: "6px 14px", borderRadius: 8, border: "1px solid #E5E7EB",
                background: "white", fontSize: 12, cursor: "pointer", color: "#6B7280",
              }}>
              🗑️ 清除
            </button>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 24px 100px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          {messages.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <div style={{
                width: 80, height: 80, borderRadius: 20, margin: "0 auto 24px",
                background: "linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 40, boxShadow: "0 4px 20px rgba(124, 58, 237, 0.25)",
              }}>⚡</div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111827", marginBottom: 8 }}>
                需要我幫你做什麼？
              </h2>
              <p style={{ fontSize: 15, color: "#6B7280", maxWidth: 480, margin: "0 auto 32px", lineHeight: 1.6 }}>
                管理員專用：建立範本、整理資料夾、批次標記、摘要分析。<br />
                員工查詢公司政策請改用「搜尋」頁面。
                <br /><span style={{ fontSize: 13, color: "#9CA3AF" }}>Admin tool: create templates, organize, tag &amp; summarize. Employees → use Ask Atlas.</span>
              </p>

              {/* Action-oriented suggestions */}
              <div className="mobile-suggestions" style={{
                display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 10, maxWidth: 560, margin: "0 auto",
              }}>
                {suggestions.map((s, i) => (
                  <button key={i} onClick={() => { setInput(s.text); inputRef.current?.focus(); }}
                    style={{
                      padding: "14px 16px", borderRadius: 10, border: "1px solid #E5E7EB",
                      background: "white", cursor: "pointer", textAlign: "left",
                      transition: "all 0.15s", display: "flex", alignItems: "flex-start", gap: 10,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = s.color; e.currentTarget.style.boxShadow = `0 2px 8px ${s.color}20`; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.boxShadow = "none"; }}
                  >
                    <span style={{ fontSize: 20, lineHeight: 1 }}>{s.icon}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", lineHeight: 1.4 }}>{s.text}</div>
                      <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>{s.en}</div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Capability badges */}
              <div style={{ marginTop: 32, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                {["📝 Create Docs", "📂 Organize", "🏷️ Auto-Tag", "📊 Summarize", "🧠 Analyze"].map((cap) => (
                  <span key={cap} style={{
                    padding: "5px 12px", borderRadius: 100, background: "#F3F4F6",
                    fontSize: 12, color: "#6B7280", fontWeight: 500,
                  }}>{cap}</span>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} style={{ marginBottom: 20, display: "flex", gap: 10, flexDirection: msg.role === "user" ? "row-reverse" : "row", alignItems: "flex-start" }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                background: msg.role === "user"
                  ? "linear-gradient(135deg, #6366F1, #8B5CF6)"
                  : "linear-gradient(135deg, #7C3AED, #EC4899)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "white", fontSize: 14,
              }}>{msg.role === "user" ? "👤" : "⚡"}</div>

              <div style={{
                maxWidth: "80%", padding: "14px 18px", borderRadius: 14,
                background: msg.role === "user" ? "#6366F1" : "white",
                color: msg.role === "user" ? "white" : "#111827",
                border: msg.role === "assistant" ? "1px solid #E5E7EB" : "none",
                fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap",
                boxShadow: msg.role === "assistant" ? "0 1px 4px rgba(0,0,0,0.06)" : "none",
              }}>
                {msg.content}

                {/* Action badges */}
                {msg.actions && msg.actions.length > 0 && msg.actions.some(a => a && a !== "REPLY") && (
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #F3F4F6", display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {msg.actions.filter(a => a && a !== "REPLY").map((a, j) => {
                      const style = getActionStyle(a);
                      return (
                        <span key={j} style={{
                          padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                          background: style.bg, color: style.color,
                        }}>{(a || "").replace("_", " ")}</span>
                      );
                    })}
                  </div>
                )}

                {/* Created items / search results */}
                {msg.createdItems && msg.createdItems.length > 0 && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #F3F4F6" }}>
                    <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 6, fontWeight: 600 }}>
                      {msg.actions?.some(a => (a || "").includes("SEARCH")) ? "📄 Results:" : "🔗 Quick links:"}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {msg.createdItems.map((item, j) => (
                        <Link key={j}
                          href={item.type === "doc" ? `/library/${encodeURIComponent(item.id)}` : `/library?folder=${item.id}`}
                          style={{
                            padding: "5px 12px", borderRadius: 6, background: "#EEF2FF",
                            color: "#4F46E5", fontSize: 12, fontWeight: 600, textDecoration: "none",
                            transition: "all 0.15s",
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "#E0E7FF"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "#EEF2FF"; }}
                        >
                          {item.type === "doc" ? "📄" : "📁"} {item.title}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: "flex", gap: 10, marginBottom: 20, alignItems: "flex-start" }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                background: "linear-gradient(135deg, #7C3AED, #EC4899)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "white", fontSize: 14,
              }}>⚡</div>
              <div style={{
                padding: "14px 18px", borderRadius: 14, background: "white",
                border: "1px solid #E5E7EB", fontSize: 14, color: "#9CA3AF",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#7C3AED", animation: "pulse 1s ease-in-out infinite" }} />
                執行中... Thinking & executing...
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Input */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        padding: "12px 24px 20px", background: "white",
        borderTop: "1px solid #E5E7EB", boxShadow: "0 -2px 8px rgba(0,0,0,0.04)",
      }}>
        <div style={{ maxWidth: 800, margin: "0 auto", display: "flex", gap: 10 }}>
          <input ref={inputRef} type="text" value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
            placeholder="告訴 AI 要做什麼... e.g. '建立今天的會議紀錄'"
            disabled={loading}
            style={{
              flex: 1, padding: "14px 18px", border: "2px solid #E5E7EB",
              borderRadius: 12, fontSize: 15, outline: "none",
              opacity: loading ? 0.6 : 1, fontFamily: "inherit",
              transition: "border-color 0.2s",
            }}
            onFocus={(e) => (e.target.style.borderColor = "#7C3AED")}
            onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
          />
          <button onClick={handleSend} disabled={!input.trim() || loading}
            style={{
              padding: "14px 24px", borderRadius: 12, border: "none",
              background: !input.trim() || loading ? "#D1D5DB" : "linear-gradient(135deg, #7C3AED, #EC4899)",
              color: "white", fontSize: 15, fontWeight: 700,
              cursor: !input.trim() || loading ? "not-allowed" : "pointer",
              minWidth: 80, transition: "all 0.2s",
              boxShadow: !input.trim() || loading ? "none" : "0 2px 8px rgba(124, 58, 237, 0.3)",
            }}>
            {loading ? "..." : "執行 →"}
          </button>
        </div>
        <div style={{ fontSize: 11, color: "#D1D5DB", marginTop: 6, textAlign: "center", maxWidth: 800, margin: "6px auto 0" }}>
          Enter 送出 · Agent 可以建立文件、整理資料夾、標記、摘要與分析
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </div>
  );
}