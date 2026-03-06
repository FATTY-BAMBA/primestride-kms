import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getUserOrganization } from "@/lib/get-user-organization";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ══════════════════════════════════════════════════════════════
// GET /api/subscription
// Returns current org's subscription status and plan details
// ══════════════════════════════════════════════════════════════
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const membership = await getUserOrganization(userId);
    if (!membership) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    // Get subscription
    const { data: subscription } = await supabase
      .from("organization_subscriptions")
      .select("*, subscription_plans(*)")
      .eq("organization_id", membership.organization_id)
      .single();

    // If no subscription, return explorer (free) defaults
    if (!subscription) {
      const { data: explorerPlan } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("id", "explorer")
        .single();

      return NextResponse.json({
        subscription: null,
        plan: explorerPlan || { id: "explorer", name: "Explorer", max_users: 3, max_documents: 50 },
        status: "free",
        is_trial: false,
        trial_days_remaining: 0,
        usage: null,
      });
    }

    // Check if trial expired
    let status = subscription.status;
    let trialDaysRemaining = 0;

    if (subscription.status === "trial" && subscription.trial_end) {
      const trialEnd = new Date(subscription.trial_end);
      const now = new Date();
      if (now > trialEnd) {
        // Trial expired — downgrade to explorer
        status = "expired";
        await supabase
          .from("organization_subscriptions")
          .update({ status: "expired", updated_at: new Date().toISOString() })
          .eq("id", subscription.id);
      } else {
        trialDaysRemaining = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      }
    }

    // Get current month usage
    const currentMonth = new Date().toISOString().slice(0, 7);
    const { data: usage } = await supabase
      .from("subscription_usage")
      .select("*")
      .eq("organization_id", membership.organization_id)
      .eq("month", currentMonth)
      .single();

    return NextResponse.json({
      subscription: {
        id: subscription.id,
        plan_id: subscription.plan_id,
        status,
        trial_start: subscription.trial_start,
        trial_end: subscription.trial_end,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        payment_method: subscription.payment_method,
        tax_id: subscription.tax_id,
        company_title: subscription.company_title,
      },
      plan: subscription.subscription_plans,
      status,
      is_trial: status === "trial",
      trial_days_remaining: trialDaysRemaining,
      usage: usage || { ai_scans_used: 0, workflow_submissions_used: 0, documents_count: 0, active_users: 0 },
    });
  } catch (err: any) {
    console.error("Subscription GET error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ══════════════════════════════════════════════════════════════
// POST /api/subscription
// Admin-only: Activate a subscription for an organization
// Used to manually set up pilot companies
// ══════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const membership = await getUserOrganization(userId);
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const {
      organization_id,        // target org (admin can set for any org if owner)
      plan_id,                // 'explorer', 'team', 'pilot', 'enterprise'
      trial_days,             // number of trial days (e.g., 90 for pilot)
      tax_id,                 // 統一編號
      company_title,          // 公司抬頭
      billing_email,
      billing_contact,
      notes,
    } = body;

    const targetOrgId = organization_id || membership.organization_id;

    // Verify plan exists
    const { data: plan } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("id", plan_id)
      .single();

    if (!plan) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    // Calculate trial period
    const now = new Date();
    const trialEnd = trial_days
      ? new Date(now.getTime() + trial_days * 24 * 60 * 60 * 1000)
      : null;

    // Upsert subscription
    const { data: subscription, error } = await supabase
      .from("organization_subscriptions")
      .upsert({
        organization_id: targetOrgId,
        plan_id,
        status: trial_days ? "trial" : "active",
        trial_start: trial_days ? now.toISOString() : null,
        trial_end: trialEnd ? trialEnd.toISOString() : null,
        current_period_start: now.toISOString(),
        current_period_end: trialEnd ? trialEnd.toISOString() : null,
        payment_method: "manual",
        tax_id: tax_id || null,
        company_title: company_title || null,
        billing_email: billing_email || null,
        billing_contact: billing_contact || null,
        notes: notes || null,
        activated_by: userId,
        updated_at: now.toISOString(),
      }, {
        onConflict: "organization_id",
      })
      .select("*, subscription_plans(*)")
      .single();

    if (error) {
      console.error("Subscription upsert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      subscription,
      message: trial_days
        ? `Pilot trial activated: ${plan.name} for ${trial_days} days`
        : `Subscription activated: ${plan.name}`,
    });
  } catch (err: any) {
    console.error("Subscription POST error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ══════════════════════════════════════════════════════════════
// PATCH /api/subscription
// Admin-only: Update subscription (cancel, change plan, update billing)
// ══════════════════════════════════════════════════════════════
export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const membership = await getUserOrganization(userId);
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const { action, organization_id, cancel_reason, plan_id, tax_id, company_title, billing_email } = body;
    const targetOrgId = organization_id || membership.organization_id;

    if (action === "cancel") {
      const { error } = await supabase
        .from("organization_subscriptions")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          cancel_reason: cancel_reason || null,
          updated_at: new Date().toISOString(),
        })
        .eq("organization_id", targetOrgId);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, message: "Subscription cancelled" });
    }

    if (action === "update_billing") {
      const updates: Record<string, any> = { updated_at: new Date().toISOString() };
      if (tax_id !== undefined) updates.tax_id = tax_id;
      if (company_title !== undefined) updates.company_title = company_title;
      if (billing_email !== undefined) updates.billing_email = billing_email;

      const { error } = await supabase
        .from("organization_subscriptions")
        .update(updates)
        .eq("organization_id", targetOrgId);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, message: "Billing info updated" });
    }

    if (action === "change_plan" && plan_id) {
      const { data: plan } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("id", plan_id)
        .single();

      if (!plan) return NextResponse.json({ error: "Invalid plan" }, { status: 400 });

      const { error } = await supabase
        .from("organization_subscriptions")
        .update({
          plan_id,
          status: "active",
          updated_at: new Date().toISOString(),
        })
        .eq("organization_id", targetOrgId);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, message: `Plan changed to ${plan.name}` });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    console.error("Subscription PATCH error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}