import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0e17",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Subtle background glow matching onboarding */}
      <div style={{
        position: "fixed", top: "20%", left: "50%", transform: "translateX(-50%)",
        width: 500, height: 300, borderRadius: "50%",
        background: "radial-gradient(ellipse, rgba(124,58,237,0.08) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Atlas EIP logo mark above the Clerk widget */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 48, height: 48, borderRadius: 13,
            background: "#4C1D95",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 12px",
            boxShadow: "0 0 0 1px rgba(167,139,250,0.2), 0 8px 24px rgba(76,29,149,0.4)",
          }}>
            <svg width="24" height="24" viewBox="0 0 26 26" fill="none">
              <path d="M13 2 L7 14 L12 14 L6 24 L20 12 L14.5 12 L21 2 Z" fill="white" fillOpacity="0.95"/>
            </svg>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9", letterSpacing: "-0.01em" }}>Atlas EIP</div>
          <div style={{ fontSize: 10, color: "#7C3AED", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 2 }}>Enterprise Intelligence</div>
        </div>

        <SignIn
          appearance={{
            elements: {
              rootBox: {
                boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                borderRadius: "16px",
              },
              card: {
                borderRadius: "16px",
                background: "#111827",
                border: "1px solid rgba(255,255,255,0.07)",
              },
              headerTitle: {
                fontSize: "20px",
                fontWeight: "700",
                color: "#f1f5f9",
              },
              headerSubtitle: {
                color: "#64748b",
              },
              socialButtonsBlockButton: {
                borderRadius: "10px",
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.03)",
                color: "#e2e8f0",
              },
              dividerLine: {
                background: "rgba(255,255,255,0.08)",
              },
              dividerText: {
                color: "#374151",
              },
              formFieldLabel: {
                color: "#94a3b8",
                fontSize: "12px",
              },
              formFieldInput: {
                borderRadius: "10px",
                border: "1.5px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)",
                color: "#e8e6e1",
                fontSize: "14px",
              },
              formButtonPrimary: {
                background: "#7C3AED",
                borderRadius: "10px",
                fontSize: "15px",
                fontWeight: "700",
              },
              footerActionLink: {
                color: "#A78BFA",
              },
              identityPreviewText: {
                color: "#94a3b8",
              },
              identityPreviewEditButton: {
                color: "#A78BFA",
              },
            },
          }}
          routing="path"
          path="/sign-in"
          signUpUrl="/sign-up"
          fallbackRedirectUrl="/onboarding"
          afterSignInUrl="/onboarding"
        />
      </div>
    </main>
  );
}