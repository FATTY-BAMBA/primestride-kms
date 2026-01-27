"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signInWithEmail, signInWithGoogle } = useAuth();

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await signInWithEmail(email, password);
    
    if (error) {
      setError(error);
    }
    
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setError("");
    setLoading(true);
    await signInWithGoogle();
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
            📚
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20, color: "var(--text-secondary)" }}>
            Performance-Aware Knowledge System
          </h1>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Welcome back</h2>
          <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: 14 }}>
            Sign in to your account to continue
          </p>
        </div>

        <div className="card" style={{ padding: 32 }}>
          {/* Google Sign In */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px 16px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-color)",
              background: "var(--bg-primary)",
              color: "var(--text-primary)",
              fontSize: 15,
              fontWeight: 500,
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              opacity: loading ? 0.7 : 1,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, margin: "24px 0" }}>
            <div style={{ flex: 1, height: 1, background: "var(--border-color)" }} />
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>or</span>
            <div style={{ flex: 1, height: 1, background: "var(--border-color)" }} />
          </div>

          {/* Email Form */}
          <form onSubmit={handleEmailLogin}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: 6, color: "var(--text-secondary)" }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                style={{ width: "100%" }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: 6, color: "var(--text-secondary)" }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{ width: "100%" }}
              />
            </div>

            {error && (
              <div style={{ padding: 12, borderRadius: "var(--radius-md)", background: "var(--accent-red-soft)", color: "var(--accent-red)", fontSize: 14, marginBottom: 16 }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ width: "100%", padding: "12px 16px", fontSize: 15, opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer", marginBottom: 16 }}
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>

            {/* Forgot Password Link */}
            <div style={{ textAlign: "center", fontSize: 14 }}>
              <Link href="/reset-password" style={{ color: "#4F46E5" }}>
                Forgot password?
              </Link>
            </div>
          </form>
        </div>

        <p style={{ textAlign: "center", marginTop: 24, color: "var(--text-secondary)", fontSize: 14 }}>
          Don&apos;t have an account?{" "}
          <Link href="/signup" style={{ color: "#4F46E5", fontWeight: 500 }}>
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}