import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { notFound, redirect } from "next/navigation";
import EditDocumentForm from "@/components/EditDocumentForm";

// Create Supabase admin client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function EditDocumentPage({
  params,
}: {
  params: { docId: string };
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/login");
  }

  // Get user's organization membership
  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", userId)
    .eq("is_active", true)
    .single();

  if (!membership) {
    return <div>No organization found</div>;
  }

  // Only admins can edit
  if (!["owner", "admin"].includes(membership.role)) {
    return (
      <div className="container" style={{ padding: "40px 20px" }}>
        <h1>Access Denied</h1>
        <p>Only administrators can edit documents.</p>
      </div>
    );
  }

  const { data: document } = await supabase
    .from("documents")
    .select("*")
    .eq("doc_id", params.docId)
    .eq("organization_id", membership.organization_id)
    .single();

  if (!document) {
    notFound();
  }

  return <EditDocumentForm document={document} />;
}