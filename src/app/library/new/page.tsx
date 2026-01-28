import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CreateDocumentForm from "@/components/CreateDocumentForm";

export default async function NewDocumentPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["owner", "admin"].includes(profile.role)) {
    return (
      <div className="container" style={{ padding: "40px 20px" }}>
        <h1>Access Denied</h1>
        <p>Only administrators can create documents.</p>
      </div>
    );
  }

  return <CreateDocumentForm />;
}