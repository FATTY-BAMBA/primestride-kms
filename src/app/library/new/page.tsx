import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import CreateDocumentForm from "@/components/CreateDocumentForm";
import { getUserOrganization } from "@/lib/get-user-organization";

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
  const membership = await getUserOrganization(userId);

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