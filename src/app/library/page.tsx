import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import DocumentFeedback from "@/components/DocumentFeedback";

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

  if (!profile?.organization_id) {
    return <div>No organization found.</div>;
  }

  // Fetch the document
  const { data: document, error } = await supabase
    .from("documents")
    .select("*")
    .eq("doc_id", docId)
    .eq("organization_id", profile.organization_id)
    .single();

  if (error || !document) {
    notFound();
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

      {/* Feedback Section - Client Component */}
      <DocumentFeedback
        docId={docId}
        helpfulCount={helpfulCount}
        notHelpfulCount={notHelpfulCount}
      />
    </div>
  );
}