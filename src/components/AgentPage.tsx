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
    "Create a weekly meeting notes template",
    "Summarize all my documents",
    "Organize my unfiled documents into folders",
    "Create a project brief for Q1 planning",
    "Find all documents about onboarding",
    "Tag all documents automatically",
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#F9FAFB", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: "16px 24px", background: "white", borderBottom: "1px solid #E5E7EB", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/library" style={{ color: "#6B7280", textDecoration: "none", fontSize: 14 }}>← Library</Link>
          <div style={{ width: 1, height: 20, background: "#E5E7EB" }} />
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🤖</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#111827" }}>AI Agent</div>
            <div style={{ fontSize: 12, color: "#9CA3AF" }}>Create, organize, search — just ask</div>
          </div>
        </div>
        {messages.length > 0 && (
          <button onClick={() => setMessages([])} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #E5E7EB", background: "white", fontSize: 13, cursor: "pointer", color: "#6B7280" }}>
            Clear chat
          </button>
        )}
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 24px 100px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          {messages.length === 0 && (
            <div style={{ textAlign: "center", padding: "80px 20px" }}>
              <div style={{ width: 80, height: 80, borderRadius: 20, margin: "0 auto 24px", background: "linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40 }}>🤖</div>
              <h2 style={{ fontSize: 24, fontWeight: 700, color: "#111827", marginBottom: 8 }}>What can I help you with?</h2>
              <p style={{ fontSize: 15, color: "#6B7280", maxWidth: 500, margin: "0 auto 32px" }}>
                I can create documents, organize folders, search your knowledge base, summarize content, tag documents, and manage projects — all through natural language.
              </p>
              <div className="mobile-suggestions" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10, maxWidth: 600, margin: "0 auto" }}>
                {suggestions.map(s => (
                  <button key={s} onClick={() => { setInput(s); inputRef.current?.focus(); }}
                    style={{ padding: "12px 16px", borderRadius: 10, border: "1px solid #E5E7EB", background: "white", fontSize: 13, cursor: "pointer", color: "#374151", textAlign: "left", transition: "all 0.15s", lineHeight: 1.4 }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#7C3AED"; e.currentTarget.style.background = "#F5F3FF"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.background = "white"; }}
                  >{s}</button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} style={{ marginBottom: 20, display: "flex", gap: 12, flexDirection: msg.role === "user" ? "row-reverse" : "row" }}>
              <div style={{
                width: 36, height: 36, borderRadius: 12, flexShrink: 0,
                background: msg.role === "user" ? "linear-gradient(135deg, #7C3AED, #A78BFA)" : "linear-gradient(135deg, #7C3AED, #EC4899)",
                display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 16,
              }}>{msg.role === "user" ? "👤" : "🤖"}</div>

              <div style={{
                maxWidth: "80%", padding: "14px 18px", borderRadius: 14,
                background: msg.role === "user" ? "#7C3AED" : "white",
                color: msg.role === "user" ? "white" : "#111827",
                border: msg.role === "assistant" ? "1px solid #E5E7EB" : "none",
                fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap",
                boxShadow: msg.role === "assistant" ? "0 1px 3px rgba(0,0,0,0.05)" : "none",
              }}>
                {msg.content}

                {msg.actions && msg.actions.length > 0 && msg.actions.some(a => a && a !== "REPLY") && (
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #F3F4F6", display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {msg.actions.filter(a => a && a !== "REPLY").map((a, j) => (
                      <span key={j} style={{
                        padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                        background: (a || "").includes("CREATE") ? "#D1FAE5" : (a || "").includes("MOVE") ? "#DBEAFE" : (a || "").includes("SEARCH") ? "#FEF3C7" : (a || "").includes("TAG") ? "#EDE9FE" : "#F3F4F6",
                        color: (a || "").includes("CREATE") ? "#065F46" : (a || "").includes("MOVE") ? "#1E40AF" : (a || "").includes("SEARCH") ? "#92400E" : (a || "").includes("TAG") ? "#5B21B6" : "#374151",
                      }}>{(a || "").replace("_", " ")}</span>
                    ))}
                  </div>
                )}

                {msg.createdItems && msg.createdItems.length > 0 && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #F3F4F6" }}>
                    <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 6 }}>
                      {msg.actions?.some(a => (a || "").includes("SEARCH")) ? "📄 Results:" : "Quick links:"}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {msg.createdItems.map((item, j) => (
                        <Link key={j}
                          href={item.type === "doc" ? `/library/${encodeURIComponent(item.id)}` : `/library?folder=${item.id}`}
                          style={{ padding: "4px 12px", borderRadius: 6, background: "#EEF2FF", color: "#4F46E5", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
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
            <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
              <div style={{ width: 36, height: 36, borderRadius: 12, flexShrink: 0, background: "linear-gradient(135deg, #7C3AED, #EC4899)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 16 }}>🤖</div>
              <div style={{ padding: "14px 18px", borderRadius: 14, background: "white", border: "1px solid #E5E7EB", fontSize: 14, color: "#9CA3AF", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#7C3AED", animation: "pulse 1s ease-in-out infinite" }} />
                Thinking & executing...
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Input */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "16px 24px", background: "white", borderTop: "1px solid #E5E7EB", boxShadow: "0 -4px 12px rgba(0,0,0,0.05)" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", display: "flex", gap: 10 }}>
          <input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
            placeholder="Tell the AI what to do... e.g. 'Create a meeting notes doc for today'"
            disabled={loading}
            style={{ flex: 1, padding: "14px 18px", border: "1px solid #D1D5DB", borderRadius: 12, fontSize: 15, outline: "none", opacity: loading ? 0.6 : 1 }} />
          <button onClick={handleSend} disabled={!input.trim() || loading}
            style={{ padding: "14px 24px", borderRadius: 12, border: "none", background: !input.trim() || loading ? "#D1D5DB" : "linear-gradient(135deg, #7C3AED, #EC4899)", color: "white", fontSize: 15, fontWeight: 700, cursor: !input.trim() || loading ? "not-allowed" : "pointer", minWidth: 80 }}>
            {loading ? "..." : "Send"}
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </div>
  );
}
