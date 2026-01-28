"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  created_at: string;
}

interface Props {
  invitation: Invitation;
  organization: Organization;
  token: string;
}

export default function InvitationAcceptForm({
  invitation,
  organization,
  token,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAccept = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();

      if (res.ok) {
        router.push("/library");
      } else {
        setError(data.error || "Failed to accept invitation");
      }
    } catch (err) {
      setError("Failed to accept invitation");
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = async () => {
    if (!confirm("Are you sure you want to decline this invitation?")) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/invitations/decline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (res.ok) {
        router.push("/");
      } else {
        setError("Failed to decline invitation");
      }
    } catch (err) {
      setError("Failed to decline invitation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#F9FAFB",
        padding: 20,
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: 500,
          width: "100%",
          padding: 40,
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
              margin: "0 auto 20px",
            }}
          >
            ✉️
          </div>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 700,
              marginBottom: 8,
              color: "#111827",
            }}
          >
            You're Invited!
          </h1>
          <p style={{ color: "#6B7280", fontSize: 16 }}>
            Join your team on PrimeStride Atlas
          </p>
        </div>

        {/* Invitation Details */}
        <div
          style={{
            padding: 20,
            background: "#F9FAFB",
            borderRadius: 12,
            marginBottom: 24,
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 13,
                color: "#6B7280",
                marginBottom: 4,
                fontWeight: 500,
              }}
            >
              Organization
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>
              {organization.name}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 13,
                color: "#6B7280",
                marginBottom: 4,
                fontWeight: 500,
              }}
            >
              Your Role
            </div>
            <div
              style={{
                display: "inline-block",
                padding: "4px 12px",
                background: "#EEF2FF",
                color: "#4F46E5",
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 600,
                textTransform: "capitalize",
              }}
            >
              {invitation.role}
            </div>
          </div>

          <div>
            <div
              style={{
                fontSize: 13,
                color: "#6B7280",
                marginBottom: 4,
                fontWeight: 500,
              }}
            >
              Email
            </div>
            <div style={{ fontSize: 15, color: "#374151" }}>
              {invitation.email}
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div
            style={{
              padding: 16,
              marginBottom: 24,
              borderRadius: 8,
              background: "#FEE2E2",
              color: "#991B1B",
              fontSize: 14,
            }}
          >
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={handleAccept}
            disabled={loading}
            className="btn btn-primary"
            style={{
              flex: 1,
              padding: "14px 24px",
              fontSize: 16,
              fontWeight: 600,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Accepting..." : "Accept Invitation"}
          </button>
          <button
            onClick={handleDecline}
            disabled={loading}
            className="btn"
            style={{
              padding: "14px 24px",
              fontSize: 16,
              fontWeight: 600,
              opacity: loading ? 0.7 : 1,
            }}
          >
            Decline
          </button>
        </div>

        {/* Footer */}
        <p
          style={{
            textAlign: "center",
            marginTop: 24,
            fontSize: 13,
            color: "#9CA3AF",
          }}
        >
          By accepting, you'll gain access to your team's knowledge base and
          documents.
        </p>
      </div>
    </div>
  );
}