"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import UserMenu from "@/components/UserMenu";
import { useAuth } from "@/lib/AuthContext";

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

export default function SearchPage() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [docType, setDocType] = useState("");
  const [domain, setDomain] = useState("");
  const [maturity, setMaturity] = useState("");
  const [status, setStatus] = useState("");
  const [tag, setTag] = useState("");
  const [results, setResults] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [facets, setFacets] = useState<Facets | null>(null);
  const [searchMode, setSearchMode] = useState<"keyword" | "semantic" | "hybrid">("hybrid");

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

  async function handleSearch() {
    setErr("");
    setLoading(true);
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

      // Log search event
      try {
        await fetch("/api/search-log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event_type: "search",
            user_email: user?.email || null,
            query: q.trim(),
            filters: {
              doc_type: docType || null,
              domain: domain || null,
              ai_maturity_stage: maturity || null,
              status: status || null,
              tag: tag || null,
              mode: searchMode,
            },
            results_count: (data.results ?? []).length,
          }),
        });
      } catch (logErr) {
        console.error("Failed to log search:", logErr);
      }
    } catch (e: any) {
      setErr(e?.message || "Error");
    } finally {
      setLoading(false);
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
          filters: {
            doc_type: docType || null,
            domain: domain || null,
            ai_maturity_stage: maturity || null,
            status: status || null,
            tag: tag || null,
            mode: searchMode,
          },
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
      <main className="container">
        <header style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: "linear-gradient(135deg, #10b981 0%, #3b82f6 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 20,
                  }}
                >
                  🔍
                </div>
                <h1 style={{ margin: 0 }}>Search</h1>
              </div>
              <p style={{ color: "var(--text-secondary)", margin: 0 }}>
                Search by keywords or use AI to search by meaning
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <Link href="/" className="btn">
                ← Library
              </Link>
              <UserMenu />
            </div>
          </div>
        </header>

        <div className="card" style={{ marginBottom: 24 }}>
          {/* Search Mode Toggle */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>
              Search Mode
            </label>
            <div
              style={{
                display: "inline-flex",
                borderRadius: 10,
                overflow: "hidden",
                border: "1px solid var(--border-color)",
              }}
            >
              <button
                onClick={() => setSearchMode("hybrid")}
                style={{
                  padding: "10px 20px",
                  fontSize: 14,
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: searchMode === "hybrid"
                    ? "linear-gradient(135deg, #7C3AED, #3B82F6)"
                    : "var(--bg-secondary)",
                  color: searchMode === "hybrid"
                    ? "white"
                    : "var(--text-secondary)",
                  transition: "all 0.2s",
                }}
              >
                🔀 Hybrid
              </button>
              <button
                onClick={() => setSearchMode("keyword")}
                style={{
                  padding: "10px 20px",
                  fontSize: 14,
                  fontWeight: 600,
                  border: "none",
                  borderLeft: "1px solid var(--border-color)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: searchMode === "keyword"
                    ? "var(--accent-blue)"
                    : "var(--bg-secondary)",
                  color: searchMode === "keyword"
                    ? "white"
                    : "var(--text-secondary)",
                  transition: "all 0.2s",
                }}
              >
                🔤 Keyword
              </button>
              <button
                onClick={() => setSearchMode("semantic")}
                style={{
                  padding: "10px 20px",
                  fontSize: 14,
                  fontWeight: 600,
                  border: "none",
                  borderLeft: "1px solid var(--border-color)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: searchMode === "semantic"
                    ? "linear-gradient(135deg, #7C3AED, #6366F1)"
                    : "var(--bg-secondary)",
                  color: searchMode === "semantic"
                    ? "white"
                    : "var(--text-secondary)",
                  transition: "all 0.2s",
                }}
              >
                🧠 Semantic
              </button>
            </div>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6, marginBottom: 0 }}>
              {searchMode === "hybrid"
                ? "Combines keyword matching + AI meaning for the best results (recommended)"
                : searchMode === "semantic"
                ? "AI search finds documents by meaning — \"keeping clients happy\" finds docs about \"customer retention\""
                : "Keyword search finds exact text matches in document titles and content"}
            </p>
          </div>

          {/* Text search */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>
              {searchMode === "keyword" ? "Search text" : "Describe what you're looking for"}
            </label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={
                searchMode === "keyword"
                  ? "e.g., performance evidence"
                  : "e.g., how do we keep clients happy and engaged?"
              }
              style={{ width: "100%" }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch();
              }}
            />
          </div>

          {/* Dropdown filters */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>
                Doc Type
              </label>
              <select value={docType} onChange={(e) => setDocType(e.target.value)} style={selectStyle}>
                <option value="">All types</option>
                {(facets?.doc_types ?? []).map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>
                Domain
              </label>
              <select value={domain} onChange={(e) => setDomain(e.target.value)} style={selectStyle}>
                <option value="">All domains</option>
                {(facets?.domains ?? []).map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>
                AI Maturity
              </label>
              <select value={maturity} onChange={(e) => setMaturity(e.target.value)} style={selectStyle}>
                <option value="">All stages</option>
                {(facets?.ai_maturity_stages ?? []).map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>
                Status
              </label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} style={selectStyle}>
                <option value="">All statuses</option>
                {(facets?.statuses ?? []).map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>
                Tag
              </label>
              <input
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="e.g., discovery"
                style={{ width: 140 }}
              />
            </div>
          </div>

          {/* Quick tags */}
          {facets?.top_tags && facets.top_tags.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)", marginRight: 8 }}>Quick tags:</span>
              {facets.top_tags.slice(0, 8).map((t) => (
                <button
                  key={t.tag}
                  onClick={() => setTag(t.tag)}
                  className="btn"
                  style={{ marginRight: 6, marginBottom: 6, padding: "4px 8px", fontSize: 12 }}
                >
                  {t.tag}
                </button>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button onClick={handleSearch} className="btn btn-primary">
              {searchMode === "hybrid" ? "🔀 Hybrid Search →" : searchMode === "semantic" ? "🧠 AI Search →" : "Search →"}
            </button>
            <button onClick={handleClear} className="btn">
              Clear
            </button>
            {loading && (
              <span style={{ color: "var(--text-muted)" }}>
                {searchMode === "hybrid" ? "🔀 Running hybrid search…" : searchMode === "semantic" ? "🧠 AI searching by meaning…" : "Searching…"}
              </span>
            )}
            {err && <span style={{ color: "var(--accent-red)" }}>{err}</span>}
          </div>

          <p style={{ marginTop: 12, marginBottom: 0, fontSize: 12, color: "var(--text-muted)" }}>
            {searchMode === "hybrid"
              ? "Tip: Hybrid combines exact keyword matching with AI meaning analysis for the best results."
              : searchMode === "semantic"
              ? "Tip: Use natural language — describe what you need instead of exact keywords."
              : "Tip: Filters work even without a text query. Press Enter to search."}
          </p>
        </div>

        <h2 style={{ fontSize: 18, marginBottom: 16 }}>
          Results {results.length > 0 ? "(" + results.length + ")" : ""}
        </h2>

        {results.length === 0 && !loading && !err && (
          <div className="card" style={{ textAlign: "center", padding: 40 }}>
            <p style={{ color: "var(--text-muted)", margin: 0 }}>
              No results yet. Enter a search query or apply filters.
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
                    {/* Semantic/Hybrid relevance badge */}
                    {(r.search_mode === "semantic" || r.search_mode === "hybrid") && r.score > 0 && (
                      <span
                        style={{
                          padding: "4px 10px",
                          background: r.score >= 60
                            ? r.search_mode === "hybrid"
                              ? "linear-gradient(135deg, #7C3AED, #3B82F6)"
                              : "linear-gradient(135deg, #7C3AED, #6366F1)"
                            : r.score >= 40
                            ? "#EEF2FF"
                            : "#F3F4F6",
                          color: r.score >= 60 ? "white" : r.score >= 40 ? "#4F46E5" : "#6B7280",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
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
                  <button onClick={() => handleResultClick(r, index)} className="btn">
                    View →
                  </button>
                  {r.source_url && (
                    <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="btn">
                      Open Source ↗
                    </a>
                  )}
                </div>
              </div>

              {/* Why this matched */}
              {Array.isArray(r.why_matched) && r.why_matched.length > 0 && (
                <div
                  style={{
                    marginBottom: 8,
                    fontSize: 13,
                    color: r.search_mode === "hybrid" ? "#6D28D9" : r.search_mode === "semantic" ? "#7C3AED" : "var(--accent-blue)",
                  }}
                >
                  {r.search_mode === "hybrid" ? "🔀 " : r.search_mode === "semantic" ? "🧠 " : ""}
                  Why matched: {r.why_matched.slice(0, 4).join(" • ")}
                </div>
              )}

              {/* Section context */}
              {(r.section_title || r.section_path) && (
                <div style={{ marginBottom: 8, fontSize: 13, color: "var(--text-muted)" }}>
                  Match in: <strong>{r.section_title || "—"}</strong>
                  {r.section_path && r.section_path !== r.section_title && (
                    <span style={{ opacity: 0.75 }}> • {r.section_path}</span>
                  )}
                </div>
              )}

              {r.snippet && (
                <div
                  style={{
                    background: "var(--bg-secondary)",
                    borderRadius: "var(--radius-sm)",
                    padding: 12,
                    fontSize: 14,
                    color: "var(--text-secondary)",
                  }}
                >
                  {r.snippet}
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </ProtectedRoute>
  );
}