import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function AdminPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="container" style={{ padding: "40px 20px", textAlign: "center" }}>
        <h1>Please Log In</h1>
        <p style={{ color: "#6B7280", marginBottom: 20 }}>You need to be logged in to access this page.</p>
        <Link href="/login" className="btn btn-primary">Sign In</Link>
      </div>
    );
  }

  const { data: profile } = await supabase
    .from("users")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();

  // Check if profile exists
  if (!profile || !profile.organization_id) {
    return (
      <div className="container" style={{ padding: "40px 20px", textAlign: "center" }}>
        <h1>Profile Not Found</h1>
        <p style={{ color: "#6B7280", marginBottom: 20 }}>Unable to load your profile.</p>
        <Link href="/library" className="btn">Go to Library</Link>
      </div>
    );
  }

  // Only owners and admins can access
  if (!["owner", "admin"].includes(profile.role || "")) {
    return (
      <div className="container" style={{ padding: "40px 20px", textAlign: "center" }}>
        <h1>Access Denied</h1>
        <p style={{ color: "#6B7280", marginBottom: 20 }}>Only administrators can access this page.</p>
        <Link href="/library" className="btn btn-primary">Go to Library</Link>
      </div>
    );
  }

  // Get all documents
  const { data: documents } = await supabase
    .from("documents")
    .select("*")
    .eq("organization_id", profile.organization_id);

  // Get all feedback
  const { data: allFeedback } = await supabase
    .from("feedback")
    .select("doc_id, is_helpful, created_at")
    .eq("organization_id", profile.organization_id);

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
          <div
            style={{
              padding: 24,
              textAlign: "center",
              background: "white",
              borderRadius: 16,
              border: "1px solid #E5E7EB",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
            }}
          >
            <div style={{ fontSize: 36, fontWeight: 700, color: "#7C3AED", marginBottom: 8 }}>
              {totalDocs}
            </div>
            <div style={{ fontSize: 14, color: "#6B7280" }}>Total Documents</div>
          </div>

          <div
            style={{
              padding: 24,
              textAlign: "center",
              background: "white",
              borderRadius: 16,
              border: "1px solid #E5E7EB",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
            }}
          >
            <div style={{ fontSize: 36, fontWeight: 700, color: "#10B981", marginBottom: 8 }}>
              {totalFeedback}
            </div>
            <div style={{ fontSize: 14, color: "#6B7280" }}>Total Feedback</div>
          </div>

          <div
            style={{
              padding: 24,
              textAlign: "center",
              background: "white",
              borderRadius: 16,
              border: "1px solid #E5E7EB",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
            }}
          >
            <div style={{ fontSize: 36, fontWeight: 700, color: "#F59E0B", marginBottom: 8 }}>
              {overallHelpfulRate}%
            </div>
            <div style={{ fontSize: 14, color: "#6B7280" }}>Helpful Rate</div>
          </div>

          <div
            style={{
              padding: 24,
              textAlign: "center",
              background: "white",
              borderRadius: 16,
              border: "1px solid #E5E7EB",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
            }}
          >
            <div style={{ fontSize: 36, fontWeight: 700, color: "#EF4444", marginBottom: 8 }}>
              {needsImprovement.length}
            </div>
            <div style={{ fontSize: 14, color: "#6B7280" }}>Need Improvement</div>
          </div>
        </div>

        {/* Quick Actions */}
        <div
          style={{
            padding: 32,
            marginBottom: 24,
            background: "white",
            borderRadius: 16,
            border: "1px solid #E5E7EB",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
          }}
        >
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, color: "#111827" }}>
            ⚡ Quick Actions
          </h2>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link
              href="/library/new"
              className="btn btn-primary"
              style={{ padding: "12px 24px", fontSize: 15 }}
            >
              ➕ Create New Document
            </Link>
            <Link
              href="/library"
              className="btn"
              style={{ padding: "12px 24px", fontSize: 15 }}
            >
              📚 View Library
            </Link>
            <Link
              href="/ai-graph"
              className="btn"
              style={{ padding: "12px 24px", fontSize: 15 }}
            >
              🧠 AI Knowledge Graph
            </Link>
            <Link
              href="/team"
              className="btn"
              style={{ padding: "12px 24px", fontSize: 15 }}
            >
              👥 Manage Team
            </Link>
          </div>
        </div>

        {/* Most Helpful Documents */}
        <div
          style={{
            padding: 32,
            marginBottom: 24,
            background: "white",
            borderRadius: 16,
            border: "1px solid #E5E7EB",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
          }}
        >
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, color: "#111827" }}>
            🏆 Top Performing Documents
          </h2>
          {mostHelpful.length === 0 ? (
            <p style={{ color: "#6B7280" }}>No feedback data yet</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {mostHelpful.map((doc) => (
                <div
                  key={doc.doc_id}
                  style={{
                    padding: 16,
                    border: "1px solid #E5E7EB",
                    borderRadius: 12,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "#FAFAFA",
                    flexWrap: "wrap",
                    gap: 16,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <Link
                      href={`/library/${doc.doc_id}`}
                      style={{ fontWeight: 600, fontSize: 16, color: "#111827", textDecoration: "none" }}
                    >
                      {doc.title}
                    </Link>
                    <div style={{ fontSize: 13, color: "#6B7280", marginTop: 4, fontFamily: "monospace" }}>
                      {doc.doc_id}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: "#10B981" }}>
                        {doc.helpful}
                      </div>
                      <div style={{ fontSize: 12, color: "#6B7280" }}>👍</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: "#EF4444" }}>
                        {doc.notHelpful}
                      </div>
                      <div style={{ fontSize: 12, color: "#6B7280" }}>👎</div>
                    </div>
                    <div
                      style={{
                        padding: "6px 14px",
                        background: "#DCFCE7",
                        color: "#16A34A",
                        borderRadius: 8,
                        fontSize: 14,
                        fontWeight: 700,
                      }}
                    >
                      {doc.helpfulPercentage}%
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Link
                        href={`/library/${doc.doc_id}/edit`}
                        className="btn"
                        style={{ fontSize: 13, padding: "6px 12px" }}
                      >
                        ✏️ Edit
                      </Link>
                      <Link
                        href={`/library/${doc.doc_id}`}
                        className="btn"
                        style={{ fontSize: 13, padding: "6px 12px" }}
                      >
                        👁️ View
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Documents Needing Improvement */}
        <div
          style={{
            padding: 32,
            marginBottom: 24,
            background: "white",
            borderRadius: 16,
            border: "1px solid #E5E7EB",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
          }}
        >
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, color: "#111827" }}>
            ⚠️ Documents Needing Improvement
          </h2>
          {needsImprovement.length === 0 ? (
            <p style={{ color: "#6B7280" }}>No documents need improvement (or not enough feedback yet)</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {needsImprovement.map((doc) => (
                <div
                  key={doc.doc_id}
                  style={{
                    padding: 16,
                    border: "2px solid #FECACA",
                    borderRadius: 12,
                    background: "#FEF2F2",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 16,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <Link
                      href={`/library/${doc.doc_id}`}
                      style={{ fontWeight: 600, fontSize: 16, color: "#111827", textDecoration: "none" }}
                    >
                      {doc.title}
                    </Link>
                    <div style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>
                      <span style={{ fontFamily: "monospace" }}>{doc.doc_id}</span> • {doc.total} feedback entries
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: "#10B981" }}>
                        {doc.helpful}
                      </div>
                      <div style={{ fontSize: 12, color: "#6B7280" }}>👍</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: "#EF4444" }}>
                        {doc.notHelpful}
                      </div>
                      <div style={{ fontSize: 12, color: "#6B7280" }}>👎</div>
                    </div>
                    <div
                      style={{
                        padding: "6px 14px",
                        background: "#FEE2E2",
                        color: "#DC2626",
                        borderRadius: 8,
                        fontSize: 14,
                        fontWeight: 700,
                      }}
                    >
                      {doc.helpfulPercentage}%
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Link
                        href={`/library/${doc.doc_id}/edit`}
                        className="btn btn-primary"
                        style={{ fontSize: 13, padding: "6px 12px" }}
                      >
                        ✏️ Edit
                      </Link>
                      <Link
                        href={`/library/${doc.doc_id}`}
                        className="btn"
                        style={{ fontSize: 13, padding: "6px 12px" }}
                      >
                        👁️ View
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Most Engaged Documents */}
        <div
          style={{
            padding: 32,
            marginBottom: 24,
            background: "white",
            borderRadius: 16,
            border: "1px solid #E5E7EB",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
          }}
        >
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, color: "#111827" }}>
            💬 Most Engaged Documents
          </h2>
          {mostEngaged.length === 0 ? (
            <p style={{ color: "#6B7280" }}>No engagement data yet</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {mostEngaged.map((doc) => (
                <div
                  key={doc.doc_id}
                  style={{
                    padding: 16,
                    border: "1px solid #E5E7EB",
                    borderRadius: 12,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "#FAFAFA",
                    flexWrap: "wrap",
                    gap: 16,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <Link
                      href={`/library/${doc.doc_id}`}
                      style={{ fontWeight: 600, fontSize: 16, color: "#111827", textDecoration: "none" }}
                    >
                      {doc.title}
                    </Link>
                    <div style={{ fontSize: 13, color: "#6B7280", marginTop: 4, fontFamily: "monospace" }}>
                      {doc.doc_id}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                    <div
                      style={{
                        padding: "8px 16px",
                        background: "linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)",
                        color: "white",
                        borderRadius: 8,
                        fontSize: 14,
                        fontWeight: 700,
                      }}
                    >
                      {doc.total} feedback entries
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Link
                        href={`/library/${doc.doc_id}/edit`}
                        className="btn"
                        style={{ fontSize: 13, padding: "6px 12px" }}
                      >
                        ✏️ Edit
                      </Link>
                      <Link
                        href={`/library/${doc.doc_id}`}
                        className="btn"
                        style={{ fontSize: 13, padding: "6px 12px" }}
                      >
                        👁️ View
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* All Documents - Full Management */}
        <div
          style={{
            padding: 32,
            background: "white",
            borderRadius: 16,
            border: "1px solid #E5E7EB",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>
              📚 All Documents ({totalDocs})
            </h2>
            <Link
              href="/library/new"
              className="btn btn-primary"
              style={{ fontSize: 14, padding: "8px 16px" }}
            >
              ➕ New Document
            </Link>
          </div>
          {docStats.length === 0 ? (
            <p style={{ color: "#6B7280" }}>No documents yet. Create your first document!</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {docStats
                .sort((a, b) => a.title.localeCompare(b.title))
                .map((doc) => (
                <div
                  key={doc.doc_id}
                  style={{
                    padding: "12px 16px",
                    border: "1px solid #E5E7EB",
                    borderRadius: 8,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "#FAFAFA",
                    flexWrap: "wrap",
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: "#111827" }}>
                      {doc.title}
                    </div>
                    <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
                      <span style={{ fontFamily: "monospace" }}>{doc.doc_id}</span>
                      {doc.doc_type && (
                        <span style={{ marginLeft: 8, padding: "2px 6px", background: "#E5E7EB", borderRadius: 4 }}>
                          {doc.doc_type}
                        </span>
                      )}
                      {doc.file_url && (
                        <span style={{ marginLeft: 8 }}>📎</span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    {doc.total > 0 && (
                      <span style={{ fontSize: 12, color: "#6B7280", marginRight: 8 }}>
                        👍 {doc.helpful} / 👎 {doc.notHelpful}
                      </span>
                    )}
                    <Link
                      href={`/library/${doc.doc_id}/edit`}
                      className="btn"
                      style={{ fontSize: 12, padding: "4px 10px" }}
                    >
                      ✏️ Edit
                    </Link>
                    <Link
                      href={`/library/${doc.doc_id}`}
                      className="btn"
                      style={{ fontSize: 12, padding: "4px 10px" }}
                    >
                      👁️ View
                    </Link>
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