"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface InvitationDetails {
  organization_name: string;
  email?: string;
  invited_email?: string;
  current_email?: string;
  role: string;
  expires_at: string;
  status: string;
  requires_auth?: boolean;
  email_mismatch?: boolean;
  can_accept?: boolean;
  error?: string;
}

export default function AcceptInvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchInvitation();
  }, [token]);

  const fetchInvitation = async () => {
    try {
      const res = await fetch(`/api/invitations/${token}`);
      const data = await res.json();

      if (!res.ok && res.status !== 403) {
        setError(data.error || "Invalid invitation");
        setLoading(false);
        return;
      }

      setInvitation(data);
      if (data.error && res.status === 403) {
        setError(data.error);
      }
      setLoading(false);
    } catch (err) {
      setError("Failed to load invitation");
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    setAccepting(true);
    setError(null);

    try {
      const res = await fetch(`/api/invitations/${token}/accept`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to accept invitation");
        setAccepting(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/library");
      }, 2000);
    } catch (err) {
      setError("Failed to accept invitation");
      setAccepting(false);
    }
  };

  const handleDecline = async () => {
    if (!confirm("Are you sure you want to decline this invitation?")) return;

    try {
      const res = await fetch(`/api/invitations/${token}/decline`, {
        method: "POST",
      });

      if (res.ok) {
        router.push("/");
      } else {
        const data = await res.json();
        setError(data.error || "Failed to decline invitation");
      }
    } catch (err) {
      setError("Failed to decline invitation");
    }
  };

  // Loading state
  if (loading) {
    return (
      <div style={{ 
        minHeight: "100vh", 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center",
        background: "#F9FAFB"
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📨</div>
          <p style={{ color: "#6B7280" }}>Loading invitation...</p>
        </div>
      </div>
    );
  }

  // Error state (no invitation data at all)
  if (error && !invitation) {
    return (
      <div style={{ 
        minHeight: "100vh", 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center",
        background: "#F9FAFB",
        padding: 20
      }}>
        <div style={{
          maxWidth: 450,
          width: "100%",
          background: "white",
          borderRadius: 16,
          padding: 40,
          boxShadow: "0 4px 24px rgba(0,0,0,0.1)",
          textAlign: "center"
        }}>
          <div style={{ fontSize: 64, marginBottom: 24 }}>❌</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12, color: "#111827" }}>
            Invalid Invitation
          </h1>
          <p style={{ color: "#6B7280", marginBottom: 32, lineHeight: 1.6 }}>
            {error}
          </p>
          <Link
            href="/"
            className="btn btn-primary"
            style={{ padding: "14px 24px", fontSize: 16 }}
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  // Needs login state
  if (invitation?.requires_auth) {
    return (
      <div style={{ 
        minHeight: "100vh", 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center",
        background: "#F9FAFB",
        padding: 20
      }}>
        <div style={{
          maxWidth: 500,
          width: "100%",
          background: "white",
          borderRadius: 16,
          padding: 40,
          boxShadow: "0 4px 24px rgba(0,0,0,0.1)",
        }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>📨</div>
            <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8, color: "#111827" }}>
              You're Invited!
            </h1>
            <p style={{ color: "#6B7280", fontSize: 16 }}>
              Join <strong>{invitation.organization_name}</strong> as a <strong>{invitation.role}</strong>
            </p>
          </div>

          <div style={{
            background: "#F9FAFB",
            borderRadius: 12,
            padding: 20,
            marginBottom: 24,
            textAlign: "center"
          }}>
            <p style={{ margin: 0, color: "#6B7280", fontSize: 14 }}>
              This invitation was sent to:
            </p>
            <p style={{ margin: "8px 0 0 0", fontWeight: 600, color: "#111827", fontSize: 16 }}>
              {invitation.invited_email}
            </p>
          </div>

          <div style={{
            background: "#FEF3C7",
            border: "1px solid #FDE68A",
            borderRadius: 8,
            padding: 16,
            marginBottom: 24
          }}>
            <p style={{ margin: 0, color: "#92400E", fontSize: 14 }}>
              🔐 Sign in or create an account with <strong>{invitation.invited_email}</strong> to accept this invitation.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Link
              href={`/login?redirect_url=/invite/${token}`}
              className="btn btn-primary"
              style={{ padding: "16px 24px", fontSize: 16, textAlign: "center", fontWeight: 600 }}
            >
              Sign In to Accept
            </Link>
            <Link
              href={`/signup?redirect_url=/invite/${token}`}
              className="btn"
              style={{ padding: "14px 24px", fontSize: 15, textAlign: "center" }}
            >
              Create Account
            </Link>
          </div>

          <p style={{ 
            textAlign: "center", 
            marginTop: 24, 
            fontSize: 13, 
            color: "#9CA3AF" 
          }}>
            Expires {new Date(invitation.expires_at).toLocaleDateString()}
          </p>
        </div>
      </div>
    );
  }

  // Email mismatch state
  if (invitation?.email_mismatch) {
    return (
      <div style={{ 
        minHeight: "100vh", 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center",
        background: "#F9FAFB",
        padding: 20
      }}>
        <div style={{
          maxWidth: 500,
          width: "100%",
          background: "white",
          borderRadius: 16,
          padding: 40,
          boxShadow: "0 4px 24px rgba(0,0,0,0.1)",
          textAlign: "center"
        }}>
          <div style={{ fontSize: 64, marginBottom: 24 }}>⚠️</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12, color: "#111827" }}>
            Email Mismatch
          </h1>
          <p style={{ color: "#6B7280", marginBottom: 24, lineHeight: 1.6 }}>
            This invitation was sent to <strong>{invitation.invited_email}</strong>, but you're signed in as <strong>{invitation.current_email}</strong>.
          </p>
          
          <div style={{
            background: "#FEF3C7",
            border: "1px solid #FDE68A",
            borderRadius: 8,
            padding: 16,
            marginBottom: 24
          }}>
            <p style={{ margin: 0, color: "#92400E", fontSize: 14 }}>
              Please sign out and sign in with <strong>{invitation.invited_email}</strong> to accept this invitation.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Link
              href="/login"
              className="btn btn-primary"
              style={{ padding: "14px 24px", fontSize: 16 }}
            >
              Sign In with Different Account
            </Link>
            <Link
              href="/"
              className="btn"
              style={{ padding: "14px 24px", fontSize: 15 }}
            >
              Go Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div style={{ 
        minHeight: "100vh", 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center",
        background: "#F9FAFB",
        padding: 20
      }}>
        <div style={{
          maxWidth: 450,
          width: "100%",
          background: "white",
          borderRadius: 16,
          padding: 40,
          boxShadow: "0 4px 24px rgba(0,0,0,0.1)",
          textAlign: "center"
        }}>
          <div style={{ fontSize: 64, marginBottom: 24 }}>🎉</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12, color: "#111827" }}>
            Welcome to {invitation?.organization_name}!
          </h1>
          <p style={{ color: "#6B7280", marginBottom: 16, lineHeight: 1.6 }}>
            You've successfully joined as a <strong>{invitation?.role}</strong>.
          </p>
          <p style={{ color: "#9CA3AF", fontSize: 14 }}>
            Redirecting to library...
          </p>
        </div>
      </div>
    );
  }

  // Main invitation view (can accept)
  return (
    <div style={{ 
      minHeight: "100vh", 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center",
      background: "#F9FAFB",
      padding: 20
    }}>
      <div style={{
        maxWidth: 500,
        width: "100%",
        background: "white",
        borderRadius: 16,
        padding: 40,
        boxShadow: "0 4px 24px rgba(0,0,0,0.1)",
      }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>📨</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8, color: "#111827" }}>
            You're Invited!
          </h1>
          <p style={{ color: "#6B7280", fontSize: 16 }}>
            You've been invited to join an organization
          </p>
        </div>

        {/* Invitation Details */}
        <div style={{
          background: "#F9FAFB",
          borderRadius: 12,
          padding: 24,
          marginBottom: 24
        }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Organization
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>
              {invitation?.organization_name}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Your Role
              </div>
              <div style={{ 
                display: "inline-block",
                padding: "6px 12px",
                background: invitation?.role === "admin" ? "#EEF2FF" : "#ECFDF5",
                color: invitation?.role === "admin" ? "#4F46E5" : "#059669",
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 600,
                textTransform: "capitalize"
              }}>
                {invitation?.role}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Your Email
              </div>
              <div style={{ fontSize: 14, color: "#111827" }}>
                {invitation?.email}
              </div>
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div style={{
            padding: 16,
            background: "#FEE2E2",
            borderRadius: 8,
            color: "#991B1B",
            marginBottom: 24,
            fontSize: 14
          }}>
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <button
            onClick={handleAccept}
            disabled={accepting}
            className="btn btn-primary"
            style={{
              padding: "16px 24px",
              fontSize: 16,
              fontWeight: 600,
              opacity: accepting ? 0.7 : 1,
              cursor: accepting ? "not-allowed" : "pointer"
            }}
          >
            {accepting ? "Joining..." : "✅ Accept Invitation"}
          </button>
          <button
            onClick={handleDecline}
            disabled={accepting}
            className="btn"
            style={{
              padding: "14px 24px",
              fontSize: 15,
              color: "#6B7280"
            }}
          >
            Decline
          </button>
        </div>

        {/* Footer */}
        <p style={{ 
          textAlign: "center", 
          marginTop: 24, 
          fontSize: 13, 
          color: "#9CA3AF" 
        }}>
          This invitation expires on {new Date(invitation?.expires_at || "").toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}