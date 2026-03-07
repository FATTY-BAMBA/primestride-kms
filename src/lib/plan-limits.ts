import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface PlanLimits {
  plan_id: string;
  plan_name: string;
  status: string;
  is_trial: boolean;
  trial_days_remaining: number;
  max_users: number;
  max_documents: number;
  max_ai_scans_monthly: number;
  max_workflow_submissions_monthly: number;
  features: string[];
  usage: {
    ai_scans_used: number;
    workflow_submissions_used: number;
    documents_count: number;
    active_users: number;
  };
}

// Default explorer limits (when no subscription exists)
const EXPLORER_DEFAULTS: PlanLimits = {
  plan_id: "explorer",
  plan_name: "Explorer",
  status: "free",
  is_trial: false,
  trial_days_remaining: 0,
  max_users: 3,
  max_documents: 50,
  max_ai_scans_monthly: 10,
  max_workflow_submissions_monthly: 20,
  features: ["library", "search", "basic_compliance", "workflows"],
  usage: { ai_scans_used: 0, workflow_submissions_used: 0, documents_count: 0, active_users: 0 },
};

export async function getOrgPlanLimits(organizationId: string): Promise<PlanLimits> {
  try {
    const { data: subscription } = await supabase
      .from("organization_subscriptions")
      .select("*, subscription_plans(*)")
      .eq("organization_id", organizationId)
      .single();

    if (!subscription || !subscription.subscription_plans) {
      return EXPLORER_DEFAULTS;
    }

    const plan = subscription.subscription_plans as Record<string, any>;
    let status = subscription.status as string;
    let trialDaysRemaining = 0;

    if (status === "trial" && subscription.trial_end) {
      const trialEnd = new Date(subscription.trial_end as string);
      const now = new Date();
      if (now > trialEnd) {
        status = "expired";
      } else {
        trialDaysRemaining = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      }
    }

    if (status === "expired" || status === "cancelled") {
      return EXPLORER_DEFAULTS;
    }

    const currentMonth = new Date().toISOString().slice(0, 7);
    const { data: usage } = await supabase
      .from("subscription_usage")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("month", currentMonth)
      .single();

    const usageRecord = usage as Record<string, any> | null;

    return {
      plan_id: plan.id,
      plan_name: plan.name,
      status,
      is_trial: status === "trial",
      trial_days_remaining: trialDaysRemaining,
      max_users: plan.max_users,
      max_documents: plan.max_documents,
      max_ai_scans_monthly: plan.max_ai_scans_monthly,
      max_workflow_submissions_monthly: plan.max_workflow_submissions_monthly,
      features: plan.features || [],
      usage: {
        ai_scans_used: usageRecord?.ai_scans_used || 0,
        workflow_submissions_used: usageRecord?.workflow_submissions_used || 0,
        documents_count: usageRecord?.documents_count || 0,
        active_users: usageRecord?.active_users || 0,
      },
    };
  } catch (err) {
    console.error("Error getting plan limits:", err);
    return EXPLORER_DEFAULTS;
  }
}

// Quick check helpers
export async function canUploadDocument(organizationId: string): Promise<{ allowed: boolean; reason?: string }> {
  const limits = await getOrgPlanLimits(organizationId);
  if (limits.usage.documents_count >= limits.max_documents) {
    return { allowed: false, reason: `Document limit reached (${limits.max_documents}). Upgrade to ${limits.plan_id === "explorer" ? "Team" : "Enterprise"} plan.` };
  }
  return { allowed: true };
}

export async function canUseAIScan(organizationId: string): Promise<{ allowed: boolean; reason?: string }> {
  const limits = await getOrgPlanLimits(organizationId);
  if (limits.usage.ai_scans_used >= limits.max_ai_scans_monthly) {
    return { allowed: false, reason: `Monthly AI scan limit reached (${limits.max_ai_scans_monthly}). Resets next month or upgrade plan.` };
  }
  return { allowed: true };
}

export async function canSubmitWorkflow(organizationId: string): Promise<{ allowed: boolean; reason?: string }> {
  const limits = await getOrgPlanLimits(organizationId);
  if (limits.usage.workflow_submissions_used >= limits.max_workflow_submissions_monthly) {
    return { allowed: false, reason: `Monthly workflow submission limit reached (${limits.max_workflow_submissions_monthly}). Resets next month or upgrade plan.` };
  }
  return { allowed: true };
}

export async function hasFeature(organizationId: string, feature: string): Promise<boolean> {
  const limits = await getOrgPlanLimits(organizationId);
  return limits.features.includes(feature);
}

// Increment usage counter
type UsageField = "ai_scans_used" | "workflow_submissions_used" | "documents_count" | "active_users";

export async function incrementUsage(organizationId: string, field: UsageField): Promise<void> {
  const currentMonth = new Date().toISOString().slice(0, 7);

  const { data, error } = await supabase
    .from("subscription_usage")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("month", currentMonth)
    .maybeSingle();

  if (error) {
    console.error("Error checking usage:", error);
    return;
  }

  if (data) {
    const record = data as Record<string, any>;
    const currentVal = Number(record[field] || 0);
    await supabase
      .from("subscription_usage")
      .update({ [field]: currentVal + 1, updated_at: new Date().toISOString() })
      .eq("id", record.id);
  } else {
    await supabase
      .from("subscription_usage")
      .insert({
        organization_id: organizationId,
        month: currentMonth,
        [field]: 1,
      });
  }
}