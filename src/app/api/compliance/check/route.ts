import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ══════════════════════════════════════════════════════════════
// POST /api/compliance/check
// Validates a workflow submission against Taiwan labor law
// Called BEFORE submission is saved (pre-submit check)
// or AFTER submission for admin review
// ══════════════════════════════════════════════════════════════

interface ComplianceResult {
  status: "pass" | "warning" | "blocked";
  checks: {
    check_type: string;
    status: "pass" | "warning" | "blocked";
    rule_reference: string;
    message: string;
    message_zh: string;
    details: Record<string, any>;
  }[];
  ai_analysis?: string;
  ai_analysis_zh?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { form_type, form_data, user_id, organization_id } = body;

    if (!form_type || !form_data || !user_id || !organization_id) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const result: ComplianceResult = { status: "pass", checks: [] };

    // ── Run rule-based checks first (fast, deterministic) ──
    if (form_type === "leave") {
      await checkLeaveCompliance(result, form_data, user_id, organization_id);
    } else if (form_type === "overtime") {
      await checkOvertimeCompliance(result, form_data, user_id, organization_id);
    } else if (form_type === "business_trip") {
      // Business trips: lighter checks
      result.checks.push({
        check_type: "trip_basic",
        status: "pass",
        rule_reference: "Company Policy",
        message: "Business trip request within normal parameters.",
        message_zh: "出差申請符合一般規範。",
        details: {},
      });
    }

    // ── Run AI-powered compliance analysis (RAG) ──
    const aiAnalysis = await runAIComplianceCheck(form_type, form_data, organization_id);
    if (aiAnalysis) {
      result.ai_analysis = aiAnalysis.en;
      result.ai_analysis_zh = aiAnalysis.zh;

      // If AI found issues, add them
      if (aiAnalysis.issues && aiAnalysis.issues.length > 0) {
        for (const issue of aiAnalysis.issues) {
          result.checks.push({
            check_type: "ai_compliance",
            status: issue.severity === "blocked" ? "blocked" : "warning",
            rule_reference: issue.rule || "AI Analysis",
            message: issue.message_en,
            message_zh: issue.message_zh,
            details: { ai_detected: true },
          });
        }
      }
    }

    // ── Determine overall status ──
    if (result.checks.some((c) => c.status === "blocked")) {
      result.status = "blocked";
    } else if (result.checks.some((c) => c.status === "warning")) {
      result.status = "warning";
    }

    // ── Log the compliance check ──
    for (const check of result.checks) {
      await supabase.from("compliance_checks").insert({
        organization_id,
        user_id,
        check_type: check.check_type,
        status: check.status,
        rule_reference: check.rule_reference,
        message: check.message,
        message_zh: check.message_zh,
        details: check.details,
      });
    }

