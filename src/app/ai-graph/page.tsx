"use client";

import { useState, useEffect, useCallback } from "react";
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";
import ProtectedRoute from "@/components/ProtectedRoute";

const CLUSTER_COLORS = ["#7C3AED", "#3B82F6", "#10B981", "#F59E0B", "#EF4444"];

// Default cluster topic names shown when API doesn't return AI-generated names
const CLUSTER_FALLBACK_NAMES = ["政策規章", "產品文件", "人資管理", "作業流程", "參考資料"];

function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return "尚未更新";
  const date = new Date(dateString);
  const now = new Date();
  const diffMins = Math.floor((now.getTime() - date.getTime()) / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return "剛剛";
  if (diffMins < 60) return `${diffMins} 分鐘前`;
  if (diffHours < 24) return `${diffHours} 小時前`;
  if (diffDays < 7) return `${diffDays} 天前`;
  return date.toLocaleDateString("zh-TW");
}

export default function AIGraphPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [stats, setStats] = useState({ docs: 0, connections: 0 });
  const [clusterCounts, setClusterCounts] = useState<{[key: number]: number}>({});
  const [clusterNames, setClusterNames] = useState<{[key: number]: string}>({});
  const [clusterMap, setClusterMap] = useState<{[key: string]: number}>({});
  const [showInfo, setShowInfo] = useState(false);
  const [showClusterModal, setShowClusterModal] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState<number | null>(null);
  const [selectedClusterDocs, setSelectedClusterDocs] = useState<Node[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [refreshResult, setRefreshResult] = useState<any>(null);
  // ── Fix 5: selected node side panel instead of immediate navigation ──
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  useEffect(() => {
    loadGraph();
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const res = await fetch("/api/profile");
      const data = await res.json();
      if (res.ok && data.role) setIsAdmin(["owner", "admin"].includes(data.role));
    } catch {}
  };

  const loadGraph = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/embeddings/similarities");
      const data = await res.json();

      if (res.ok) {
        setLastUpdated(data.lastUpdated || null);

        const counts: {[key: number]: number} = {};
        Object.values(data.clusters).forEach((clusterIdx: any) => {
          counts[clusterIdx] = (counts[clusterIdx] || 0) + 1;
        });
        setClusterCounts(counts);
        setClusterMap(data.clusters || {});

        // ── Fix 3: Use AI names if available, else meaningful fallbacks ──
        const names: {[key: number]: string} = {};
        Object.keys(counts).forEach((idx) => {
          const index = parseInt(idx);
          names[index] = data.clusterNames?.[index] 
            || CLUSTER_FALLBACK_NAMES[index % CLUSTER_FALLBACK_NAMES.length];
        });
        setClusterNames(names);

        const flowNodes: Node[] = data.nodes.map((node: any) => {
          const clusterIdx = data.clusters[node.id] || 0;
          const color = CLUSTER_COLORS[clusterIdx % CLUSTER_COLORS.length];
          return {
            id: node.id,
            data: {
              label: node.label,
              cluster: names[clusterIdx],
              clusterIdx,
              docId: node.id,
            },
            position: { x: Math.random() * 600, y: Math.random() * 500 },
            style: {
              background: color,
              color: "white",
              border: "2px solid rgba(255,255,255,0.3)",
              borderRadius: 10,
              padding: "10px 14px",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              maxWidth: 160,
              textAlign: "center" as const,
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            },
          };
        });

        // ── Fix 4: Limit edges — only keep top 2 connections per node ──
        const edgesByNode: {[key: string]: {edge: any, strength: number}[]} = {};
        data.edges.forEach((edge: any) => {
          if (!edgesByNode[edge.source]) edgesByNode[edge.source] = [];
          edgesByNode[edge.source].push({ edge, strength: edge.strength });
        });

        const topEdges = new Set<string>();
        Object.values(edgesByNode).forEach((nodeEdges) => {
          nodeEdges
            .sort((a, b) => b.strength - a.strength)
            .slice(0, 2) // max 2 connections per node
            .forEach(({ edge }) => topEdges.add(`${edge.source}-${edge.target}`));
        });

        const flowEdges: Edge[] = data.edges
          .filter((edge: any) => topEdges.has(`${edge.source}-${edge.target}`))
          .map((edge: any) => ({
            id: `${edge.source}-${edge.target}`,
            source: edge.source,
            target: edge.target,
            animated: edge.strength > 0.85,
            style: {
              stroke: edge.strength > 0.7 ? "#94A3B8" : "#CBD5E1",
              strokeWidth: Math.max(1, edge.strength * 2.5),
              strokeOpacity: 0.6,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: "#94A3B8",
            },
          }));

        setNodes(flowNodes);
        setEdges(flowEdges);
        setStats({ docs: data.totalDocuments, connections: flowEdges.length });
      } else {
        setError(data.error || "Failed to load graph");
      }
    } catch {
      setError("Failed to load graph");
    } finally {
      setLoading(false);
    }
  };

  // ── Fix 5: Single click = show panel, double click = navigate ──
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onNodeDoubleClick = useCallback((event: React.MouseEvent, node: Node) => {
    window.location.href = `/library/${node.data.docId}`;
  }, []);

  const handleClusterClick = useCallback((clusterIdx: number) => {
    const docsInCluster = nodes.filter(n => clusterMap[n.id] === clusterIdx);
    setSelectedCluster(clusterIdx);
    setSelectedClusterDocs(docsInCluster);
    setShowClusterModal(true);
  }, [nodes, clusterMap]);

  const generateEmbeddings = async () => {
    if (!confirm("重新整理 AI 知識圖譜？這將重新計算24小時內未更新的文件嵌入向量。")) return;
    try {
      setGenerating(true);
      setError("");
      setRefreshResult(null);
      const res = await fetch("/api/embeddings/generate", { method: "POST" });
      const data = await res.json();
      if (res.ok) { setRefreshResult(data); loadGraph(); }
      else if (res.status === 429) { setError(data.error); setRefreshResult({ rateLimited: true, ...data }); }
      else setError(data.error || "Failed to generate embeddings");
    } catch { setError("Failed to generate embeddings"); }
    finally { setGenerating(false); }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div style={{ padding: "60px 20px", textAlign: "center", color: "#94A3B8" }}>
          載入 AI 知識圖譜中...
        </div>
      </ProtectedRoute>
    );
  }

  const btnStyle = {
    padding: "8px 16px", borderRadius: 8, border: "1px solid #E2E8F0",
    background: "white", fontSize: 13, fontWeight: 600, color: "#374151",
    cursor: "pointer", transition: "all 0.15s",
  };

  const btnPrimaryStyle = {
    padding: "8px 16px", borderRadius: 8, border: "none",
    background: "#7C3AED", fontSize: 13, fontWeight: 600, color: "white",
    cursor: "pointer", transition: "all 0.15s",
  };

  return (
    <ProtectedRoute>
      <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#F8FAFC" }}>

        {/* ── Header ── */}
        <div style={{ padding: "16px 24px", borderBottom: "1px solid #E2E8F0", background: "white" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "#0F172A" }}>
                  🧠 AI 知識圖譜
                </h1>
                <button
                  onClick={() => setShowInfo(true)}
                  style={{ padding: "3px 10px", background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 5, fontSize: 12, cursor: "pointer", color: "#64748B", fontWeight: 500 }}
                >
                  ℹ️ 這是什麼？
                </button>
              </div>
              <p style={{ fontSize: 13, color: "#94A3B8", margin: "0 0 10px" }}>
                {stats.docs} 份文件 · {stats.connections} 個關聯 · 單擊節點查看詳情，雙擊開啟文件
              </p>
              <p style={{ fontSize: 12, color: "#CBD5E1", margin: "0 0 10px" }}>
                🕐 最後更新：{formatRelativeTime(lastUpdated)}
              </p>

              {/* ── Fix 3: Cluster pills with meaningful names ── */}
              {Object.keys(clusterCounts).length > 0 && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#94A3B8" }}>主題分群：</span>
                  {Object.entries(clusterCounts).map(([idx, count]) => {
                    const index = parseInt(idx);
                    const name = clusterNames[index];
                    return (
                      <button
                        key={idx}
                        onClick={() => handleClusterClick(index)}
                        style={{
                          display: "flex", alignItems: "center", gap: 5,
                          padding: "4px 10px", borderRadius: 20,
                          border: `1px solid ${CLUSTER_COLORS[index % CLUSTER_COLORS.length]}40`,
                          background: `${CLUSTER_COLORS[index % CLUSTER_COLORS.length]}10`,
                          cursor: "pointer", transition: "all 0.15s",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = `${CLUSTER_COLORS[index % CLUSTER_COLORS.length]}20`; }}
                        onMouseLeave={e => { e.currentTarget.style.background = `${CLUSTER_COLORS[index % CLUSTER_COLORS.length]}10`; }}
                      >
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: CLUSTER_COLORS[index % CLUSTER_COLORS.length] }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: CLUSTER_COLORS[index % CLUSTER_COLORS.length] }}>
                          {name}
                        </span>
                        <span style={{ fontSize: 11, color: "#94A3B8" }}>({count})</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Fix 1 & 2: Removed ← Back and UserMenu (both in sidebar) ── */}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {isAdmin && (
                <button onClick={generateEmbeddings} disabled={generating} style={{ ...btnPrimaryStyle, opacity: generating ? 0.7 : 1 }}>
                  {generating ? "更新中..." : "🔄 重新整理"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ padding: "12px 20px", background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", margin: "12px 20px", borderRadius: 8, fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Success */}
        {refreshResult && !refreshResult.rateLimited && (
          <div style={{ padding: "12px 20px", background: "#F0FDF4", border: "1px solid #BBF7D0", color: "#166534", margin: "12px 20px", borderRadius: 8, fontSize: 13 }}>
            ✅ 圖譜已更新 — 處理了 {refreshResult.processed} 份文件
            <button onClick={() => setRefreshResult(null)} style={{ marginLeft: 12, fontSize: 12, color: "#166534", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>關閉</button>
          </div>
        )}

        {/* Graph area */}
        {nodes.length === 0 ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", padding: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🧠</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "#0F172A" }}>
              {isAdmin ? "尚未建立嵌入向量" : "目前無文件"}
            </h2>
            <p style={{ color: "#94A3B8", marginBottom: 24, textAlign: "center", maxWidth: 400, fontSize: 14 }}>
              {isAdmin
                ? "點擊「重新整理」來建立 AI 嵌入向量，即可視覺化文件關聯與主題分群"
                : "知識圖譜尚無文件，請聯絡管理員建立嵌入向量"}
            </p>
            {isAdmin && (
              <button onClick={generateEmbeddings} disabled={generating} style={btnPrimaryStyle}>
                {generating ? "建立中..." : "🔄 建立嵌入向量"}
              </button>
            )}
          </div>
        ) : (
          <div style={{ flex: 1, position: "relative" }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              onNodeDoubleClick={onNodeDoubleClick}
              fitView
            >
              <Background color="#E2E8F0" gap={20} />
              <Controls />
            </ReactFlow>

            {/* ── Fix 5: Node detail side panel ── */}
            {selectedNode && (
              <div style={{
                position: "absolute", top: 16, right: 16, width: 280,
                background: "white", borderRadius: 12, border: "1px solid #E2E8F0",
                boxShadow: "0 4px 20px rgba(0,0,0,0.1)", overflow: "hidden", zIndex: 10,
              }}>
                <div style={{
                  padding: "12px 16px",
                  background: CLUSTER_COLORS[selectedNode.data.clusterIdx % CLUSTER_COLORS.length],
                  display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: 4, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
                      {clusterNames[selectedNode.data.clusterIdx]}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "white", lineHeight: 1.3 }}>
                      {selectedNode.data.label}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedNode(null)}
                    style={{ background: "none", border: "none", color: "rgba(255,255,255,0.8)", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 0, marginLeft: 8 }}
                  >
                    ×
                  </button>
                </div>
                <div style={{ padding: 16 }}>
                  <div style={{ fontSize: 12, color: "#94A3B8", marginBottom: 12 }}>
                    {edges.filter(e => e.source === selectedNode.id || e.target === selectedNode.id).length} 個關聯文件
                  </div>
                  <a
                    href={`/library/${selectedNode.data.docId}`}
                    style={{
                      display: "block", width: "100%", padding: "10px 0",
                      background: "#7C3AED", color: "white", borderRadius: 8,
                      fontSize: 13, fontWeight: 700, textAlign: "center" as const,
                      textDecoration: "none", boxSizing: "border-box" as const,
                    }}
                  >
                    開啟文件 →
                  </a>
                  <div style={{ marginTop: 8, fontSize: 11, color: "#CBD5E1", textAlign: "center" as const }}>
                    或雙擊節點快速開啟
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Info Modal */}
        {showInfo && (
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
            onClick={() => setShowInfo(false)}
          >
            <div
              style={{ maxWidth: 540, width: "100%", padding: 32, margin: 20, background: "white", borderRadius: 16, boxShadow: "0 20px 40px rgba(0,0,0,0.2)", maxHeight: "90vh", overflow: "auto" }}
              onClick={e => e.stopPropagation()}
            >
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: "#0F172A" }}>🧠 關於 AI 知識圖譜</h2>
              <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.7, marginBottom: 20 }}>
                AI 知識圖譜將您的文件以視覺化方式呈現，自動找出文件之間的關聯與主題群組。
              </p>

              <div style={{ marginBottom: 16, padding: 16, background: "#F8FAFC", borderRadius: 10, border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginBottom: 10 }}>如何使用：</div>
                {[
                  ["🔵 節點顏色", "相同顏色 = 相同主題群組，由 AI 自動分類"],
                  ["🏷️ 主題分群", "點擊上方分群標籤，查看該主題的所有文件"],
                  ["📏 連線粗細", "線條越粗 = 文件關聯越強"],
                  ["✨ 動態連線", "閃爍連線代表相似度 85% 以上"],
                  ["👆 單擊節點", "顯示文件摘要側邊欄"],
                  ["👆👆 雙擊節點", "直接開啟文件"],
                ].map(([key, val]) => (
                  <div key={key} style={{ display: "flex", gap: 10, marginBottom: 8, fontSize: 13 }}>
                    <span style={{ fontWeight: 600, color: "#374151", flexShrink: 0 }}>{key}</span>
                    <span style={{ color: "#64748B" }}>{val}</span>
                  </div>
                ))}
              </div>

              <div style={{ padding: 16, background: "#F5F3FF", borderRadius: 10, border: "1px solid #DDD6FE", marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#5B21B6", marginBottom: 8 }}>💡 適合用來：</div>
                {["發現不知道存在的相關文件", "找出知識庫的缺口", "了解跨部門知識結構", "研究主題時快速找到相似文件"].map(item => (
                  <div key={item} style={{ fontSize: 13, color: "#6D28D9", marginBottom: 4 }}>✓ {item}</div>
                ))}
              </div>

              {isAdmin && (
                <div style={{ padding: 14, background: "#FEF3C7", borderRadius: 10, border: "1px solid #FCD34D", marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#92400E", marginBottom: 4 }}>🕐 更新限制（管理員）</div>
                  <div style={{ fontSize: 12, color: "#92400E" }}>每天最多重新整理 3 次 · 每份文件有 24 小時冷卻時間</div>
                </div>
              )}

              <button onClick={() => setShowInfo(false)} style={{ ...btnPrimaryStyle, width: "100%", padding: "12px 0" }}>
                了解了！
              </button>
            </div>
          </div>
        )}

        {/* Cluster Modal */}
        {showClusterModal && selectedCluster !== null && (
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
            onClick={() => setShowClusterModal(false)}
          >
            <div
              style={{ maxWidth: 500, width: "100%", padding: 28, margin: 20, background: "white", borderRadius: 16, maxHeight: "80vh", overflow: "auto", boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <div style={{ width: 14, height: 14, borderRadius: "50%", background: CLUSTER_COLORS[selectedCluster % CLUSTER_COLORS.length] }} />
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "#0F172A" }}>
                  {clusterNames[selectedCluster]}
                </h2>
              </div>
              <p style={{ fontSize: 13, color: "#94A3B8", marginBottom: 20 }}>
                {selectedClusterDocs.length} 份文件屬於此主題群組
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {selectedClusterDocs.map((doc) => (
                  <a
                    key={doc.id}
                    href={`/library/${doc.id}`}
                    style={{ padding: "12px 16px", border: "1px solid #E2E8F0", borderRadius: 10, textDecoration: "none", display: "block", background: "white", transition: "all 0.15s" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = CLUSTER_COLORS[selectedCluster % CLUSTER_COLORS.length]; e.currentTarget.style.background = "#F8FAFC"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.background = "white"; }}
                  >
                    {/* ── Fix 6: No doc ID shown ── */}
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#0F172A" }}>{doc.data.label}</div>
                  </a>
                ))}
              </div>

              <button onClick={() => setShowClusterModal(false)} style={{ ...btnStyle, width: "100%", marginTop: 20, padding: "10px 0" }}>
                關閉
              </button>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}