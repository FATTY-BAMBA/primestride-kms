import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0e17",
        fontFamily: "system-ui, -apple-system, sans-serif",
        padding: "24px 16px",
      }}
    >
      {/* Background glow */}
      <div style={{
        position: "fixed", top: "20%", left: "30%",
        width: 600, height: 400, borderRadius: "50%",
        background: "radial-gradient(ellipse, rgba(124,58,237,0.07) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 48,
        maxWidth: 920,
        width: "100%",
      }}>

        {/* ── Left panel: Atlas EIP features ── */}
        <div style={{
          flex: "0 0 340px",
          display: "flex",
          flexDirection: "column",
        }}
          className="signup-left-panel"
        >
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 40 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 11,
              background: "#4C1D95",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 0 1px rgba(167,139,250,0.2), 0 4px 16px rgba(76,29,149,0.4)",
              flexShrink: 0,
            }}>
              <svg width="20" height="20" viewBox="0 0 26 26" fill="none">
                <path d="M13 2 L7 14 L12 14 L6 24 L20 12 L14.5 12 L21 2 Z" fill="white" fillOpacity="0.95"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9", letterSpacing: "-0.01em" }}>Atlas EIP</div>
              <div style={{ fontSize: 9, color: "#7C3AED", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>Enterprise Intelligence</div>
            </div>
          </div>

          {/* Headline */}
          <div style={{ marginBottom: 32 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "#f1f5f9", margin: "0 0 10px", lineHeight: 1.3, letterSpacing: "-0.02em" }}>
              台灣 SMB 的<br />AI 企業智慧平台
            </h1>
            <p style={{ fontSize: 13, color: "#4b5563", margin: 0, lineHeight: 1.6 }}>
              One Box. Zero Forms.<br />從知識到行動，一步到位。
            </p>
          </div>

          {/* Feature list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              {
                icon: "🛡️",
                title: "2026 勞基法合規引擎",
                desc: "自動掃描制度文件，偵測違規條款並標示法條依據",
                color: "#7C3AED",
                bg: "rgba(124,58,237,0.08)",
              },
              {
                icon: "💬",
                title: "Ask Atlas AI 問答",
                desc: "員工用中文直接問公司政策，AI 附來源引用即時回答",
                color: "#2563EB",
                bg: "rgba(37,99,235,0.08)",
              },
              {
                icon: "📝",
                title: "NLP 智慧表單",
                desc: "一句話完成請假、加班、出差申請，支援台灣口語",
                color: "#059669",
                bg: "rgba(5,150,105,0.08)",
              },
              {
                icon: "🔍",
                title: "Shadow Audit 加班預警",
                desc: "即時監控全體員工加班時數，超標前自動警示",
                color: "#DC2626",
                bg: "rgba(220,38,38,0.08)",
              },
              {
                icon: "🌿",
                title: "ESG S-Pillar 報告",
                desc: "自動彙整勞動數據，一鍵產出社會面報告",
                color: "#059669",
                bg: "rgba(5,150,105,0.08)",
              },
            ].map(f => (
              <div key={f.title} style={{
                display: "flex", gap: 12, alignItems: "flex-start",
                padding: "10px 12px", borderRadius: 10,
                background: f.bg,
                border: `1px solid ${f.color}20`,
              }}>
                <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{f.icon}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", marginBottom: 2 }}>{f.title}</div>
                  <div style={{ fontSize: 11, color: "#4b5563", lineHeight: 1.5 }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>

        </div>

        {/* ── Right panel: Clerk widget ── */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <SignUp
            appearance={{
              elements: {
                rootBox: {
                  boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                  borderRadius: "16px",
                  width: "100%",
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
              },
            }}
            routing="path"
            path="/sign-up"
            signInUrl="/sign-in"
            fallbackRedirectUrl="/home"
          />
        </div>
      </div>

      {/* Hide left panel on mobile */}
      <style>{`
        @media (max-width: 768px) {
          .signup-left-panel { display: none !important; }
        }
      `}</style>
    </main>
  );
}