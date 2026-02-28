"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
  is_active: boolean;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState("");
  const [copied, setCopied] = useState(false);
  const [showDocs, setShowDocs] = useState(false);

  const fetchKeys = async () => {
    try {
      const res = await fetch("/api/api-keys");
      const data = await res.json();
      setKeys(data.keys || []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchKeys(); }, []);

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName, scopes: ["read", "write", "search"] }),
      });
      const data = await res.json();
      if (res.ok && data.apiKey) {
        setNewKeyValue(data.apiKey);
        setNewKeyName("");
        fetchKeys();
      }
    } catch {} finally { setCreating(false); }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm("撤銷此 API 金鑰？使用此金鑰的整合將停止運作。\nRevoke this API key? Integrations using it will stop working.")) return;
    try {
      await fetch(`/api/api-keys?id=${id}`, { method: "DELETE" });
      fetchKeys();
    } catch {}
  };

  const copyKey = () => {
    navigator.clipboard.writeText(newKeyValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString("zh-TW", { year: "numeric", month: "short", day: "numeric" });

  return (
    <div style={{ minHeight: "100vh", background: "#F9FAFB", paddingBottom: 60 }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 20px" }}>
        <Link href="/library" style={{ color: "#6B7280", textDecoration: "none", fontSize: 14, fontWeight: 500, display: "inline-block", marginBottom: 24 }}>
          ← 返回資料庫 Back to Library
        </Link>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: "#111827", marginBottom: 4 }}>🔑 API 金鑰管理</h1>
            <p style={{ fontSize: 15, color: "#6B7280" }}>管理公開 API 存取金鑰 | Manage Public API access keys</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setShowDocs(!showDocs)} className="btn" style={{ padding: "10px 20px", fontSize: 14 }}>
              📖 API 文件 Docs
            </button>
            <button onClick={() => { setShowCreate(true); setNewKeyValue(""); }} className="btn btn-primary"
              style={{ padding: "10px 20px", fontSize: 14, fontWeight: 600 }}>
              + 建立金鑰 Create Key
            </button>
          </div>
        </div>

        {/* API Docs */}
        {showDocs && (
          <div style={{ background: "white", borderRadius: 12, border: "1px solid #E5E7EB", padding: 28, marginBottom: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: "#111827" }}>📖 API 文件 Documentation</h2>

            <div style={{ fontSize: 14, lineHeight: 1.8, color: "#374151" }}>
              <p style={{ marginBottom: 16 }}><strong>Base URL:</strong> <code style={{ padding: "2px 8px", background: "#F3F4F6", borderRadius: 4 }}>https://primestrideatlas.com/api/v1</code></p>

              <p style={{ marginBottom: 8 }}><strong>認證 Authentication:</strong></p>
              <pre style={{ background: "#1F2937", color: "#E5E7EB", padding: 16, borderRadius: 8, fontSize: 13, overflowX: "auto", marginBottom: 16 }}>
{`Authorization: Bearer psa_your_api_key_here`}
              </pre>

              <p style={{ fontWeight: 700, marginBottom: 8 }}>📄 列出文件 List Documents</p>
              <pre style={{ background: "#1F2937", color: "#E5E7EB", padding: 16, borderRadius: 8, fontSize: 13, overflowX: "auto", marginBottom: 16 }}>
{`GET /api/v1/documents
GET /api/v1/documents?search=keyword
GET /api/v1/documents?tag=onboarding
GET /api/v1/documents?doc_type=report
GET /api/v1/documents?limit=10&offset=0`}
              </pre>

              <p style={{ fontWeight: 700, marginBottom: 8 }}>📄 取得單一文件 Get Document</p>
              <pre style={{ background: "#1F2937", color: "#E5E7EB", padding: 16, borderRadius: 8, fontSize: 13, overflowX: "auto", marginBottom: 16 }}>
{`GET /api/v1/documents?doc_id=PS-DOC-001`}
              </pre>

              <p style={{ fontWeight: 700, marginBottom: 8 }}>✏️ 建立文件 Create Document</p>
              <pre style={{ background: "#1F2937", color: "#E5E7EB", padding: 16, borderRadius: 8, fontSize: 13, overflowX: "auto", marginBottom: 16 }}>
{`POST /api/v1/documents
Content-Type: application/json

{
  "title": "會議記錄 Meeting Notes",
  "content": "會議內容...",
  "doc_type": "meeting-notes",
  "tags": ["會議", "Q1"]
}`}
              </pre>

              <p style={{ fontWeight: 700, marginBottom: 8 }}>📝 更新文件 Update Document</p>
              <pre style={{ background: "#1F2937", color: "#E5E7EB", padding: 16, borderRadius: 8, fontSize: 13, overflowX: "auto", marginBottom: 16 }}>
{`PATCH /api/v1/documents
Content-Type: application/json

{
  "doc_id": "PS-DOC-001",
  "title": "Updated Title",
  "tags": ["updated", "重要"]
}`}
              </pre>

              <p style={{ fontWeight: 700, marginBottom: 8 }}>🗑️ 刪除文件 Delete Document</p>
              <pre style={{ background: "#1F2937", color: "#E5E7EB", padding: 16, borderRadius: 8, fontSize: 13, overflowX: "auto", marginBottom: 16 }}>
{`DELETE /api/v1/documents?doc_id=PS-DOC-001`}
              </pre>

              <p style={{ fontWeight: 700, marginBottom: 8 }}>📦 回應格式 Response Format</p>
              <pre style={{ background: "#1F2937", color: "#E5E7EB", padding: 16, borderRadius: 8, fontSize: 13, overflowX: "auto" }}>
{`{
  "data": {
    "documents": [...],
    "total": 34,
    "limit": 20,
    "offset": 0
  },
  "status": 200
}`}
              </pre>
            </div>
          </div>
        )}

        {/* New Key Created */}
        {newKeyValue && (
          <div style={{
            padding: 20, background: "#FEF3C7", border: "1px solid #F59E0B",
            borderRadius: 12, marginBottom: 24,
          }}>
            <div style={{ fontWeight: 700, color: "#92400E", marginBottom: 8 }}>
              ⚠️ 請立即複製此金鑰 — 這是唯一一次顯示！
            </div>
            <div style={{ fontWeight: 600, color: "#92400E", marginBottom: 12, fontSize: 13 }}>
              Save this API key now — it won&apos;t be shown again!
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <code style={{
                flex: 1, padding: "10px 14px", background: "white", borderRadius: 8,
                border: "1px solid #D1D5DB", fontSize: 13, fontFamily: "monospace",
                wordBreak: "break-all",
              }}>{newKeyValue}</code>
              <button onClick={copyKey} style={{
                padding: "10px 16px", borderRadius: 8, border: "none",
                background: copied ? "#059669" : "#7C3AED", color: "white",
                fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
              }}>
                {copied ? "✓ 已複製" : "📋 複製"}
              </button>
            </div>
          </div>
        )}

        {/* Create Key Form */}
        {showCreate && !newKeyValue && (
          <div style={{
            padding: 24, background: "white", borderRadius: 12,
            border: "1px solid #E5E7EB", marginBottom: 24,
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>建立新金鑰 Create New Key</h3>
            <div style={{ display: "flex", gap: 10 }}>
              <input
                type="text" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="金鑰名稱 Key name (e.g., Production, 正式環境)"
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
                style={{ flex: 1, padding: "10px 14px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 14, outline: "none" }}
              />
              <button onClick={handleCreate} disabled={creating || !newKeyName.trim()}
                style={{
                  padding: "10px 20px", borderRadius: 8, border: "none",
                  background: creating ? "#A78BFA" : "#7C3AED", color: "white",
                  fontSize: 14, fontWeight: 600, cursor: "pointer",
                }}>
                {creating ? "建立中..." : "建立 Create"}
              </button>
              <button onClick={() => setShowCreate(false)} style={{
                padding: "10px 16px", borderRadius: 8, border: "1px solid #D1D5DB",
                background: "white", fontSize: 14, cursor: "pointer",
              }}>取消</button>
            </div>
          </div>
        )}

        {/* Keys List */}
        <div style={{ background: "white", borderRadius: 12, border: "1px solid #E5E7EB" }}>
          <div style={{ padding: "16px 24px", borderBottom: "1px solid #E5E7EB" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>API 金鑰列表 Active Keys</h3>
          </div>

          {loading && <div style={{ padding: 40, textAlign: "center", color: "#9CA3AF" }}>載入中...</div>}

          {!loading && keys.length === 0 && (
            <div style={{ padding: 40, textAlign: "center", color: "#9CA3AF" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔑</div>
              <div style={{ fontSize: 15 }}>尚無 API 金鑰 | No API keys yet</div>
            </div>
          )}

          {keys.map(k => (
            <div key={k.id} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "16px 24px", borderBottom: "1px solid #F3F4F6",
              gap: 12, flexWrap: "wrap", opacity: k.is_active ? 1 : 0.5,
            }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: "#111827", marginBottom: 4 }}>
                  {k.name}
                  {!k.is_active && <span style={{ marginLeft: 8, padding: "2px 8px", background: "#FEE2E2", color: "#991B1B", borderRadius: 4, fontSize: 11 }}>已撤銷 Revoked</span>}
                </div>
                <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#9CA3AF" }}>
                  <code style={{ background: "#F3F4F6", padding: "2px 8px", borderRadius: 4 }}>{k.key_prefix}</code>
                  <span>建立 {formatDate(k.created_at)}</span>
                  {k.last_used_at && <span>最後使用 {formatDate(k.last_used_at)}</span>}
                </div>
                <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                  {(k.scopes || []).map(s => (
                    <span key={s} style={{ padding: "2px 8px", background: "#EEF2FF", color: "#4F46E5", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{s}</span>
                  ))}
                </div>
              </div>
              {k.is_active && (
                <button onClick={() => handleRevoke(k.id)} style={{
                  padding: "6px 14px", borderRadius: 6, border: "1px solid #FCA5A5",
                  background: "#FEE2E2", color: "#991B1B", fontSize: 12, cursor: "pointer", fontWeight: 500,
                }}>撤銷 Revoke</button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
