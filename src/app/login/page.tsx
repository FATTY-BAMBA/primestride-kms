"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useSignIn, useAuth as useClerkAuth } from "@clerk/nextjs";

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, isLoaded, setActive } = useSignIn();
  const { isSignedIn } = useClerkAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Get redirect URL from query params (for invite flow)
  const redirectUrl = searchParams.get("redirect_url") || searchParams.get("redirect") || "/library";

  // Redirect if already signed in
  useEffect(() => {
    if (isSignedIn) {
      router.push(redirectUrl);
    }
  }, [isSignedIn, router, redirectUrl]);

  const handleOAuthSignIn = async (provider: "oauth_google" | "oauth_github") => {
    if (!signIn) return;
    
    try {
      await signIn.authenticateWithRedirect({
        strategy: provider,
        redirectUrl: "/sso-callback",
        redirectUrlComplete: redirectUrl,
      });
    } catch (err: any) {
      setError(err.errors?.[0]?.message || "OAuth sign in failed");
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signIn) return;

    setError("");
    setLoading(true);

    try {
      const result = await signIn.create({
        identifier: email,
        password,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.push(redirectUrl);
      }
    } catch (err: any) {
      console.error("Sign in error:", err);
      setError(err.errors?.[0]?.message || "Sign in failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded) {
    return (
      <div style={{ 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center", 
        minHeight: "100vh",
        background: "linear-gradient(135deg, #F8F7FF 0%, #EDE9FE 100%)",
      }}>
        <div style={{ color: "#6B7280" }}>Loading...</div>
      </div>
    );
  }

  // Build signup URL with redirect preserved
  const signupUrl = redirectUrl !== "/library" 
    ? `/signup?redirect_url=${encodeURIComponent(redirectUrl)}`
    : "/signup";

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, #F8F7FF 0%, #EDE9FE 100%)",
      padding: 20,
    }}>
      {/* Container that holds both panels together */}
      <div style={{
        display: "flex",
        maxWidth: 900,
        width: "100%",
        background: "white",
        borderRadius: 24,
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.08)",
        overflow: "hidden",
      }}>
        {/* Left Panel - Description */}
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "48px 40px",
          background: "linear-gradient(135deg, #FAFAFA 0%, #F5F3FF 100%)",
          borderRight: "1px solid #F3F4F6",
        }}
        className="hidden-mobile"
        >
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 22,
            marginBottom: 28,
          }}>
            📚
          </div>

          <div>
            <FeatureItem
              icon="🚀"
              title="Accelerate knowledge sharing"
              description="Upload documents once, let your entire team access and learn from them instantly."
            />
            <FeatureItem
              icon="🤖"
              title="AI-powered insights"
              description="Get intelligent summaries, answers, and connections across all your documents."
            />
            <FeatureItem
              icon="👥"
              title="Built for teams"
              description="Collaborate seamlessly with role-based access and organization management."
            />
            <FeatureItem
              icon="🔒"
              title="Enterprise security"
              description="Your data is encrypted and secure with industry-leading protection."
            />
          </div>

          <p style={{ color: "#9CA3AF", fontSize: 12, marginTop: 24 }}>
            © 2026 PrimeStride Atlas. All rights reserved.
          </p>
        </div>

        {/* Right Panel - Sign In Form */}
        <div style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 40px",
        }}>
          <div style={{
            width: "100%",
            maxWidth: 360,
          }}>
          {/* Show invite context if redirecting from invite */}
          {redirectUrl.includes("/invite/") && (
            <div style={{
              background: "#F0FDF4",
              border: "1px solid #86EFAC",
              borderRadius: 12,
              padding: 16,
              marginBottom: 24,
              textAlign: "center",
            }}>
              <p style={{ margin: 0, color: "#166534", fontSize: 14 }}>
                🎉 Sign in to accept your team invitation
              </p>
            </div>
          )}

          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <h1 style={{ 
              fontSize: 26, 
              fontWeight: 700, 
              marginBottom: 8, 
              color: "#111827" 
            }}>
              Welcome back
            </h1>
            <p style={{ color: "#6B7280", fontSize: 15 }}>
              Sign in to continue to PrimeStride Atlas
            </p>
          </div>

          {/* OAuth Buttons */}
          <div style={{ 
            display: "flex", 
            gap: 12, 
            marginBottom: 24 
          }}>
            <button
              onClick={() => handleOAuthSignIn("oauth_github")}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "12px 16px",
                border: "1px solid #E5E7EB",
                borderRadius: 10,
                background: "white",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 500,
                color: "#374151",
                transition: "all 0.2s",
              }}
              onMouseOver={(e) => e.currentTarget.style.background = "#F9FAFB"}
              onMouseOut={(e) => e.currentTarget.style.background = "white"}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
              </svg>
              GitHub
            </button>
            <button
              onClick={() => handleOAuthSignIn("oauth_google")}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "12px 16px",
                border: "1px solid #E5E7EB",
                borderRadius: 10,
                background: "white",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 500,
                color: "#374151",
                transition: "all 0.2s",
              }}
              onMouseOver={(e) => e.currentTarget.style.background = "#F9FAFB"}
              onMouseOut={(e) => e.currentTarget.style.background = "white"}
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google
            </button>
          </div>

          {/* Divider */}
          <div style={{
            display: "flex",
            alignItems: "center",
            marginBottom: 24,
          }}>
            <div style={{ flex: 1, height: 1, background: "#E5E7EB" }} />
            <span style={{ 
              padding: "0 16px", 
              color: "#9CA3AF", 
              fontSize: 13 
            }}>
              or
            </span>
            <div style={{ flex: 1, height: 1, background: "#E5E7EB" }} />
          </div>

          {/* Email Form */}
          <form onSubmit={handleEmailSignIn}>
            <div style={{ marginBottom: 16 }}>
              <label style={{
                display: "block",
                fontSize: 14,
                fontWeight: 500,
                marginBottom: 6,
                color: "#374151",
              }}>
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                required
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  border: "1px solid #E5E7EB",
                  borderRadius: 10,
                  fontSize: 15,
                  outline: "none",
                  transition: "border-color 0.2s",
                }}
                onFocus={(e) => e.target.style.borderColor = "#7C3AED"}
                onBlur={(e) => e.target.style.borderColor = "#E5E7EB"}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center",
                marginBottom: 6,
              }}>
                <label style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: "#374151",
                }}>
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  style={{
                    fontSize: 13,
                    color: "#7C3AED",
                    textDecoration: "none",
                  }}
                >
                  Forgot password?
                </Link>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  border: "1px solid #E5E7EB",
                  borderRadius: 10,
                  fontSize: 15,
                  outline: "none",
                  transition: "border-color 0.2s",
                }}
                onFocus={(e) => e.target.style.borderColor = "#7C3AED"}
                onBlur={(e) => e.target.style.borderColor = "#E5E7EB"}
              />
            </div>

            {error && (
              <div style={{
                padding: 12,
                borderRadius: 10,
                background: "#FEE2E2",
                color: "#991B1B",
                fontSize: 14,
                marginBottom: 16,
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "14px 16px",
                fontSize: 15,
                fontWeight: 600,
                borderRadius: 10,
                border: "none",
                background: "linear-gradient(135deg, #7C3AED 0%, #9333EA 100%)",
                color: "white",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                marginTop: 8,
                transition: "all 0.2s",
              }}
            >
              {loading ? "Signing in..." : (
                <>
                  Continue
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </>
              )}
            </button>
          </form>

          <p style={{
            textAlign: "center",
            marginTop: 24,
            color: "#6B7280",
            fontSize: 14,
          }}>
            Don't have an account?{" "}
            <Link
              href={signupUrl}
              style={{
                color: "#7C3AED",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Sign up
            </Link>
          </p>

          <p style={{
            textAlign: "center",
            marginTop: 20,
            color: "#9CA3AF",
            fontSize: 12,
          }}>
            Secured by <span style={{ fontWeight: 600 }}>PrimeStride</span>
          </p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media (max-width: 768px) {
          .hidden-mobile {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

function FeatureItem({ icon, title, description }: { 
  icon: string; 
  title: string; 
  description: string;
}) {
  return (
    <div style={{
      display: "flex",
      gap: 16,
      marginBottom: 28,
    }}>
      <div style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        background: "rgba(124, 58, 237, 0.1)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 20,
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <h3 style={{ 
          fontSize: 16, 
          fontWeight: 600, 
          color: "#111827",
          marginBottom: 4,
        }}>
          {title}
        </h3>
        <p style={{ 
          fontSize: 14, 
          color: "#6B7280",
          lineHeight: 1.5,
          margin: 0,
        }}>
          {description}
        </p>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div style={{ 
        minHeight: "100vh", 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center",
        background: "linear-gradient(135deg, #F8F7FF 0%, #EDE9FE 100%)",
      }}>
        <div style={{ color: "#6B7280" }}>Loading...</div>
      </div>
    }>
      <SignInForm />
    </Suspense>
  );
}