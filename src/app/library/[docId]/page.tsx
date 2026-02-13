import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { notFound, redirect } from "next/navigation";
import DocumentView from "@/components/DocumentView";
import { getUserOrganization } from "@/lib/get-user-organization";

// Create Supabase admin client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function DocumentPage({ 
  params 
}: { 
  params: { docId: string } 
}) {
  const { userId } = await auth();
  
  if (!userId) {
    redirect("/login");
  }

  // Get user's organization membership (handles multiple memberships)
  const membership = await getUserOrganization(userId);

  if (!membership) {
    return <div>No organization found</div>;
  }

  // Fetch document
  const { data: document } = await supabase
    .from("documents")
    .select("*")
    .eq("doc_id", params.docId)
    .eq("organization_id", membership.organization_id)
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
      organizationId={membership.organization_id}
      userRole={membership.role}
    />
  );
}