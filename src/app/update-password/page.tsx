"use client";

import { useState } from "react";
import Link from "next/link";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage(data.message);
        setEmail("");
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError("Failed to send reset email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div style={{ width: "100%", maxWidth: 420 }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              margin: "0 auto 16px",
            }}
          >
            🔑
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20, color: "var(--text-secondary)" }}>
            Performance-Aware Knowledge System
          </h1>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Reset Password</h2>
          <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: 14 }}>
            Enter your email and we'll send you a reset link
          </p>
        </div>

        <div className="card" style={{ padding: 32 }}>
          {message && (
            <div
              style={{
                padding: 12,
                borderRadius: "var(--radius-md)",
                background: "#D1FAE5",
                color: "#065F46",
                fontSize: 14,
                marginBottom: 16,
                border: "1px solid #10B981",
              }}
            >
              ✅ {message}
            </div>
          )}

          {error && (
            <div
              style={{
                padding: 12,
                borderRadius: "var(--radius-md)",
                background: "var(--accent-red-soft)",
                color: "var(--accent-red)",
                fontSize: 14,
                marginBottom: 16,
              }}
            >
              ❌ {error}
            </div>
          )}

          <form onSubmit={handleResetPassword}>
            <div style={{ marginBottom: 24 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 14,
                  fontWeight: 500,
                  marginBottom: 6,
                  color: "var(--text-secondary)",
                }}
              >
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={loading}
                style={{ width: "100%" }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{
                width: "100%",
                padding: "12px 16px",
                fontSize: 15,
                opacity: loading ? 0.7 : 1,
                cursor: loading ? "not-allowed" : "pointer",
                marginBottom: 16,
              }}
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </button>

            <div style={{ textAlign: "center", fontSize: 14 }}>
              <Link href="/login" style={{ color: "#4F46E5", fontWeight: 500 }}>
                ← Back to login
              </Link>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}