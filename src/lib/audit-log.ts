import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function logAudit({
  organizationId,
  userId,
  userName,
  action,
  targetType,
  targetId,
  targetTitle,
  details,
  ipAddress,
}: {
  organizationId: string;
  userId: string;
  userName?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  targetTitle?: string;
  details?: string;
  ipAddress?: string;
}) {
  try {
    await supabase.from("audit_logs").insert({
      organization_id: organizationId,
      user_id: userId,
      user_name: userName || null,
      action,
      target_type: targetType || null,
      target_id: targetId || null,
      target_title: targetTitle || null,
      details: details || null,
      ip_address: ipAddress || null,
    });
  } catch (err) {
    console.error("Audit log error:", err);
  }
}
