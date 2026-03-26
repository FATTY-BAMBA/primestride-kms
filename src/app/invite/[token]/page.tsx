"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface InvitationDetails {
  organization_name: string;
  email?: string;
  invited_email?: string;
  current_email?: string;
  role: string;
  expires_at: string;
  status: string;
  requires_auth?: boolean;
  email_mismatch?: boolean;
  can_accept?: boolean;
  error?: string;
}

const PRIMARY = "#7C3AED";
const PRIMARY_LIGHT = "#A78BFA";
const PRIMARY_DIM = "rgba(124,58,237,0.12)";
const PRIMARY_BORDER = "rgba(124,58,237,0.25)";

function LogoMark() {
  return (
    <div style={{
      width: 44, height: 44, borderRadius: 12,
      background: "#4C1D95",
      display: "flex", alignItems: "center", justifyContent: "center",
      margin: "0 auto 16px",
      boxShadow: "0 0 0 1px rgba(167,139,250,0.2), 0 8px 24px rgba(76,29,149,0.4)",
    }}>
      <svg width="22" height="22" viewBox="0 0 26 26" fill="none">
        <path d="M13 2 L7 14 L12 14 L6 24 L20 12 L14.5 12 L21 2 Z" fill="white" fillOpacity="0.95"/>
      </svg>
    </div>
  );
}

const card: React.CSSProperties = {
  maxWidth: 480,
  width: "100%",
  background: "#111827",
  borderRadius: 20,
  border: "1px solid rgba(255,255,255,0.07)",
  overflow: "hidden",
  fontFamily: "system-ui, -apple-system, sans-serif",
};

const page: React.CSSProperties = {
  minHeight: "100vh",
  background: "#0a0e17",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
};

const btnPrimary: React.CSSProperties = {
  width: "100%", padding: "13px", borderRadius: 10, border: "none",
  background: PRIMARY, color: "white", fontSize: 15, fontWeight: 700,
  cursor: "pointer", transition: "opacity 0.15s",
  fontFamily: "system-ui, sans-serif",
};

const btnSecondary: React.CSSProperties = {
  width: "100%", padding: "12px", borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "transparent", color: "#64748b", fontSize: 14,
  cursor: "pointer", fontFamily: "system-ui, sans-serif",
};

