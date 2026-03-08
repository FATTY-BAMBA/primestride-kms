"use client";

import { useState, useRef, useEffect, ReactNode } from "react";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
  timestamp: Date;
}

interface ChatSource {
  doc_id: string;
  title: string;
  doc_type: string | null;
  relevance: number;
}

// ══════════════════════════════════════════════════════════════
// Simple Markdown Renderer for AI Responses
// Handles: **bold**, numbered lists, bullet points, line breaks
// ══════════════════════════════════════════════════════════════
function renderMarkdown(text: string): ReactNode {
  const lines = text.split("\n");
  const elements: ReactNode[] = [];
  let key = 0;

  const processBold = (line: string): ReactNode[] => {
    const parts = line.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i} style={{ color: "#111827" }}>{part.slice(2, -2)}</strong>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  lines.forEach((line) => {
    const trimmed = line.trim();

    // Empty line → spacer
    if (trimmed === "") {
      elements.push(<div key={key++} style={{ height: 8 }} />);
      return;
    }

    // Numbered list: "1. ", "2. ", etc.
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      elements.push(
        <div key={key++} style={{ display: "flex", gap: 10, marginBottom: 4, marginTop: 8, paddingLeft: 4 }}>
          <span style={{ color: "#10B981", fontWeight: 700, minWidth: 22, flexShrink: 0 }}>{numMatch[1]}.</span>
          <div style={{ flex: 1 }}>{processBold(numMatch[2])}</div>
        </div>
      );
      return;
    }

    // Sub-item bullet: "   - text" or "  * text"
    const subBulletMatch = trimmed.match(/^[\-\*]\s+(.*)/);
    const leadingSpaces = line.length - line.trimStart().length;
    if (subBulletMatch && leadingSpaces >= 2) {
      elements.push(
        <div key={key++} style={{ display: "flex", gap: 8, marginBottom: 2, paddingLeft: 36 }}>
          <span style={{ color: "#6B7280", flexShrink: 0 }}>•</span>
          <div style={{ flex: 1 }}>{processBold(subBulletMatch[1])}</div>
        </div>
      );
      return;
    }

    // Top-level bullet: "- text" or "* text"
    if (subBulletMatch) {
      elements.push(
        <div key={key++} style={{ display: "flex", gap: 8, marginBottom: 3, paddingLeft: 12 }}>
          <span style={{ color: "#10B981", flexShrink: 0 }}>•</span>
          <div style={{ flex: 1 }}>{processBold(subBulletMatch[1])}</div>
        </div>
      );
      return;
    }

    // Regular text
    elements.push(
      <div key={key++} style={{ marginBottom: 4 }}>{processBold(trimmed)}</div>
    );
  });

  return <div>{elements}</div>;
}

