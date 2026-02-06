"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import UserMenu from "@/components/UserMenu";
import OrgSwitcher from "@/components/OrgSwitcher";

interface Team {
  id: string;
  name: string;
  description: string | null;
  color: string;
  member_count: number;
  document_count: number;
  is_member: boolean;
  user_role: string | null;
  created_at: string;
}

export default function GroupsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [userOrgRole, setUserOrgRole] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form states
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamDescription, setNewTeamDescription] = useState("");
  const [newTeamColor, setNewTeamColor] = useState("#7C3AED");
  const [creating, setCreating] = useState(false);

  const isAdmin = ["owner", "admin"].includes(userOrgRole);

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      const res = await fetch("/api/teams");
      const data = await res.json();
      if (res.ok) {
        setTeams(data.teams || []);
        setUserOrgRole(data.user_org_role || "");
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError("Failed to load groups");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;

    setCreating(true);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTeamName,
          description: newTeamDescription,
          color: newTeamColor,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setTeams([...teams, data.team]);
        setShowCreateModal(false);
        setNewTeamName("");
        setNewTeamDescription("");
        setNewTeamColor("#7C3AED");
      } else {
        alert(data.error || "Failed to create group");
      }
    } catch (err) {
      alert("Failed to create group");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteTeam = async (team: Team) => {
    if (!confirm(`Delete "${team.name}"? Documents will become org-wide.`)) return;

    try {
      const res = await fetch(`/api/teams/${team.id}`, { method: "DELETE" });
      if (res.ok) {
        setTeams(teams.filter(t => t.id !== team.id));
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete group");
      }
    } catch (err) {
      alert("Failed to delete group");
    }
  };

  const colorOptions = [
    "#7C3AED", "#3B82F6", "#10B981", "#F59E0B",
    "#EF4444", "#EC4899", "#6366F1", "#14B8A6",
  ];

  return (
    <ProtectedRoute>
      <main className="container" style={{ maxWidth: 1000 }}>
        {/* Header */}
        <header style={{ marginBottom: 40 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 8, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: "linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
              }}>
                🏷️
              </div>
              <h1 style={{ fontSize: 20, margin: 0 }}>Groups</h1>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Link href="/library" className="btn" style={{ padding: "8px 14px", fontSize: 13 }}>
                ← Back to Library
              </Link>
              {isAdmin && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="btn btn-primary"
                  style={{ padding: "8px 14px", fontSize: 13 }}
                >
                  ➕ Create Group
                </button>
              )}
              <OrgSwitcher />
              <UserMenu />
            </div>
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
            Organize members into groups and control document access
          </p>
        </header>

        {/* Loading / Error */}
        {loading && <div className="loading">Loading groups...</div>}
        {error && <div className="card" style={{ background: "#FEE2E2", color: "#991B1B" }}>{error}</div>}

        {/* Groups Grid */}
        {!loading && !error && (
          <div style={{ display: "grid", gap: 20 }}>
            {/* Org-wide section */}
            <div className="card" style={{ 
              background: "linear-gradient(135deg, #F8F7FF 0%, #EDE9FE 100%)",
              border: "1px solid #DDD6FE",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, color: "#5B21B6" }}>
                    🌐 Organization-Wide
                  </h3>
                  <p style={{ fontSize: 13, color: "#7C3AED", margin: 0 }}>
                    Documents visible to all organization members
                  </p>
                </div>
                <Link href="/library?team=org-wide" className="btn" style={{ padding: "8px 16px", fontSize: 13 }}>
                  View Docs →
                </Link>
              </div>
            </div>

            {/* Groups list */}
            {teams.length === 0 ? (
              <div className="card" style={{ textAlign: "center", padding: 40 }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🏷️</div>
                <h3 style={{ marginBottom: 8 }}>No groups yet</h3>
                <p style={{ color: "var(--text-muted)", marginBottom: 20 }}>
                  Create groups to organize members and control document access
                </p>
                {isAdmin && (
                  <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
                    Create First Group
                  </button>
                )}
              </div>
            ) : (
              teams.map((team) => (
                <div
                  key={team.id}
                  className="card"
                  style={{
                    borderLeft: `4px solid ${team.color}`,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 20,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <h3 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>{team.name}</h3>
                      {team.is_member && (
                        <span style={{
                          padding: "2px 8px",
                          background: team.user_role === "lead" ? "#FEF3C7" : "#DBEAFE",
                          color: team.user_role === "lead" ? "#92400E" : "#1D4ED8",
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          textTransform: "uppercase",
                        }}>
                          {team.user_role}
                        </span>
                      )}
                    </div>
                    {team.description && (
                      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>
                        {team.description}
                      </p>
                    )}
                    <div style={{ display: "flex", gap: 16, fontSize: 13, color: "var(--text-secondary)" }}>
                      <span>👥 {team.member_count} members</span>
                      <span>📄 {team.document_count} documents</span>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <Link
                      href={`/teams/${team.id}`}
                      className="btn"
                      style={{ padding: "8px 16px", fontSize: 13 }}
                    >
                      Manage
                    </Link>
                    <Link
                      href={`/library?team=${team.id}`}
                      className="btn btn-primary"
                      style={{ padding: "8px 16px", fontSize: 13 }}
                    >
                      View Docs →
                    </Link>
                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteTeam(team)}
                        className="btn"
                        style={{ padding: "8px 12px", fontSize: 13, color: "#DC2626" }}
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Create Group Modal */}
        {showCreateModal && (
          <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000, padding: 20,
          }}>
            <div style={{
              background: "white", borderRadius: 16, padding: 32,
              width: "100%", maxWidth: 480, maxHeight: "90vh", overflow: "auto",
            }}>
              <h2 style={{ marginBottom: 24 }}>Create New Group</h2>

              <form onSubmit={handleCreateTeam}>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 500 }}>
                    Group Name *
                  </label>
                  <input
                    type="text"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    placeholder="e.g., Engineering, Sales, HR"
                    required
                    style={{
                      width: "100%", padding: "12px 14px",
                      border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 15,
                    }}
                  />
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 500 }}>
                    Description
                  </label>
                  <textarea
                    value={newTeamDescription}
                    onChange={(e) => setNewTeamDescription(e.target.value)}
                    placeholder="What does this group work on?"
                    rows={3}
                    style={{
                      width: "100%", padding: "12px 14px",
                      border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 15,
                      resize: "vertical",
                    }}
                  />
                </div>

                <div style={{ marginBottom: 24 }}>
                  <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>
                    Group Color
                  </label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {colorOptions.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setNewTeamColor(color)}
                        style={{
                          width: 36, height: 36, borderRadius: 8,
                          background: color,
                          border: newTeamColor === color ? "3px solid #111" : "2px solid transparent",
                          cursor: "pointer",
                          transition: "transform 0.1s",
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.1)"}
                        onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                      />
                    ))}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="btn"
                    style={{ padding: "12px 24px" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating || !newTeamName.trim()}
                    className="btn btn-primary"
                    style={{ padding: "12px 24px", opacity: creating ? 0.7 : 1 }}
                  >
                    {creating ? "Creating..." : "Create Group"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
}