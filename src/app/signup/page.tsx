"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          companyName: inviteToken ? undefined : companyName,
          inviteToken,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Signup failed");
        setLoading(false);
        return;
      }

      router.push("/library");
    } catch (err) {
      setError("An error occurred. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div style={{ width: "100%", maxWidth: 420 }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: "linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 28,
            margin: "0 auto 16px",
          }}
        >
          🧭
        </div>
        <h1
          style={{
            fontSize: 18,
            fontWeight: 600,
            marginBottom: 20,
            color: "#6B7280",
          }}
        >
          PrimeStride Atlas
        </h1>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
          {inviteToken ? "Accept Invitation" : "Create your account"}
        </h2>
        <p style={{ color: "#6B7280", margin: 0, fontSize: 14 }}>
          {inviteToken
            ? "Join your team on Atlas"
            : "Start managing knowledge with your team"}
        </p>
      </div>

      <div className="card" style={{ padding: 32 }}>
        {inviteToken && (
          <div
            style={{
              padding: 12,
              borderRadius: 8,
              background: "#EDE9FE",
              border: "1px solid #DDD6FE",
              color: "#7C3AED",
              fontSize: 14,
              marginBottom: 24,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span style={{ fontSize: 18 }}>✉️</span>
            <span>
              You've been invited to join an organization. Sign up to accept.
            </span>
          </div>
        )}

        <form onSubmit={handleSignup}>
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: "block",
                fontSize: 14,
                fontWeight: 500,
                marginBottom: 6,
                color: "#374151",
              }}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              style={{
                width: "100%",
                padding: "10px 14px",
                border: "1px solid #E5E7EB",
                borderRadius: 8,
                fontSize: 15,
              }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: "block",
                fontSize: 14,
                fontWeight: 500,
                marginBottom: 6,
                color: "#374151",
              }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              style={{
                width: "100%",
                padding: "10px 14px",
                border: "1px solid #E5E7EB",
                borderRadius: 8,
                fontSize: 15,
              }}
            />
            <p
              style={{
                fontSize: 12,
                color: "#9CA3AF",
                marginTop: 6,
                marginBottom: 0,
              }}
            >
              Must be at least 6 characters
            </p>
          </div>

          {!inviteToken && (
            <div style={{ marginBottom: 24 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 14,
                  fontWeight: 500,
                  marginBottom: 6,
                  color: "#374151",
                }}
              >
                Company Name
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Acme Corp"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  border: "1px solid #E5E7EB",
                  borderRadius: 8,
                  fontSize: 15,
                }}
              />
              <p
                style={{
                  fontSize: 12,
                  color: "#9CA3AF",
                  marginTop: 6,
                  marginBottom: 0,
                }}
              >
                Your organization name (optional)
              </p>
            </div>
          )}

          {error && (
            <div
              style={{
                padding: 12,
                borderRadius: 8,
                background: "#FEE2E2",
                border: "1px solid #FCA5A5",
                color: "#991B1B",
                fontSize: 14,
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px 16px",
              fontSize: 15,
              fontWeight: 600,
              borderRadius: 10,
              border: "none",
              background: "linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)",
              color: "white",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              boxShadow: "0 4px 14px rgba(124, 58, 237, 0.25)",
            }}
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>
      </div>

      <p
        style={{
          textAlign: "center",
          marginTop: 24,
          color: "#6B7280",
          fontSize: 14,
        }}
      >
        Already have an account?{" "}
        <Link
          href="/login"
          style={{
            color: "#7C3AED",
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}

export default function SignupPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background: "#F8F7FF",
      }}
    >
      <Suspense fallback={<div>Loading...</div>}>
        <SignupForm />
      </Suspense>
    </main>
  );
}