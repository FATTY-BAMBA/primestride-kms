"use client";

import Link from "next/link";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import UserMenu from "@/components/UserMenu";
import OrgSwitcher from "@/components/OrgSwitcher";

type Team = {
  id: string;
  name: string;
  color: string;
};

type DocRow = {
  doc_id: string;
  title: string;
  current_version: string;
  status: string;
  doc_type: string | null;
  domain: string | null;
  tags: string[] | null;
  file_url?: string | null;
  team_id?: string | null;
  teams?: Team | null;
  feedback_counts: {
    helped: number;
    not_confident: number;
    didnt_help: number;
  };
};

// Inner component that uses useSearchParams
function LibraryContent() {
  const searchParams = useSearchParams();
  const teamFilter = searchParams.get("team") || "all";

  const [docs, setDocs] = useState<DocRow[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState<string>("");

  useEffect(() => {
    fetchData();
  }, [teamFilter]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch documents with team filter
      const url = teamFilter && teamFilter !== "all" 
        ? `/api/learning-summary?team=${teamFilter}`
        : "/api/learning-summary";
      
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to load");
      setDocs(data.documents ?? []);
      setTeams(data.teams ?? []);
      
      // Fetch user role
      const profileRes = await fetch("/api/profile");
      const profileData = await profileRes.json();
      if (profileRes.ok && profileData.role) {
        setUserRole(profileData.role);
        setIsAdmin(["owner", "admin"].includes(profileData.role));
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  const totalFeedback = docs.reduce(
    (sum, d) =>
      sum +
      d.feedback_counts.helped +
      d.feedback_counts.not_confident +
      d.feedback_counts.didnt_help,
    0
  );

  return (
    <>
      <header style={{ marginBottom: 40 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            marginBottom: 8,
            flexWrap: "wrap",
          }}
        >
          {/* Logo & Title */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: "linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
              }}
            >
              📚
            </div>
            <h1 style={{ fontSize: 20, margin: 0 }}>PS Atlas</h1>
          </div>

          {/* Navigation */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {isAdmin && (
              <Link href="/library/new" className="btn btn-primary" style={{ padding: "8px 14px", fontSize: 13 }}>
                ➕ New
              </Link>
            )}
            <Link 
              href="/chat" 
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "8px 14px",
                background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                color: "white",
                borderRadius: 8,
                textDecoration: "none",
                fontSize: 13,
                fontWeight: 600,
                boxShadow: "0 2px 6px rgba(16, 185, 129, 0.3)",
              }}
            >
              🤖 Chat
            </Link>
            <Link href="/search" className="btn" style={{ padding: "8px 14px", fontSize: 13 }}>
              🔍 Search
            </Link>
            <Link href="/learning" className="btn" style={{ padding: "8px 14px", fontSize: 13 }}>
              📊 Learning
            </Link>
            <Link href="/admin" className="btn" style={{ padding: "8px 14px", fontSize: 13 }}>
              ⚙️ Admin
            </Link>
            <Link href="/team" className="btn" style={{ padding: "8px 14px", fontSize: 13 }}>
              👤 Members
            </Link>
            <Link href="/teams" className="btn" style={{ padding: "8px 14px", fontSize: 13 }}>
              🏷️ Groups
            </Link>
            <Link href="/ai-graph" className="btn" style={{ padding: "8px 14px", fontSize: 13 }}>
              🧠 Graph
            </Link>
            <OrgSwitcher />
            <UserMenu />
          </div>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
          Learning-enabled docs with feedback → weekly improvements
        </p>
      </header>

      {/* Stats Cards */}
      {!loading && !err && (
        <div style={{ display: "flex", gap: 16, marginBottom: 32, flexWrap: "wrap" }}>
          <div className="card" style={{ flex: "1 1 150px", minWidth: 150 }}>
            <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>
              {docs.length}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Documents</div>
          </div>
          <div className="card" style={{ flex: "1 1 150px", minWidth: 150 }}>
            <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 4, color: "var(--accent-blue)" }}>
              {totalFeedback}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Total Feedback</div>
          </div>
          {teams.length > 0 && (
            <div className="card" style={{ flex: "1 1 150px", minWidth: 150 }}>
              <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 4, color: "#7C3AED" }}>
                {teams.length}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Groups</div>
            </div>
          )}
        </div>
      )}

      {/* Team Filter */}
      {!loading && !err && teams.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "var(--text-muted)", marginRight: 4 }}>Filter:</span>
            <Link
              href="/library"
              className="btn"
              style={{
                padding: "6px 14px",
                fontSize: 13,
                background: teamFilter === "all" ? "#7C3AED" : undefined,
                color: teamFilter === "all" ? "white" : undefined,
              }}
            >
              All
            </Link>
            <Link
              href="/library?team=org-wide"
              className="btn"
              style={{
                padding: "6px 14px",
                fontSize: 13,
                background: teamFilter === "org-wide" ? "#7C3AED" : undefined,
                color: teamFilter === "org-wide" ? "white" : undefined,
              }}
            >
              🌐 Org-Wide
            </Link>
            {teams.map((team) => (
              <Link
                key={team.id}
                href={`/library?team=${team.id}`}
                className="btn"
                style={{
                  padding: "6px 14px",
                  fontSize: 13,
                  background: teamFilter === team.id ? team.color : undefined,
                  color: teamFilter === team.id ? "white" : undefined,
                  borderLeft: teamFilter !== team.id ? `3px solid ${team.color}` : undefined,
                }}
              >
                {team.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      <section>
        <h2 style={{ marginBottom: 20, fontSize: 18 }}>
          Knowledge Library
          {teamFilter !== "all" && teamFilter !== "org-wide" && teams.find(t => t.id === teamFilter) && (
            <span style={{ 
              fontSize: 14, 
              fontWeight: 400, 
              color: "var(--text-muted)",
              marginLeft: 8,
            }}>
              — {teams.find(t => t.id === teamFilter)?.name}
            </span>
          )}
          {teamFilter === "org-wide" && (
            <span style={{ 
              fontSize: 14, 
              fontWeight: 400, 
              color: "var(--text-muted)",
              marginLeft: 8,
            }}>
              — Organization-Wide
            </span>
          )}
        </h2>

        {loading && <div className="loading"><span>Loading documents...</span></div>}

        {err && (
          <div className="card" style={{ borderColor: "var(--accent-red)", background: "var(--accent-red-soft)" }}>
            <p style={{ color: "var(--accent-red)" }}>Error: {err}</p>
          </div>
        )}

        {!loading && !err && (
          <div style={{ display: "grid", gap: 16 }}>
            {docs.map((d, i) => (
              <div
                key={d.doc_id}
                className="card animate-in"
                style={{
                  animationDelay: `${i * 0.05}s`,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 20,
                  flexWrap: "wrap",
                  borderLeft: d.teams ? `4px solid ${d.teams.color}` : "4px solid #E5E7EB",
                }}
              >
                <div style={{ flex: 1, minWidth: 200 }}>
                  <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>{d.title}</h3>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <span className="badge mono">{d.doc_id}</span>
                    <span className="badge">{d.current_version}</span>
                    <span className="badge badge-success">{d.status}</span>
                    {d.doc_type && <span className="badge">{d.doc_type}</span>}
                    {d.file_url && <span className="badge" title="Has attached file">📎 File</span>}
                    {d.teams ? (
                      <span 
                        className="badge" 
                        style={{ 
                          background: d.teams.color + "20", 
                          color: d.teams.color,
                          borderColor: d.teams.color,
                        }}
                      >
                        {d.teams.name}
                      </span>
                    ) : (
                      <span className="badge" style={{ background: "#F3F4F6", color: "#6B7280" }}>
                        🌐 Org-Wide
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", gap: 16, fontSize: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--accent-green)" }}>
                      <span>✓</span>
                      <span style={{ fontWeight: 600 }}>{d.feedback_counts.helped}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--accent-yellow)" }}>
                      <span>⚠</span>
                      <span style={{ fontWeight: 600 }}>{d.feedback_counts.not_confident}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--accent-red)" }}>
                      <span>✗</span>
                      <span style={{ fontWeight: 600 }}>{d.feedback_counts.didnt_help}</span>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    {isAdmin && (
                      <Link href={`/library/${encodeURIComponent(d.doc_id)}/edit`} className="btn">
                        ✏️ Edit
                      </Link>
                    )}
                    <Link href={`/library/${encodeURIComponent(d.doc_id)}`} className="btn btn-primary">
                      View & Feedback →
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && !err && docs.length === 0 && (
          <div className="card" style={{ textAlign: "center", padding: 40 }}>
            <p style={{ color: "var(--text-muted)" }}>
              {teamFilter !== "all" 
                ? "No documents found in this filter." 
                : "No documents found."}
            </p>
            {isAdmin && (
              <Link href="/library/new" className="btn btn-primary" style={{ marginTop: 16 }}>
                ➕ Create First Document
              </Link>
            )}
            {teamFilter !== "all" && (
              <Link href="/library" className="btn" style={{ marginTop: 16, marginLeft: 8 }}>
                View All Documents
              </Link>
            )}
          </div>
        )}
      </section>
    </>
  );
}

// Loading fallback for Suspense
function LibraryLoading() {
  return (
    <div className="loading" style={{ padding: 40, textAlign: "center" }}>
      <span>Loading library...</span>
    </div>
  );
}

// Main page component with Suspense boundary
export default function LibraryPage() {
  return (
    <ProtectedRoute>
      <main className="container">
        <Suspense fallback={<LibraryLoading />}>
          <LibraryContent />
        </Suspense>
      </main>
    </ProtectedRoute>
  );
}