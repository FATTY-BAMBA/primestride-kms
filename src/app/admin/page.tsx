import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserOrganization } from "@/lib/get-user-organization";

export const dynamic = "force-dynamic";

// Create Supabase admin client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function AdminPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/login");
  }

  // Get user's organization membership (handles multiple memberships)
  const membership = await getUserOrganization(userId);

  if (!membership) {
    return (
      <div className="container" style={{ padding: "40px 20px", textAlign: "center" }}>
        <h1>No Organization Found</h1>
        <p style={{ color: "#6B7280", marginBottom: 20 }}>You don't belong to any organization yet.</p>
        <Link href="/library" className="btn">Go to Library</Link>
      </div>
    );
  }

  // Only owners and admins can access
  if (!["owner", "admin"].includes(membership.role || "")) {
    return (
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "80px 20px", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12, color: "#111827" }}>Access Restricted</h1>
        <p style={{ color: "#6B7280", marginBottom: 24 }}>
          Only Admins and Owners can access Admin Settings. Contact your organization admin if you need access.
        </p>
        <Link href="/library" style={{ display: "inline-block", padding: "10px 24px", background: "#7C3AED", color: "white", borderRadius: 8, textDecoration: "none", fontWeight: 600 }}>
          ← Back to Library
        </Link>
      </div>
    );
  }

  // Get all documents
  const { data: documents } = await supabase
    .from("documents")
    .select("*")
    .eq("organization_id", membership.organization_id)
    .order("title", { ascending: true });

  // Get all feedback
  const { data: allFeedback } = await supabase
    .from("feedback")
    .select("doc_id, is_helpful, created_at")
    .eq("organization_id", membership.organization_id);

  // Calculate stats per document
  const docStats = documents?.map((doc) => {
    const docFeedback = allFeedback?.filter((f) => f.doc_id === doc.doc_id) || [];
    const helpful = docFeedback.filter((f) => f.is_helpful).length;
    const notHelpful = docFeedback.filter((f) => !f.is_helpful).length;
    const total = helpful + notHelpful;
    const helpfulPercentage = total > 0 ? Math.round((helpful / total) * 100) : 0;

    return {
      ...doc,
      helpful,
      notHelpful,
      total,
      helpfulPercentage,
    };
  }) || [];

  // Sort by different criteria
  const mostHelpful = [...docStats].sort((a, b) => b.helpful - a.helpful).slice(0, 5);
  const needsImprovement = [...docStats]
    .filter((d) => d.total >= 3)
    .sort((a, b) => a.helpfulPercentage - b.helpfulPercentage)
    .slice(0, 5);
  const mostEngaged = [...docStats].sort((a, b) => b.total - a.total).slice(0, 5);

  // Overall stats
  const totalDocs = documents?.length || 0;
  const totalFeedback = allFeedback?.length || 0;
  const totalHelpful = allFeedback?.filter((f) => f.is_helpful).length || 0;
  const overallHelpfulRate = totalFeedback > 0 
    ? Math.round((totalHelpful / totalFeedback) * 100) 
    : 0;

  return (
    <div style={{ minHeight: "100vh", background: "#F8F7FF" }}>
      <div className="container" style={{ maxWidth: 1200, padding: "40px 20px" }}>
        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <Link
            href="/library"
            style={{
              color: "#7C3AED",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 500,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 16,
            }}
          >
            ← Back to Library
          </Link>
          <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8, color: "#111827" }}>
            📊 Admin Dashboard
          </h1>
          <p style={{ color: "#6B7280", fontSize: 16 }}>
            Analytics and insights for your knowledge base
          </p>
        </div>

        {/* Stats Overview */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 20,
            marginBottom: 24,
          }}
        >
          <div style={{ padding: 24, textAlign: "center", background: "white", borderRadius: 16, border: "1px solid #E5E7EB", boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)" }}>
            <div style={{ fontSize: 36, fontWeight: 700, color: "#7C3AED", marginBottom: 8 }}>{totalDocs}</div>
            <div style={{ fontSize: 14, color: "#6B7280" }}>Total Documents</div>
          </div>
          <div style={{ padding: 24, textAlign: "center", background: "white", borderRadius: 16, border: "1px solid #E5E7EB", boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)" }}>
            <div style={{ fontSize: 36, fontWeight: 700, color: "#10B981", marginBottom: 8 }}>{totalFeedback}</div>
            <div style={{ fontSize: 14, color: "#6B7280" }}>Total Feedback</div>
          </div>
          <div style={{ padding: 24, textAlign: "center", background: "white", borderRadius: 16, border: "1px solid #E5E7EB", boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)" }}>
            <div style={{ fontSize: 36, fontWeight: 700, color: "#F59E0B", marginBottom: 8 }}>{overallHelpfulRate}%</div>
            <div style={{ fontSize: 14, color: "#6B7280" }}>Helpful Rate</div>
          </div>
          <div style={{ padding: 24, textAlign: "center", background: "white", borderRadius: 16, border: "1px solid #E5E7EB", boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)" }}>
            <div style={{ fontSize: 36, fontWeight: 700, color: "#EF4444", marginBottom: 8 }}>{needsImprovement.length}</div>
            <div style={{ fontSize: 14, color: "#6B7280" }}>Need Improvement</div>
          </div>
        </div>

        {/* Quick Actions */}
        <div style={{ padding: 24, marginBottom: 24, background: "white", borderRadius: 16, border: "1px solid #E5E7EB", boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: "#111827" }}>⚡ Quick Actions</h2>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/library/new" className="btn btn-primary" style={{ padding: "10px 20px", fontSize: 14 }}>➕ Create New Document</Link>
            <Link href="/library" className="btn" style={{ padding: "10px 20px", fontSize: 14 }}>📚 View Library</Link>
            <Link href="/ai-graph" className="btn" style={{ padding: "10px 20px", fontSize: 14 }}>🧠 AI Knowledge Graph</Link>
            <Link href="/team" className="btn" style={{ padding: "10px 20px", fontSize: 14 }}>👥 Manage Team</Link>
          </div>
        </div>

        {/* Top Performing */}
        <div style={{ padding: 32, marginBottom: 24, background: "white", borderRadius: 16, border: "1px solid #E5E7EB", boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)" }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, color: "#111827" }}>🏆 Top Performing Documents</h2>
          {mostHelpful.length === 0 ? (
            <p style={{ color: "#6B7280" }}>No feedback data yet</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {mostHelpful.map((doc) => (
                <div key={doc.doc_id} style={{ padding: 16, border: "1px solid #E5E7EB", borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center", background: "#FAFAFA", flexWrap: "wrap", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontWeight: 600, fontSize: 16, color: "#111827" }}>{doc.title}</div>
                    <div style={{ fontSize: 13, color: "#6B7280", marginTop: 4, fontFamily: "monospace" }}>{doc.doc_id}</div>
                  </div>
                  <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ textAlign: "center" }}><div style={{ fontSize: 20, fontWeight: 700, color: "#10B981" }}>{doc.helpful}</div><div style={{ fontSize: 12, color: "#6B7280" }}>👍</div></div>
                    <div style={{ textAlign: "center" }}><div style={{ fontSize: 20, fontWeight: 700, color: "#EF4444" }}>{doc.notHelpful}</div><div style={{ fontSize: 12, color: "#6B7280" }}>👎</div></div>
                    <div style={{ padding: "6px 14px", background: "#DCFCE7", color: "#16A34A", borderRadius: 8, fontSize: 14, fontWeight: 700 }}>{doc.helpfulPercentage}%</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Link href={`/library/${doc.doc_id}/edit`} className="btn" style={{ padding: "6px 12px", fontSize: 13 }}>✏️ Edit</Link>
                      <Link href={`/library/${doc.doc_id}`} className="btn" style={{ padding: "6px 12px", fontSize: 13 }}>👁️ View</Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Needs Improvement */}
        <div style={{ padding: 32, marginBottom: 24, background: "white", borderRadius: 16, border: "1px solid #E5E7EB", boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)" }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, color: "#111827" }}>⚠️ Documents Needing Improvement</h2>
          {needsImprovement.length === 0 ? (
            <p style={{ color: "#6B7280" }}>No documents need improvement (or not enough feedback yet)</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {needsImprovement.map((doc) => (
                <div key={doc.doc_id} style={{ padding: 16, border: "2px solid #FECACA", borderRadius: 12, background: "#FEF2F2", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontWeight: 600, fontSize: 16, color: "#111827" }}>{doc.title}</div>
                    <div style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}><span style={{ fontFamily: "monospace" }}>{doc.doc_id}</span> • {doc.total} feedback entries</div>
                  </div>
                  <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ textAlign: "center" }}><div style={{ fontSize: 20, fontWeight: 700, color: "#10B981" }}>{doc.helpful}</div><div style={{ fontSize: 12, color: "#6B7280" }}>👍</div></div>
                    <div style={{ textAlign: "center" }}><div style={{ fontSize: 20, fontWeight: 700, color: "#EF4444" }}>{doc.notHelpful}</div><div style={{ fontSize: 12, color: "#6B7280" }}>👎</div></div>
                    <div style={{ padding: "6px 14px", background: "#FEE2E2", color: "#DC2626", borderRadius: 8, fontSize: 14, fontWeight: 700 }}>{doc.helpfulPercentage}%</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Link href={`/library/${doc.doc_id}/edit`} className="btn btn-primary" style={{ padding: "6px 12px", fontSize: 13 }}>✏️ Edit</Link>
                      <Link href={`/library/${doc.doc_id}`} className="btn" style={{ padding: "6px 12px", fontSize: 13 }}>👁️ View</Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Most Engaged */}
        <div style={{ padding: 32, marginBottom: 24, background: "white", borderRadius: 16, border: "1px solid #E5E7EB", boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)" }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, color: "#111827" }}>💬 Most Engaged Documents</h2>
          {mostEngaged.length === 0 ? (
            <p style={{ color: "#6B7280" }}>No engagement data yet</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {mostEngaged.map((doc) => (
                <div key={doc.doc_id} style={{ padding: 16, border: "1px solid #E5E7EB", borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center", background: "#FAFAFA", flexWrap: "wrap", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontWeight: 600, fontSize: 16, color: "#111827" }}>{doc.title}</div>
                    <div style={{ fontSize: 13, color: "#6B7280", marginTop: 4, fontFamily: "monospace" }}>{doc.doc_id}</div>
                  </div>
                  <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ padding: "8px 16px", background: "linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)", color: "white", borderRadius: 8, fontSize: 14, fontWeight: 700 }}>{doc.total} feedback entries</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Link href={`/library/${doc.doc_id}/edit`} className="btn" style={{ padding: "6px 12px", fontSize: 13 }}>✏️ Edit</Link>
                      <Link href={`/library/${doc.doc_id}`} className="btn" style={{ padding: "6px 12px", fontSize: 13 }}>👁️ View</Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* All Documents */}
        <div style={{ padding: 32, background: "white", borderRadius: 16, border: "1px solid #E5E7EB", boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>📚 All Documents ({totalDocs})</h2>
            <Link href="/library/new" className="btn btn-primary" style={{ padding: "8px 16px", fontSize: 14 }}>➕ New Document</Link>
          </div>
          {docStats.length === 0 ? (
            <p style={{ color: "#6B7280" }}>No documents yet. Create your first document!</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {docStats.map((doc) => (
                <div key={doc.doc_id} style={{ padding: "12px 16px", border: "1px solid #E5E7EB", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center", background: "#FAFAFA", flexWrap: "wrap", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: "#111827" }}>{doc.title}</div>
                    <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "monospace" }}>{doc.doc_id}</span>
                      {doc.doc_type && <span style={{ padding: "2px 6px", background: "#E5E7EB", borderRadius: 4, fontSize: 11 }}>{doc.doc_type}</span>}
                      {doc.file_url && <span title="Has attached file">📎</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {doc.total > 0 && <span style={{ fontSize: 12, color: "#6B7280", marginRight: 8 }}>👍 {doc.helpful} / 👎 {doc.notHelpful}</span>}
                    <Link href={`/library/${doc.doc_id}/edit`} className="btn" style={{ padding: "6px 12px", fontSize: 12 }}>✏️ Edit</Link>
                    <Link href={`/library/${doc.doc_id}`} className="btn" style={{ padding: "6px 12px", fontSize: 12 }}>👁️ View</Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}