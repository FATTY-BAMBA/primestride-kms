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
    <div className="auth-container">
      <div className="auth-card">
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div className="logo" style={{ fontSize: 40, marginBottom: 8 }}>
            📚
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
            Reset Password
          </h1>
          <p style={{ color: "#6B7280", fontSize: 14 }}>
            Enter your email and we'll send you a reset link
          </p>
        </div>

        {message && (
          <div
            style={{
              padding: 12,
              background: "#D1FAE5",
              border: "1px solid #10B981",
              borderRadius: 8,
              color: "#065F46",
              marginBottom: 16,
              fontSize: 14,
            }}
          >
            {message}
          </div>
        )}

        {error && (
          <div
            style={{
              padding: 12,
              background: "#FEE2E2",
              border: "1px solid #EF4444",
              borderRadius: 8,
              color: "#991B1B",
              marginBottom: 16,
              fontSize: 14,
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleResetPassword}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: "100%", marginBottom: 16 }}
          >
            {loading ? "Sending..." : "Send Reset Link"}
          </button>

          <div style={{ textAlign: "center", fontSize: 14 }}>
            <Link href="/login" style={{ color: "#4F46E5" }}>
              ← Back to login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}