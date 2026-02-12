"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Member = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  created_at: string;
};

type Invitation = {
  id: string;
  email: string;
  role: string;
  created_at: string;
  expires_at: string;
};

export default function TeamPage() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [currentUserRole, setCurrentUserRole] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviting, setInviting] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadTeam();
    loadCurrentUser();
  }, []);

  const loadCurrentUser = async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setCurrentUserId(data.user?.id || "");
        setCurrentUserRole(data.user?.role || "");
      }
    } catch (error) {
      console.error("Failed to load current user:", error);
    }
  };

  const loadTeam = async () => {
    try {
      const res = await fetch("/api/team/members");
      const data = await res.json();

      if (res.ok) {
        setMembers(data.members || []);
        setInvitations(data.pending_invitations || []);
      } else {
        setError(data.error || "Failed to load team");
      }
    } catch (error) {
      setError("Failed to load team");
    } finally {
      setLoading(false);
    }
  };

  const sendInvite = async () => {
    setError("");
    setInviting(true);

    try {
      const res = await fetch("/api/invitations/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });

      const data = await res.json();

      if (res.ok) {
        setInviteUrl(data.invitation.inviteUrl);
        setInviteEmail("");
        setInviteRole("member");
        loadTeam(); // Refresh list
      } else {
        setError(data.error || "Failed to send invitation");
      }
    } catch (error) {
      setError("Failed to send invitation");
    } finally {
      setInviting(false);
    }
  };

  const removeMember = async (memberId: string, memberEmail: string) => {
    if (memberId === currentUserId) {
      alert("You cannot remove yourself from the team");
      return;
    }

    if (!confirm(`Are you sure you want to remove ${memberEmail} from the team?`)) {
      return;
    }

    try {
      const res = await fetch("/api/team/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: memberId }),
      });

      if (res.ok) {
        loadTeam(); // Refresh list
      } else {
        const data = await res.json();
        alert(data.error || "Failed to remove member");
      }
    } catch (error) {
      alert("Failed to remove member");
    }
  };

  const changeRole = async (memberId: string, memberEmail: string, newRole: string) => {
    if (memberId === currentUserId) {
      alert("You cannot change your own role");
      return;
    }

    if (!confirm(`Change ${memberEmail}'s role to ${newRole}?`)) {
      return;
    }

    try {
      const res = await fetch("/api/team/change-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: memberId, role: newRole }),
      });

      if (res.ok) {
        loadTeam(); // Refresh list
      } else {
        const data = await res.json();
        alert(data.error || "Failed to change role");
      }
    } catch (error) {
      alert("Failed to change role");
    }
  };

  const cancelInvitation = async (invitationId: string, email: string) => {
    if (!confirm(`Cancel invitation for ${email}?`)) {
      return;
    }

    try {
      const res = await fetch("/api/invitations/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId }),
      });

      if (res.ok) {
        loadTeam(); // Refresh list
      } else {
        const data = await res.json();
        alert(data.error || "Failed to cancel invitation");
      }
    } catch (error) {
      alert("Failed to cancel invitation");
    }
  };

  const resendInvitation = async (email: string, role: string) => {
    try {
      const res = await fetch("/api/invitations/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });

      const data = await res.json();

      if (res.ok) {
        alert(`Invitation resent to ${email}`);
        loadTeam();
      } else {
        alert(data.error || "Failed to resend invitation");
      }
    } catch (error) {
      alert("Failed to resend invitation");
    }
  };

  const isAdmin = currentUserRole === "owner" || currentUserRole === "admin";

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <div>Loading team...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "80px 20px", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12, color: "#111827" }}>Access Restricted</h1>
        <p style={{ color: "#6B7280", marginBottom: 24 }}>
          Only Admins and Owners can access Team Settings. Contact your organization admin if you need access.
        </p>
        <Link href="/library" style={{ display: "inline-block", padding: "10px 24px", background: "#7C3AED", color: "white", borderRadius: 8, textDecoration: "none", fontWeight: 600 }}>
          ← Back to Library
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 20px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 32,
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>
            Team Settings
          </h1>
          <p style={{ color: "#6B7280" }}>Manage your organization members</p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <Link href="/library" className="btn">
            ← Back to Library
          </Link>
          {isAdmin && (
            <button
              onClick={() => setShowInviteModal(true)}
              className="btn btn-primary"
            >
              + Invite Member
            </button>
          )}
        </div>
      </div>

      {/* Team Members */}
      <div className="card" style={{ marginBottom: 24, padding: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>
          Team Members ({members.length})
        </h2>
        <div style={{ display: "grid", gap: 12 }}>
          {members.map((member) => (
            <div
              key={member.id}
              style={{
                padding: 16,
                border: "1px solid #E5E7EB",
                borderRadius: 8,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
                  {member.email}
                  {member.id === currentUserId && (
                    <span
                      style={{
                        background: "#DBEAFE",
                        color: "#1E40AF",
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      You
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: "#9CA3AF" }}>
                  Joined {new Date(member.created_at).toLocaleDateString()}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {/* Role Badge/Dropdown */}
                {isAdmin && member.id !== currentUserId && member.role !== "owner" ? (
                  <select
                    value={member.role}
                    onChange={(e) => changeRole(member.id, member.email, e.target.value)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 6,
                      border: "1px solid #E5E7EB",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      background:
                        member.role === "admin" ? "#DBEAFE" : "#F3F4F6",
                      color: member.role === "admin" ? "#3B82F6" : "#6B7280",
                    }}
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                ) : (
                  <span
                    className="badge"
                    style={{
                      background:
                        member.role === "owner"
                          ? "#DCFCE7"
                          : member.role === "admin"
                          ? "#DBEAFE"
                          : "#F3F4F6",
                      color:
                        member.role === "owner"
                          ? "#16A34A"
                          : member.role === "admin"
                          ? "#3B82F6"
                          : "#6B7280",
                      padding: "6px 12px",
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    {member.role}
                  </span>
                )}

                {/* Remove Button */}
                {isAdmin && member.id !== currentUserId && member.role !== "owner" && (
                  <button
                    onClick={() => removeMember(member.id, member.email)}
                    style={{
                      padding: "6px 12px",
                      background: "#FEE2E2",
                      color: "#DC2626",
                      border: "1px solid #FCA5A5",
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>
            Pending Invitations ({invitations.length})
          </h2>
          <div style={{ display: "grid", gap: 12 }}>
            {invitations.map((invite) => (
              <div
                key={invite.id}
                style={{
                  padding: 16,
                  border: "1px solid #E5E7EB",
                  borderRadius: 8,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 16,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>
                    {invite.email}
                  </div>
                  <div style={{ fontSize: 13, color: "#9CA3AF" }}>
                    Invited as {invite.role} •{" "}
                    {new Date(invite.created_at).toLocaleDateString()}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span
                    className="badge"
                    style={{
                      background: "#FEF3C7",
                      color: "#92400E",
                      padding: "6px 12px",
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    Pending
                  </span>

                  {isAdmin && (
                    <>
                      <button
                        onClick={() => resendInvitation(invite.email, invite.role)}
                        style={{
                          padding: "6px 12px",
                          background: "#DBEAFE",
                          color: "#3B82F6",
                          border: "1px solid #93C5FD",
                          borderRadius: 6,
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Resend
                      </button>
                      <button
                        onClick={() => cancelInvitation(invite.id, invite.email)}
                        style={{
                          padding: "6px 12px",
                          background: "#FEE2E2",
                          color: "#DC2626",
                          border: "1px solid #FCA5A5",
                          borderRadius: 6,
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => {
            setShowInviteModal(false);
            setInviteUrl("");
            setError("");
          }}
        >
          <div
            className="card"
            style={{ maxWidth: 500, width: "100%", padding: 32, margin: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            {!inviteUrl ? (
              <>
                <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>
                  Invite Team Member
                </h2>

                {error && (
                  <div
                    style={{
                      padding: 12,
                      background: "#FEE2E2",
                      border: "1px solid #FCA5A5",
                      borderRadius: 8,
                      color: "#991B1B",
                      fontSize: 14,
                      marginBottom: 16,
                    }}
                  >
                    {error}
                  </div>
                )}

                <div style={{ marginBottom: 16 }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: 6,
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@company.com"
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      border: "1px solid #E5E7EB",
                      borderRadius: 8,
                    }}
                  />
                </div>

                <div style={{ marginBottom: 24 }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: 6,
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    Role
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      border: "1px solid #E5E7EB",
                      borderRadius: 8,
                    }}
                  >
                    <option value="member">Member - Can view and create documents</option>
                    <option value="admin">Admin - Can manage team</option>
                  </select>
                </div>

                <div style={{ display: "flex", gap: 12 }}>
                  <button
                    onClick={() => {
                      setShowInviteModal(false);
                      setInviteEmail("");
                      setInviteRole("member");
                      setError("");
                    }}
                    className="btn"
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={sendInvite}
                    disabled={inviting || !inviteEmail}
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                  >
                    {inviting ? "Sending..." : "Send Invite"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>
                  Invitation Sent! 🎉
                </h2>
                <p style={{ marginBottom: 16, color: "#6B7280" }}>
                  An email has been sent with the invitation link. You can also copy and share it directly:
                </p>
                <div
                  style={{
                    padding: 12,
                    background: "#F3F4F6",
                    borderRadius: 8,
                    wordBreak: "break-all",
                    fontSize: 13,
                    marginBottom: 16,
                    fontFamily: "monospace",
                  }}
                >
                  {inviteUrl}
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(inviteUrl);
                    alert("Link copied to clipboard!");
                  }}
                  className="btn btn-primary"
                  style={{ width: "100%", marginBottom: 12 }}
                >
                  📋 Copy Link
                </button>
                <button
                  onClick={() => {
                    setShowInviteModal(false);
                    setInviteUrl("");
                  }}
                  className="btn"
                  style={{ width: "100%" }}
                >
                  Done
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}