export default function SearchPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setError("");

    const newUserMessage: ChatMessage = {
      role: "user",
      content: userMessage,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newUserMessage]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          conversationHistory: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to get response");

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: data.answer,
        sources: data.sources,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const suggestedQuestions = [
    "我們的請假規定是什麼？",
    "How do I request overtime?",
    "新人到職第一天要做什麼？",
    "What's our travel reimbursement policy?",
    "加班費怎麼計算？",
    "Who do I contact for IT issues?",
  ];

  return (
    <ProtectedRoute>
      <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#F9FAFB" }}>

        {/* ═══ HEADER ═══ */}
        <div style={{
          padding: "12px 24px",
          background: "white",
          borderBottom: "1px solid #E5E7EB",
          flexShrink: 0,
        }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            maxWidth: 800, margin: "0 auto",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20, boxShadow: "0 2px 8px rgba(16, 185, 129, 0.3)",
              }}>
                🔍
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", lineHeight: 1.2 }}>
                  Ask Atlas
                </div>
                <div style={{ fontSize: 12, color: "#6B7280" }}>
                  公司知識助手 · Company Knowledge Assistant
                </div>
              </div>
            </div>

            {messages.length > 0 && (
              <button
                onClick={() => { setMessages([]); setError(""); }}
                style={{
                  padding: "6px 14px", borderRadius: 8, border: "1px solid #E5E7EB",
                  background: "white", fontSize: 12, cursor: "pointer", color: "#6B7280",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#D1D5DB"; e.currentTarget.style.background = "#F9FAFB"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.background = "white"; }}
              >
                🗑️ 清除對話
              </button>
            )}
          </div>
        </div>

        {/* ═══ CHAT AREA ═══ */}
        <div style={{ flex: 1, overflow: "auto", padding: "24px 24px 16px" }}>
          <div style={{ maxWidth: 800, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16, minHeight: "100%" }}>

            {/* Empty state */}
            {messages.length === 0 && (
              <div style={{
                flex: 1, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                textAlign: "center", padding: "40px 20px",
              }}>
                <div style={{
                  width: 80, height: 80, borderRadius: 20, marginBottom: 24,
                  background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 40, boxShadow: "0 4px 20px rgba(16, 185, 129, 0.25)",
                }}>
                  🔍
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111827", marginBottom: 8 }}>
                  有什麼想問的嗎？
                </h2>
                <p style={{ fontSize: 15, color: "#6B7280", maxWidth: 480, marginBottom: 32, lineHeight: 1.6 }}>
                  Ask me anything about company policies, procedures, or documents.
                  <br />
                  我會從公司知識庫中找到答案。
                </p>

                {/* Suggested questions */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 10, maxWidth: 560, width: "100%",
                }}>
                  {suggestedQuestions.map((sq, i) => (
                    <button
                      key={i}
                      onClick={() => { setInput(sq); inputRef.current?.focus(); }}
                      style={{
                        padding: "12px 16px", background: "white", border: "1px solid #E5E7EB",
                        borderRadius: 10, fontSize: 13, color: "#374151", cursor: "pointer",
                        textAlign: "left", transition: "all 0.15s", lineHeight: 1.5,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#10B981"; e.currentTarget.style.background = "#F0FDF4"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.background = "white"; }}
                    >
                      {sq}
                    </button>
                  ))}
                </div>

                <div style={{ marginTop: 32, padding: "12px 20px", background: "#F0FDF4", borderRadius: 10, border: "1px solid #BBF7D0" }}>
                  <div style={{ fontSize: 12, color: "#065F46", lineHeight: 1.5 }}>
                    💡 <strong>Tip:</strong> I only answer from your company&apos;s documents — no hallucinations.
                    <br />
                    所有回答皆來自公司文件，不會產生幻覺。
                  </div>
                </div>
              </div>
            )}

            {/* Messages */}
            {messages.map((msg, index) => (
              <div key={index} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{ maxWidth: "85%", display: "flex", gap: 10, flexDirection: msg.role === "user" ? "row-reverse" : "row", alignItems: "flex-start" }}>
                  {/* Avatar */}
                  <div style={{
                    width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                    background: msg.role === "user"
                      ? "linear-gradient(135deg, #6366F1, #8B5CF6)"
                      : "linear-gradient(135deg, #10B981, #059669)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "white", fontSize: 14,
                  }}>
                    {msg.role === "user" ? "👤" : "🔍"}
                  </div>

                  {/* Bubble */}
                  <div style={{
                    padding: "14px 18px", borderRadius: 14,
                    background: msg.role === "user" ? "#6366F1" : "white",
                    color: msg.role === "user" ? "white" : "#111827",
                    border: msg.role === "assistant" ? "1px solid #E5E7EB" : "none",
                    boxShadow: msg.role === "assistant" ? "0 1px 4px rgba(0,0,0,0.06)" : "none",
                    fontSize: 14, lineHeight: 1.7,
                    whiteSpace: msg.role === "user" ? "pre-wrap" : "normal",
                  }}>
                    {msg.role === "assistant" ? renderMarkdown(msg.content) : msg.content}

                    {/* Sources */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #E5E7EB" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          📚 Sources 參考文件
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {msg.sources.map((source, i) => (
                            <Link
                              key={i}
                              href={`/library/${encodeURIComponent(source.doc_id)}`}
                              style={{
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                padding: "8px 12px", background: "#F9FAFB", borderRadius: 8,
                                textDecoration: "none", color: "inherit", fontSize: 12,
                                border: "1px solid #E5E7EB", transition: "all 0.15s",
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#10B981"; e.currentTarget.style.background = "#F0FDF4"; }}
                              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.background = "#F9FAFB"; }}
                            >
                              <div>
                                <div style={{ fontWeight: 600, color: "#111827" }}>{source.title}</div>
                                <div style={{ fontSize: 11, color: "#9CA3AF", fontFamily: "'JetBrains Mono', monospace" }}>{source.doc_id}</div>
                              </div>
                              <div style={{
                                padding: "3px 8px", background: "#D1FAE5",
                                color: "#065F46", borderRadius: 6, fontSize: 11, fontWeight: 700,
                              }}>
                                {source.relevance}%
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{
                      fontSize: 10, marginTop: 8,
                      color: msg.role === "user" ? "rgba(255,255,255,0.6)" : "#D1D5DB",
                    }}>
                      {msg.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Loading */}
            {loading && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                    background: "linear-gradient(135deg, #10B981, #059669)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "white", fontSize: 14,
                  }}>🔍</div>
                  <div style={{
                    padding: "14px 18px", borderRadius: 14, background: "white",
                    border: "1px solid #E5E7EB", fontSize: 14, color: "#6B7280",
                    display: "flex", alignItems: "center", gap: 10,
                  }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: "50%", background: "#10B981",
                      animation: "pulse 1s ease-in-out infinite",
                    }} />
                    搜尋文件中... Searching documents...
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            margin: "0 24px 8px", padding: "10px 16px", background: "#FEE2E2",
            borderRadius: 8, color: "#991B1B", fontSize: 13, maxWidth: 800,
            marginLeft: "auto", marginRight: "auto",
          }}>
            {error}
          </div>
        )}

        {/* ═══ INPUT ═══ */}
        <div style={{
          padding: "12px 24px 20px", background: "white",
          borderTop: "1px solid #E5E7EB", flexShrink: 0,
        }}>
          <div style={{ maxWidth: 800, margin: "0 auto" }}>
            <div style={{ display: "flex", gap: 10 }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="問任何關於公司的問題... Ask anything about the company..."
                disabled={loading}
                rows={1}
                style={{
                  flex: 1, padding: "14px 18px", borderRadius: 12,
                  border: "2px solid #E5E7EB", fontSize: 15, resize: "none",
                  outline: "none", transition: "border-color 0.2s",
                  minHeight: 50, maxHeight: 120, fontFamily: "inherit",
                  opacity: loading ? 0.6 : 1,
                }}
                onFocus={(e) => (e.target.style.borderColor = "#10B981")}
                onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
              />
              <button
                onClick={() => handleSubmit()}
                disabled={loading || !input.trim()}
                style={{
                  padding: "14px 24px", borderRadius: 12, border: "none",
                  background: loading || !input.trim() ? "#D1D5DB" : "linear-gradient(135deg, #10B981, #059669)",
                  color: "white", fontSize: 15, fontWeight: 700,
                  cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                  transition: "all 0.2s", minWidth: 80,
                  boxShadow: loading || !input.trim() ? "none" : "0 2px 8px rgba(16, 185, 129, 0.3)",
                }}
              >
                {loading ? "..." : "送出 →"}
              </button>
            </div>
            <div style={{ fontSize: 11, color: "#D1D5DB", marginTop: 6, textAlign: "center" }}>
              Enter 送出 · Shift+Enter 換行 · 所有回答皆來自公司文件
            </div>
          </div>
        </div>

        <style jsx>{`
          @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        `}</style>
      </div>
    </ProtectedRoute>
  );
}