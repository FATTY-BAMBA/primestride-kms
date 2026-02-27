"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface QuickCreateProps {
  onCreateFolder?: () => void;
  isAdmin?: boolean;
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  content: string;
  doc_type: string | null;
  tags: string[];
  icon: string;
}

export default function QuickCreate({ onCreateFolder, isAdmin }: QuickCreateProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  const itemStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 12,
    padding: "14px 18px", textDecoration: "none", color: "#111827",
    fontSize: 14, fontWeight: 500, borderBottom: "1px solid #F3F4F6",
    transition: "background 0.15s", background: "none", border: "none",
    width: "100%", cursor: "pointer", textAlign: "left",
  };

  const hover = (e: React.MouseEvent<HTMLElement>, on: boolean) => {
    e.currentTarget.style.background = on ? "#F9FAFB" : "transparent";
  };

  const iconBubble = (bg: string, emoji: string) => (
    <span style={{
      width: 36, height: 36, borderRadius: 10, background: bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 18, flexShrink: 0,
    }}>{emoji}</span>
  );

  return (
    <>
      <div ref={menuRef} style={{ position: "relative" }}>
        <button
          onClick={() => setOpen(!open)}
          className="btn btn-primary"
          style={{ padding: "8px 14px", fontSize: 13, display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> New
          <span style={{ fontSize: 10, marginLeft: 2, transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▼</span>
        </button>

        {open && (
          <div style={{
            position: "absolute", top: "calc(100% + 6px)", right: 0,
            background: "white", borderRadius: 12, border: "1px solid #E5E7EB",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)", minWidth: 220,
            zIndex: 50, overflow: "hidden", animation: "fadeIn 0.15s ease-out",
          }}>
            <Link href="/library/new" onClick={() => setOpen(false)} style={itemStyle}
              onMouseEnter={(e) => hover(e, true)} onMouseLeave={(e) => hover(e, false)}>
              {iconBubble("linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)", "📂")}
              <div>
                <div style={{ fontWeight: 600 }}>Upload Files</div>
                <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>PDF, Word, Excel, PPT & more</div>
              </div>
            </Link>

            <button onClick={() => { setOpen(false); setShowUrlModal(true); }} style={itemStyle}
              onMouseEnter={(e) => hover(e, true)} onMouseLeave={(e) => hover(e, false)}>
              {iconBubble("linear-gradient(135deg, #2563EB 0%, #60A5FA 100%)", "🔗")}
              <div>
                <div style={{ fontWeight: 600 }}>Import URL</div>
                <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>Web page, article, YouTube</div>
              </div>
            </button>

            <Link href="/library/note/new" onClick={() => setOpen(false)} style={itemStyle}
              onMouseEnter={(e) => hover(e, true)} onMouseLeave={(e) => hover(e, false)}>
              {iconBubble("linear-gradient(135deg, #10B981 0%, #34D399 100%)", "📝")}
              <div>
                <div style={{ fontWeight: 600 }}>New Note</div>
                <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>Write freely, auto-saved</div>
              </div>
            </Link>

            <button onClick={() => { setOpen(false); setShowTemplateModal(true); }} style={itemStyle}
              onMouseEnter={(e) => hover(e, true)} onMouseLeave={(e) => hover(e, false)}>
              {iconBubble("linear-gradient(135deg, #EC4899 0%, #F472B6 100%)", "📋")}
              <div>
                <div style={{ fontWeight: 600 }}>From Template</div>
                <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>Start with a structure</div>
              </div>
            </button>

            <button onClick={() => { setOpen(false); onCreateFolder?.(); }}
              style={{ ...itemStyle, borderBottom: "none" }}
              onMouseEnter={(e) => hover(e, true)} onMouseLeave={(e) => hover(e, false)}>
              {iconBubble("linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)", "📁")}
              <div>
                <div style={{ fontWeight: 600 }}>New Folder</div>
                <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>Organize your documents</div>
              </div>
            </button>
          </div>
        )}

        <style jsx>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-4px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>

      {showUrlModal && (
        <ImportUrlModal
          onClose={() => setShowUrlModal(false)}
          onImported={(docId) => { setShowUrlModal(false); router.push(`/library/${encodeURIComponent(docId)}`); }}
        />
      )}

      {showTemplateModal && (
        <TemplatePickerModal
          isAdmin={isAdmin}
          onClose={() => setShowTemplateModal(false)}
          onCreated={(docId) => { setShowTemplateModal(false); router.push(`/library/${encodeURIComponent(docId)}/edit`); }}
          onManage={() => { setShowTemplateModal(false); setShowCreateTemplate(true); }}
        />
      )}

      {showCreateTemplate && (
        <CreateTemplateModal
          onClose={() => setShowCreateTemplate(false)}
          onCreated={() => { setShowCreateTemplate(false); setShowTemplateModal(true); }}
        />
      )}
    </>
  );
}

// ── Import URL Modal ──
function ImportUrlModal({ onClose, onImported }: { onClose: () => void; onImported: (docId: string) => void }) {
  const [url, setUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const handleImport = async () => {
    if (!url.trim()) return;
    let testUrl = url.trim();
    if (!testUrl.startsWith("http://") && !testUrl.startsWith("https://")) testUrl = "https://" + testUrl;
    try { new URL(testUrl); } catch { setError("Please enter a valid URL"); return; }

    setImporting(true); setError(""); setStatus("🔗 Fetching page...");
    try {
      const res = await fetch("/api/documents/import-url", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: testUrl }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to import URL"); setImporting(false); setStatus(""); return; }
      setStatus(`✅ Imported: ${data.title}`);
      setTimeout(() => onImported(data.docId), 800);
    } catch { setError("Failed to import URL"); setImporting(false); setStatus(""); }
  };

  return (
    <ModalWrapper onClose={onClose}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <span style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg, #2563EB 0%, #60A5FA 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🔗</span>
        <h3 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Import from URL</h3>
      </div>
      <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 20, lineHeight: 1.5 }}>
        Paste a web page, article, or YouTube URL. AI will extract content and generate metadata automatically.
      </p>
      {error && <div style={{ padding: 10, background: "#FEE2E2", color: "#991B1B", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>}
      {status && !error && <div style={{ padding: 10, background: "#D1FAE5", color: "#065F46", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{status}</div>}
      <input type="url" value={url} onChange={(e) => { setUrl(e.target.value); setError(""); }}
        placeholder="https://example.com/article or YouTube URL" autoFocus disabled={importing}
        onKeyDown={(e) => { if (e.key === "Enter") handleImport(); }}
        style={{ width: "100%", padding: "12px 16px", border: "1px solid #D1D5DB", borderRadius: 10, fontSize: 15, outline: "none", opacity: importing ? 0.6 : 1, marginBottom: 20 }} />
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button onClick={onClose} disabled={importing} style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid #D1D5DB", background: "white", fontSize: 14, cursor: "pointer", fontWeight: 500 }}>Cancel</button>
        <button onClick={handleImport} disabled={!url.trim() || importing}
          style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: importing || !url.trim() ? "#93C5FD" : "#2563EB", color: "white", fontSize: 14, cursor: importing ? "not-allowed" : "pointer", fontWeight: 600 }}>
          {importing ? "Importing..." : "🔗 Import"}
        </button>
      </div>
    </ModalWrapper>
  );
}

// ── Template Picker Modal ──
function TemplatePickerModal({ isAdmin, onClose, onCreated, onManage }: {
  isAdmin?: boolean; onClose: () => void; onCreated: (docId: string) => void; onManage: () => void;
}) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/templates")
      .then(r => r.json())
      .then(d => setTemplates(d.templates || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleUse = async (template: Template) => {
    setCreating(template.id);
    try {
      const res = await fetch("/api/templates/use", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: template.id }),
      });
      const data = await res.json();
      if (res.ok) onCreated(data.docId);
    } catch {} finally {
      setCreating(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    try {
      await fetch(`/api/templates?id=${id}`, { method: "DELETE" });
      setTemplates(templates.filter(t => t.id !== id));
    } catch {}
  };

  return (
    <ModalWrapper onClose={onClose} wide>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg, #EC4899 0%, #F472B6 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>📋</span>
          <h3 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Choose a Template</h3>
        </div>
        {isAdmin && (
          <button onClick={onManage} style={{
            padding: "8px 16px", borderRadius: 8, border: "1px solid #D1D5DB",
            background: "white", fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>+ Create Template</button>
        )}
      </div>

      {loading && <div style={{ padding: 30, textAlign: "center", color: "#9CA3AF" }}>Loading templates...</div>}

      {!loading && templates.length === 0 && (
        <div style={{ padding: "40px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#374151", marginBottom: 8 }}>No templates yet</div>
          <div style={{ fontSize: 14, color: "#9CA3AF", marginBottom: 20 }}>
            {isAdmin ? "Create your first template to help your team get started quickly." : "Ask your admin to create templates for common document types."}
          </div>
          {isAdmin && (
            <button onClick={onManage} style={{
              padding: "10px 20px", borderRadius: 8, border: "none",
              background: "#7C3AED", color: "white", fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}>+ Create First Template</button>
          )}
        </div>
      )}

      {!loading && templates.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
          {templates.map(t => (
            <div key={t.id} style={{
              padding: 20, borderRadius: 10, border: "1px solid #E5E7EB",
              background: "white", cursor: "pointer", transition: "all 0.15s",
              position: "relative",
            }}
              onClick={() => !creating && handleUse(t)}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#7C3AED"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(124,58,237,0.15)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.boxShadow = "none"; }}
            >
              <div style={{ fontSize: 28, marginBottom: 10 }}>{t.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#111827", marginBottom: 4 }}>{t.name}</div>
              {t.description && (
                <div style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.4, marginBottom: 8 }}>
                  {t.description.length > 80 ? t.description.slice(0, 80) + "..." : t.description}
                </div>
              )}
              {t.tags.length > 0 && (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {t.tags.slice(0, 3).map(tag => (
                    <span key={tag} style={{ padding: "2px 6px", background: "#EEF2FF", color: "#4F46E5", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {creating === t.id && (
                <div style={{
                  position: "absolute", inset: 0, borderRadius: 10,
                  background: "rgba(255,255,255,0.8)", display: "flex",
                  alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 600, color: "#7C3AED",
                }}>Creating...</div>
              )}
              {isAdmin && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }}
                  style={{
                    position: "absolute", top: 8, right: 8,
                    background: "none", border: "none", color: "#D1D5DB",
                    cursor: "pointer", fontSize: 14, padding: 4,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#DC2626")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#D1D5DB")}
                >✕</button>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
        <button onClick={onClose} style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid #D1D5DB", background: "white", fontSize: 14, cursor: "pointer", fontWeight: 500 }}>Cancel</button>
      </div>
    </ModalWrapper>
  );
}

// ── Create Template Modal ──
function CreateTemplateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("📋");
  const [docType, setDocType] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const icons = ["📋", "📊", "📈", "📝", "🎯", "💡", "🔬", "📚", "🗂️", "⚙️", "🏗️", "📐", "🧪", "📌", "🎨", "💼"];

  // Pre-built starters
  const starters = [
    { label: "Meeting Notes", icon: "📝", type: "meeting-notes", content: "# Meeting Notes — {{date}}\n\n## Attendees\n- \n\n## Agenda\n1. \n\n## Discussion\n\n\n## Action Items\n- [ ] \n\n## Next Steps\n" },
    { label: "Project Brief", icon: "🎯", type: "project-brief", content: "# Project Brief — {{title}}\n\n## Overview\n\n\n## Objectives\n1. \n2. \n3. \n\n## Scope\n### In Scope\n- \n\n### Out of Scope\n- \n\n## Timeline\n| Phase | Dates | Deliverables |\n|-------|-------|--------------|\n| | | |\n\n## Team\n| Role | Person |\n|------|--------|\n| | |\n\n## Risks\n- \n\n## Success Metrics\n- \n" },
    { label: "SOP / Process", icon: "⚙️", type: "sop", content: "# Standard Operating Procedure\n\n**Document ID:** {{doc_id}}\n**Effective Date:** {{date}}\n**Version:** 1.0\n\n## Purpose\n\n\n## Scope\n\n\n## Prerequisites\n- \n\n## Procedure\n### Step 1:\n\n\n### Step 2:\n\n\n### Step 3:\n\n\n## Expected Outcome\n\n\n## Troubleshooting\n| Issue | Solution |\n|-------|----------|\n| | |\n\n## References\n- \n" },
    { label: "Weekly Report", icon: "📊", type: "report", content: "# Weekly Report — {{date}}\n\n## Highlights\n- \n\n## Completed This Week\n1. \n2. \n3. \n\n## In Progress\n1. \n2. \n\n## Blockers\n- \n\n## Plan for Next Week\n1. \n2. \n3. \n\n## Metrics\n| Metric | This Week | Last Week | Change |\n|--------|-----------|-----------|--------|\n| | | | |\n" },
  ];

  const handleStarterSelect = (starter: typeof starters[0]) => {
    setName(starter.label);
    setIcon(starter.icon);
    setDocType(starter.type);
    setContent(starter.content);
  };

  const handleSave = async () => {
    if (!name.trim() || !content.trim()) { setError("Name and content are required"); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/templates", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, content, docType, icon }),
      });
      if (res.ok) onCreated();
      else { const d = await res.json(); setError(d.error || "Failed to save"); }
    } catch { setError("Failed to save"); } finally { setSaving(false); }
  };

  return (
    <ModalWrapper onClose={onClose} wide>
      <h3 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 20px 0" }}>Create Template</h3>

      {error && <div style={{ padding: 10, background: "#FEE2E2", color: "#991B1B", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>}

      {/* Quick starters */}
      {!content && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#6B7280", marginBottom: 10 }}>Start from a preset:</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {starters.map(s => (
              <button key={s.label} onClick={() => handleStarterSelect(s)} style={{
                padding: "8px 14px", borderRadius: 8, border: "1px solid #E5E7EB",
                background: "white", fontSize: 13, cursor: "pointer", fontWeight: 500,
                display: "flex", alignItems: "center", gap: 6,
              }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#7C3AED")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#E5E7EB")}
              >
                <span>{s.icon}</span> {s.label}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 8 }}>Or create from scratch below.</div>
        </div>
      )}

      {/* Name + Icon */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Template Name *</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Meeting Notes"
            style={{ width: "100%", padding: "10px 14px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 14, outline: "none" }} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Icon</label>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", maxWidth: 200 }}>
            {icons.map(ic => (
              <button key={ic} onClick={() => setIcon(ic)} style={{
                width: 32, height: 32, borderRadius: 6, border: icon === ic ? "2px solid #7C3AED" : "1px solid #E5E7EB",
                background: icon === ic ? "#F5F3FF" : "white", fontSize: 16, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>{ic}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Description */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Description</label>
        <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
          placeholder="Short description of when to use this template"
          style={{ width: "100%", padding: "10px 14px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 14, outline: "none" }} />
      </div>

      {/* Doc Type */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Document Type</label>
        <input type="text" value={docType} onChange={(e) => setDocType(e.target.value)}
          placeholder="e.g., meeting-notes, sop, report"
          style={{ width: "100%", padding: "10px 14px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 14, outline: "none" }} />
      </div>

      {/* Content */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
          Template Content *
        </label>
        <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={12}
          placeholder="Write your template content here...&#10;&#10;Use {{date}} for auto-date&#10;Use {{title}} for document title&#10;Use {{doc_id}} for auto-generated ID"
          style={{
            width: "100%", padding: "14px", border: "1px solid #D1D5DB", borderRadius: 8,
            fontSize: 14, fontFamily: "monospace", lineHeight: 1.6, resize: "vertical", outline: "none",
          }} />
        <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 6 }}>
          Variables: <code style={{ background: "#F3F4F6", padding: "1px 4px", borderRadius: 3 }}>{"{{date}}"}</code>{" "}
          <code style={{ background: "#F3F4F6", padding: "1px 4px", borderRadius: 3 }}>{"{{title}}"}</code>{" "}
          <code style={{ background: "#F3F4F6", padding: "1px 4px", borderRadius: 3 }}>{"{{doc_id}}"}</code>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button onClick={onClose} style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid #D1D5DB", background: "white", fontSize: 14, cursor: "pointer", fontWeight: 500 }}>Cancel</button>
        <button onClick={handleSave} disabled={saving || !name.trim() || !content.trim()}
          style={{
            padding: "10px 20px", borderRadius: 8, border: "none",
            background: saving ? "#A78BFA" : "#7C3AED", color: "white",
            fontSize: 14, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer",
          }}>
          {saving ? "Saving..." : "💾 Save Template"}
        </button>
      </div>
    </ModalWrapper>
  );
}

// ── Modal Wrapper ──
function ModalWrapper({ children, onClose, wide }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,0.4)", display: "flex",
      alignItems: "center", justifyContent: "center", padding: 20,
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "white", borderRadius: 16, padding: 32,
        width: "100%", maxWidth: wide ? 640 : 480,
        maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
      }}>
        {children}
      </div>
    </div>
  );
}
