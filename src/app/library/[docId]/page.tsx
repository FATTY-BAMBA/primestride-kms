import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import DocumentView from "@/components/DocumentView";

export default async function DocumentPage({ 
  params 
}: { 
  params: { docId: string } 
}) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <div>Please log in</div>;

  const { data: profile } = await supabase
    .from("users")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (!profile) return <div>Profile not found</div>;

  // Fetch document
  const { data: document } = await supabase
    .from("documents")
    .select("*")
    .eq("doc_id", params.docId)
    .eq("organization_id", profile.organization_id)
    .single();

  if (!document) notFound();

  // Fetch feedback stats
  const { data: feedbackStats } = await supabase
    .from("feedback")
    .select("is_helpful")
    .eq("doc_id", params.docId);

  const helpfulCount = feedbackStats?.filter(f => f.is_helpful).length || 0;
  const notHelpfulCount = feedbackStats?.filter(f => !f.is_helpful).length || 0;

  // Pass ALL data to client component
  return (
    <DocumentView
      document={document}
      helpfulCount={helpfulCount}
      notHelpfulCount={notHelpfulCount}
      organizationId={profile.organization_id}
    />
  );
}