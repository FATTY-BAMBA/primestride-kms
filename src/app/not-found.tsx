import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{ minHeight: "100vh", background: "#0a0e17", color: "#e8e6e1", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ textAlign: "center", maxWidth: 480 }}>
        <div style={{ fontSize: 80, marginBottom: 16 }}>🔍</div>
        <h1 style={{ fontSize: 72, fontWeight: 800, color: "#2563eb", marginBottom: 8, fontFamily: "system-ui" }}>404</h1>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>找不到此頁面</h2>
        <p style={{ fontSize: 16, color: "#64748b", marginBottom: 32, lineHeight: 1.7 }}>
          The page you are looking for does not exist or has been moved.
          <br />
          您要找的頁面不存在或已移動。
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/" style={{ padding: "12px 28px", borderRadius: 10, background: "#2563eb", color: "white", textDecoration: "none", fontSize: 15, fontWeight: 700 }}>
            ← 回首頁 Home
          </Link>
          <Link href="/library" style={{ padding: "12px 28px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", color: "#e8e6e1", textDecoration: "none", fontSize: 15, fontWeight: 600 }}>
            📚 知識庫 Library
          </Link>
        </div>
      </div>
    </div>
  );
}