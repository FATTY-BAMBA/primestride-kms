import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function LibraryPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.organization_id) {
    return (
      <div className="container" style={{ padding: "40px 20px", textAlign: "center" }}>
        <h1>Profile Not Found</h1>
        <p style={{ color: "#6B7280", marginBottom: 20 }}>Unable to load your profile.</p>
      </div>
    );
  }

  const isAdmin = ["owner", "admin"].includes(profile.role || "");

  // Get all documents
  const { data: documents } = await supabase
    .from("documents")
    .select("*")
    .eq("organization_id", profile.organization_id)
    .order("title", { ascending: true });

  // Get feedback counts for each document
  const { data: feedback } = await supabase
    .from("feedback")
    .select("doc_id, is_helpful")
    .eq("organization_id", profile.organization_id);

  // Calculate feedback per document
  const feedbackByDoc: Record<string, { helpful: number; notHelpful: number }> = {};
  feedback?.forEach((f) => {
    if (!feedbackByDoc[f.doc_id]) {
      feedbackByDoc[f.doc_id] = { helpful: 0, notHelpful: 0 };
    }
    if (f.is_helpful) {
      feedbackByDoc[f.doc_id].helpful++;
    } else {
      feedbackByDoc[f.doc_id].notHelpful++;
    }
  });

  return (
    <div style={{ minHeight: "100vh", background: "#F9FAFB" }}>
      <div className="container" style={{ maxWidth: 1200, padding: "40px 20px" }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
            <div>
              <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8, color: "#111827" }}>
                📚 Knowledge Library
              </h1>
              <p style={{ color: "#6B7280", fontSize: 16 }}>
                Browse and learn from your organization's knowledge base
              </p>
            </div>
            {isAdmin && (
              <div style={{ display: "flex", gap: 12 }}>
                <Link
                  href="/library/new"
                  className="btn btn-primary"
                  style={{ padding: "10px 20px", fontSize: 15 }}
                >
                  ➕ New Document
                </Link>
                <Link
                  href="/admin"
                  className="btn"
                  style={{ padding: "10px 20px", fontSize: 15 }}
                >
                  📊 Admin Dashboard
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Documents Grid */}
        {!documents || documents.length === 0 ? (
          <div
            style={{
              padding: 60,
              textAlign: "center",
              background: "white",
              borderRadius: 16,
              border: "1px solid #E5E7EB",
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
            <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8, color: "#111827" }}>
              No documents yet
            </h2>
            <p style={{ color: "#6B7280", marginBottom: 24 }}>
              {isAdmin
                ? "Get started by creating your first document."
                : "No documents have been added to the library yet."}
            </p>
            {isAdmin && (
              <Link href="/library/new" className="btn btn-primary" style={{ padding: "12px 24px" }}>
                ➕ Create First Document
              </Link>
            )}
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: 20,
            }}
          >
            {documents.map((doc) => {
              const docFeedback = feedbackByDoc[doc.doc_id] || { helpful: 0, notHelpful: 0 };
              const totalFeedback = docFeedback.helpful + docFeedback.notHelpful;

              return (
                <div
                  key={doc.doc_id}
                  style={{
                    background: "white",
                    borderRadius: 12,
                    border: "1px solid #E5E7EB",
                    overflow: "hidden",
                    transition: "box-shadow 0.2s, transform 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.1)";
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = "none";
                    e.currentTarget.style.transform = "none";
                  }}
                >
                  {/* Card Header */}
                  <div style={{ padding: "20px 20px 0" }}>
                    {/* Badges */}
                    <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
                      <span
                        style={{
                          padding: "4px 10px",
                          background: "#EEF2FF",
                          color: "#4F46E5",
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          fontFamily: "monospace",
                        }}
                      >
                        {doc.doc_id}
                      </span>
                      {doc.doc_type && (
                        <span
                          style={{
                            padding: "4px 10px",
                            background: "#ECFDF5",
                            color: "#059669",
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 500,
                          }}
                        >
                          {doc.doc_type}
                        </span>
                      )}
                      {doc.file_url && (
                        <span
                          style={{
                            padding: "4px 10px",
                            background: "#FEF3C7",
                            color: "#D97706",
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 500,
                          }}
                        >
                          📎 File
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <Link
                      href={`/library/${doc.doc_id}`}
                      style={{
                        fontSize: 18,
                        fontWeight: 600,
                        color: "#111827",
                        textDecoration: "none",
                        display: "block",
                        marginBottom: 8,
                        lineHeight: 1.3,
                      }}
                    >
                      {doc.title}
                    </Link>

                    {/* Preview */}
                    <p
                      style={{
                        fontSize: 14,
                        color: "#6B7280",
                        lineHeight: 1.5,
                        marginBottom: 16,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {doc.content?.slice(0, 150) || "No content preview available"}
                      {doc.content?.length > 150 ? "..." : ""}
                    </p>
                  </div>

                  {/* Card Footer */}
                  <div
                    style={{
                      padding: "12px 20px",
                      background: "#F9FAFB",
                      borderTop: "1px solid #E5E7EB",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    {/* Feedback Stats */}
                    <div style={{ display: "flex", gap: 12, fontSize: 13, color: "#6B7280" }}>
                      {totalFeedback > 0 ? (
                        <>
                          <span>👍 {docFeedback.helpful}</span>
                          <span>👎 {docFeedback.notHelpful}</span>
                        </>
                      ) : (
                        <span>No feedback yet</span>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: 8 }}>
                      {isAdmin && (
                        <Link
                          href={`/library/${doc.doc_id}/edit`}
                          className="btn"
                          style={{ padding: "6px 12px", fontSize: 12 }}
                        >
                          ✏️ Edit
                        </Link>
                      )}
                      <Link
                        href={`/library/${doc.doc_id}`}
                        className="btn btn-primary"
                        style={{ padding: "6px 12px", fontSize: 12 }}
                      >
                        View →
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}