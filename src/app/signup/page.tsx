"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const redirectTo = searchParams.get("redirect");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Validate password length
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      setLoading(false);
      return;
    }

    // Validate passwords match
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    // Validate company name if not invite
    if (!inviteToken && !companyName.trim()) {
      setError("Organization name is required");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          password,
          companyName: inviteToken ? undefined : companyName.trim(),
          inviteToken,
          redirectTo: redirectTo || inviteToken ? `/invite/${inviteToken}` : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Signup failed");
        setLoading(false);
        return;
      }

      // Show success message - user needs to confirm email
      setSuccess(true);
    } catch (err) {
      setError("An error occurred. Please try again.");
      setLoading(false);
    }
  };

  // Success state - show email confirmation message
  if (success) {
    return (
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div className="card" style={{ padding: 40, textAlign: "center" }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #10B981 0%, #34D399 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 36,
              margin: "0 auto 24px",
            }}
          >
            ✉️
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12, color: "#111827" }}>
            Check your email
          </h2>
          <p style={{ color: "#6B7280", fontSize: 15, lineHeight: 1.6, marginBottom: 24 }}>
            We've sent a confirmation link to<br />
            <strong style={{ color: "#111827" }}>{email}</strong>
          </p>
          <p style={{ color: "#9CA3AF", fontSize: 14, marginBottom: 24 }}>
            Click the link in the email to verify your account and get started.
          </p>
          <div style={{ 
            padding: 16, 
            background: "#F3F4F6", 
            borderRadius: 8,
            fontSize: 13,
            color: "#6B7280"
          }}>
            <strong>Didn't receive the email?</strong><br />
            Check your spam folder or{" "}
            <button
              onClick={() => setSuccess(false)}
              style={{
                background: "none",
                border: "none",
                color: "#7C3AED",
                cursor: "pointer",
                fontWeight: 600,
                padding: 0,
              }}
            >
              try again
            </button>
          </div>
        </div>
        <p
          style={{
            textAlign: "center",
            marginTop: 24,
            color: "#6B7280",
            fontSize: 14,
          }}
        >
          Already confirmed?{" "}
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
          📚
        </div>
        <h1
          style={{
            fontSize: 16,
            fontWeight: 500,
            marginBottom: 16,
            color: "#9CA3AF",
            letterSpacing: "0.5px",
          }}
        >
          PrimeStride Atlas
        </h1>
        <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8, color: "#111827" }}>
          {inviteToken ? "Accept Invitation" : "Create your account"}
        </h2>
        <p style={{ color: "#6B7280", margin: 0, fontSize: 15 }}>
          {inviteToken
            ? "Sign up to join your team"
            : "Start managing knowledge with your team"}
        </p>
      </div>

      <div className="card" style={{ padding: 32 }}>
        {inviteToken && (
          <div
            style={{
              padding: 14,
              borderRadius: 10,
              background: "#EDE9FE",
              border: "1px solid #DDD6FE",
              color: "#6D28D9",
              fontSize: 14,
              marginBottom: 24,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span style={{ fontSize: 20 }}>🎉</span>
            <span>You've been invited to join an organization!</span>
          </div>
        )}

        <form onSubmit={handleSignup}>
          {/* Email */}
          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                display: "block",
                fontSize: 14,
                fontWeight: 600,
                marginBottom: 8,
                color: "#374151",
              }}
            >
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              autoComplete="email"
              style={{
                width: "100%",
                padding: "12px 14px",
                border: "2px solid #E5E7EB",
                borderRadius: 10,
                fontSize: 15,
                transition: "border-color 0.2s",
                outline: "none",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#7C3AED")}
              onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                display: "block",
                fontSize: 14,
                fontWeight: 600,
                marginBottom: 8,
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
              minLength={8}
              autoComplete="new-password"
              style={{
                width: "100%",
                padding: "12px 14px",
                border: "2px solid #E5E7EB",
                borderRadius: 10,
                fontSize: 15,
                transition: "border-color 0.2s",
                outline: "none",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#7C3AED")}
              onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
            />
            <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: 6, marginBottom: 0 }}>
              Must be at least 8 characters
            </p>
          </div>

          {/* Confirm Password */}
          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                display: "block",
                fontSize: 14,
                fontWeight: 600,
                marginBottom: 8,
                color: "#374151",
              }}
            >
              Confirm password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
              autoComplete="new-password"
              style={{
                width: "100%",
                padding: "12px 14px",
                border: confirmPassword && password !== confirmPassword 
                  ? "2px solid #EF4444" 
                  : "2px solid #E5E7EB",
                borderRadius: 10,
                fontSize: 15,
                transition: "border-color 0.2s",
                outline: "none",
              }}
              onFocus={(e) => {
                if (!(confirmPassword && password !== confirmPassword)) {
                  e.target.style.borderColor = "#7C3AED";
                }
              }}
              onBlur={(e) => {
                if (!(confirmPassword && password !== confirmPassword)) {
                  e.target.style.borderColor = "#E5E7EB";
                }
              }}
            />
            {confirmPassword && password !== confirmPassword && (
              <p style={{ fontSize: 12, color: "#EF4444", marginTop: 6, marginBottom: 0 }}>
                Passwords do not match
              </p>
            )}
          </div>

          {/* Company Name (only if not invite) */}
          {!inviteToken && (
            <div style={{ marginBottom: 24 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 14,
                  fontWeight: 600,
                  marginBottom: 8,
                  color: "#374151",
                }}
              >
                Organization name
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Acme Corp"
                required
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  border: "2px solid #E5E7EB",
                  borderRadius: 10,
                  fontSize: 15,
                  transition: "border-color 0.2s",
                  outline: "none",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#7C3AED")}
                onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
              />
              <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: 6, marginBottom: 0 }}>
                This will be your workspace name
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div
              style={{
                padding: 14,
                borderRadius: 10,
                background: "#FEE2E2",
                border: "1px solid #FCA5A5",
                color: "#991B1B",
                fontSize: 14,
                marginBottom: 20,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || (confirmPassword !== "" && password !== confirmPassword)}
            style={{
              width: "100%",
              padding: "14px 16px",
              fontSize: 16,
              fontWeight: 600,
              borderRadius: 10,
              border: "none",
              background: loading || (confirmPassword !== "" && password !== confirmPassword)
                ? "#D1D5DB"
                : "linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)",
              color: "white",
              cursor: loading || (confirmPassword !== "" && password !== confirmPassword) 
                ? "not-allowed" 
                : "pointer",
              boxShadow: loading ? "none" : "0 4px 14px rgba(124, 58, 237, 0.25)",
              transition: "all 0.2s",
            }}
          >
            {loading ? "Creating account..." : "Create account"}
          </button>

          {/* Terms */}
          <p style={{ 
            fontSize: 12, 
            color: "#9CA3AF", 
            textAlign: "center", 
            marginTop: 16,
            marginBottom: 0,
            lineHeight: 1.5
          }}>
            By signing up, you agree to our{" "}
            <a href="/terms" style={{ color: "#7C3AED", textDecoration: "none" }}>
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="/privacy" style={{ color: "#7C3AED", textDecoration: "none" }}>
              Privacy Policy
            </a>
          </p>
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
            fontWeight: 600,
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
        background: "linear-gradient(135deg, #F8F7FF 0%, #F3E8FF 100%)",
      }}
    >
      <Suspense fallback={
        <div style={{ textAlign: "center", color: "#6B7280" }}>
          Loading...
        </div>
      }>
        <SignupForm />
      </Suspense>
    </main>
  );
}