"use client";

import { useState, useEffect } from "react";
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

const CLUSTER_COLORS = [
  "#7C3AED", // Purple
  "#3B82F6", // Blue  
  "#10B981", // Green
  "#F59E0B", // Orange
  "#EF4444", // Red
];

export default function AIGraphPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [stats, setStats] = useState({ docs: 0, connections: 0 });
  const [clusterCounts, setClusterCounts] = useState<{[key: number]: number}>({});
  const [clusterNames, setClusterNames] = useState<{[key: number]: string}>({});
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    loadGraph();
  }, []);

  const loadGraph = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/embeddings/similarities");
      const data = await res.json();

      if (res.ok) {
        const counts: {[key: number]: number} = {};
        Object.values(data.clusters).forEach((clusterIdx: any) => {
          counts[clusterIdx] = (counts[clusterIdx] || 0) + 1;
        });
        setClusterCounts(counts);

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
              cluster: names[clusterIdx] || `Cluster ${clusterIdx + 1}`
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
    } catch (error) {
      setError("Failed to load graph");
    } finally {
      setLoading(false);
    }
  };

  const generateEmbeddings = async () => {
    if (!confirm("Generate AI embeddings for all documents? This will use OpenAI API and may take a minute.")) {
      return;
    }

    try {
      setGenerating(true);
      setError("");

      const res = await fetch("/api/embeddings/generate", {
        method: "POST",
      });

      const data = await res.json();

      if (res.ok) {
        alert(`✅ Generated embeddings for ${data.processed} documents with AI-powered cluster names!`);
        loadGraph();
      } else {
        setError(data.error || "Failed to generate embeddings");
      }
    } catch (error) {
      setError("Failed to generate embeddings");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: "40px 20px", textAlign: "center" }}>
        <div>Loading AI Knowledge Graph...</div>
      </div>
    );
  }

  return (
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
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
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
            </div>
            
            <p style={{ fontSize: 14, color: "#6B7280", margin: "0 0 12px 0" }}>
              {stats.docs} documents • {stats.connections} connections
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
                  <div key={idx} style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    gap: 6,
                    padding: "4px 10px",
                    background: "#F9FAFB",
                    borderRadius: 6,
                    border: "1px solid #E5E7EB"
                  }}>
                    <div style={{ 
                      width: 12, 
                      height: 12, 
                      borderRadius: "50%",
                      background: CLUSTER_COLORS[parseInt(idx)]
                    }} />
                    <span style={{ color: "#374151", fontWeight: 500 }}>
                      {clusterNames[parseInt(idx)]} ({count})
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <Link href="/library" className="btn">
              ← Back
            </Link>
            <button
              onClick={generateEmbeddings}
              disabled={generating}
              className="btn btn-primary"
              style={{ opacity: generating ? 0.7 : 1 }}
            >
              {generating ? "Generating..." : "🔄 Generate Embeddings"}
            </button>
          </div>
        </div>
      </div>

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
            No Embeddings Yet
          </h2>
          <p style={{ color: "#6B7280", marginBottom: 24, textAlign: "center", maxWidth: 400 }}>
            Generate AI embeddings to visualize document relationships with intelligent topic clustering
          </p>
          <button
            onClick={generateEmbeddings}
            disabled={generating}
            className="btn btn-primary"
          >
            {generating ? "Generating..." : "Generate Embeddings"}
          </button>
        </div>
      ) : (
        <div style={{ flex: 1 }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            fitView
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>
      )}

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
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.3)"
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
                <li><strong>Nodes (circles):</strong> Each node represents one document</li>
                <li><strong>Colors:</strong> Documents are automatically grouped by topic using AI</li>
                <li><strong>Cluster names:</strong> AI analyzes content and generates meaningful category names</li>
                <li><strong>Lines:</strong> Show relationships between similar documents</li>
                <li><strong>Line thickness:</strong> Thicker lines = stronger relationship</li>
                <li><strong>Animated lines:</strong> Very similar documents (85%+ match)</li>
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
                <li>Discover related content you didn't know existed</li>
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
    </div>
  );
}