import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface ApiKeyAuth {
  organization_id: string;
  key_id: string;
  scopes: string[];
}

export async function authenticateApiKey(request: Request): Promise<ApiKeyAuth | null> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer psa_")) return null;

  const apiKey = authHeader.replace("Bearer ", "");
  const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");

  const { data: key } = await supabase
    .from("api_keys")
    .select("id, organization_id, scopes, is_active")
    .eq("key_hash", keyHash)
    .eq("is_active", true)
    .single();

  if (!key) return null;

  // Update last used
  await supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", key.id);

  return {
    organization_id: key.organization_id,
    key_id: key.id,
    scopes: key.scopes || [],
  };
}
