import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import CreateDocumentForm from "@/components/CreateDocumentForm";

// Create Supabase admin client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function NewDocumentPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/login");
  }

  // Get user's organization membership (handles multiple memberships)
  const { data: memberships } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", userId)
    .eq("is_active", true);

  const membership = memberships?.[0] || null;

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return (
      <div className="container" style={{ padding: "40px 20px" }}>
        <h1>Access Denied</h1>
        <p>Only administrators can create documents.</p>
      </div>
    );
  }

  return <CreateDocumentForm />;
}