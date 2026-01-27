"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

export default function LandingPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<"library" | "feedback" | "dashboard">("library");

  useEffect(() => {
    if (!loading && user) {
      router.replace("/library");
    }
  }, [user, loading, router]);

  if (loading || user) {
    return null;
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F8F7FF" }}>
      {/* Navigation */}
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(255, 255, 255, 0.9)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(139, 92, 246, 0.08)",
        }}
      >
        <div
          className="container"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            height: 70,
            padding: "0 32px",
            maxWidth: 1200,
            margin: "0 auto",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: "linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
                fontWeight: 700,
                color: "white",
              }}
            >
              A
            </div>
            <div style={{ fontWeight: 700, fontSize: 18, color: "#1F2937" }}>
              PrimeStride Atlas
            </div>
          </div>

          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <Link
              href="/login"
              style={{
                color: "#6B7280",
                textDecoration: "none",
                fontSize: 15,
                fontWeight: 500,
              }}
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              style={{
                background: "linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)",
                color: "white",
                padding: "10px 24px",
                borderRadius: 10,
                textDecoration: "none",
                fontSize: 15,
                fontWeight: 600,
                boxShadow: "0 4px 14px rgba(124, 58, 237, 0.25)",
                transition: "all 0.2s",
                display: "inline-block",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow = "0 6px 20px rgba(124, 58, 237, 0.35)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 14px rgba(124, 58, 237, 0.25)";
              }}
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section
        style={{
          padding: "100px 32px 80px",
          background: "linear-gradient(180deg, #FDFBFF 0%, #F8F7FF 100%)",
        }}
      >
        <div style={{ maxWidth: 1000, margin: "0 auto", textAlign: "center" }}>
          {/* Badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "#EDE9FE",
              border: "1px solid #DDD6FE",
              borderRadius: 50,
              padding: "8px 20px",
              marginBottom: 28,
              fontSize: 14,
              fontWeight: 600,
              color: "#7C3AED",
            }}
          >
            <span>🧭</span>
            <span>Performance-Aware Knowledge System</span>
          </div>

          {/* Headline */}
          <h1
            style={{
              fontSize: "clamp(44px, 6vw, 68px)",
              fontWeight: 800,
              lineHeight: 1.1,
              marginBottom: 16,
              color: "#111827",
            }}
          >
            Knowledge that learns
            <br />
            <span
              style={{
                background: "linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              from every interaction
            </span>
          </h1>
          {/* Chinese subtitle for Taiwan market */}
          <p
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: "#9CA3AF",
              marginBottom: 24,
              fontStyle: "italic",
            }}
          >
            從每次互動中學習的知識系統
          </p>

          {/* Subtitle */}
          <p
            style={{
              fontSize: 19,
              color: "#6B7280",
              maxWidth: 720,
              margin: "0 auto 36px",
              lineHeight: 1.65,
            }}
          >
            Stop guessing which docs work. Atlas captures feedback at the moment of use,
            surfaces confusion, and drives measurable improvement.
          </p>

          {/* CTAs */}
          <div
            style={{
              display: "flex",
              gap: 14,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <Link
              href="/signup"
              style={{
                background: "linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)",
                color: "white",
                padding: "16px 36px",
                borderRadius: 12,
                textDecoration: "none",
                fontSize: 16,
                fontWeight: 600,
                boxShadow: "0 4px 14px rgba(124, 58, 237, 0.25)",
                transition: "all 0.2s",
                display: "inline-block",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 8px 24px rgba(124, 58, 237, 0.35)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 14px rgba(124, 58, 237, 0.25)";
              }}
            >
              Start Free Trial
            </Link>
            <button
              onClick={() => {
                document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" });
              }}
              style={{
                background: "white",
                color: "#374151",
                padding: "16px 36px",
                borderRadius: 12,
                border: "1px solid #E5E7EB",
                fontSize: 16,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#C4B5FD";
                e.currentTarget.style.background = "#FDFBFF";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#E5E7EB";
                e.currentTarget.style.background = "white";
              }}
            >
              Watch Demo
            </button>
          </div>

          {/* Social Proof */}
          <div
            style={{
              marginTop: 48,
              fontSize: 14,
              color: "#9CA3AF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 20,
              flexWrap: "wrap",
            }}
          >
            <span>Trusted by knowledge teams at</span>
            <div style={{ display: "flex", gap: 20, fontWeight: 600, color: "#6B7280" }}>
              <span>YC Startups</span>
              <span>•</span>
              <span>Tech Companies</span>
              <span>•</span>
              <span>Consulting Firms</span>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Demo Section */}
      <section id="demo" style={{ padding: "80px 32px", background: "white" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          {/* Section Header */}
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <h2
              style={{
                fontSize: 42,
                fontWeight: 800,
                marginBottom: 18,
                color: "#111827",
              }}
            >
              See it in action
            </h2>
            <p
              style={{
                fontSize: 18,
                color: "#6B7280",
                maxWidth: 640,
                margin: "0 auto",
                lineHeight: 1.6,
              }}
            >
              Three views that transform documents from static files into learning assets
            </p>
          </div>

          {/* Tab Navigation */}
          <div
            style={{
              display: "flex",
              gap: 12,
              justifyContent: "center",
              marginBottom: 40,
              flexWrap: "wrap",
            }}
          >
            {[
              { id: "library", label: "📚 Knowledge Library" },
              { id: "feedback", label: "💬 Live Feedback" },
              { id: "dashboard", label: "📊 Learning Dashboard" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                style={{
                  padding: "14px 28px",
                  background: activeTab === tab.id ? "linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)" : "white",
                  color: activeTab === tab.id ? "white" : "#374151",
                  border: `1px solid ${activeTab === tab.id ? "transparent" : "#E5E7EB"}`,
                  borderRadius: 12,
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s",
                  boxShadow: activeTab === tab.id ? "0 4px 14px rgba(124, 58, 237, 0.25)" : "none",
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== tab.id) {
                    e.currentTarget.style.borderColor = "#C4B5FD";
                    e.currentTarget.style.background = "#FDFBFF";
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== tab.id) {
                    e.currentTarget.style.borderColor = "#E5E7EB";
                    e.currentTarget.style.background = "white";
                  }
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div
            style={{
              borderRadius: 20,
              border: "1px solid #E5E7EB",
              overflow: "hidden",
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.05)",
              background: "white",
            }}
          >
            {/* Library View */}
            {activeTab === "library" && (
              <div style={{ padding: 48, background: "#FDFBFF" }}>
                <div style={{ marginBottom: 32 }}>
                  <h3
                    style={{
                      fontSize: 22,
                      fontWeight: 800,
                      marginBottom: 10,
                      color: "#111827",
                    }}
                  >
                    Learning-Enabled Knowledge Library
                  </h3>
                  <p style={{ color: "#6B7280", fontSize: 15, lineHeight: 1.6 }}>
                    Documents evolve with evidence — versioned, measurable, improvable
                  </p>
                </div>

                <div style={{ display: "grid", gap: 16 }}>
                  {[
                    {
                      id: "PS-DIAG-001",
                      title: "Diagnostic → Problem Framing",
                      helped: 12,
                      unsure: 3,
                      no: 1,
                    },
                    {
                      id: "PS-PITCH-001",
                      title: "Pitch Narrative",
                      helped: 8,
                      unsure: 0,
                      no: 0,
                    },
                    {
                      id: "PS-ORIENT-001",
                      title: "Atlas Orientation Guide",
                      helped: 15,
                      unsure: 2,
                      no: 0,
                    },
                  ].map((doc, idx) => (
                    <div
                      key={doc.id}
                      style={{
                        padding: 24,
                        background: "white",
                        border: "1px solid #E5E7EB",
                        borderRadius: 16,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 20,
                        flexWrap: "wrap",
                        transition: "all 0.2s",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "#C4B5FD";
                        e.currentTarget.style.boxShadow = "0 4px 16px rgba(124, 58, 237, 0.12)";
                        e.currentTarget.style.transform = "translateY(-2px)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "#E5E7EB";
                        e.currentTarget.style.boxShadow = "none";
                        e.currentTarget.style.transform = "translateY(0)";
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 220 }}>
                        <div
                          style={{
                            fontWeight: 700,
                            marginBottom: 10,
                            fontSize: 16,
                            color: "#111827",
                          }}
                        >
                          {doc.title}
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <span
                            style={{
                              background: "#F3F4F6",
                              color: "#6B7280",
                              padding: "4px 12px",
                              borderRadius: 6,
                              fontSize: 13,
                              fontWeight: 600,
                              fontFamily: "monospace",
                            }}
                          >
                            {doc.id}
                          </span>
                          <span
                            style={{
                              background: "#DCFCE7",
                              color: "#16A34A",
                              padding: "4px 12px",
                              borderRadius: 6,
                              fontSize: 13,
                              fontWeight: 600,
                            }}
                          >
                            v1.1
                          </span>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                        <div style={{ display: "flex", gap: 16, fontSize: 15, fontWeight: 600 }}>
                          <span style={{ color: "#16A34A" }}>✓ {doc.helped}</span>
                          <span style={{ color: "#CA8A04" }}>⚠ {doc.unsure}</span>
                          <span style={{ color: "#DC2626" }}>✗ {doc.no}</span>
                        </div>
                        <button
                          style={{
                            background: "linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)",
                            color: "white",
                            padding: "10px 20px",
                            borderRadius: 10,
                            border: "none",
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          View →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Feedback View */}
            {activeTab === "feedback" && (
              <div style={{ padding: 48, background: "#FDFBFF" }}>
                <div style={{ marginBottom: 32 }}>
                  <h3 style={{ fontSize: 22, fontWeight: 800, marginBottom: 10, color: "#111827" }}>
                    Capture Feedback at the Moment of Use
                  </h3>
                  <p style={{ color: "#6B7280", fontSize: 15, lineHeight: 1.6 }}>
                    Readers signal understanding instantly — feedback becomes improvement input
                  </p>
                </div>

                <div
                  style={{
                    padding: 40,
                    background: "white",
                    border: "1px solid #E5E7EB",
                    borderRadius: 16,
                  }}
                >
                  <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
                    <span
                      style={{
                        background: "#F3F4F6",
                        color: "#6B7280",
                        padding: "5px 14px",
                        borderRadius: 6,
                        fontSize: 13,
                        fontWeight: 600,
                        fontFamily: "monospace",
                      }}
                    >
                      PS-ORIENT-001
                    </span>
                    <span
                      style={{
                        background: "#DCFCE7",
                        color: "#16A34A",
                        padding: "5px 14px",
                        borderRadius: 6,
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      v1.1
                    </span>
                  </div>

                  <h4 style={{ fontSize: 19, fontWeight: 700, marginBottom: 20, color: "#111827" }}>
                    PrimeStride Atlas — Orientation & Operating Guide
                  </h4>

                  <div
                    style={{
                      padding: 24,
                      background: "#F9FAFB",
                      borderRadius: 12,
                      marginBottom: 24,
                      borderLeft: "4px solid #7C3AED",
                    }}
                  >
                    <p style={{ fontSize: 15, color: "#4B5563", lineHeight: 1.7 }}>
                      "Atlas turns documents into living knowledge assets by capturing feedback at
                      the moment of use..."
                    </p>
                  </div>

                  <div
                    style={{
                      padding: 24,
                      background: "#FFFBEB",
                      border: "1px solid #FDE68A",
                      borderRadius: 12,
                      marginBottom: 24,
                    }}
                  >
                    <p
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        marginBottom: 16,
                        color: "#92400E",
                      }}
                    >
                      💬 Did this section help you do the work?
                    </p>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                      {[
                        { label: "✓ This helped", color: "#16A34A" },
                        { label: "⚠ Not confident", color: "#CA8A04" },
                        { label: "✗ Didn't help", color: "#DC2626" },
                      ].map((btn) => (
                        <button
                          key={btn.label}
                          style={{
                            padding: "12px 24px",
                            background: "white",
                            border: `2px solid ${btn.color}`,
                            borderRadius: 10,
                            color: btn.color,
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: "pointer",
                            transition: "all 0.2s",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = btn.color;
                            e.currentTarget.style.color = "white";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "white";
                            e.currentTarget.style.color = btn.color;
                          }}
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <p style={{ fontSize: 14, color: "#9CA3AF" }}>
                    💡 Readers can add context notes explaining confusion or suggesting improvements
                  </p>
                </div>
              </div>
            )}

            {/* Dashboard View */}
            {activeTab === "dashboard" && (
              <div style={{ padding: 48, background: "#FDFBFF" }}>
                <div style={{ marginBottom: 32 }}>
                  <h3 style={{ fontSize: 22, fontWeight: 800, marginBottom: 10, color: "#111827" }}>
                    See Where Knowledge Breaks Down
                  </h3>
                  <p style={{ color: "#6B7280", fontSize: 15, lineHeight: 1.6 }}>
                    Rank documents by ambiguity — focus improvement where it matters most
                  </p>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: 16,
                    marginBottom: 32,
                  }}
                >
                  {[
                    { label: "Total Feedback", value: "35", color: "#7C3AED" },
                    { label: "Avg Helpfulness", value: "82%", color: "#16A34A" },
                    { label: "Need Attention", value: "1", color: "#CA8A04" },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      style={{
                        padding: 24,
                        background: "white",
                        border: "1px solid #E5E7EB",
                        borderRadius: 12,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 32,
                          fontWeight: 800,
                          color: stat.color,
                          marginBottom: 8,
                        }}
                      >
                        {stat.value}
                      </div>
                      <div style={{ fontSize: 13, color: "#9CA3AF", fontWeight: 500 }}>
                        {stat.label}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: "grid", gap: 16 }}>
                  {[
                    {
                      id: "PS-DIAG-001",
                      title: "Diagnostic → Problem Framing",
                      ambiguity: 2,
                      helped: 12,
                      unsure: 3,
                      no: 1,
                    },
                    {
                      id: "PS-ORIENT-001",
                      title: "Atlas Orientation Guide",
                      ambiguity: 1,
                      helped: 15,
                      unsure: 2,
                      no: 0,
                    },
                    {
                      id: "PS-PITCH-001",
                      title: "Pitch Narrative",
                      ambiguity: 0,
                      helped: 8,
                      unsure: 0,
                      no: 0,
                    },
                  ].map((doc) => (
                    <div
                      key={doc.id}
                      style={{
                        padding: 24,
                        background: "white",
                        border: "1px solid #E5E7EB",
                        borderRadius: 16,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          gap: 20,
                          flexWrap: "wrap",
                          marginBottom: doc.ambiguity > 0 ? 16 : 0,
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 16, color: "#111827" }}>
                            {doc.title}
                          </div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <span
                              style={{
                                background: "#F3F4F6",
                                color: "#6B7280",
                                padding: "4px 12px",
                                borderRadius: 6,
                                fontSize: 13,
                                fontWeight: 600,
                                fontFamily: "monospace",
                              }}
                            >
                              {doc.id}
                            </span>
                            <span
                              style={{
                                background: doc.ambiguity > 1 ? "#FEF3C7" : doc.ambiguity > 0 ? "#DBEAFE" : "#DCFCE7",
                                color: doc.ambiguity > 1 ? "#CA8A04" : doc.ambiguity > 0 ? "#3B82F6" : "#16A34A",
                                padding: "4px 12px",
                                borderRadius: 6,
                                fontSize: 13,
                                fontWeight: 600,
                              }}
                            >
                              Ambiguity: {doc.ambiguity}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: 16, fontSize: 15, fontWeight: 600 }}>
                          <span style={{ color: "#16A34A" }}>✓ {doc.helped}</span>
                          <span style={{ color: "#CA8A04" }}>⚠ {doc.unsure}</span>
                          <span style={{ color: "#DC2626" }}>✗ {doc.no}</span>
                        </div>
                      </div>

                      {doc.ambiguity > 0 && (
                        <div
                          style={{
                            padding: 16,
                            background: "#FFFBEB",
                            borderRadius: 10,
                            fontSize: 14,
                          }}
                        >
                          <span style={{ fontWeight: 600, color: "#92400E" }}>💡 Top confusion:</span>{" "}
                          <span style={{ color: "#78350F" }}>
                            "Section on diagnostic flow unclear - needs examples"
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Benefits Grid */}
      <section style={{ padding: "80px 32px", background: "#F8F7FF" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <h2 style={{ fontSize: 42, fontWeight: 800, marginBottom: 18, color: "#111827" }}>
              Why Choose Atlas?
            </h2>
            <p style={{ fontSize: 18, color: "#6B7280", maxWidth: 640, margin: "0 auto" }}>
              Powered by evidence-based knowledge management
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: 24,
            }}
          >
            {[
              {
                icon: "💡",
                title: "Evidence-Based",
                desc: "Stop guessing. See exactly which documents help users succeed.",
              },
              {
                icon: "⚡",
                title: "Real-Time Feedback",
                desc: "Capture understanding at the moment of use. No surveys needed.",
              },
              {
                icon: "🎯",
                title: "Smart Prioritization",
                desc: "Ambiguity scores show you which docs need attention most.",
              },
              {
                icon: "🔄",
                title: "Built-In Learning",
                desc: "Documents evolve with evidence. Version control included.",
              },
            ].map((item, idx) => (
              <div
                key={idx}
                style={{
                  padding: 32,
                  background: "white",
                  border: "1px solid #E5E7EB",
                  borderRadius: 16,
                  transition: "all 0.2s",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-4px)";
                  e.currentTarget.style.boxShadow = "0 12px 32px rgba(124, 58, 237, 0.12)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div style={{ fontSize: 48, marginBottom: 16 }}>{item.icon}</div>
                <h3 style={{ fontSize: 19, fontWeight: 700, marginBottom: 12, color: "#111827" }}>
                  {item.title}
                </h3>
                <p style={{ fontSize: 15, color: "#6B7280", lineHeight: 1.65 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section
        style={{
          padding: "100px 32px",
          background: "linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)",
          color: "white",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <h2
            style={{
              fontSize: "clamp(36px, 5vw, 52px)",
              fontWeight: 800,
              marginBottom: 24,
              lineHeight: 1.2,
            }}
          >
            Stop managing documents.
            <br />
            Start improving understanding.
          </h2>
          <p style={{ fontSize: 19, marginBottom: 40, opacity: 0.95, lineHeight: 1.65 }}>
            Join knowledge teams using Atlas to turn feedback into measurable improvement.
          </p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <Link
              href="/signup"
              style={{
                background: "white",
                color: "#7C3AED",
                padding: "18px 40px",
                borderRadius: 12,
                textDecoration: "none",
                fontSize: 17,
                fontWeight: 700,
                boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
                transition: "all 0.2s",
                display: "inline-block",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 12px 32px rgba(0, 0, 0, 0.16)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.12)";
              }}
            >
              Get Started Free
            </Link>
            <Link
              href="/login"
              style={{
                background: "rgba(255, 255, 255, 0.15)",
                color: "white",
                padding: "18px 40px",
                borderRadius: 12,
                border: "2px solid rgba(255, 255, 255, 0.3)",
                textDecoration: "none",
                fontSize: 17,
                fontWeight: 700,
                transition: "all 0.2s",
                display: "inline-block",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.25)";
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.5)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.3)";
              }}
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: "48px 32px", background: "#111827", color: "#9CA3AF", fontSize: 14 }}>
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 20,
              paddingBottom: 24,
              borderBottom: "1px solid #374151",
            }}
          >
            <div>
              <div style={{ fontWeight: 700, color: "white", marginBottom: 6, fontSize: 16 }}>
                PrimeStride Atlas
              </div>
              <div>Performance-aware knowledge system</div>
            </div>
            <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
              <a href="#" style={{ color: "#9CA3AF", textDecoration: "none", transition: "color 0.2s" }}>
                Documentation
              </a>
              <a href="#" style={{ color: "#9CA3AF", textDecoration: "none", transition: "color 0.2s" }}>
                Contact
              </a>
              <a href="#" style={{ color: "#9CA3AF", textDecoration: "none", transition: "color 0.2s" }}>
                Privacy
              </a>
            </div>
          </div>
          <div style={{ marginTop: 24, fontSize: 13, color: "#6B7280", textAlign: "center" }}>
            繁體中文版本即將推出 | Traditional Chinese version coming soon
          </div>
        </div>
      </footer>
    </div>
  );
}