"use client";

import QuickCreate from "@/components/QuickCreate";
import Link from "next/link";
import { useEffect, useState, Suspense, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import UserMenu from "@/components/UserMenu";
import OrgSwitcher from "@/components/OrgSwitcher";

type Team = {
  id: string;
  name: string;
  color: string;
};

type Folder = {
  id: string;
  name: string;
  color: string;
  icon: string;
  parent_folder_id: string | null;
  team_id: string | null;
  documents: { count: number }[] | null;
};

type DocRow = {
  doc_id: string;
  title: string;
  current_version: string;
  status: string;
  doc_type: string | null;
  domain: string | null;
  tags: string[] | null;
  file_url?: string | null;
  team_id?: string | null;
  folder_id?: string | null;
  doc_source?: string | null;
  teams?: Team | null;
  feedback_counts: {
    helped: number;
    not_confident: number;
    didnt_help: number;
  };
};

// ── Folder Creation Modal ──
function CreateFolderModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#7C3AED");
  const [icon, setIcon] = useState("📁");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const colors = ["#7C3AED", "#2563EB", "#059669", "#D97706", "#DC2626", "#EC4899", "#6B7280"];
  const icons = ["📁", "📂", "📋", "📌", "🗂️", "💼", "🎯", "📚", "🔬", "💡"];

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), color, icon }),
      });
      const data = await res.json();
      if (res.ok) {
        setName("");
        setColor("#7C3AED");
        setIcon("📁");
        onClose();
        onCreated();
      } else {
        setError(data.error || "Failed to create folder");
      }
    } catch {
      setError("Failed to create folder");
    } finally {
      setCreating(false);
    }
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.4)", display: "flex",
        alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "white", borderRadius: 16, padding: 32,
          width: "100%", maxWidth: 420,
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
        }}
      >
        <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>New Folder</h3>

        {error && (
          <div style={{ padding: 10, background: "#FEE2E2", color: "#991B1B", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
            Folder Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Onboarding Docs"
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
            style={{
              width: "100%", padding: "10px 14px", border: "1px solid #D1D5DB",
              borderRadius: 8, fontSize: 15, outline: "none",
            }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
            Icon
          </label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {icons.map((ic) => (
              <button
                key={ic}
                type="button"
                onClick={() => setIcon(ic)}
                style={{
                  width: 40, height: 40, borderRadius: 8, border: icon === ic ? "2px solid #7C3AED" : "1px solid #E5E7EB",
                  background: icon === ic ? "#F5F3FF" : "white",
                  fontSize: 20, cursor: "pointer", display: "flex",
                  alignItems: "center", justifyContent: "center",
                }}
              >
                {ic}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
            Color
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            {colors.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                style={{
                  width: 32, height: 32, borderRadius: "50%", border: color === c ? "3px solid #111827" : "2px solid transparent",
                  background: c, cursor: "pointer", outline: color === c ? "2px solid white" : "none",
                  outlineOffset: -4,
                }}
              />
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              padding: "10px 20px", borderRadius: 8, border: "1px solid #D1D5DB",
              background: "white", fontSize: 14, cursor: "pointer", fontWeight: 500,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || creating}
            style={{
              padding: "10px 20px", borderRadius: 8, border: "none",
              background: creating || !name.trim() ? "#D1D5DB" : "#7C3AED",
              color: "white", fontSize: 14, cursor: creating ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            {creating ? "Creating..." : "Create Folder"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Move to Folder Modal ──
function MoveToFolderModal({
  open,
  docId,
  folders,
  onClose,
  onMoved,
}: {
  open: boolean;
  docId: string;
  folders: Folder[];
  onClose: () => void;
  onMoved: () => void;
}) {
  const [moving, setMoving] = useState(false);

  const handleMove = async (folderId: string | null) => {
    setMoving(true);
    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(docId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId }),
      });
      if (res.ok) {
        onClose();
        onMoved();
      }
    } catch {} finally {
      setMoving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.4)", display: "flex",
        alignItems: "center", justifyContent: "center", padding: 20,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "white", borderRadius: 16, padding: 32,
          width: "100%", maxWidth: 360,
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
        }}
      >
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Move to Folder</h3>

        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 300, overflowY: "auto" }}>
          {/* Unfiled option */}
          <button
            onClick={() => handleMove(null)}
            disabled={moving}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 14px", borderRadius: 8, border: "1px solid #E5E7EB",
              background: "white", cursor: "pointer", fontSize: 14, textAlign: "left", width: "100%",
            }}
          >
            <span>🌐</span>
            <span>Unfiled (root)</span>
          </button>

          {folders.map((f) => (
            <button
              key={f.id}
              onClick={() => handleMove(f.id)}
              disabled={moving}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 14px", borderRadius: 8, border: "1px solid #E5E7EB",
                background: "white", cursor: "pointer", fontSize: 14, textAlign: "left", width: "100%",
              }}
            >
              <span>{f.icon}</span>
              <span style={{ fontWeight: 500 }}>{f.name}</span>
            </button>
          ))}
        </div>

        <div style={{ marginTop: 16, textAlign: "right" }}>
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px", borderRadius: 8, border: "1px solid #D1D5DB",
              background: "white", fontSize: 13, cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Library Content ──
function LibraryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const teamFilter = searchParams.get("team") || "all";
  const folderFilter = searchParams.get("folder") || null;

  const [docs, setDocs] = useState<DocRow[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState<string>("");
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [moveDocId, setMoveDocId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      const url = teamFilter && teamFilter !== "all"
        ? `/api/learning-summary?team=${teamFilter}`
        : "/api/learning-summary";

      const [docRes, folderRes, profileRes] = await Promise.all([
        fetch(url),
        fetch("/api/folders"),
        fetch("/api/profile"),
      ]);

      const docData = await docRes.json();
      const folderData = await folderRes.json();
      const profileData = await profileRes.json();

      if (!docRes.ok) throw new Error(docData?.error ?? "Failed to load");

      setDocs(docData.documents ?? []);
      setTeams(docData.teams ?? []);
      setFolders(folderData.folders ?? []);

      if (profileRes.ok && profileData.role) {
        setUserRole(profileData.role);
        setIsAdmin(["owner", "admin"].includes(profileData.role));
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [teamFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalFeedback = docs.reduce(
    (sum, d) =>
      sum + d.feedback_counts.helped + d.feedback_counts.not_confident + d.feedback_counts.didnt_help,
    0
  );

  // Filter docs by folder
  const filteredDocs = folderFilter
    ? docs.filter((d) => d.folder_id === folderFilter)
    : docs;

  const currentFolder = folders.find((f) => f.id === folderFilter);

  const handleDeleteFolder = async (folderId: string) => {
    if (!confirm("Delete this folder? Documents inside will be moved to unfiled.")) return;
    try {
      await fetch(`/api/folders?id=${folderId}`, { method: "DELETE" });
      router.push("/library");
      fetchData();
    } catch {}
  };

  const getDocIcon = (doc: DocRow) => {
    if (doc.doc_source === "note") return "📝";
    if (doc.doc_source === "url") return "🔗";
    if (doc.doc_source === "youtube") return "🎬";
    if (doc.doc_source === "template") return "📋";
    if (doc.file_url) {
      const ext = doc.doc_type?.toLowerCase() || "";
      if (ext === "pdf" || doc.file_url?.includes(".pdf")) return "📕";
      if (ext === "docx" || ext === "doc") return "📘";
      if (ext === "pptx" || ext === "ppt") return "📙";
      if (ext === "xlsx" || ext === "xls" || ext === "csv") return "📗";
    }
    return "📄";
  };

  return (
    <>
      <header style={{ marginBottom: 40 }}>
        <div
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 16, marginBottom: 8, flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <div
              style={{
                width: 36, height: 36, borderRadius: 8,
                background: "linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
              }}
            >
              📚
            </div>
            <h1 style={{ fontSize: 20, margin: 0 }}>PS Atlas</h1>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {isAdmin && <QuickCreate onCreateFolder={() => setShowCreateFolder(true)} isAdmin={isAdmin} />}
            <Link
              href="/search"
              style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "8px 14px",
                background: "linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)",
                color: "white", borderRadius: 8, textDecoration: "none",
                fontSize: 13, fontWeight: 600,
                boxShadow: "0 2px 6px rgba(124, 58, 237, 0.3)",
              }}
            >
              🔍 Search & Ask AI
            </Link>
            {isAdmin && (
              <Link href="/learning" className="btn" style={{ padding: "8px 14px", fontSize: 13 }}>
                📊 Learning
              </Link>
            )}
            {isAdmin && (
              <Link href="/admin" className="btn" style={{ padding: "8px 14px", fontSize: 13 }}>
                ⚙️ Admin
              </Link>
            )}
            {isAdmin && (
              <Link href="/team" className="btn" style={{ padding: "8px 14px", fontSize: 13 }}>
                👤 Members
              </Link>
            )}
            {isAdmin && (
              <Link href="/teams" className="btn" style={{ padding: "8px 14px", fontSize: 13 }}>
                🏷️ Groups
              </Link>
            )}
            <Link href="/ai-graph" className="btn" style={{ padding: "8px 14px", fontSize: 13 }}>
              🧠 Graph
            </Link>
            <Link href="/projects" className="btn" style={{ padding: "8px 14px", fontSize: 13 }}>
              🎯 Projects
            </Link>
            <Link href="/agent" style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "8px 14px",
              background: "linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)",
              color: "white", borderRadius: 8, textDecoration: "none",
              fontSize: 13, fontWeight: 600,
              boxShadow: "0 2px 6px rgba(124, 58, 237, 0.3)",
            }}>
              🤖 AI Agent
            </Link>
            <OrgSwitcher />
            <UserMenu />
          </div>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
          Learning-enabled docs with feedback → weekly improvements
        </p>
      </header>

      {/* Stats Cards */}
      {!loading && !err && (
        <div style={{ display: "flex", gap: 16, marginBottom: 32, flexWrap: "wrap" }}>
          <div className="card" style={{ flex: "1 1 150px", minWidth: 150 }}>
            <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>{docs.length}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Documents</div>
          </div>
          <div className="card" style={{ flex: "1 1 150px", minWidth: 150 }}>
            <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 4, color: "var(--accent-blue)" }}>{totalFeedback}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Total Feedback</div>
          </div>
          {folders.length > 0 && (
            <div className="card" style={{ flex: "1 1 150px", minWidth: 150 }}>
              <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 4, color: "#D97706" }}>{folders.length}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Folders</div>
            </div>
          )}
          {teams.length > 0 && (
            <div className="card" style={{ flex: "1 1 150px", minWidth: 150 }}>
              <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 4, color: "#7C3AED" }}>{teams.length}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Groups</div>
            </div>
          )}
        </div>
      )}

      {/* Team Filter */}
      {!loading && !err && teams.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "var(--text-muted)", marginRight: 4 }}>Filter:</span>
            <Link href="/library" className="btn" style={{ padding: "6px 14px", fontSize: 13, background: teamFilter === "all" && !folderFilter ? "#7C3AED" : undefined, color: teamFilter === "all" && !folderFilter ? "white" : undefined }}>
              All
            </Link>
            <Link href="/library?team=org-wide" className="btn" style={{ padding: "6px 14px", fontSize: 13, background: teamFilter === "org-wide" ? "#7C3AED" : undefined, color: teamFilter === "org-wide" ? "white" : undefined }}>
              🌐 Org-Wide
            </Link>
            {teams.map((team) => (
              <Link key={team.id} href={`/library?team=${team.id}`} className="btn" style={{ padding: "6px 14px", fontSize: 13, background: teamFilter === team.id ? team.color : undefined, color: teamFilter === team.id ? "white" : undefined, borderLeft: teamFilter !== team.id ? `3px solid ${team.color}` : undefined }}>
                {team.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Folders Section ── */}
      {!loading && !err && folders.length > 0 && !folderFilter && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 14, color: "var(--text-muted)" }}>
            📁 Folders
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
            {folders.map((f) => {
              const docCount = f.documents?.[0]?.count || docs.filter(d => d.folder_id === f.id).length;
              return (
                <Link
                  key={f.id}
                  href={`/library?folder=${f.id}`}
                  style={{
                    display: "flex", flexDirection: "column",
                    padding: "16px 18px", borderRadius: 12,
                    border: "1px solid #E5E7EB", background: "white",
                    textDecoration: "none", color: "#111827",
                    transition: "all 0.15s",
                    borderLeft: `4px solid ${f.color}`,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}
                >
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{f.icon}</div>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{f.name}</div>
                  <div style={{ fontSize: 12, color: "#9CA3AF" }}>
                    {docCount} doc{docCount !== 1 ? "s" : ""}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Folder Breadcrumb ── */}
      {folderFilter && currentFolder && (
        <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
          <Link href="/library" style={{ color: "#6B7280", textDecoration: "none", fontSize: 14 }}>
            All Documents
          </Link>
          <span style={{ color: "#D1D5DB" }}>/</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#111827", display: "flex", alignItems: "center", gap: 6 }}>
            {currentFolder.icon} {currentFolder.name}
          </span>
          {isAdmin && (
            <button
              onClick={() => handleDeleteFolder(currentFolder.id)}
              style={{
                marginLeft: 8, padding: "4px 10px", borderRadius: 6,
                border: "1px solid #FCA5A5", background: "#FEE2E2",
                color: "#991B1B", fontSize: 12, cursor: "pointer",
              }}
            >
              Delete folder
            </button>
          )}
          {isAdmin && (
            <Link
              href={`/library/new?folder=${currentFolder.id}`}
              style={{
                marginLeft: 8, padding: "4px 12px", borderRadius: 6,
                border: "1px solid #C4B5FD", background: "#EDE9FE",
                color: "#5B21B6", fontSize: 12, textDecoration: "none",
                fontWeight: 600,
              }}
            >
              ➕ Upload to this folder
            </Link>
          )}
        </div>
      )}

      {/* ── Documents ── */}
      <section>
        <h2 style={{ marginBottom: 20, fontSize: 18 }}>
          {folderFilter && currentFolder
            ? `${currentFolder.icon} ${currentFolder.name}`
            : "Knowledge Library"}
          {teamFilter !== "all" && teamFilter !== "org-wide" && teams.find(t => t.id === teamFilter) && (
            <span style={{ fontSize: 14, fontWeight: 400, color: "var(--text-muted)", marginLeft: 8 }}>
              — {teams.find(t => t.id === teamFilter)?.name}
            </span>
          )}
          {teamFilter === "org-wide" && (
            <span style={{ fontSize: 14, fontWeight: 400, color: "var(--text-muted)", marginLeft: 8 }}>
              — Organization-Wide
            </span>
          )}
        </h2>

        {loading && <div className="loading"><span>Loading documents...</span></div>}

        {err && (
          <div className="card" style={{ borderColor: "var(--accent-red)", background: "var(--accent-red-soft)" }}>
            <p style={{ color: "var(--accent-red)" }}>Error: {err}</p>
          </div>
        )}

        {!loading && !err && (
          <div style={{ display: "grid", gap: 16 }}>
            {filteredDocs.map((d, i) => (
              <div
                key={d.doc_id}
                className="card animate-in"
                style={{
                  animationDelay: `${i * 0.05}s`,
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  gap: 20, flexWrap: "wrap",
                  borderLeft: d.teams ? `4px solid ${d.teams.color}` : "4px solid #E5E7EB",
                }}
              >
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 20 }}>{getDocIcon(d)}</span>
                    <h3 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>{d.title}</h3>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <span className="badge mono">{d.doc_id}</span>
                    <span className="badge">{d.current_version}</span>
                    <span className="badge badge-success">{d.status}</span>
                    {d.doc_type && <span className="badge">{d.doc_type}</span>}
                    {d.file_url && <span className="badge" title="Has attached file">📎 File</span>}
                    {d.doc_source === "note" && <span className="badge" style={{ background: "#D1FAE5", color: "#065F46" }}>📝 Note</span>}
                    {d.doc_source === "url" && <span className="badge" style={{ background: "#DBEAFE", color: "#1E40AF" }}>🔗 URL</span>}
                    {d.doc_source === "youtube" && <span className="badge" style={{ background: "#FEE2E2", color: "#991B1B" }}>🎬 YouTube</span>}
                    {d.doc_source === "template" && <span className="badge" style={{ background: "#FCE7F3", color: "#9D174D" }}>📋 Template</span>}
                    {d.doc_source === "ai-agent" && <span className="badge" style={{ background: "linear-gradient(135deg, #EDE9FE, #FCE7F3)", color: "#7C3AED" }}>🤖 AI Agent</span>}
                    {d.teams ? (
                      <span className="badge" style={{ background: d.teams.color + "20", color: d.teams.color, borderColor: d.teams.color }}>
                        {d.teams.name}
                      </span>
                    ) : (
                      <span className="badge" style={{ background: "#F3F4F6", color: "#6B7280" }}>🌐 Org-Wide</span>
                    )}
                    {/* Show folder badge if in a folder */}
                    {d.folder_id && !folderFilter && (
                      <span className="badge" style={{ background: "#FEF3C7", color: "#92400E" }}>
                        {folders.find(f => f.id === d.folder_id)?.icon || "📁"}{" "}
                        {folders.find(f => f.id === d.folder_id)?.name || "Folder"}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", gap: 16, fontSize: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--accent-green)" }}>
                      <span>✓</span><span style={{ fontWeight: 600 }}>{d.feedback_counts.helped}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--accent-yellow)" }}>
                      <span>⚠</span><span style={{ fontWeight: 600 }}>{d.feedback_counts.not_confident}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--accent-red)" }}>
                      <span>✗</span><span style={{ fontWeight: 600 }}>{d.feedback_counts.didnt_help}</span>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    {isAdmin && folders.length > 0 && (
                      <button
                        onClick={() => setMoveDocId(d.doc_id)}
                        className="btn"
                        style={{ padding: "6px 10px", fontSize: 12 }}
                        title="Move to folder"
                      >
                        📁
                      </button>
                    )}
                    {isAdmin && (
                      <Link href={`/library/${encodeURIComponent(d.doc_id)}/edit`} className="btn">
                        ✏️ Edit
                      </Link>
                    )}
                    <Link href={`/library/${encodeURIComponent(d.doc_id)}`} className="btn btn-primary">
                      View →
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && !err && filteredDocs.length === 0 && (
          <div className="card" style={{ textAlign: "center", padding: 40 }}>
            <p style={{ color: "var(--text-muted)" }}>
              {folderFilter
                ? "No documents in this folder yet."
                : teamFilter !== "all"
                ? "No documents found in this filter."
                : "No documents found."}
            </p>
            {isAdmin && !folderFilter && (
              <Link href="/library/new" className="btn btn-primary" style={{ marginTop: 16 }}>
                ➕ Upload Documents
              </Link>
            )}
            {folderFilter && (
              <Link href="/library" className="btn" style={{ marginTop: 16 }}>
                ← Back to All Documents
              </Link>
            )}
          </div>
        )}
      </section>

      {/* Modals */}
      <CreateFolderModal
        open={showCreateFolder}
        onClose={() => setShowCreateFolder(false)}
        onCreated={fetchData}
      />

      {moveDocId && (
        <MoveToFolderModal
          open={!!moveDocId}
          docId={moveDocId}
          folders={folders}
          onClose={() => setMoveDocId(null)}
          onMoved={fetchData}
        />
      )}
    </>
  );
}

function LibraryLoading() {
  return (
    <div className="loading" style={{ padding: 40, textAlign: "center" }}>
      <span>Loading library...</span>
    </div>
  );
}

export default function LibraryPage() {
  return (
    <ProtectedRoute>
      <main className="container">
        <Suspense fallback={<LibraryLoading />}>
          <LibraryContent />
        </Suspense>
      </main>
    </ProtectedRoute>
  );
}
