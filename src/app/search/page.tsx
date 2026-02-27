"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import UserMenu from "@/components/UserMenu";
import { useAuth } from "@/lib/AuthContext";

// ── Types ──────────────────────────────────────────────

type ResultRow = {
  doc_id: string;
  title: string;
  version: string;
  doc_type: string | null;
  domain: string | null;
  ai_maturity_stage: string | null;
  tags: string[];
  status: string | null;
  source_url: string | null;
  score: number;
  snippet: string;
  section_title?: string;
  section_path?: string;
  why_matched?: string[];
  search_mode?: string;
};

type Facets = {
  doc_types: string[];
  domains: string[];
  ai_maturity_stages: string[];
  statuses: string[];
  top_tags: { tag: string; count: number }[];
};

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

// ── Main Component ─────────────────────────────────────

export default function UnifiedSearchPage() {
  const { user } = useAuth();

  // Mode: "search" or "ask"
  const [mode, setMode] = useState<"search" | "ask">("search");

  // ── Search state ──
  const [q, setQ] = useState("");
  const [docType, setDocType] = useState("");
  const [domain, setDomain] = useState("");
  const [maturity, setMaturity] = useState("");
  const [status, setStatus] = useState("");
  const [tag, setTag] = useState("");
  const [results, setResults] = useState<ResultRow[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchErr, setSearchErr] = useState("");
  const [facets, setFacets] = useState<Facets | null>(null);
  const [searchMode, setSearchMode] = useState<"keyword" | "semantic" | "hybrid">("hybrid");
  const [showFilters, setShowFilters] = useState(false);

  // ── Chat state ──
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  // Load facets on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/facets");
        const data = await res.json();
        if (res.ok) setFacets(data);
      } catch (e) {
        console.error("Failed to load facets:", e);
      }
    })();
  }, []);

  // Scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Focus chat input when switching to ask mode
  useEffect(() => {
    if (mode === "ask") {
      setTimeout(() => chatInputRef.current?.focus(), 100);
    }
  }, [mode]);

  // ── Search handlers ──

  async function handleSearch() {
    setSearchErr("");
    setSearchLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (docType.trim()) params.set("doc_type", docType.trim());
      if (domain.trim()) params.set("domain", domain.trim());
      if (maturity.trim()) params.set("ai_maturity_stage", maturity.trim());
      if (status.trim()) params.set("status", status.trim());
      if (tag.trim()) params.set("tag", tag.trim());
      params.set("mode", searchMode);

      const res = await fetch("/api/search?" + params.toString());
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Search failed");
      setResults(data.results || []);

      // Log search
      try {
        await fetch("/api/search-log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event_type: "search",
            user_email: user?.email || null,
            query: q.trim(),
            filters: { doc_type: docType || null, domain: domain || null, ai_maturity_stage: maturity || null, status: status || null, tag: tag || null, mode: searchMode },
            results_count: (data.results ?? []).length,
          }),
        });
      } catch (logErr) {
        console.error("Failed to log search:", logErr);
      }
    } catch (e: any) {
      setSearchErr(e?.message || "Error");
    } finally {
      setSearchLoading(false);
    }
  }

  function handleClear() {
    setQ("");
    setDocType("");
    setDomain("");
    setMaturity("");
    setStatus("");
    setTag("");
    setResults([]);
  }

  async function handleResultClick(r: ResultRow, index: number) {
    try {
      await fetch("/api/search-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_type: "search_click",
          user_email: user?.email || null,
          query: q.trim(),
          filters: { doc_type: docType || null, domain: domain || null, ai_maturity_stage: maturity || null, status: status || null, tag: tag || null, mode: searchMode },
          clicked_doc_id: r.doc_id,
          clicked_version: r.version,
          clicked_section_title: r.section_title || null,
          clicked_section_path: r.section_path || null,
          clicked_rank: index + 1,
        }),
      });
    } catch (logErr) {
      console.error("Failed to log click:", logErr);
    }
    window.location.href = "/library/" + encodeURIComponent(r.doc_id);
  }

  // ── Chat handlers ──

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userMessage = chatInput.trim();
    setChatInput("");
    setChatError("");

    const newUserMessage: ChatMessage = {
      role: "user",
      content: userMessage,
      timestamp: new Date(),
    };
    setChatMessages((prev) => [...prev, newUserMessage]);
    setChatLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          conversationHistory: chatMessages.map((m) => ({
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
      setChatMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setChatLoading(false);
      chatInputRef.current?.focus();
    }
  };

  const handleChatKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleChatSubmit(e);
    }
  };

  const suggestedQuestions = [
    "What documents do we have about sales?",
    "How do we engage with clients?",
    "What is our pitch narrative?",
    "Summarize our key strategies",
  ];

  const selectStyle: React.CSSProperties = {
    padding: "10px 12px",
    borderRadius: "var(--radius-md)",
    border: "1px solid var(--border-color)",
    background: "var(--bg-secondary)",
    color: "var(--text-primary)",
    fontSize: 14,
    minWidth: 140,
  };

  return (
    <ProtectedRoute>
      <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#F9FAFB" }}>

        {/* ═══ HEADER ═══ */}
        <div style={{
          padding: "16px 24px",
          background: "white",
          borderBottom: "1px solid #E5E7EB",
          flexShrink: 0,
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            maxWidth: 1000,
            margin: "0 auto",
            gap: 16,
            flexWrap: "wrap",
          }}>
            {/* Left: Icon + Title */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: mode === "ask"
                  ? "linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)"
                  : "linear-gradient(135deg, #10b981 0%, #3b82f6 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20, transition: "background 0.3s",
              }}>
                {mode === "ask" ? "🤖" : "🔍"}
              </div>
              <div>
                <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "#111827" }}>
                  {mode === "ask" ? "AI Assistant" : "Search"}
                </h1>
                <p style={{ fontSize: 13, color: "#6B7280", margin: 0 }}>
                  {mode === "ask" ? "Ask questions about your knowledge base" : "Find documents by keyword or meaning"}
                </p>
              </div>
            </div>

            {/* Center: Mode Toggle */}
            <div style={{
              display: "inline-flex",
              borderRadius: 10,
              overflow: "hidden",
              border: "2px solid #E5E7EB",
              background: "#F3F4F6",
            }}>
              <button
                onClick={() => setMode("search")}
                style={{
                  padding: "10px 24px",
                  fontSize: 14,
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: mode === "search" ? "white" : "transparent",
                  color: mode === "search" ? "#111827" : "#6B7280",
                  boxShadow: mode === "search" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  transition: "all 0.2s",
                }}
              >
                🔍 Find Docs
              </button>
              <button
                onClick={() => setMode("ask")}
                style={{
                  padding: "10px 24px",
                  fontSize: 14,
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: mode === "ask" ? "white" : "transparent",
                  color: mode === "ask" ? "#111827" : "#6B7280",
                  boxShadow: mode === "ask" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  transition: "all 0.2s",
                }}
              >
                🤖 Ask AI
              </button>
            </div>

            {/* Right: Navigation */}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Link href="/library" className="btn">📚 Library</Link>
              <Link href="/ai-graph" className="btn">🧠 Graph</Link>
              <UserMenu />
            </div>
          </div>
        </div>

        {/* ═══ SEARCH MODE ═══ */}
        {mode === "search" && (
          <div style={{ flex: 1, overflow: "auto", padding: "24px" }}>
            <div style={{ maxWidth: 1000, margin: "0 auto" }}>

              {/* Search Card */}
              <div className="card" style={{ marginBottom: 24 }}>
                {/* Search Mode Toggle */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{
                    display: "inline-flex",
                    borderRadius: 10,
                    overflow: "hidden",
                    border: "1px solid var(--border-color)",
                  }}>
                    <button
                      onClick={() => setSearchMode("hybrid")}
                      style={{
                        padding: "10px 20px", fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 6,
                        background: searchMode === "hybrid" ? "linear-gradient(135deg, #7C3AED, #3B82F6)" : "var(--bg-secondary)",
                        color: searchMode === "hybrid" ? "white" : "var(--text-secondary)",
                        transition: "all 0.2s",
                      }}
                    >
                      🔀 Hybrid
                    </button>
                    <button
                      onClick={() => setSearchMode("keyword")}
                      style={{
                        padding: "10px 20px", fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer",
                        borderLeft: "1px solid var(--border-color)",
                        display: "flex", alignItems: "center", gap: 6,
                        background: searchMode === "keyword" ? "var(--accent-blue)" : "var(--bg-secondary)",
                        color: searchMode === "keyword" ? "white" : "var(--text-secondary)",
                        transition: "all 0.2s",
                      }}
                    >
                      🔤 Keyword
                    </button>
                    <button
                      onClick={() => setSearchMode("semantic")}
                      style={{
                        padding: "10px 20px", fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer",
                        borderLeft: "1px solid var(--border-color)",
                        display: "flex", alignItems: "center", gap: 6,
                        background: searchMode === "semantic" ? "linear-gradient(135deg, #7C3AED, #6366F1)" : "var(--bg-secondary)",
                        color: searchMode === "semantic" ? "white" : "var(--text-secondary)",
                        transition: "all 0.2s",
                      }}
                    >
                      🧠 Semantic
                    </button>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6, marginBottom: 0 }}>
                    {searchMode === "hybrid"
                      ? "Combines keyword matching + AI meaning for the best results"
                      : searchMode === "semantic"
                      ? "AI finds documents by meaning — \"keeping clients happy\" finds \"customer retention\" docs"
                      : "Finds exact text matches in document titles and content"}
                  </p>
                </div>

                {/* Search Input */}
                <div style={{ marginBottom: 16 }}>
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder={
                      searchMode === "keyword"
                        ? "e.g., performance evidence"
                        : "e.g., how do we keep clients happy and engaged?"
                    }
                    style={{ width: "100%", padding: "12px 16px", fontSize: 15 }}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                  />
                </div>

                {/* Toggle Filters */}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: 13, color: "var(--text-muted)", marginBottom: showFilters ? 16 : 0,
                    display: "flex", alignItems: "center", gap: 4,
                  }}
                >
                  {showFilters ? "▾ Hide filters" : "▸ Show filters"} ({[docType, domain, maturity, status, tag].filter(Boolean).length} active)
                </button>

                {/* Filters */}
                {showFilters && (
                  <>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>Doc Type</label>
                        <select value={docType} onChange={(e) => setDocType(e.target.value)} style={selectStyle}>
                          <option value="">All types</option>
                          {(facets?.doc_types ?? []).map((v) => (<option key={v} value={v}>{v}</option>))}
                        </select>
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>Domain</label>
                        <select value={domain} onChange={(e) => setDomain(e.target.value)} style={selectStyle}>
                          <option value="">All domains</option>
                          {(facets?.domains ?? []).map((v) => (<option key={v} value={v}>{v}</option>))}
                        </select>
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>AI Maturity</label>
                        <select value={maturity} onChange={(e) => setMaturity(e.target.value)} style={selectStyle}>
                          <option value="">All stages</option>
                          {(facets?.ai_maturity_stages ?? []).map((v) => (<option key={v} value={v}>{v}</option>))}
                        </select>
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>Status</label>
                        <select value={status} onChange={(e) => setStatus(e.target.value)} style={selectStyle}>
                          <option value="">All statuses</option>
                          {(facets?.statuses ?? []).map((v) => (<option key={v} value={v}>{v}</option>))}
                        </select>
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>Tag</label>
                        <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="e.g., discovery" style={{ width: 140 }} />
                      </div>
                    </div>

                    {/* Quick tags */}
                    {facets?.top_tags && facets.top_tags.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <span style={{ fontSize: 12, color: "var(--text-muted)", marginRight: 8 }}>Quick tags:</span>
                        {facets.top_tags.slice(0, 8).map((t) => (
                          <button key={t.tag} onClick={() => setTag(t.tag)} className="btn" style={{ marginRight: 6, marginBottom: 6, padding: "4px 8px", fontSize: 12 }}>
                            {t.tag}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* Actions */}
                <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 16 }}>
                  <button onClick={handleSearch} className="btn btn-primary">
                    {searchMode === "hybrid" ? "🔀 Hybrid Search →" : searchMode === "semantic" ? "🧠 AI Search →" : "Search →"}
                  </button>
                  <button onClick={handleClear} className="btn">Clear</button>
                  {searchLoading && (
                    <span style={{ color: "var(--text-muted)" }}>
                      {searchMode === "hybrid" ? "🔀 Running hybrid search…" : searchMode === "semantic" ? "🧠 AI searching…" : "Searching…"}
                    </span>
                  )}
                  {searchErr && <span style={{ color: "var(--accent-red)" }}>{searchErr}</span>}
                </div>
              </div>

              {/* Results */}
              <h2 style={{ fontSize: 18, marginBottom: 16 }}>
                Results {results.length > 0 ? "(" + results.length + ")" : ""}
              </h2>

              {results.length === 0 && !searchLoading && !searchErr && (
                <div className="card" style={{ textAlign: "center", padding: 40 }}>
                  <p style={{ color: "var(--text-muted)", margin: 0 }}>
                    No results yet. Enter a search query or apply filters.
                  </p>
                  <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 8, marginBottom: 0 }}>
                    Or switch to <button onClick={() => setMode("ask")} style={{ background: "none", border: "none", color: "#7C3AED", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>🤖 Ask AI</button> to get answers with citations.
                  </p>
                </div>
              )}

              <div style={{ display: "grid", gap: 16 }}>
                {results.map((r, index) => (
                  <div key={r.doc_id + "-" + r.version} className="card">
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
                      <div>
                        <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>{r.title}</h3>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                          <span className="badge mono">{r.doc_id}</span>
                          <span className="badge">{r.version}</span>
                          {r.doc_type && <span className="badge">{r.doc_type}</span>}
                          {r.domain && <span className="badge">{r.domain}</span>}
                          {r.ai_maturity_stage && <span className="badge">{r.ai_maturity_stage}</span>}
                          {(r.search_mode === "semantic" || r.search_mode === "hybrid") && r.score > 0 && (
                            <span style={{
                              padding: "4px 10px",
                              background: r.score >= 60
                                ? r.search_mode === "hybrid" ? "linear-gradient(135deg, #7C3AED, #3B82F6)" : "linear-gradient(135deg, #7C3AED, #6366F1)"
                                : r.score >= 40 ? "#EEF2FF" : "#F3F4F6",
                              color: r.score >= 60 ? "white" : r.score >= 40 ? "#4F46E5" : "#6B7280",
                              borderRadius: 6, fontSize: 12, fontWeight: 700,
                            }}>
                              {r.search_mode === "hybrid" ? "🔀" : "🧠"} {r.score}% match
                            </span>
                          )}
                        </div>
                        {r.tags && r.tags.length > 0 && (
                          <div style={{ marginTop: 8, fontSize: 13, color: "var(--text-muted)" }}>
                            Tags: {r.tags.join(", ")}
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => handleResultClick(r, index)} className="btn">View →</button>
                        {r.source_url && (
                          <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="btn">Open Source ↗</a>
                        )}
                      </div>
                    </div>

                    {Array.isArray(r.why_matched) && r.why_matched.length > 0 && (
                      <div style={{
                        marginBottom: 8, fontSize: 13,
                        color: r.search_mode === "hybrid" ? "#6D28D9" : r.search_mode === "semantic" ? "#7C3AED" : "var(--accent-blue)",
                      }}>
                        {r.search_mode === "hybrid" ? "🔀 " : r.search_mode === "semantic" ? "🧠 " : ""}
                        Why matched: {r.why_matched.slice(0, 4).join(" • ")}
                      </div>
                    )}

                    {(r.section_title || r.section_path) && (
                      <div style={{ marginBottom: 8, fontSize: 13, color: "var(--text-muted)" }}>
                        Match in: <strong>{r.section_title || "—"}</strong>
                        {r.section_path && r.section_path !== r.section_title && (
                          <span style={{ opacity: 0.75 }}> • {r.section_path}</span>
                        )}
                      </div>
                    )}

                    {r.snippet && (
                      <div style={{
                        background: "var(--bg-secondary)",
                        borderRadius: "var(--radius-sm)",
                        padding: 12, fontSize: 14, color: "var(--text-secondary)",
                      }}>
                        {r.snippet}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══ ASK AI MODE ═══ */}
        {mode === "ask" && (
          <>
            {/* Chat Messages */}
            <div style={{
              flex: 1, overflow: "auto", padding: "24px",
              display: "flex", flexDirection: "column", gap: 16,
            }}>
              <div style={{ maxWidth: 1000, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
                {chatMessages.length === 0 ? (
                  <div style={{
                    flex: 1, display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    textAlign: "center", padding: 40,
                  }}>
                    <div style={{ fontSize: 64, marginBottom: 24 }}>🤖</div>
                    <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: "#111827" }}>
                      Ask me anything about your documents
                    </h2>
                    <p style={{ fontSize: 15, color: "#6B7280", marginBottom: 32, maxWidth: 500 }}>
                      I can search through your knowledge base and provide answers with citations.
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: 600 }}>
                      {suggestedQuestions.map((sq, i) => (
                        <button
                          key={i}
                          onClick={() => setChatInput(sq)}
                          style={{
                            padding: "10px 16px", background: "white", border: "1px solid #E5E7EB",
                            borderRadius: 8, fontSize: 14, color: "#374151", cursor: "pointer", transition: "all 0.2s",
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#7C3AED"; e.currentTarget.style.background = "#F5F3FF"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.background = "white"; }}
                        >
                          {sq}
                        </button>
                      ))}
                    </div>
                    <p style={{ marginTop: 24, fontSize: 13, color: "#9CA3AF" }}>
                      Or switch to <button onClick={() => setMode("search")} style={{ background: "none", border: "none", color: "#7C3AED", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>🔍 Find Docs</button> to browse and filter documents.
                    </p>
                  </div>
                ) : (
                  <>
                    {chatMessages.map((msg, index) => (
                      <div key={index} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                        <div style={{
                          maxWidth: "80%", padding: "16px 20px", borderRadius: 16,
                          background: msg.role === "user" ? "linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)" : "white",
                          color: msg.role === "user" ? "white" : "#111827",
                          boxShadow: msg.role === "assistant" ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
                          border: msg.role === "assistant" ? "1px solid #E5E7EB" : "none",
                        }}>
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
                                      display: "flex", alignItems: "center", justifyContent: "space-between",
                                      padding: "10px 14px", background: "#F9FAFB", borderRadius: 8,
                                      textDecoration: "none", color: "inherit", fontSize: 13,
                                      border: "1px solid #E5E7EB", transition: "all 0.2s",
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#7C3AED"; e.currentTarget.style.background = "#F5F3FF"; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.background = "#F9FAFB"; }}
                                  >
                                    <div>
                                      <div style={{ fontWeight: 600, color: "#111827" }}>{source.title}</div>
                                      <div style={{ fontSize: 12, color: "#6B7280", fontFamily: "monospace" }}>{source.doc_id}</div>
                                    </div>
                                    <div style={{
                                      padding: "4px 10px", background: "#EEF2FF",
                                      color: "#4F46E5", borderRadius: 6, fontSize: 12, fontWeight: 700,
                                    }}>
                                      {source.relevance}%
                                    </div>
                                  </Link>
                                ))}
                              </div>
                            </div>
                          )}

                          <div style={{
                            fontSize: 11,
                            color: msg.role === "user" ? "rgba(255,255,255,0.7)" : "#9CA3AF",
                            marginTop: 8,
                          }}>
                            {msg.timestamp.toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    ))}

                    {chatLoading && (
                      <div style={{ display: "flex", justifyContent: "flex-start" }}>
                        <div style={{
                          padding: "16px 20px", borderRadius: 16, background: "white",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.08)", border: "1px solid #E5E7EB",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div className="loading-dots"><span></span><span></span><span></span></div>
                            <span style={{ color: "#6B7280", fontSize: 14 }}>Searching documents...</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Chat Error */}
            {chatError && (
              <div style={{
                margin: "0 24px 16px", padding: 16, background: "#FEE2E2",
                borderRadius: 8, color: "#991B1B", fontSize: 14, maxWidth: 1000, marginLeft: "auto", marginRight: "auto",
              }}>
                {chatError}
              </div>
            )}

            {/* Chat Input */}
            <div style={{ padding: "16px 24px 24px", background: "white", borderTop: "1px solid #E5E7EB", flexShrink: 0 }}>
              <form onSubmit={handleChatSubmit} style={{ display: "flex", gap: 12, maxWidth: 1000, margin: "0 auto" }}>
                <textarea
                  ref={chatInputRef}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={handleChatKeyDown}
                  placeholder="Ask a question about your documents..."
                  disabled={chatLoading}
                  rows={1}
                  style={{
                    flex: 1, padding: "14px 18px", borderRadius: 12,
                    border: "2px solid #E5E7EB", fontSize: 15, resize: "none",
                    outline: "none", transition: "border-color 0.2s",
                    minHeight: 52, maxHeight: 150,
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#7C3AED")}
                  onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
                />
                <button
                  type="submit"
                  disabled={chatLoading || !chatInput.trim()}
                  className="btn btn-primary"
                  style={{
                    padding: "14px 24px", fontSize: 15, fontWeight: 600,
                    opacity: chatLoading || !chatInput.trim() ? 0.6 : 1,
                    cursor: chatLoading || !chatInput.trim() ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", gap: 8,
                  }}
                >
                  {chatLoading ? "..." : "Send →"}
                </button>
              </form>
              <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: 8, textAlign: "center" }}>
                Press Enter to send • Shift+Enter for new line
              </p>
            </div>
          </>
        )}

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
          .loading-dots span:nth-child(1) { animation-delay: -0.32s; }
          .loading-dots span:nth-child(2) { animation-delay: -0.16s; }
          @keyframes bounce {
            0%, 80%, 100% { transform: scale(0); }
            40% { transform: scale(1); }
          }
        `}</style>
      </div>
    </ProtectedRoute>
  );
}