export default function AcceptInvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => { fetchInvitation(); }, [token]);

  const fetchInvitation = async () => {
    try {
      const res = await fetch(`/api/invitations/${token}`);
      const data = await res.json();
      if (!res.ok && res.status !== 403) {
        setError(data.error || "Invalid invitation");
        setLoading(false);
        return;
      }
      setInvitation(data);
      if (data.error && res.status === 403) setError(data.error);
      setLoading(false);
    } catch {
      setError("Failed to load invitation");
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    setAccepting(true);
    setError(null);
    try {
      const res = await fetch(`/api/invitations/${token}/accept`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to accept invitation");
        setAccepting(false);
        return;
      }
      setSuccess(true);
      setTimeout(() => { window.location.href = "/home"; }, 2000);
    } catch {
      setError("Failed to accept invitation");
      setAccepting(false);
    }
  };

  const handleDecline = async () => {
    if (!confirm("Are you sure you want to decline this invitation?")) return;
    try {
      const res = await fetch(`/api/invitations/${token}/decline`, { method: "POST" });
      if (res.ok) router.push("/");
      else { const data = await res.json(); setError(data.error || "Failed to decline"); }
    } catch { setError("Failed to decline invitation"); }
  };

  // ── Loading ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={page}>
        <div style={{ textAlign: "center" }}>
          <LogoMark />
          <p style={{ color: "#4b5563", fontSize: 13 }}>載入邀請中...</p>
        </div>
      </div>
    );
  }

  // ── Invalid invitation ─────────────────────────────────────────
  if (error && !invitation) {
    return (
      <div style={page}>
        <div style={card}>
          <div style={{ padding: "40px 32px", textAlign: "center" }}>
            <LogoMark />
            <div style={{ fontSize: 36, marginBottom: 16 }}>❌</div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9", marginBottom: 8 }}>
              無效的邀請連結
            </h1>
            <p style={{ color: "#4b5563", fontSize: 13, marginBottom: 28, lineHeight: 1.6 }}>
              {error}
            </p>
            <Link href="/" style={{ ...btnPrimary, display: "block", textDecoration: "none", textAlign: "center" }}>
              返回首頁
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Needs login ────────────────────────────────────────────────
  if (invitation?.requires_auth) {
    return (
      <div style={page}>
        <div style={card}>
          <div style={{ padding: "40px 32px" }}>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <LogoMark />
              <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9", marginBottom: 6 }}>
                您收到邀請了！
              </h1>
              <p style={{ fontSize: 13, color: "#4b5563" }}>
                You've been invited to join Atlas EIP
              </p>
            </div>

            {/* Org card */}
            <div style={{ padding: "16px 18px", background: PRIMARY_DIM, borderRadius: 12, border: `1px solid ${PRIMARY_BORDER}`, marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: PRIMARY_LIGHT, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>加入企業</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9" }}>{invitation.organization_name}</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                職務：<span style={{ color: PRIMARY_LIGHT, fontWeight: 600, textTransform: "capitalize" }}>{invitation.role}</span>
              </div>
            </div>

            <div style={{ padding: "12px 14px", background: "rgba(251,191,36,0.06)", borderRadius: 8, border: "1px solid rgba(251,191,36,0.15)", marginBottom: 24 }}>
              <p style={{ margin: 0, color: "#d97706", fontSize: 12, lineHeight: 1.6 }}>
                此邀請發送至 <strong>{invitation.invited_email}</strong>，請使用該 Email 登入或註冊。
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Link
                href={`/sign-up?redirect_url=/invite/${token}`}
                style={{ ...btnPrimary, display: "block", textDecoration: "none", textAlign: "center" }}
              >
                註冊並加入工作空間 →
              </Link>
              <Link
                href={`/sign-in?redirect_url=/invite/${token}`}
                style={{ ...btnSecondary, display: "block", textDecoration: "none", textAlign: "center" }}
              >
                已有帳號？登入
              </Link>
            </div>

            <p style={{ textAlign: "center", marginTop: 20, fontSize: 11, color: "#374151" }}>
              邀請到期：{new Date(invitation.expires_at).toLocaleDateString("zh-TW")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Email mismatch ─────────────────────────────────────────────
  if (invitation?.email_mismatch) {
    return (
      <div style={page}>
        <div style={card}>
          <div style={{ padding: "40px 32px", textAlign: "center" }}>
            <LogoMark />
            <div style={{ fontSize: 32, marginBottom: 16 }}>⚠️</div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9", marginBottom: 8 }}>
              Email 不符合
            </h1>
            <p style={{ color: "#4b5563", fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
              此邀請是發給 <strong style={{ color: "#e2e8f0" }}>{invitation.invited_email}</strong>，
              但您目前登入的是 <strong style={{ color: "#e2e8f0" }}>{invitation.current_email}</strong>。
            </p>
            <div style={{ padding: "12px 14px", background: "rgba(251,191,36,0.06)", borderRadius: 8, border: "1px solid rgba(251,191,36,0.15)", marginBottom: 24, textAlign: "left" }}>
              <p style={{ margin: 0, color: "#d97706", fontSize: 12 }}>
                請登出後，使用 <strong>{invitation.invited_email}</strong> 重新登入以接受邀請。
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Link href="/sign-in" style={{ ...btnPrimary, display: "block", textDecoration: "none", textAlign: "center" }}>
                切換帳號登入
              </Link>
              <Link href="/" style={{ ...btnSecondary, display: "block", textDecoration: "none", textAlign: "center" }}>
                返回首頁
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Success ────────────────────────────────────────────────────
  if (success) {
    return (
      <div style={page}>
        <div style={card}>
          <div style={{ padding: "40px 32px", textAlign: "center" }}>
            <LogoMark />
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 20px", fontSize: 24,
            }}>✅</div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9", marginBottom: 6 }}>
              成功加入！
            </h1>
            <p style={{ color: "#4b5563", fontSize: 13, marginBottom: 6 }}>
              您已成功加入 <strong style={{ color: PRIMARY_LIGHT }}>{invitation?.organization_name}</strong>
            </p>
            <p style={{ color: "#374151", fontSize: 12 }}>正在進入工作空間...</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Main: can accept ───────────────────────────────────────────
  return (
    <div style={page}>
      {/* Background glow */}
      <div style={{
        position: "fixed", top: "20%", left: "50%", transform: "translateX(-50%)",
        width: 500, height: 300, borderRadius: "50%",
        background: "radial-gradient(ellipse, rgba(124,58,237,0.07) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div style={card}>
        <div style={{ padding: "40px 32px" }}>

          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <LogoMark />
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9", marginBottom: 6 }}>
              您收到邀請了！
            </h1>
            <p style={{ fontSize: 13, color: "#4b5563" }}>
              You've been invited to join Atlas EIP
            </p>
          </div>

          {/* Invitation details */}
          <div style={{ padding: "18px 20px", background: PRIMARY_DIM, borderRadius: 12, border: `1px solid ${PRIMARY_BORDER}`, marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: PRIMARY_LIGHT, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>加入企業</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9", marginBottom: 12 }}>
              {invitation?.organization_name}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: "#4b5563", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>職務 Role</div>
                <div style={{
                  display: "inline-block", padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700,
                  background: invitation?.role === "admin" ? "rgba(124,58,237,0.15)" : "rgba(16,185,129,0.1)",
                  color: invitation?.role === "admin" ? PRIMARY_LIGHT : "#10b981",
                  textTransform: "capitalize",
                }}>
                  {invitation?.role}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#4b5563", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>Email</div>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>{invitation?.email}</div>
              </div>
            </div>
          </div>

          {/* What you get */}
          <div style={{ padding: "14px 16px", background: "rgba(255,255,255,0.02)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", marginBottom: 24 }}>
            <div style={{ fontSize: 11, color: "#374151", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>加入後即可使用</div>
            <div style={{ display: "grid", gap: 7 }}>
              {[
                ["💬", "Ask Atlas AI 問答助手"],
                ["📝", "自然語言請假、加班申請"],
                ["📚", "公司知識庫與文件搜尋"],
                ["🛡️", "2026 勞基法合規檢查"],
              ].map(([icon, label]) => (
                <div key={label as string} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 13 }}>{icon}</span>
                  <span style={{ fontSize: 12, color: "#64748b" }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 8, background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", color: "#fca5a5", fontSize: 13 }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button
              onClick={handleAccept}
              disabled={accepting}
              style={{ ...btnPrimary, opacity: accepting ? 0.7 : 1, cursor: accepting ? "not-allowed" : "pointer" }}
            >
              {accepting ? "加入中..." : "✅ 接受邀請並加入 →"}
            </button>
            <button onClick={handleDecline} disabled={accepting} style={btnSecondary}>
              拒絕邀請
            </button>
          </div>

          <p style={{ textAlign: "center", marginTop: 18, fontSize: 11, color: "#374151" }}>
            邀請到期：{new Date(invitation?.expires_at || "").toLocaleDateString("zh-TW")} · Atlas EIP by PrimeStride AI
          </p>
        </div>
      </div>
    </div>
  );
}