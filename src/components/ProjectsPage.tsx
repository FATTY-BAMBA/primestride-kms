"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Project {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  status: string;
  doc_count: number;
  created_at: string;
  updated_at: string;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      setProjects(data.projects || []);
      setUserRole(data.user_role || "");
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchProjects(); }, []);

  const isAdmin = ["owner", "admin"].includes(userRole);

  const formatDate = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <div style={{ minHeight: "100vh", background: "#F9FAFB", paddingBottom: 60 }}>
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 20px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: "#111827", marginBottom: 4 }}>Projects</h1>
            <p style={{ fontSize: 15, color: "#6B7280" }}>Scoped AI workspaces for focused collaboration</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowCreate(true)}
              className="btn btn-primary"
              style={{ padding: "10px 20px", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}
            >
              + New Project
            </button>
          )}
        </div>

        {loading && (
          <div style={{ padding: 40, textAlign: "center", color: "#9CA3AF" }}>Loading projects...</div>
        )}

        {!loading && projects.length === 0 && (
          <div style={{
            padding: "60px 40px", textAlign: "center", background: "white",
            borderRadius: 12, border: "1px solid #E5E7EB",
          }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🎯</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#111827", marginBottom: 8 }}>No projects yet</div>
            <div style={{ fontSize: 15, color: "#6B7280", marginBottom: 24, maxWidth: 400, margin: "0 auto 24px" }}>
              Projects are focused workspaces where you group related documents and chat with AI that understands your full context.
            </div>
            {isAdmin && (
              <button onClick={() => setShowCreate(true)} className="btn btn-primary"
                style={{ padding: "12px 24px", fontSize: 15, fontWeight: 600 }}>
                Create Your First Project
              </button>
            )}
          </div>
        )}

        {/* Project Grid */}
        {!loading && projects.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {projects.map(p => (
              <Link key={p.id} href={`/projects/${p.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                <div style={{
                  padding: 24, background: "white", borderRadius: 12,
                  border: "1px solid #E5E7EB", transition: "all 0.15s", cursor: "pointer",
                  borderTop: `3px solid ${p.color}`,
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <span style={{ fontSize: 28 }}>{p.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 16, color: "#111827" }}>{p.name}</div>
                      {p.status !== "active" && (
                        <span style={{
                          padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                          background: p.status === "completed" ? "#D1FAE5" : "#F3F4F6",
                          color: p.status === "completed" ? "#065F46" : "#6B7280",
                        }}>{p.status}</span>
                      )}
                    </div>
                  </div>
                  {p.description && (
                    <div style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.5, marginBottom: 12 }}>
                      {p.description.length > 100 ? p.description.slice(0, 100) + "..." : p.description}
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 13, color: "#9CA3AF" }}>
                    <span>📄 {p.doc_count} docs</span>
                    <span>Updated {formatDate(p.updated_at)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      {showCreate && (
        <CreateProjectModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchProjects(); }}
        />
      )}
    </div>
  );
}

function CreateProjectModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("🎯");
  const [color, setColor] = useState("#7C3AED");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const icons = ["🎯", "🚀", "💡", "📊", "🔬", "🏗️", "📚", "⚙️", "🎨", "💼", "🌍", "🧪"];
  const colors = ["#7C3AED", "#2563EB", "#059669", "#DC2626", "#D97706", "#EC4899", "#6B7280", "#0891B2"];

  const handleSave = async () => {
    if (!name.trim()) { setError("Name is required"); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/projects", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, icon, color }),
      });
      if (res.ok) onCreated();
      else { const d = await res.json(); setError(d.error || "Failed to create"); }
    } catch { setError("Failed to create"); } finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "white", borderRadius: 16, padding: 32, width: "100%", maxWidth: 480, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <h3 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 20px 0" }}>New Project</h3>

        {error && <div style={{ padding: 10, background: "#FEE2E2", color: "#991B1B", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>}

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Project Name *</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} autoFocus
            placeholder="e.g., Q1 Marketing Campaign"
            style={{ width: "100%", padding: "10px 14px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 14, outline: "none" }} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
            placeholder="What's this project about?"
            style={{ width: "100%", padding: "10px 14px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 14, outline: "none", resize: "vertical" }} />
        </div>

        <div style={{ display: "flex", gap: 20, marginBottom: 20 }}>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Icon</label>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {icons.map(ic => (
                <button key={ic} onClick={() => setIcon(ic)} style={{
                  width: 36, height: 36, borderRadius: 6, border: icon === ic ? "2px solid #7C3AED" : "1px solid #E5E7EB",
                  background: icon === ic ? "#F5F3FF" : "white", fontSize: 18, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>{ic}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Color</label>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {colors.map(c => (
                <button key={c} onClick={() => setColor(c)} style={{
                  width: 36, height: 36, borderRadius: 6, background: c,
                  border: color === c ? "3px solid #111827" : "2px solid transparent",
                  cursor: "pointer",
                }} />
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid #D1D5DB", background: "white", fontSize: 14, cursor: "pointer", fontWeight: 500 }}>Cancel</button>
          <button onClick={handleSave} disabled={saving || !name.trim()}
            style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: saving ? "#A78BFA" : "#7C3AED", color: "white", fontSize: 14, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer" }}>
            {saving ? "Creating..." : "🎯 Create Project"}
          </button>
        </div>
      </div>
    </div>
  );
}
