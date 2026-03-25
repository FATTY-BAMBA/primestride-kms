import { auth } from "@clerk/nextjs/server";
import { logAudit } from "@/lib/audit-log";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getUserOrganization } from "@/lib/get-user-organization";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { doc_id, access_level } = await request.json();

    if (!doc_id || !access_level) {
      return NextResponse.json({ error: "doc_id and access_level required" }, { status: 400 });
    }

    if (!["all_members", "admin_only"].includes(access_level)) {
      return NextResponse.json({ error: "Invalid access_level" }, { status: 400 });
    }

    const membership = await getUserOrganization(userId);
    if (!membership) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Only owners and admins can change access level
    if (!["owner", "admin"].includes(membership.role || "")) {
      return NextResponse.json({ error: "Only admins can change document access" }, { status: 403 });
    }

    // Update access level
    const { error } = await supabase
      .from("documents")
      .update({ access_level })
      .eq("doc_id", doc_id)
      .eq("organization_id", membership.organization_id);

    if (error) {
      console.error("Error updating access level:", error);
      return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    }

    logAudit({
      organizationId: membership.organization_id,
      userId,
      action: "document.access_changed",
      targetType: "document",
      targetId: doc_id,
      details: `Access level changed to ${access_level}`,
    }).catch(() => {});

    return NextResponse.json({ success: true, doc_id, access_level });
  } catch (error) {
    console.error("Error in document access route:", error);
    return NextResponse.json({ error: "Failed to update access level" }, { status: 500 });
  }
}