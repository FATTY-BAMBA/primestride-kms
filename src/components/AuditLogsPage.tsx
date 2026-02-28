"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface AuditLog {
  id: string;
  user_id: string;
  user_name: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  target_title: string | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}

const actionLabels: Record<string, { label: string; icon: string; color: string }> = {
  "doc.create": { label: "建立文件 Created doc", icon: "📄", color: "#059669" },
  "doc.update": { label: "更新文件 Updated doc", icon: "✏️", color: "#2563EB" },
  "doc.delete": { label: "刪除文件 Deleted doc", icon: "🗑️", color: "#DC2626" },
  "doc.export": { label: "匯出文件 Exported doc", icon: "📤", color: "#7C3AED" },
  "doc.view": { label: "檢視文件 Viewed doc", icon: "👁️", color: "#6B7280" },
  "folder.create": { label: "建立資料夾 Created folder", icon: "📁", color: "#059669" },
  "folder.delete": { label: "刪除資料夾 Deleted folder", icon: "🗑️", color: "#DC2626" },
  "project.create": { label: "建立專案 Created project", icon: "🎯", color: "#059669" },
  "project.delete": { label: "刪除專案 Deleted project", icon: "🗑️", color: "#DC2626" },
  "member.invite": { label: "邀請成員 Invited member", icon: "👤", color: "#7C3AED" },
  "member.remove": { label: "移除成員 Removed member", icon: "👤", color: "#DC2626" },
  "api_key.create": { label: "建立 API 金鑰 Created API key", icon: "🔑", color: "#D97706" },
  "api_key.revoke": { label: "撤銷 API 金鑰 Revoked API key", icon: "🔑", color: "#DC2626" },
  "comment.create": { label: "新增留言 Added comment", icon: "💬", color: "#2563EB" },
  "template.create": { label: "建立範本 Created template", icon: "📋", color: "#059669" },
  "agent.action": { label: "AI 代理操作 Agent action", icon: "🤖", color: "#EC4899" },
  "login": { label: "登入 Logged in", icon: "🔓", color: "#059669" },
  "logout": { label: "登出 Logged out", icon: "🔒", color: "#6B7280" },
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [actionFilter, setActionFilter] = useState("");
  const limit = 30;

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let url = `/api/audit-logs?limit=${limit}&offset=${offset}`;
      if (actionFilter) url += `&action=${actionFilter}`;
      const res = await fetch(url);
      const data = await res.json();
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchLogs(); }, [offset, actionFilter]);

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString("zh-TW", { month: "short", day: "numeric" }) +
      " " + date.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });
  };

  const getActionInfo = (action: string) => {
    return actionLabels[action] || { label: action, icon: "📌", color: "#6B7280" };
  };

  const actionTypes = [
    "", "doc.create", "doc.update", "doc.delete", "doc.export",
    "folder.create", "project.create", "member.invite",
    "api_key.create", "comment.create", "agent.action",
  ];

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 20px", paddingBottom: 60 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111827", marginBottom: 4 }}>📋 操作紀錄 Audit Logs</h1>
          <p style={{ fontSize: 14, color: "#6B7280" }}>追蹤所有使用者操作 | Track all user activity</p>
        </div>
        <div style={{ fontSize: 14, color: "#9CA3AF" }}>
          共 {total} 筆紀錄
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 13, color: "#6B7280" }}>篩選 Filter:</span>
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setOffset(0); }}
          style={{
            padding: "6px 12px", borderRadius: 8, border: "1px solid #D1D5DB",
            fontSize: 13, outline: "none", background: "white", color: "#374151",
          }}
        >
          <option value="">全部操作 All actions</option>
          {actionTypes.filter(a => a).map(a => (
            <option key={a} value={a}>{getActionInfo(a).icon} {getActionInfo(a).label}</option>
          ))}
        </select>
      </div>

      {/* Logs */}
      <div style={{ background: "white", borderRadius: 12, border: "1px solid #E5E7EB", overflow: "hidden" }}>
        {loading && <div style={{ padding: 40, textAlign: "center", color: "#9CA3AF" }}>載入中...</div>}

        {!loading && logs.length === 0 && (
          <div style={{ padding: 60, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#374151", marginBottom: 4 }}>尚無操作紀錄</div>
            <div style={{ fontSize: 14, color: "#9CA3AF" }}>No audit logs yet. Activity will be tracked here.</div>
          </div>
        )}

        {logs.map((log, i) => {
          const info = getActionInfo(log.action);
          return (
            <div key={log.id} style={{
              display: "flex", alignItems: "flex-start", gap: 14,
              padding: "14px 20px",
              borderBottom: i < logs.length - 1 ? "1px solid #F3F4F6" : "none",
            }}>
              {/* Icon */}
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: info.color + "15",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18,
              }}>{info.icon}</div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, color: "#111827", marginBottom: 2 }}>
                  <span style={{ fontWeight: 600 }}>{log.user_name || log.user_id.slice(0, 12)}</span>
                  <span style={{ color: "#6B7280", marginLeft: 6 }}>{info.label}</span>
                </div>
                {log.target_title && (
                  <div style={{ fontSize: 13, color: "#4B5563" }}>
                    {log.target_type === "document" && log.target_id ? (
                      <Link href={`/library/${encodeURIComponent(log.target_id)}`}
                        style={{ color: "#4F46E5", textDecoration: "none", fontWeight: 500 }}>
                        {log.target_title}
                      </Link>
                    ) : (
                      <span>{log.target_title}</span>
                    )}
                  </div>
                )}
                {log.details && (
                  <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>{log.details}</div>
                )}
              </div>

              {/* Timestamp */}
              <div style={{ fontSize: 12, color: "#9CA3AF", whiteSpace: "nowrap", flexShrink: 0 }}>
                {formatDate(log.created_at)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {total > limit && (
        <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 20 }}>
          <button
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={offset === 0}
            style={{
              padding: "8px 16px", borderRadius: 8, border: "1px solid #D1D5DB",
              background: "white", fontSize: 13, cursor: offset === 0 ? "not-allowed" : "pointer",
              color: offset === 0 ? "#D1D5DB" : "#374151",
            }}
          >← 上一頁 Prev</button>
          <span style={{ fontSize: 13, color: "#6B7280", padding: "8px 0" }}>
            {offset + 1}–{Math.min(offset + limit, total)} / {total}
          </span>
          <button
            onClick={() => setOffset(offset + limit)}
            disabled={offset + limit >= total}
            style={{
              padding: "8px 16px", borderRadius: 8, border: "1px solid #D1D5DB",
              background: "white", fontSize: 13, cursor: offset + limit >= total ? "not-allowed" : "pointer",
              color: offset + limit >= total ? "#D1D5DB" : "#374151",
            }}
          >下一頁 Next →</button>
        </div>
      )}
    </div>
  );
}
