"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

interface Project {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  status: string;
}

interface Doc {
  doc_id: string;
  title: string;
  doc_type: string | null;
  doc_source: string | null;
  tags: string[] | null;
  summary: string | null;
  file_url: string | null;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: { doc_id: string; title: string }[];
}

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"docs" | "chat">("docs");
  const [showAddDocs, setShowAddDocs] = useState(false);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const fetchProject = async () => {
    try {
      const res = await fetch(`/api/projects?id=${projectId}`);
      const data = await res.json();
      if (res.ok) {
        setProject(data.project);
        setDocuments(data.documents || []);
      }
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchProject(); }, [projectId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleRemoveDoc = async (docId: string) => {
    if (!confirm("Remove this document from the project?")) return;
    try {
      await fetch("/api/projects", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, action: "remove-doc", docId }),
      });
      setDocuments(documents.filter(d => d.doc_id !== docId));
    } catch {}
  };

  const handleDeleteProject = async () => {
    if (!confirm("Delete this project? Documents won't be deleted, just unlinked.")) return;
    try {
      const res = await fetch(`/api/projects?id=${projectId}`, { method: "DELETE" });
      if (res.ok) router.push("/projects");
    } catch {}
  };

  const handleChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg: ChatMessage = { role: "user", content: chatInput.trim() };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await fetch("/api/projects/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          message: userMsg.content,
          history: chatMessages.slice(-10),
        }),
      });
      const data = await res.json();
      setChatMessages(prev => [...prev, {
        role: "assistant",
        content: data.reply || "Sorry, I couldn't process that.",
        sources: data.sources || [],
      }]);
    } catch {
      setChatMessages(prev => [...prev, { role: "assistant", content: "Failed to get response. Please try again." }]);
    } finally { setChatLoading(false); }
  };

  const getDocIcon = (doc: Doc) => {
    if (doc.doc_source === "note") return "📝";
    if (doc.doc_source === "url") return "🔗";
    if (doc.doc_source === "youtube") return "🎬";
    if (doc.doc_source === "template") return "📋";
    if (doc.file_url) return "📕";
    return "📄";
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#9CA3AF" }}>Loading project...</div>;
  if (!project) return <div style={{ padding: 40, textAlign: "center" }}>Project not found</div>;

  return (
    <div style={{ minHeight: "100vh", background: "#F9FAFB" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 20px" }}>
        {/* Breadcrumb */}
        <Link href="/projects" style={{ color: "#6B7280", textDecoration: "none", fontSize: 14, fontWeight: 500, marginBottom: 24, display: "inline-block" }}>
          ← Back to Projects
        </Link>

        {/* Project Header */}
        <div style={{
          padding: "28px 32px", background: "white", borderRadius: 12,
          border: "1px solid #E5E7EB", marginBottom: 24,
          borderTop: `3px solid ${project.color}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 36 }}>{project.icon}</span>
              <div>
                <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111827", margin: 0 }}>{project.name}</h1>
                {project.description && <p style={{ fontSize: 14, color: "#6B7280", margin: "4px 0 0 0" }}>{project.description}</p>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleDeleteProject} style={{
                padding: "8px 14px", borderRadius: 8, border: "1px solid #FCA5A5",
                background: "#FEE2E2", color: "#991B1B", fontSize: 13, fontWeight: 500, cursor: "pointer",
              }}>🗑️ Delete</button>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: "flex", gap: 24, marginTop: 16, fontSize: 14, color: "#6B7280" }}>
            <span>📄 {documents.length} documents</span>
            <span>💬 {chatMessages.filter(m => m.role === "user").length} messages</span>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
          {(["docs", "chat"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: "10px 20px", borderRadius: "8px 8px 0 0", border: "1px solid #E5E7EB",
              borderBottom: activeTab === tab ? "2px solid #7C3AED" : "1px solid #E5E7EB",
              background: activeTab === tab ? "white" : "#F9FAFB",
              color: activeTab === tab ? "#7C3AED" : "#6B7280",
              fontSize: 14, fontWeight: 600, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6,
            }}>
              {tab === "docs" ? "📄 Documents" : "🤖 AI Chat"}
              {tab === "docs" && documents.length > 0 && (
                <span style={{ padding: "1px 8px", background: "#EEF2FF", color: "#4F46E5", borderRadius: 10, fontSize: 12, fontWeight: 700 }}>
                  {documents.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Documents Tab */}
        {activeTab === "docs" && (
          <div style={{ background: "white", borderRadius: 12, border: "1px solid #E5E7EB", padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: 0 }}>Project Documents</h3>
              <button onClick={() => setShowAddDocs(true)} className="btn btn-primary"
                style={{ padding: "8px 16px", fontSize: 13, fontWeight: 600 }}>
                + Add Documents
              </button>
            </div>

            {documents.length === 0 && (
              <div style={{ padding: "40px 20px", textAlign: "center", color: "#9CA3AF" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
                <div style={{ fontSize: 15, marginBottom: 8 }}>No documents in this project yet</div>
                <div style={{ fontSize: 13 }}>Add existing documents to give the AI context about your project.</div>
              </div>
            )}

            {documents.map(d => (
              <div key={d.doc_id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 16px", borderRadius: 8, border: "1px solid #F3F4F6",
                marginBottom: 8, gap: 12,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 22 }}>{getDocIcon(d)}</span>
                  <div style={{ overflow: "hidden" }}>
                    <Link href={`/library/${encodeURIComponent(d.doc_id)}`}
                      style={{ fontWeight: 600, fontSize: 14, color: "#111827", textDecoration: "none" }}>
                      {d.title}
                    </Link>
                    <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>
                      {d.doc_id} • {d.doc_type || "document"}
                    </div>
                  </div>
                </div>
                <button onClick={() => handleRemoveDoc(d.doc_id)} style={{
                  padding: "4px 10px", borderRadius: 6, border: "1px solid #E5E7EB",
                  background: "white", fontSize: 12, color: "#6B7280", cursor: "pointer", flexShrink: 0,
                }}>Remove</button>
              </div>
            ))}
          </div>
        )}

        {/* AI Chat Tab */}
        {activeTab === "chat" && (
          <div style={{ background: "white", borderRadius: 12, border: "1px solid #E5E7EB", display: "flex", flexDirection: "column", height: "calc(100vh - 360px)", minHeight: 500 }}>
            {/* Chat messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
              {chatMessages.length === 0 && (
                <div style={{ textAlign: "center", padding: "60px 20px", color: "#9CA3AF" }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🤖</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Project AI Assistant</div>
                  <div style={{ fontSize: 14, maxWidth: 400, margin: "0 auto" }}>
                    I have context of all {documents.length} document(s) in this project. Ask me anything — summarize, analyze, compare, or generate insights.
                  </div>
                  {documents.length > 0 && (
                    <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 20, flexWrap: "wrap" }}>
                      {["Summarize all documents", "What are the key themes?", "Find connections between docs"].map(q => (
                        <button key={q} onClick={() => { setChatInput(q); }}
                          style={{
                            padding: "8px 14px", borderRadius: 8, border: "1px solid #E5E7EB",
                            background: "white", fontSize: 13, cursor: "pointer", color: "#374151",
                          }}>
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {chatMessages.map((msg, i) => (
                <div key={i} style={{
                  display: "flex", gap: 10, marginBottom: 16,
                  flexDirection: msg.role === "user" ? "row-reverse" : "row",
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                    background: msg.role === "user"
                      ? "linear-gradient(135deg, #7C3AED, #A78BFA)"
                      : "linear-gradient(135deg, #059669, #34D399)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "white", fontSize: 14,
                  }}>
                    {msg.role === "user" ? "👤" : "🤖"}
                  </div>
                  <div style={{
                    maxWidth: "75%", padding: "12px 16px", borderRadius: 12,
                    background: msg.role === "user" ? "#7C3AED" : "#F3F4F6",
                    color: msg.role === "user" ? "white" : "#111827",
                    fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap",
                  }}>
                    {msg.content}
                    {msg.sources && msg.sources.length > 0 && (
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(0,0,0,0.1)", fontSize: 12 }}>
                        Sources: {msg.sources.map((s, j) => (
                          <Link key={j} href={`/library/${encodeURIComponent(s.doc_id)}`}
                            style={{ color: msg.role === "user" ? "#E0E7FF" : "#4F46E5", textDecoration: "underline", marginRight: 8 }}>
                            {s.title}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {chatLoading && (
                <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                    background: "linear-gradient(135deg, #059669, #34D399)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "white", fontSize: 14,
                  }}>🤖</div>
                  <div style={{ padding: "12px 16px", borderRadius: 12, background: "#F3F4F6", color: "#9CA3AF", fontSize: 14 }}>
                    Thinking...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat input */}
            <div style={{ padding: "16px 24px", borderTop: "1px solid #E5E7EB" }}>
              <div style={{ display: "flex", gap: 10 }}>
                <input
                  type="text" value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={documents.length > 0 ? "Ask about your project documents..." : "Add documents first to chat with AI..."}
                  disabled={chatLoading || documents.length === 0}
                  onKeyDown={(e) => { if (e.key === "Enter") handleChat(); }}
                  style={{
                    flex: 1, padding: "12px 16px", border: "1px solid #D1D5DB",
                    borderRadius: 10, fontSize: 14, outline: "none",
                    opacity: documents.length === 0 ? 0.5 : 1,
                  }}
                />
                <button onClick={handleChat} disabled={!chatInput.trim() || chatLoading || documents.length === 0}
                  style={{
                    padding: "12px 20px", borderRadius: 10, border: "none",
                    background: !chatInput.trim() || chatLoading ? "#D1D5DB" : "#7C3AED",
                    color: "white", fontSize: 14, fontWeight: 600, cursor: "pointer",
                  }}>
                  Send
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Documents Modal */}
      {showAddDocs && (
        <AddDocsModal
          projectId={projectId}
          existingDocIds={documents.map(d => d.doc_id)}
          onClose={() => setShowAddDocs(false)}
          onAdded={() => { setShowAddDocs(false); fetchProject(); }}
        />
      )}
    </div>
  );
}

// ── Add Documents Modal ──
function AddDocsModal({ projectId, existingDocIds, onClose, onAdded }: {
  projectId: string; existingDocIds: string[]; onClose: () => void; onAdded: () => void;
}) {
  const [allDocs, setAllDocs] = useState<Doc[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/learning-summary")
      .then(r => r.json())
      .then(d => setAllDocs((d.documents || []).filter((doc: any) => !existingDocIds.includes(doc.doc_id))))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = allDocs.filter(d =>
    d.title.toLowerCase().includes(search.toLowerCase()) ||
    d.doc_id.toLowerCase().includes(search.toLowerCase())
  );

  const toggleDoc = (docId: string) => {
    setSelected(prev => prev.includes(docId) ? prev.filter(id => id !== docId) : [...prev, docId]);
  };

  const handleAdd = async () => {
    if (selected.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/projects", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, action: "add-docs", docIds: selected }),
      });
      if (res.ok) onAdded();
    } catch {} finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "white", borderRadius: 16, padding: 32, width: "100%", maxWidth: 560,
        maxHeight: "80vh", display: "flex", flexDirection: "column",
        boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
      }}>
        <h3 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 16px 0" }}>Add Documents to Project</h3>

        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search documents..." autoFocus
          style={{ width: "100%", padding: "10px 14px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 14, outline: "none", marginBottom: 12 }} />

        <div style={{ flex: 1, overflowY: "auto", marginBottom: 16 }}>
          {loading && <div style={{ padding: 20, textAlign: "center", color: "#9CA3AF" }}>Loading...</div>}

          {!loading && filtered.length === 0 && (
            <div style={{ padding: 20, textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>
              {allDocs.length === 0 ? "All documents are already in this project" : "No matching documents"}
            </div>
          )}

          {filtered.map(d => (
            <div key={d.doc_id} onClick={() => toggleDoc(d.doc_id)} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
              borderRadius: 8, cursor: "pointer", marginBottom: 4,
              background: selected.includes(d.doc_id) ? "#F5F3FF" : "white",
              border: selected.includes(d.doc_id) ? "1px solid #7C3AED" : "1px solid #F3F4F6",
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: 4, flexShrink: 0,
                border: selected.includes(d.doc_id) ? "none" : "2px solid #D1D5DB",
                background: selected.includes(d.doc_id) ? "#7C3AED" : "white",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "white", fontSize: 12,
              }}>
                {selected.includes(d.doc_id) && "✓"}
              </div>
              <div style={{ overflow: "hidden", flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.title}</div>
                <div style={{ fontSize: 12, color: "#9CA3AF" }}>{d.doc_id}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "#6B7280" }}>{selected.length} selected</span>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid #D1D5DB", background: "white", fontSize: 14, cursor: "pointer", fontWeight: 500 }}>Cancel</button>
            <button onClick={handleAdd} disabled={selected.length === 0 || saving}
              style={{
                padding: "10px 20px", borderRadius: 8, border: "none",
                background: selected.length === 0 ? "#D1D5DB" : "#7C3AED",
                color: "white", fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}>
              {saving ? "Adding..." : `Add ${selected.length} doc(s)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
