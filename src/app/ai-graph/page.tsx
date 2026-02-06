"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
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
import UserMenu from "@/components/UserMenu";

const CLUSTER_COLORS = [
  "#7C3AED",
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
];

function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return "Never";
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
  
  return date.toLocaleDateString();
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
  const [accessLevel, setAccessLevel] = useState<"admin" | "member">("member");
  const [isAdmin, setIsAdmin] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [refreshResult, setRefreshResult] = useState<any>(null);

  useEffect(() => {
    loadGraph();
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const res = await fetch("/api/profile");
      const data = await res.json();
      if (res.ok && data.role) {
        setIsAdmin(["owner", "admin"].includes(data.role));
      }
    } catch (err) {
      console.error("Failed to check admin status:", err);
    }
  };

  const loadGraph = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/embeddings/similarities");
      const data = await res.json();

      if (res.ok) {
        setAccessLevel(data.accessLevel || "member");
        setLastUpdated(data.lastUpdated || null);

        const counts: {[key: number]: number} = {};
        Object.values(data.clusters).forEach((clusterIdx: any) => {
          counts[clusterIdx] = (counts[clusterIdx] || 0) + 1;
        });
        setClusterCounts(counts);
        setClusterMap(data.clusters || {});

        const names: {[key: number]: string} = {};
        Object.keys(counts).forEach((idx) => {
          const index = parseInt(idx);
          names[index] = data.clusterNames?.[index] || `Cluster ${index + 1}`;
        });
        setClusterNames(names);

        const flowNodes: Node[] = data.nodes.map((node: any) => {
          const clusterIdx = data.clusters[node.id] || 0;
          const color = CLUSTER_COLORS[clusterIdx % CLUSTER_COLORS.length];

          return {
            id: node.id,
            data: { 
              label: node.label,
              cluster: names[clusterIdx] || `Cluster ${clusterIdx + 1}`,
              docId: node.id,
            },
            position: { x: Math.random() * 500, y: Math.random() * 500 },
            style: {
              background: color,
              color: "white",
              border: "2px solid white",
              borderRadius: 8,
              padding: 10,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            },
          };
        });

        const flowEdges: Edge[] = data.edges.map((edge: any) => ({
          id: `${edge.source}-${edge.target}`,
          source: edge.source,
          target: edge.target,
          animated: edge.strength > 0.85,
          style: {
            stroke: "#94A3B8",
            strokeWidth: edge.strength * 3,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: "#94A3B8",
          },
        }));

        setNodes(flowNodes);
        setEdges(flowEdges);
        setStats({
          docs: data.totalDocuments,
          connections: data.totalConnections,
        });
      } else {
        setError(data.error || "Failed to load graph");
      }
    } catch (err) {
      setError("Failed to load graph");
    } finally {
      setLoading(false);
    }
  };

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    window.location.href = `/library/${node.data.docId}`;
  }, []);

  const handleClusterClick = useCallback((clusterIdx: number) => {
    const docsInCluster = nodes.filter(
      (node) => clusterMap[node.id] === clusterIdx
    );
    setSelectedCluster(clusterIdx);
    setSelectedClusterDocs(docsInCluster);
    setShowClusterModal(true);
  }, [nodes, clusterMap]);

  const generateEmbeddings = async () => {
    if (!confirm("Refresh the AI Knowledge Graph? This will regenerate embeddings for documents that haven't been updated in 24 hours.")) {
      return;
    }

    try {
      setGenerating(true);
      setError("");
      setRefreshResult(null);

      const res = await fetch("/api/embeddings/generate", {
        method: "POST",
      });

      const data = await res.json();

      if (res.ok) {
        setRefreshResult(data);
        loadGraph();
      } else if (res.status === 429) {
        // Rate limited
        setError(data.error);
        setRefreshResult({
          rateLimited: true,
          refreshesUsed: data.refreshesUsed,
          refreshesAllowed: data.refreshesAllowed,
        });
      } else {
        setError(data.error || "Failed to generate embeddings");
      }
    } catch (err) {
      setError("Failed to generate embeddings");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="container" style={{ padding: "40px 20px", textAlign: "center" }}>
          <div>Loading AI Knowledge Graph...</div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
        <div
          style={{
            padding: "20px 32px",
            borderBottom: "1px solid #E5E7EB",
            background: "white",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              flexWrap: "wrap",
              gap: 16,
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
                <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
                  🧠 AI Knowledge Graph
                </h1>
                <button
                  onClick={() => setShowInfo(true)}
                  style={{
                    padding: "4px 12px",
                    background: "#F3F4F6",
                    border: "1px solid #E5E7EB",
                    borderRadius: 6,
                    fontSize: 13,
                    cursor: "pointer",
                    fontWeight: 500,
                  }}
                >
                  ℹ️ What is this?
                </button>
                {/* Access level badge */}
                <span
                  style={{
                    padding: "4px 10px",
                    background: accessLevel === "admin" ? "#DCFCE7" : "#DBEAFE",
                    color: accessLevel === "admin" ? "#166534" : "#1E40AF",
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {accessLevel === "admin" ? "🔓 Full View" : "👤 My Access"}
                </span>
              </div>
              
              <p style={{ fontSize: 14, color: "#6B7280", margin: "0 0 8px 0" }}>
                {stats.docs} documents • {stats.connections} connections • Click nodes to view documents
                {accessLevel === "member" && (
                  <span style={{ color: "#9CA3AF", marginLeft: 8 }}>
                    (Showing docs you have access to)
                  </span>
                )}
              </p>

              {/* Last updated timestamp */}
              <p style={{ fontSize: 13, color: "#9CA3AF", margin: "0 0 12px 0" }}>
                🕐 Last updated: {formatRelativeTime(lastUpdated)}
              </p>

              {Object.keys(clusterCounts).length > 0 && (
                <div style={{ 
                  display: "flex", 
                  gap: 12,
                  flexWrap: "wrap",
                  alignItems: "center",
                  fontSize: 13
                }}>
                  <span style={{ fontWeight: 600, color: "#6B7280" }}>AI Topic Clusters:</span>
                  {Object.entries(clusterCounts).map(([idx, count]) => (
                    <button
                      key={idx}
                      onClick={() => handleClusterClick(parseInt(idx))}
                      style={{ 
                        display: "flex", 
                        alignItems: "center", 
                        gap: 6,
                        padding: "6px 12px",
                        background: "#F9FAFB",
                        borderRadius: 6,
                        border: "1px solid #E5E7EB",
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "#E5E7EB";
                        e.currentTarget.style.borderColor = CLUSTER_COLORS[parseInt(idx)];
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "#F9FAFB";
                        e.currentTarget.style.borderColor = "#E5E7EB";
                      }}
                    >
                      <div style={{ 
                        width: 12, 
                        height: 12, 
                        borderRadius: "50%",
                        background: CLUSTER_COLORS[parseInt(idx)]
                      }} />
                      <span style={{ color: "#374151", fontWeight: 500, fontSize: 13 }}>
                        {clusterNames[parseInt(idx)]} ({count})
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <Link href="/library" className="btn">
                ← Back
              </Link>
              {/* Only show generate button for admins */}
              {isAdmin && (
                <button
                  onClick={generateEmbeddings}
                  disabled={generating}
                  className="btn btn-primary"
                  style={{ opacity: generating ? 0.7 : 1 }}
                >
                  {generating ? "Refreshing..." : "🔄 Refresh Graph"}
                </button>
              )}
              <UserMenu />
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div
            style={{
              padding: 16,
              background: "#FEE2E2",
              border: "1px solid #FCA5A5",
              color: "#991B1B",
              margin: 20,
              borderRadius: 8,
            }}
          >
            {error}
            {refreshResult?.rateLimited && (
              <div style={{ marginTop: 8, fontSize: 13 }}>
                You've used {refreshResult.refreshesUsed} of {refreshResult.refreshesAllowed} daily refreshes.
              </div>
            )}
          </div>
        )}

        {/* Success message */}
        {refreshResult && !refreshResult.rateLimited && (
          <div
            style={{
              padding: 16,
              background: "#DCFCE7",
              border: "1px solid #86EFAC",
              color: "#166534",
              margin: 20,
              borderRadius: 8,
            }}
          >
            <strong>✅ Graph refreshed!</strong>
            <div style={{ marginTop: 8, fontSize: 13 }}>
              • Processed: {refreshResult.processed} documents<br/>
              • Skipped (cooldown): {refreshResult.skippedCooldown}<br/>
              • Skipped (no content): {refreshResult.skippedNoContent}<br/>
              {refreshResult.rateLimits && (
                <>• Refreshes remaining today: {refreshResult.rateLimits.userRefreshesRemaining}</>
              )}
            </div>
            <button
              onClick={() => setRefreshResult(null)}
              style={{
                marginTop: 12,
                padding: "6px 12px",
                background: "transparent",
                border: "1px solid #166534",
                borderRadius: 6,
                color: "#166534",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Dismiss
            </button>
          </div>
        )}

        {nodes.length === 0 ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              padding: 40,
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>🧠</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
              {isAdmin ? "No Embeddings Yet" : "No Documents Available"}
            </h2>
            <p style={{ color: "#6B7280", marginBottom: 24, textAlign: "center", maxWidth: 400 }}>
              {isAdmin 
                ? "Generate AI embeddings to visualize document relationships with intelligent topic clustering"
                : "No documents are available in the knowledge graph yet. Ask an admin to generate embeddings."
              }
            </p>
            {isAdmin && (
              <button
                onClick={generateEmbeddings}
                disabled={generating}
                className="btn btn-primary"
              >
                {generating ? "Generating..." : "Generate Embeddings"}
              </button>
            )}
          </div>
        ) : (
          <div style={{ flex: 1 }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              fitView
            >
              <Background />
              <Controls />
            </ReactFlow>
          </div>
        )}

        {/* Info Modal */}
        {showInfo && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0, 0, 0, 0.7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
            onClick={() => setShowInfo(false)}
          >
            <div
              className="card"
              style={{ 
                maxWidth: 600, 
                width: "100%", 
                padding: 32, 
                margin: 20,
                background: "white",
                boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.3)",
                maxHeight: "90vh",
                overflow: "auto",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16, color: "#111827" }}>
                🧠 About AI Knowledge Graph
              </h2>
              
              <p style={{ marginBottom: 16, color: "#1F2937", lineHeight: 1.6, fontSize: 15 }}>
                The AI Knowledge Graph visualizes relationships between your documents using artificial intelligence.
              </p>

              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: "#111827" }}>
                  How it works:
                </h3>
                <ul style={{ marginLeft: 20, lineHeight: 1.8, color: "#1F2937", fontSize: 14 }}>
                  <li><strong>Nodes (circles):</strong> Each node represents one document - click to view</li>
                  <li><strong>Colors:</strong> Documents are automatically grouped by topic using AI</li>
                  <li><strong>Cluster badges:</strong> Click a cluster badge to see all documents in that topic</li>
                  <li><strong>Cluster names:</strong> AI analyzes content and generates meaningful category names</li>
                  <li><strong>Lines:</strong> Show relationships between similar documents</li>
                  <li><strong>Line thickness:</strong> Thicker lines = stronger relationship</li>
                  <li><strong>Animated lines:</strong> Very similar documents (85%+ match)</li>
                </ul>
              </div>

              {/* Access control explanation */}
              <div style={{ 
                padding: 16, 
                background: accessLevel === "admin" ? "#DCFCE7" : "#DBEAFE", 
                borderRadius: 8,
                marginBottom: 16 
              }}>
                <strong style={{ fontSize: 14, color: "#111827" }}>
                  {accessLevel === "admin" ? "🔓 Admin View:" : "👤 Your View:"}
                </strong>
                <p style={{ marginTop: 8, fontSize: 14, color: "#1F2937", margin: 0 }}>
                  {accessLevel === "admin" 
                    ? "You can see all documents in the organization and refresh the graph (max 3 times per day)."
                    : "You can see organization-wide documents and documents from your groups. Contact an admin to refresh the graph."
                  }
                </p>
              </div>

              {/* Update policy */}
              <div style={{ 
                padding: 16, 
                background: "#FEF3C7", 
                borderRadius: 8,
                marginBottom: 16 
              }}>
                <strong style={{ fontSize: 14, color: "#92400E" }}>🕐 Update Policy:</strong>
                <ul style={{ marginLeft: 20, marginTop: 8, lineHeight: 1.6, fontSize: 14, color: "#92400E" }}>
                  <li>Graph refreshes are limited to 3 per user per day</li>
                  <li>Documents have a 24-hour cooldown between re-processing</li>
                  <li>This helps manage costs and keeps the graph stable</li>
                </ul>
              </div>

              <div style={{ 
                padding: 16, 
                background: "#F3F4F6", 
                borderRadius: 8,
                marginBottom: 16 
              }}>
                <strong style={{ fontSize: 14, color: "#111827" }}>💡 Use this to:</strong>
                <ul style={{ marginLeft: 20, marginTop: 8, lineHeight: 1.6, fontSize: 14, color: "#1F2937" }}>
                  <li>Discover related content you did not know existed</li>
                  <li>Identify gaps in your documentation</li>
                  <li>Understand knowledge structure across teams</li>
                  <li>Find similar documents when researching topics</li>
                </ul>
              </div>

              <button
                onClick={() => setShowInfo(false)}
                className="btn btn-primary"
                style={{ width: "100%" }}
              >
                Got it!
              </button>
            </div>
          </div>
        )}

        {/* Cluster Modal */}
        {showClusterModal && selectedCluster !== null && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0, 0, 0, 0.7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
            onClick={() => setShowClusterModal(false)}
          >
            <div
              className="card"
              style={{ 
                maxWidth: 600, 
                width: "100%", 
                padding: 32, 
                margin: 20,
                background: "white",
                maxHeight: "80vh",
                overflow: "auto",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <div style={{ 
                  width: 16, 
                  height: 16, 
                  borderRadius: "50%",
                  background: CLUSTER_COLORS[selectedCluster % CLUSTER_COLORS.length]
                }} />
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "#111827" }}>
                  {clusterNames[selectedCluster]}
                </h2>
              </div>
              <p style={{ color: "#6B7280", fontSize: 14, marginBottom: 20 }}>
                {selectedClusterDocs.length} document{selectedClusterDocs.length !== 1 ? "s" : ""} in this cluster
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {selectedClusterDocs.map((doc) => (
                  <a
                    key={doc.id}
                    href={`/library/${doc.id}`}
                    style={{
                      padding: 16,
                      border: "1px solid #E5E7EB",
                      borderRadius: 8,
                      textDecoration: "none",
                      color: "inherit",
                      transition: "all 0.2s",
                      display: "block",
                      background: "white",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = CLUSTER_COLORS[selectedCluster % CLUSTER_COLORS.length];
                      e.currentTarget.style.background = "#F9FAFB";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#E5E7EB";
                      e.currentTarget.style.background = "white";
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 4, color: "#111827" }}>
                      {doc.data.label}
                    </div>
                    <div style={{ fontSize: 12, color: "#6B7280", fontFamily: "monospace" }}>
                      {doc.id}
                    </div>
                  </a>
                ))}
              </div>

              <button
                onClick={() => setShowClusterModal(false)}
                className="btn"
                style={{ width: "100%", marginTop: 20 }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}