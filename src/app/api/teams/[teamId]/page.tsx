"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import UserMenu from "@/components/UserMenu";

interface TeamMember {
  user_id: string;
  email: string;
  full_name: string | null;
  role: string;
  added_at: string;
}

interface TeamDoc {
  doc_id: string;
  title: string;
  updated_at: string;
}

interface Team {
  id: string;
  name: string;
  description: string | null;
  color: string;
  created_at: string;
}

interface OrgMember {
  user_id: string;
  email: string;
  full_name: string | null;
  role: string;
}

export default function TeamDetailPage() {
  const params = useParams();
  const router = useRouter();
  const teamId = params.teamId as string;

  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [documents, setDocuments] = useState<TeamDoc[]>([]);
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userOrgRole, setUserOrgRole] = useState<string>("");
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);

  // Edit form
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editColor, setEditColor] = useState("");
  const [saving, setSaving] = useState(false);

  const canManage = ["owner", "admin"].includes(userOrgRole) || userRole === "lead";

  useEffect(() => {
    fetchTeamDetails();
    fetchOrgMembers();
  }, [teamId]);

  const fetchTeamDetails = async () => {
    try {
      const res = await fetch(`/api/teams/${teamId}`);
      const data = await res.json();

      if (res.ok) {
        setTeam(data.team);
        setMembers(data.members || []);
        setDocuments(data.documents || []);
        setUserRole(data.user_role);
        setUserOrgRole(data.user_org_role || "");
        setIsMember(data.is_member);

        // Set edit form defaults
        setEditName(data.team.name);
        setEditDescription(data.team.description || "");
        setEditColor(data.team.color);
      } else {
        setError(data.error || "Failed to load team");
      }
    } catch (err) {
      setError("Failed to load team");
    } finally {
      setLoading(false);
    }
  };

  const fetchOrgMembers = async () => {
    try {
      const res = await fetch("/api/team/members");
      const data = await res.json();
      if (res.ok) {
        setOrgMembers(data.members || []);
      }
    } catch (err) {
      console.error("Failed to fetch org members:", err);
    }
  };

  const handleAddMembers = async () => {
    if (selectedMembers.length === 0) return;

    setAdding(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: selectedMembers }),
      });

      if (res.ok) {
        setShowAddMemberModal(false);
        setSelectedMembers([]);
        fetchTeamDetails();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to add members");
      }
    } catch (err) {
      alert("Failed to add members");
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveMember = async (userId: string, email: string) => {
    if (!confirm(`Remove ${email} from this team?`)) return;

    try {
      const res = await fetch(`/api/teams/${teamId}/members?userId=${userId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setMembers(members.filter(m => m.user_id !== userId));
      } else {
        const data = await res.json();
        alert(data.error || "Failed to remove member");
      }
    } catch (err) {
      alert("Failed to remove member");
    }
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/teams/${teamId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: userId, role: newRole }),
      });

      if (res.ok) {
        setMembers(members.map(m => 
          m.user_id === userId ? { ...m, role: newRole } : m
        ));
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update role");
      }
    } catch (err) {
      alert("Failed to update role");
    }
  };

  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/teams/${teamId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          description: editDescription,
          color: editColor,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setTeam(data.team);
        setShowEditModal(false);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update team");
      }
    } catch (err) {
      alert("Failed to update team");
    } finally {
      setSaving(false);
    }
  };

  const colorOptions = [
    "#7C3AED", "#3B82F6", "#10B981", "#F59E0B",
    "#EF4444", "#EC4899", "#6366F1", "#14B8A6",
  ];

  // Filter org members not already in team
  const availableMembers = orgMembers.filter(
    om => !members.find(m => m.user_id === om.user_id)
  );

  if (loading) {
    return (
      <ProtectedRoute>
        <main className="container">
          <div className="loading">Loading team...</div>
        </main>
      </ProtectedRoute>
    );
  }

  if (error || !team) {
    return (
      <ProtectedRoute>
        <main className="container">
          <div className="card" style={{ textAlign: "center", padding: 40 }}>
            <h2>Team not found</h2>
            <p style={{ color: "var(--text-muted)", marginBottom: 20 }}>{error}</p>
            <Link href="/teams" className="btn btn-primary">Back to Teams</Link>
          </div>
        </main>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <main className="container" style={{ maxWidth: 900 }}>
        {/* Header */}
        <header style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: team.color,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20, color: "white", fontWeight: 700,
              }}>
                {team.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 style={{ fontSize: 22, margin: 0 }}>{team.name}</h1>
                {team.description && (
                  <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
                    {team.description}
                  </p>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Link href="/teams" className="btn" style={{ padding: "8px 14px", fontSize: 13 }}>
                ← Back
              </Link>
              {canManage && (
                <button
                  onClick={() => setShowEditModal(true)}
                  className="btn"
                  style={{ padding: "8px 14px", fontSize: 13 }}
                >
                  ✏️ Edit
                </button>
              )}
              <UserMenu />
            </div>
          </div>
        </header>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 16, marginBottom: 32 }}>
          <div className="card" style={{ textAlign: "center", padding: 20 }}>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{members.length}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Members</div>
          </div>
          <div className="card" style={{ textAlign: "center", padding: 20 }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: "var(--accent-blue)" }}>{documents.length}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Documents</div>
          </div>
        </div>

        {/* Members Section */}
        <section style={{ marginBottom: 40 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, margin: 0 }}>Team Members</h2>
            {canManage && (
              <button
                onClick={() => setShowAddMemberModal(true)}
                className="btn btn-primary"
                style={{ padding: "8px 14px", fontSize: 13 }}
              >
                ➕ Add Member
              </button>
            )}
          </div>

          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {members.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>
                No members yet
              </div>
            ) : (
              members.map((member, i) => (
                <div
                  key={member.user_id}
                  style={{
                    padding: "16px 20px",
                    borderBottom: i < members.length - 1 ? "1px solid var(--border)" : "none",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 16,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: "50%",
                      background: "var(--bg-secondary)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 14, fontWeight: 600,
                    }}>
                      {(member.full_name || member.email).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 500 }}>
                        {member.full_name || member.email}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {member.email}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {canManage ? (
                      <select
                        value={member.role}
                        onChange={(e) => handleChangeRole(member.user_id, e.target.value)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 6,
                          border: "1px solid var(--border)",
                          fontSize: 13,
                          background: member.role === "lead" ? "#FEF3C7" : "white",
                        }}
                      >
                        <option value="member">Member</option>
                        <option value="lead">Lead</option>
                      </select>
                    ) : (
                      <span style={{
                        padding: "4px 10px",
                        background: member.role === "lead" ? "#FEF3C7" : "#F3F4F6",
                        color: member.role === "lead" ? "#92400E" : "#4B5563",
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 600,
                        textTransform: "capitalize",
                      }}>
                        {member.role}
                      </span>
                    )}

                    {canManage && (
                      <button
                        onClick={() => handleRemoveMember(member.user_id, member.email)}
                        style={{
                          padding: "6px 10px",
                          background: "transparent",
                          border: "none",
                          color: "#DC2626",
                          cursor: "pointer",
                          fontSize: 14,
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Documents Section */}
        <section>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, margin: 0 }}>Team Documents</h2>
            <Link
              href={`/library?team=${teamId}`}
              className="btn"
              style={{ padding: "8px 14px", fontSize: 13 }}
            >
              View All →
            </Link>
          </div>

          <div className="card">
            {documents.length === 0 ? (
              <div style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>
                No documents assigned to this team yet
              </div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {documents.map((doc) => (
                  <Link
                    key={doc.doc_id}
                    href={`/library/${encodeURIComponent(doc.doc_id)}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 16px",
                      background: "var(--bg-secondary)",
                      borderRadius: 8,
                      textDecoration: "none",
                      color: "inherit",
                    }}
                  >
                    <span style={{ fontWeight: 500 }}>{doc.title}</span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {new Date(doc.updated_at).toLocaleDateString()}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Add Member Modal */}
        {showAddMemberModal && (
          <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000, padding: 20,
          }}>
            <div style={{
              background: "white", borderRadius: 16, padding: 32,
              width: "100%", maxWidth: 480, maxHeight: "80vh", overflow: "auto",
            }}>
              <h2 style={{ marginBottom: 20 }}>Add Members to {team.name}</h2>

              {availableMembers.length === 0 ? (
                <p style={{ color: "var(--text-muted)", marginBottom: 20 }}>
                  All organization members are already in this team.
                </p>
              ) : (
                <div style={{ marginBottom: 20, maxHeight: 300, overflow: "auto" }}>
                  {availableMembers.map((member) => (
                    <label
                      key={member.user_id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "12px 16px",
                        borderRadius: 8,
                        cursor: "pointer",
                        background: selectedMembers.includes(member.user_id) ? "#F5F3FF" : "transparent",
                        marginBottom: 4,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedMembers.includes(member.user_id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedMembers([...selectedMembers, member.user_id]);
                          } else {
                            setSelectedMembers(selectedMembers.filter(id => id !== member.user_id));
                          }
                        }}
                        style={{ width: 18, height: 18 }}
                      />
                      <div>
                        <div style={{ fontWeight: 500 }}>
                          {member.full_name || member.email}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                          {member.email} • {member.role}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                <button
                  onClick={() => {
                    setShowAddMemberModal(false);
                    setSelectedMembers([]);
                  }}
                  className="btn"
                  style={{ padding: "12px 24px" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddMembers}
                  disabled={adding || selectedMembers.length === 0}
                  className="btn btn-primary"
                  style={{ padding: "12px 24px", opacity: adding ? 0.7 : 1 }}
                >
                  {adding ? "Adding..." : `Add ${selectedMembers.length} Member(s)`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Team Modal */}
        {showEditModal && (
          <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000, padding: 20,
          }}>
            <div style={{
              background: "white", borderRadius: 16, padding: 32,
              width: "100%", maxWidth: 480,
            }}>
              <h2 style={{ marginBottom: 24 }}>Edit Team</h2>

              <form onSubmit={handleSaveTeam}>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 500 }}>
                    Team Name *
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
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
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
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
                    Team Color
                  </label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {colorOptions.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setEditColor(color)}
                        style={{
                          width: 36, height: 36, borderRadius: 8,
                          background: color,
                          border: editColor === color ? "3px solid #111" : "2px solid transparent",
                          cursor: "pointer",
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="btn"
                    style={{ padding: "12px 24px" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving || !editName.trim()}
                    className="btn btn-primary"
                    style={{ padding: "12px 24px", opacity: saving ? 0.7 : 1 }}
                  >
                    {saving ? "Saving..." : "Save Changes"}
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