"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords don't match");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/update-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (res.ok) {
        alert("✅ Password updated successfully!");
        router.push("/library");
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError("Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div className="logo" style={{ fontSize: 40, marginBottom: 8 }}>
            🔒
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: "#111827" }}>
            Update Password
          </h1>
          <p style={{ color: "#6B7280", fontSize: 14 }}>
            Choose a strong password for your account
          </p>
        </div>

        {error && (
          <div
            style={{
              padding: 16,
              background: "#FEE2E2",
              border: "1px solid #EF4444",
              borderRadius: 8,
              color: "#991B1B",
              marginBottom: 24,
              fontSize: 14,
              lineHeight: 1.5,
            }}
          >
            ❌ {error}
          </div>
        )}

        <form onSubmit={handleUpdatePassword}>
          <div className="form-group">
            <label>New Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              required
              disabled={loading}
              minLength={6}
            />
          </div>

          <div className="form-group">
            <label>Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              required
              disabled={loading}
              minLength={6}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: "100%" }}
          >
            {loading ? "Updating..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}