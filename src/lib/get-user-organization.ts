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
 * 
 * Resolution order:
 * 1. Check active_organization_id stored in profiles table (set by org switcher)
 * 2. If user has only one membership, return it
 * 3. If multiple memberships and no preference, return the one with documents
 * 4. Fallback to first membership
 * 
 * This ensures users always land in the correct org with the correct role,
 * even when they belong to multiple organizations.
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

  // If only one membership, always return it
  if (memberships.length === 1) {
    return memberships[0];
  }

  // ── Multiple memberships: check user's saved preference ──

  // 1. Check active_organization_id in profiles table
  const { data: profile } = await supabase
    .from("profiles")
    .select("active_organization_id")
    .eq("id", userId)
    .single();

  if (profile?.active_organization_id) {
    const preferred = memberships.find(
      (m) => m.organization_id === profile.active_organization_id
    );
    if (preferred) {
      return preferred;
    }
    // Preference points to an org they're no longer in — fall through
  }

  // 2. Fallback: find the org with documents
  for (const membership of memberships) {
    const { count } = await supabase
      .from("documents")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", membership.organization_id);

    if (count && count > 0) {
      return membership;
    }
  }

  // 3. Last resort: return the first one
  return memberships[0];
}

/**
 * Get ALL organizations a user belongs to.
 * Used by the organization switcher UI.
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
