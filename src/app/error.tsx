"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0e17", color: "#e8e6e1", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ textAlign: "center", maxWidth: 480 }}>
        <div style={{ fontSize: 80, marginBottom: 16 }}>⚠️</div>
        <h1 style={{ fontSize: 48, fontWeight: 800, color: "#DC2626", marginBottom: 8, fontFamily: "system-ui" }}>Error</h1>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>系統發生錯誤</h2>
        <p style={{ fontSize: 16, color: "#64748b", marginBottom: 32, lineHeight: 1.7 }}>
          Something went wrong. Please try again.
          <br />
          系統發生錯誤，請重試。
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            onClick={reset}
            style={{ padding: "12px 28px", borderRadius: 10, background: "#2563eb", color: "white", border: "none", fontSize: 15, fontWeight: 700, cursor: "pointer" }}
          >
            🔄 重試 Try Again
          </button>
          <Link href="/" style={{ padding: "12px 28px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", color: "#e8e6e1", textDecoration: "none", fontSize: 15, fontWeight: 600 }}>
            ← 回首頁 Home
          </Link>
        </div>
        {error.digest && (
          <p style={{ fontSize: 12, color: "#4b5563", marginTop: 24, fontFamily: "monospace" }}>
            Error ID: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}