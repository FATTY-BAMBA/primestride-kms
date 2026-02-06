// /src/lib/get-user-organization.ts
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface UserOrganization {
  organization_id: string;
  role: string;
}

/**
 * Get user's active organization membership.
 * If user has multiple memberships, returns the one with documents (or first one).
 * This handles the case where a user belongs to multiple organizations.
 */
export async function getUserOrganization(userId: string): Promise<UserOrganization | null> {
  // Get all active memberships for this user
  const { data: memberships, error } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (error) {
    console.error("Error fetching memberships:", error);
    return null;
  }

  if (!memberships || memberships.length === 0) {
    return null;
  }

  // If only one membership, return it
  if (memberships.length === 1) {
    return memberships[0];
  }

  // Multiple memberships: find the one with documents
  for (const membership of memberships) {
    const { count } = await supabase
      .from("documents")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", membership.organization_id);

    if (count && count > 0) {
      return membership;
    }
  }

  // If no org has docs, return the first one
  return memberships[0];
}

/**
 * Get ALL organizations a user belongs to.
 * Useful for organization switcher UI.
 */
export async function getUserOrganizations(userId: string) {
  const { data: memberships, error } = await supabase
    .from("organization_members")
    .select(`
      organization_id,
      role,
      joined_at,
      organizations (
        id,
        name
      )
    `)
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("joined_at", { ascending: false });

  if (error) {
    console.error("Error fetching user organizations:", error);
    return [];
  }

  return memberships || [];
}