import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/onboarding
// Called after org creation to store company metadata
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { organization_id, company_name, company_size, industry, admin_role } = body;

    if (!organization_id || !company_name) {
      return NextResponse.json({ error: "organization_id and company_name required" }, { status: 400 });
    }

    // Store company metadata
    await supabase
      .from("organization_metadata")
      .upsert({
        organization_id,
        company_name,
        company_size: company_size || null,
        industry: industry || null,
        admin_role: admin_role || null,
        onboarded_by: userId,
        onboarded_at: new Date().toISOString(),
      }, {
        onConflict: "organization_id",
      });

    // Auto-create a default leave balance for the owner
    const currentYear = new Date().getFullYear();
    const { data: existingBalance } = await supabase
      .from("leave_balances")
      .select("id")
      .eq("user_id", userId)
      .eq("organization_id", organization_id)
      .eq("year", currentYear)
      .single();

    if (!existingBalance) {
      await supabase.from("leave_balances").insert({
        user_id: userId,
        organization_id,
        year: currentYear,
        annual_total: 7,
        annual_used: 0,
        sick_total: 30,
        sick_used: 0,
        personal_total: 14,
        personal_used: 0,
        family_care_total: 7,
        family_care_used: 0,
        family_care_hours_total: 56,
        family_care_hours_used: 0,
        maternity_total: 0,
        maternity_used: 0,
        paternity_total: 0,
        paternity_used: 0,
        marriage_total: 0,
        marriage_used: 0,
        bereavement_total: 0,
        bereavement_used: 0,
        comp_time_total: 0,
        comp_time_used: 0,
      });
    }

    // Auto-create explorer subscription (free tier)
    const { data: existingSub } = await supabase
      .from("organization_subscriptions")
      .select("id")
      .eq("organization_id", organization_id)
      .single();

    if (!existingSub) {
      await supabase.from("organization_subscriptions").insert({
        organization_id,
        plan_id: "explorer",
        status: "active",
        current_period_start: new Date().toISOString(),
        payment_method: "free",
        activated_by: userId,
        notes: "Auto-created on onboarding",
      });
    }

    return NextResponse.json({ success: true, message: "Onboarding complete" });
  } catch (err: any) {
    console.error("Onboarding error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}