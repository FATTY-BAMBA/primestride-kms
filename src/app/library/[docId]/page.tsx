import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";

interface PageProps {
  params: {
    docId: string;
  };
}

export default async function DocumentPage({ params }: PageProps) {
  const { docId } = params;
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <div>Please log in to view documents.</div>;
  }

  // Get user's organization
  const { data: profile } = await supabase
    .from("users")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  // Fetch the document
  const { data: document, error } = await supabase
    .from("documents")
    .select("*")
    .eq("doc_id", docId)
    .eq("organization_id", profile?.organization_id)
    .single();

  if (error || !document) {
    notFound();
  }

  // Fetch similar documents
  let similarDocs = [];
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/embeddings/similar?docId=${docId}&limit=3`,
      { cache: "no-store" }
    );
    if (response.ok) {
      const data = await response.json();
      similarDocs = data.similar || [];
    }
  } catch (error) {
    console.error("Failed to fetch similar docs:", error);
  }

  // Fetch feedback stats
  const { data: feedbackStats } = await supabase
    .from("feedback")
    .select("is_helpful")
    .eq("doc_id", docId);

  const helpfulCount = feedbackStats?.filter((f) => f.is_helpful).length || 0;
  const notHelpfulCount = feedbackStats?.filter((f) => !f.is_helpful).length || 0;

  return (
    <div className="container" style={{ maxWidth: 1000, padding: "40px 20px" }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 24 }}>
        <Link
          href="/library"
          style={{
            color: "#6B7280",
            textDecoration: "none",
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          ← Back to Library
        </Link>
      </div>

      {/* Document Header */}
      <div
        className="card"
        style={{
          padding: 32,
          marginBottom: 24,
        }}
      >
        {/* Metadata */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <span
            style={{
              padding: "4px 12px",
              background: "#EEF2FF",
              color: "#4F46E5",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {document.doc_id}
          </span>
          <span
            style={{
              padding: "4px 12px",
              background: "#F3F4F6",
              color: "#374151",
              borderRadius: 6,
              fontSize: 13,
            }}
          >
            {document.current_version}
          </span>
          {document.doc_type && (
            <span
              style={{
                padding: "4px 12px",
                background: "#F3F4F6",
                color: "#374151",
                borderRadius: 6,
                fontSize: 13,
              }}
            >
              {document.doc_type}
            </span>
          )}
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: 32,
            fontWeight: 700,
            marginBottom: 16,
            color: "#111827",
          }}
        >
          {document.title}
        </h1>

        {/* Feedback Stats */}
        <div
          style={{
            display: "flex",
            gap: 16,
            paddingTop: 16,
            borderTop: "1px solid #E5E7EB",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 20 }}>👍</span>
            <span style={{ fontSize: 14, color: "#6B7280" }}>
              {helpfulCount} helpful
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 20 }}>👎</span>
            <span style={{ fontSize: 14, color: "#6B7280" }}>
              {notHelpfulCount} not helpful
            </span>
          </div>
        </div>
      </div>

      {/* Document Content */}
      <div className="card" style={{ padding: 32, marginBottom: 24 }}>
        <div
          style={{
            fontSize: 16,
            lineHeight: 1.8,
            color: "#374151",
            whiteSpace: "pre-wrap",
          }}
        >
          {document.content || "No content available for this document."}
        </div>
      </div>

      {/* Feedback Section */}
      <div className="card" style={{ padding: 24, marginBottom: 24 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
          Was this document helpful?
        </h3>
        <div style={{ display: "flex", gap: 12 }}>
          <button
            className="btn"
            style={{
              padding: "10px 20px",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
            onClick={() => {
              // We'll add this functionality next
              alert("Feedback feature coming soon!");
            }}
          >
            👍 Helpful
          </button>
          <button
            className="btn"
            style={{
              padding: "10px 20px",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
            onClick={() => {
              alert("Feedback feature coming soon!");
            }}
          >
            👎 Not Helpful
          </button>
        </div>
      </div>

      {/* Similar Documents */}
      {similarDocs.length > 0 && (
        <div className="card" style={{ padding: 32 }}>
          <h3
            style={{
              fontSize: 18,
              fontWeight: 700,
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            🔗 Related Documents
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {similarDocs.map((doc: any) => (
              <Link
                key={doc.docId}
                href={`/library/${doc.docId}`}
                style={{
                  padding: 16,
                  border: "1px solid #E5E7EB",
                  borderRadius: 8,
                  textDecoration: "none",
                  color: "inherit",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#4F46E5";
                  e.currentTarget.style.background = "#F9FAFB";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#E5E7EB";
                  e.currentTarget.style.background = "white";
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>
                      {doc.title}
                    </div>
                    <div style={{ fontSize: 13, color: "#6B7280" }}>
                      {doc.docId}
                    </div>
                  </div>
                  <div
                    style={{
                      padding: "4px 12px",
                      background: "#EEF2FF",
                      color: "#4F46E5",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {Math.round(doc.similarity * 100)}% match
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}