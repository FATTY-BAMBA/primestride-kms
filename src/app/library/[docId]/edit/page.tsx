import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import EditDocumentForm from "@/components/EditDocumentForm";

export default async function EditDocumentPage({
  params,
}: {
  params: { docId: string };
}) {
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

  if (!profile) {
    return <div>Profile not found</div>;
  }

  // Only admins can edit
  if (!["owner", "admin"].includes(profile.role)) {
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
    .eq("organization_id", profile.organization_id)
    .single();

  if (!document) {
    notFound();
  }

  return <EditDocumentForm document={document} />;
}