    return NextResponse.json({ data: result });
  } catch (err: any) {
    console.error("Compliance check error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ══════════════════════════════════════════════════════════════
// LEAVE COMPLIANCE CHECKS
// ══════════════════════════════════════════════════════════════
async function checkLeaveCompliance(
  result: ComplianceResult,
  form_data: Record<string, any>,
  user_id: string,
  org_id: string
) {
  const { leave_type, days, start_date, end_date } = form_data;
  const numDays = parseFloat(days) || 0;

  // 1. Check leave balance
  const { data: balance } = await supabase
    .from("leave_balances")
    .select("*")
    .eq("user_id", user_id)
    .eq("organization_id", org_id)
    .eq("year", new Date().getFullYear())
    .single();

  if (balance) {
    let available = 0;
    let totalDays = 0;
    let usedDays = 0;
    let balanceField = "";

    // Map leave type to balance field
    const leaveTypeKey = (leave_type || "").toLowerCase();
    if (leaveTypeKey.includes("特休") || leaveTypeKey.includes("annual")) {
      totalDays = balance.annual_total || 7;
      usedDays = balance.annual_used || 0;
      balanceField = "annual";
    } else if (leaveTypeKey.includes("病假") || leaveTypeKey.includes("sick")) {
      totalDays = balance.sick_total || 30;
      usedDays = balance.sick_used || 0;
      balanceField = "sick";
    } else if (leaveTypeKey.includes("事假") || leaveTypeKey.includes("personal")) {
      totalDays = balance.personal_total || 14;
      usedDays = balance.personal_used || 0;
      balanceField = "personal";
    } else if (leaveTypeKey.includes("家庭") || leaveTypeKey.includes("family")) {
      totalDays = balance.family_care_total || 7;
      usedDays = balance.family_care_used || 0;
      balanceField = "family_care";
    } else if (leaveTypeKey.includes("婚假") || leaveTypeKey.includes("marriage")) {
      totalDays = balance.marriage_total || 8;
      usedDays = balance.marriage_used || 0;
      balanceField = "marriage";
    } else if (leaveTypeKey.includes("產假") || leaveTypeKey.includes("maternity")) {
      totalDays = balance.maternity_total || 56;
      usedDays = balance.maternity_used || 0;
      balanceField = "maternity";
    } else if (leaveTypeKey.includes("陪產") || leaveTypeKey.includes("paternity")) {
      totalDays = balance.paternity_total || 7;
      usedDays = balance.paternity_used || 0;
      balanceField = "paternity";
    } else if (leaveTypeKey.includes("喪假") || leaveTypeKey.includes("bereavement")) {
      totalDays = balance.bereavement_total || 8;
      usedDays = balance.bereavement_used || 0;
      balanceField = "bereavement";
    }

    available = totalDays - usedDays;

    if (numDays > available) {
      result.checks.push({
        check_type: "leave_balance",
        status: "blocked",
        rule_reference: "LSA Art. 38 / Leave Balance",
        message: `Insufficient ${balanceField} leave balance. Requested: ${numDays} days, Available: ${available} days (${usedDays}/${totalDays} used).`,
        message_zh: `${balanceField === "annual" ? "特休" : balanceField === "sick" ? "病假" : balanceField === "personal" ? "事假" : balanceField === "family_care" ? "家庭照顧假" : leave_type}餘額不足。申請 ${numDays} 天，剩餘 ${available} 天（已使用 ${usedDays}/${totalDays}）。`,
        details: { requested: numDays, available, total: totalDays, used: usedDays, leave_type: balanceField },
      });
    } else {
      result.checks.push({
        check_type: "leave_balance",
        status: "pass",
        rule_reference: "Leave Balance Check",
        message: `Leave balance sufficient. Requesting ${numDays} of ${available} available days.`,
        message_zh: `假期餘額充足。申請 ${numDays} 天，剩餘 ${available} 天。`,
        details: { requested: numDays, available, total: totalDays, used: usedDays },
      });
    }

    // 2. Sick leave > 3 days: medical certificate warning
    if (balanceField === "sick" && numDays > 3) {
      result.checks.push({
        check_type: "sick_leave_certificate",
        status: "warning",
        rule_reference: "Labor Leave Rules Art. 4",
        message: "Sick leave exceeding 3 consecutive days requires a medical certificate.",
        message_zh: "連續請病假超過3天須檢附醫師證明。",
        details: { days_requested: numDays, certificate_required: true },
      });
    }

    // 3. Full Attendance Bonus protection check
    const protectedTypes = ["family_care", "marriage", "bereavement"];
    if (protectedTypes.includes(balanceField)) {
      result.checks.push({
        check_type: "attendance_bonus_protection",
        status: "pass",
        rule_reference: "MOL 2025 Amendment - Full Attendance Bonus",
        message: `${leave_type} is protected: Full Attendance Bonus cannot be deducted for this leave type.`,
        message_zh: `${leave_type}受保護：此假別不得扣發全勤獎金。`,
        details: { protected: true, leave_type: balanceField },
      });
    }
  }
}

// ══════════════════════════════════════════════════════════════
// OVERTIME COMPLIANCE CHECKS
// ══════════════════════════════════════════════════════════════
async function checkOvertimeCompliance(
  result: ComplianceResult,
  form_data: Record<string, any>,
  user_id: string,
  org_id: string
) {
  const { date, start_time, end_time, hours } = form_data;
  const numHours = parseFloat(hours) || 0;

  // 1. Daily hours limit (max 4 hours overtime = 12 total)
  if (numHours > 4) {
    result.checks.push({
      check_type: "daily_overtime_limit",
      status: "blocked",
      rule_reference: "LSA Art. 32 - Daily Overtime Limit",
      message: `Overtime exceeds 4-hour daily limit. Requested: ${numHours} hours. Total work day would exceed the 12-hour maximum.`,
      message_zh: `加班時數超過每日上限4小時。申請 ${numHours} 小時，工作日總時數將超過12小時上限。`,
      details: { requested_hours: numHours, max_daily_overtime: 4, max_daily_total: 12 },
    });
  } else {
    result.checks.push({
      check_type: "daily_overtime_limit",
      status: "pass",
      rule_reference: "LSA Art. 32",
      message: `Daily overtime within limit (${numHours}/4 hours).`,
      message_zh: `每日加班時數符合規定（${numHours}/4 小時）。`,
      details: { requested_hours: numHours, max_daily_overtime: 4 },
    });
  }

  // 2. Monthly overtime cap check
  if (date) {
    const monthStart = date.substring(0, 7) + "-01";
    const monthEnd = date.substring(0, 7) + "-31";

    // Get all approved overtime this month
    const { data: monthOT } = await supabase
      .from("workflow_submissions")
      .select("form_data")
      .eq("organization_id", org_id)
      .eq("user_id", user_id)
      .eq("form_type", "overtime")
      .in("status", ["approved", "pending"])
      .gte("created_at", monthStart)
      .lte("created_at", monthEnd);

    const totalMonthHours = (monthOT || []).reduce((sum: number, s: any) => {
      return sum + (parseFloat(s.form_data?.hours) || 0);
    }, 0);

    const projectedTotal = totalMonthHours + numHours;

    if (projectedTotal > 46) {
      result.checks.push({
        check_type: "monthly_overtime_cap",
        status: projectedTotal > 54 ? "blocked" : "warning",
        rule_reference: "LSA Art. 32 - Monthly Overtime Cap",
        message: `Monthly overtime will reach ${projectedTotal} hours (existing: ${totalMonthHours}h + new: ${numHours}h). Standard limit: 46h/month. Extended limit (with consent): 54h/month.`,
        message_zh: `本月加班將達 ${projectedTotal} 小時（已有 ${totalMonthHours}h + 新增 ${numHours}h）。標準上限：46小時/月。經同意延長上限：54小時/月。`,
        details: { existing_hours: totalMonthHours, requested: numHours, projected: projectedTotal, limit_standard: 46, limit_extended: 54 },
      });
    } else {
      result.checks.push({
        check_type: "monthly_overtime_cap",
        status: "pass",
        rule_reference: "LSA Art. 32",
        message: `Monthly overtime within limit. Projected: ${projectedTotal}/46 hours.`,
        message_zh: `本月加班時數符合規定。預計：${projectedTotal}/46 小時。`,
        details: { existing_hours: totalMonthHours, requested: numHours, projected: projectedTotal },
      });
    }
  }

  // 3. Check if overtime is on a national holiday
  if (date) {
    const { data: holidays } = await supabase
      .from("compliance_knowledge")
      .select("metadata")
      .eq("article_number", "LSA Art. 37")
      .eq("is_active", true)
      .limit(1);

    if (holidays && holidays[0]?.metadata?.holidays_2026) {
      const holidayList: string[] = holidays[0].metadata.holidays_2026;
      if (holidayList.includes(date)) {
        result.checks.push({
          check_type: "holiday_overtime",
          status: "warning",
          rule_reference: "LSA Art. 39 - Holiday Overtime",
          message: `${date} is a national holiday. Overtime requires employee consent and must be paid at double rate (200%).`,
          message_zh: `${date} 為國定假日。加班需經勞工同意，且須加倍發給工資（200%）。`,
          details: { date, is_holiday: true, required_rate: 2.0 },
        });
      }
    }
  }
}

// ══════════════════════════════════════════════════════════════
// AI-POWERED COMPLIANCE ANALYSIS (RAG)
// Queries the compliance_knowledge table for relevant rules
// and asks GPT-4o to analyze the request
// ══════════════════════════════════════════════════════════════
async function runAIComplianceCheck(
  form_type: string,
  form_data: Record<string, any>,
  org_id: string
): Promise<{ en: string; zh: string; issues: { severity: string; rule: string; message_en: string; message_zh: string }[] } | null> {
  try {
    // 1. Get relevant compliance rules
    const category = form_type === "leave" ? "leave" : form_type === "overtime" ? "overtime" : "general";
    const { data: rules } = await supabase
      .from("compliance_knowledge")
      .select("title, content, content_zh, article_number, metadata")
      .eq("is_active", true)
      .or(`category.eq.${category},category.eq.general,category.eq.salary`)
      .limit(10);

    if (!rules || rules.length === 0) return null;

    const rulesContext = rules
      .map((r) => `[${r.article_number || "Policy"}] ${r.title}\n${r.content}\nMetadata: ${JSON.stringify(r.metadata)}`)
      .join("\n\n");

    // 2. Ask GPT-4o to analyze
    const today = new Date().toISOString().split("T")[0];
    const dayOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date().getDay()];

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: `You are a Taiwan Labor Law compliance AI assistant. Today is ${today} (${dayOfWeek}).

You analyze employee workflow requests against Taiwan's Labor Standards Act (LSA) and related regulations.

RULES CONTEXT:
${rulesContext}

Analyze the following ${form_type} request and check for any compliance issues.

Respond in JSON ONLY:
{
  "summary_en": "Brief compliance summary in English",
  "summary_zh": "Brief compliance summary in Traditional Chinese",
  "issues": [
    {
      "severity": "warning" or "blocked",
      "rule": "Article reference",
      "message_en": "Issue description in English",
      "message_zh": "Issue description in Traditional Chinese"
    }
  ]
}

If no issues found, return empty issues array.
CRITICAL: Only flag real legal compliance issues. Do not flag normal valid requests.`,
        },
        {
          role: "user",
          content: `Analyze this ${form_type} request:\n${JSON.stringify(form_data, null, 2)}`,
        },
      ],
    });

    const text = response.choices[0]?.message?.content || "";
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    return {
      en: parsed.summary_en || "",
      zh: parsed.summary_zh || "",
      issues: parsed.issues || [],
    };
  } catch (err) {
    console.error("AI compliance check error:", err);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════
// GET /api/compliance/check
// Retrieve compliance check history for a submission or user
// ══════════════════════════════════════════════════════════════
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const submission_id = searchParams.get("submission_id");
  const user_id = searchParams.get("user_id");
  const org_id = searchParams.get("organization_id");

  if (!org_id) {
    return NextResponse.json({ error: "organization_id required" }, { status: 400 });
  }

  let query = supabase
    .from("compliance_checks")
    .select("*")
    .eq("organization_id", org_id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (submission_id) query = query.eq("submission_id", submission_id);
  if (user_id) query = query.eq("user_id", user_id);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data });
}
