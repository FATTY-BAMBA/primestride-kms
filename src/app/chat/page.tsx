"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  timestamp: Date;
}

interface Source {
  doc_id: string;
  title: string;
  doc_type: string | null;
  relevance: number;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setError("");

    // Add user message
    const newUserMessage: Message = {
      role: "user",
      content: userMessage,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newUserMessage]);
    setIsLoading(true);

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

      if (!res.ok) {
        throw new Error(data.error || "Failed to get response");
      }

      // Add assistant message
      const assistantMessage: Message = {
        role: "assistant",
        content: data.answer,
        sources: data.sources,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const suggestedQuestions = [
    "What documents do we have about sales?",
    "How do we engage with clients?",
    "What is our pitch narrative?",
    "Summarize our key strategies",
  ];

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#F9FAFB" }}>
      {/* Header */}
      <div
        style={{
          padding: "16px 24px",
          background: "white",
          borderBottom: "1px solid #E5E7EB",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
            }}
          >
            🤖
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "#111827" }}>
              AI Assistant
            </h1>
            <p style={{ fontSize: 13, color: "#6B7280", margin: 0 }}>
              Ask questions about your knowledge base
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/library" className="btn">
            📚 Library
          </Link>
          <Link href="/ai-graph" className="btn">
            🧠 AI Graph
          </Link>
        </div>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {messages.length === 0 ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: 40,
            }}
          >
            <div style={{ fontSize: 64, marginBottom: 24 }}>🤖</div>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: "#111827" }}>
              Ask me anything about your documents
            </h2>
            <p style={{ fontSize: 15, color: "#6B7280", marginBottom: 32, maxWidth: 500 }}>
              I can search through your knowledge base and provide answers with citations.
              Try asking about your processes, strategies, or any documentation.
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: 600 }}>
              {suggestedQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => setInput(q)}
                  style={{
                    padding: "10px 16px",
                    background: "white",
                    border: "1px solid #E5E7EB",
                    borderRadius: 8,
                    fontSize: 14,
                    color: "#374151",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#7C3AED";
                    e.currentTarget.style.background = "#F5F3FF";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#E5E7EB";
                    e.currentTarget.style.background = "white";
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, index) => (
              <div
                key={index}
                style={{
                  display: "flex",
                  justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    maxWidth: "80%",
                    padding: "16px 20px",
                    borderRadius: 16,
                    background: msg.role === "user" ? "linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)" : "white",
                    color: msg.role === "user" ? "white" : "#111827",
                    boxShadow: msg.role === "assistant" ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
                    border: msg.role === "assistant" ? "1px solid #E5E7EB" : "none",
                  }}
                >
                  <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, fontSize: 15 }}>
                    {msg.content}
                  </div>

                  {/* Sources */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #E5E7EB" }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        📚 Sources
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {msg.sources.map((source, i) => (
                          <Link
                            key={i}
                            href={`/library/${encodeURIComponent(source.doc_id)}`}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "10px 14px",
                              background: "#F9FAFB",
                              borderRadius: 8,
                              textDecoration: "none",
                              color: "inherit",
                              fontSize: 13,
                              border: "1px solid #E5E7EB",
                              transition: "all 0.2s",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = "#7C3AED";
                              e.currentTarget.style.background = "#F5F3FF";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = "#E5E7EB";
                              e.currentTarget.style.background = "#F9FAFB";
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 600, color: "#111827" }}>{source.title}</div>
                              <div style={{ fontSize: 12, color: "#6B7280", fontFamily: "monospace" }}>
                                {source.doc_id}
                              </div>
                            </div>
                            <div
                              style={{
                                padding: "4px 10px",
                                background: "#EEF2FF",
                                color: "#4F46E5",
                                borderRadius: 6,
                                fontSize: 12,
                                fontWeight: 700,
                              }}
                            >
                              {source.relevance}%
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ fontSize: 11, color: msg.role === "user" ? "rgba(255,255,255,0.7)" : "#9CA3AF", marginTop: 8 }}>
                    {msg.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div
                  style={{
                    padding: "16px 20px",
                    borderRadius: 16,
                    background: "white",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                    border: "1px solid #E5E7EB",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div className="loading-dots">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                    <span style={{ color: "#6B7280", fontSize: 14 }}>Searching documents...</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            margin: "0 24px 16px",
            padding: 16,
            background: "#FEE2E2",
            borderRadius: 8,
            color: "#991B1B",
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}

      {/* Input */}
      <div
        style={{
          padding: "16px 24px 24px",
          background: "white",
          borderTop: "1px solid #E5E7EB",
        }}
      >
        <form onSubmit={handleSubmit} style={{ display: "flex", gap: 12 }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about your documents..."
            disabled={isLoading}
            rows={1}
            style={{
              flex: 1,
              padding: "14px 18px",
              borderRadius: 12,
              border: "2px solid #E5E7EB",
              fontSize: 15,
              resize: "none",
              outline: "none",
              transition: "border-color 0.2s",
              minHeight: 52,
              maxHeight: 150,
            }}
            onFocus={(e) => (e.target.style.borderColor = "#7C3AED")}
            onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="btn btn-primary"
            style={{
              padding: "14px 24px",
              fontSize: 15,
              fontWeight: 600,
              opacity: isLoading || !input.trim() ? 0.6 : 1,
              cursor: isLoading || !input.trim() ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {isLoading ? "..." : "Send →"}
          </button>
        </form>
        <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: 8, textAlign: "center" }}>
          Press Enter to send • Shift+Enter for new line
        </p>
      </div>

      <style jsx>{`
        .loading-dots {
          display: flex;
          gap: 4px;
        }
        .loading-dots span {
          width: 8px;
          height: 8px;
          background: #7C3AED;
          border-radius: 50%;
          animation: bounce 1.4s infinite ease-in-out both;
        }
        .loading-dots span:nth-child(1) {
          animation-delay: -0.32s;
        }
        .loading-dots span:nth-child(2) {
          animation-delay: -0.16s;
        }
        @keyframes bounce {
          0%, 80%, 100% {
            transform: scale(0);
          }
          40% {
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}