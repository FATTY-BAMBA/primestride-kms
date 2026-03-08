import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { getUserOrganization } from "@/lib/get-user-organization";
import OpenAI from "openai";
import { logUsage } from "@/lib/usage-logger";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
    const { form_type, form_data } = body;

    if (!form_type || !form_data) {
      return NextResponse.json({ error: "form_type and form_data are required" }, { status: 400 });
    }

    let user_id = body.user_id || null;
    let organization_id = body.organization_id || null;

    if (!user_id || !organization_id) {
      try {
        const { userId } = await auth();
        if (userId) {
          user_id = userId;
          const org = await getUserOrganization(userId);
          if (org) {
            organization_id = org.organization_id;
          }
        }
      } catch {
        // Auth not available
      }
    }

    if (!user_id || !organization_id) {
      return NextResponse.json({ error: "Unable to resolve user context. Please log in." }, { status: 401 });
    }

    const result: ComplianceResult = { status: "pass", checks: [] };

    if (form_type === "leave") {
      await checkLeaveCompliance(result, form_data, user_id, organization_id);
    } else if (form_type === "overtime") {
      await checkOvertimeCompliance(result, form_data, user_id, organization_id);
    } else if (form_type === "business_trip") {
      result.checks.push({
        check_type: "trip_basic",
        status: "pass",
        rule_reference: "Company Policy",
        message: "Business trip request within normal parameters.",
        message_zh: "出差申請符合一般規範。",
        details: {},
      });
    }

    // AI-powered compliance analysis (RAG)
    const aiAnalysis = await runAIComplianceCheck(form_type, form_data, organization_id);
    if (aiAnalysis) {
      result.ai_analysis = aiAnalysis.en;
      result.ai_analysis_zh = aiAnalysis.zh;

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

    // Determine overall status
    if (result.checks.some((c) => c.status === "blocked")) {
      result.status = "blocked";
    } else if (result.checks.some((c) => c.status === "warning")) {
      result.status = "warning";
    }

    // Log compliance checks
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

    logUsage({ organization_id, user_id, action: "compliance.check", resource_type: "compliance", metadata: { form_type, status: result.status } });

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
  const { leave_type, days } = form_data;
  const numDays = parseFloat(days) || 0;

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

    const leaveTypeKey = (leave_type || "").toLowerCase();
    if (leaveTypeKey.includes("特休") || leaveTypeKey.includes("annual")) {
      totalDays = balance.annual_total || 7; usedDays = balance.annual_used || 0; balanceField = "annual";
    } else if (leaveTypeKey.includes("病假") || leaveTypeKey.includes("sick")) {
      totalDays = balance.sick_total || 30; usedDays = balance.sick_used || 0; balanceField = "sick";
    } else if (leaveTypeKey.includes("事假") || leaveTypeKey.includes("personal")) {
      totalDays = balance.personal_total || 14; usedDays = balance.personal_used || 0; balanceField = "personal";
    } else if (leaveTypeKey.includes("家庭") || leaveTypeKey.includes("family")) {
      totalDays = balance.family_care_total || 7; usedDays = balance.family_care_used || 0; balanceField = "family_care";
    } else if (leaveTypeKey.includes("婚假") || leaveTypeKey.includes("marriage")) {
      totalDays = balance.marriage_total || 8; usedDays = balance.marriage_used || 0; balanceField = "marriage";
    } else if (leaveTypeKey.includes("產假") || leaveTypeKey.includes("maternity")) {
      totalDays = balance.maternity_total || 56; usedDays = balance.maternity_used || 0; balanceField = "maternity";
    } else if (leaveTypeKey.includes("陪產") || leaveTypeKey.includes("paternity")) {
      totalDays = balance.paternity_total || 7; usedDays = balance.paternity_used || 0; balanceField = "paternity";
    } else if (leaveTypeKey.includes("喪假") || leaveTypeKey.includes("bereavement")) {
      totalDays = balance.bereavement_total || 8; usedDays = balance.bereavement_used || 0; balanceField = "bereavement";
    }

    available = totalDays - usedDays;

    // 1. Leave balance check
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

    // 3. Full Attendance Bonus — Fully Protected Leave Types
    const fullyProtectedTypes = ["family_care", "marriage", "bereavement", "maternity", "paternity"];
    if (fullyProtectedTypes.includes(balanceField)) {
      result.checks.push({
        check_type: "attendance_bonus_protection",
        status: "pass",
        rule_reference: "LSA Art. 9-1 — Full Attendance Bonus Protection",
        message: `${leave_type} is fully protected: Attendance bonus CANNOT be deducted for this leave type under any circumstances.`,
        message_zh: `${leave_type}受法律完全保護：依勞基法第9-1條，此假別不得以任何方式扣發全勤獎金。`,
        details: { protected: true, deduction: 0, leave_type: balanceField },
      });
    }

    // ═══ NEW: 4. Sick Leave — Pro-Rata Bonus Calculator (2026) ═══
    if (balanceField === "sick") {
      const sickDaysThisYear = usedDays + numDays;
      // 2026 rule: sick leave cannot lose FULL bonus — must use pro-rata deduction
      // Default: NT$3,000 monthly bonus (organizations can configure this later)
      const monthlyBonus = 3000;
      const dailyRate = Math.round(monthlyBonus / 30);
      const deduction = dailyRate * numDays;
      const remainingBonus = Math.max(monthlyBonus - deduction, 0);

      result.checks.push({
        check_type: "sick_leave_bonus_prorata",
        status: "pass",
        rule_reference: "LSA Art. 9-1 — 2026 Pro-Rata Bonus Protection",
        message: `2026 Protection: Attendance bonus adjusted by pro-rata only. Deduction: NT$${deduction} (NT$${dailyRate}/day × ${numDays} days). You keep NT$${remainingBonus} of your NT$${monthlyBonus} monthly bonus. Full deduction is ILLEGAL.`,
        message_zh: `💰 2026 合規保護：全勤獎金僅按比例扣減，全額扣發屬違法行為。扣除金額：NT$${deduction}（NT$${dailyRate}/天 × ${numDays}天）。您仍可領取 NT$${remainingBonus} / NT$${monthlyBonus} 的全勤獎金。`,
        details: {
          monthly_bonus: monthlyBonus,
          daily_rate: dailyRate,
          days_requested: numDays,
          deduction,
          remaining_bonus: remainingBonus,
          sick_days_this_year: sickDaysThisYear,
          prorata_protected: true,
          full_deduction_illegal: true,
        },
      });
    }

    // ═══ NEW: 5. Family Care Leave — 2026 Hourly Tracking ═══
    if (balanceField === "family_care") {
      const hoursTotal = balance.family_care_hours_total || 56;
      const hoursUsed = balance.family_care_hours_used || 0;
      const hoursRemaining = hoursTotal - hoursUsed;
      const requestedHours = numDays * 8;

      result.checks.push({
        check_type: "family_care_hourly_2026",
        status: requestedHours > hoursRemaining ? "warning" : "pass",
        rule_reference: "2026 Amendment — Hourly Family Care Leave",
        message: `2026 Rule: Family Care Leave can be taken by the hour (${hoursTotal}hr/year). Used: ${hoursUsed}hr, Remaining: ${hoursRemaining}hr. This request: ${requestedHours}hr. Attendance bonus fully protected.`,
        message_zh: `⏰ 2026 新規：家庭照顧假可按小時請假（每年${hoursTotal}小時）。已使用：${hoursUsed}小時，剩餘：${hoursRemaining}小時。本次申請：${requestedHours}小時。全勤獎金完全受保護。`,
        details: {
          hours_total: hoursTotal,
          hours_used: hoursUsed,
          hours_remaining: hoursRemaining,
          hours_requested: requestedHours,
          hourly_enabled: true,
          bonus_protected: true,
        },
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
  const { date, hours } = form_data;
  const numHours = parseFloat(hours) || 0;

  // 1. Daily hours limit (max 4 hours overtime = 12 total)
  if (numHours > 4) {
    result.checks.push({
      check_type: "daily_overtime_limit",
      status: "blocked",
      rule_reference: "LSA Art. 32 — Daily Overtime Limit",
      message: `Overtime exceeds 4-hour daily limit. Requested: ${numHours} hours. Total work day would exceed 12-hour maximum.`,
      message_zh: `🚫 加班時數超過每日上限4小時。申請 ${numHours} 小時，工作日總時數將超過12小時上限。`,
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

  // 2. Monthly overtime cap
  let totalMonthHours = 0;
  if (date) {
    const monthStart = date.substring(0, 7) + "-01";
    const monthEnd = date.substring(0, 7) + "-31";

    const { data: monthOT } = await supabase
      .from("workflow_submissions")
      .select("form_data")
      .eq("organization_id", org_id)
      .eq("submitted_by", user_id)
      .eq("form_type", "overtime")
      .in("status", ["approved", "pending"])
      .gte("created_at", monthStart)
      .lte("created_at", monthEnd);

    totalMonthHours = (monthOT || []).reduce((sum: number, s: any) => {
      return sum + (parseFloat(s.form_data?.hours) || 0);
    }, 0);

    const projectedTotal = totalMonthHours + numHours;

    if (projectedTotal > 54) {
      result.checks.push({
        check_type: "monthly_overtime_cap",
        status: "blocked",
        rule_reference: "LSA Art. 32 — Monthly Overtime Hard Cap",
        message: `BLOCKED: Monthly overtime will reach ${projectedTotal}h, exceeding absolute maximum 54h/month. Fine: NT$20,000 ~ NT$1,000,000.`,
        message_zh: `🚫 禁止：本月加班將達 ${projectedTotal} 小時，超過絕對上限54小時/月。罰款風險：NT$20,000 ~ NT$1,000,000。`,
        details: { existing_hours: totalMonthHours, requested: numHours, projected: projectedTotal, limit_standard: 46, limit_extended: 54, fine_risk: "NT$20,000-1,000,000" },
      });
    } else if (projectedTotal > 46) {
      result.checks.push({
        check_type: "monthly_overtime_cap",
        status: "warning",
        rule_reference: "LSA Art. 32 — Extended Monthly Cap",
        message: `Monthly overtime will reach ${projectedTotal}h (standard: 46h). Extended to 54h requires written consent + labor-management meeting record.`,
        message_zh: `⚠️ 本月加班將達 ${projectedTotal} 小時（標準上限：46小時）。延長至54小時需勞工書面同意及勞資會議紀錄。`,
        details: { existing_hours: totalMonthHours, requested: numHours, projected: projectedTotal, consent_required: true },
      });
    } else {
      result.checks.push({
        check_type: "monthly_overtime_cap",
        status: "pass",
        rule_reference: "LSA Art. 32",
        message: `Monthly overtime within limit: ${projectedTotal}/46 hours.`,
        message_zh: `本月加班時數符合規定：${projectedTotal}/46 小時。`,
        details: { existing_hours: totalMonthHours, requested: numHours, projected: projectedTotal },
      });
    }

    // ═══ NEW: 3. Quarterly 138-Hour Cap (Rolling 3-Month Window) ═══
    const requestDate = new Date(date);
    const threeMonthsAgo = new Date(requestDate);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 2);
    threeMonthsAgo.setDate(1);
    const quarterStart = threeMonthsAgo.toISOString().split("T")[0];
    const quarterEnd = new Date(requestDate.getFullYear(), requestDate.getMonth() + 1, 0).toISOString().split("T")[0];

    const { data: quarterOT } = await supabase
      .from("workflow_submissions")
      .select("form_data")
      .eq("organization_id", org_id)
      .eq("submitted_by", user_id)
      .eq("form_type", "overtime")
      .in("status", ["approved", "pending"])
      .gte("created_at", quarterStart)
      .lte("created_at", quarterEnd);

    const totalQuarterHours = (quarterOT || []).reduce((sum: number, s: any) => {
      return sum + (parseFloat(s.form_data?.hours) || 0);
    }, 0);

    const projectedQuarter = totalQuarterHours + numHours;

    if (projectedQuarter > 138) {
      result.checks.push({
        check_type: "quarterly_overtime_cap",
        status: "blocked",
        rule_reference: "LSA Art. 32 — Quarterly 138-Hour Hard Cap",
        message: `BLOCKED: 3-month overtime will reach ${projectedQuarter}h, exceeding 138h quarterly cap. This is an absolute legal limit with no exceptions. Fine: NT$20,000 ~ NT$1,000,000.`,
        message_zh: `🚫 禁止：近3個月加班將達 ${projectedQuarter} 小時，超過任3個月138小時絕對上限。此上限無法延長或例外。罰款：NT$20,000 ~ NT$1,000,000。`,
        details: { quarter_start: quarterStart, quarter_end: quarterEnd, existing_quarter_hours: totalQuarterHours, requested: numHours, projected_quarter: projectedQuarter, limit: 138, fine_risk: "NT$20,000-1,000,000" },
      });
    } else if (projectedQuarter > 120) {
      result.checks.push({
        check_type: "quarterly_overtime_cap",
        status: "warning",
        rule_reference: "LSA Art. 32 — Quarterly Cap Warning",
        message: `Approaching quarterly limit: ${projectedQuarter}/138h in 3-month window. Only ${138 - projectedQuarter}h remaining.`,
        message_zh: `⚠️ 接近季度上限：近3個月 ${projectedQuarter}/138 小時。僅剩 ${138 - projectedQuarter} 小時。`,
        details: { existing_quarter_hours: totalQuarterHours, projected_quarter: projectedQuarter, remaining: 138 - projectedQuarter },
      });
    } else {
      result.checks.push({
        check_type: "quarterly_overtime_cap",
        status: "pass",
        rule_reference: "LSA Art. 32 — Quarterly Cap",
        message: `Quarterly overtime within limit: ${projectedQuarter}/138 hours.`,
        message_zh: `近3個月加班符合規定：${projectedQuarter}/138 小時。`,
        details: { existing_quarter_hours: totalQuarterHours, projected_quarter: projectedQuarter },
      });
    }
  }

  // 4. National holiday check
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
          rule_reference: "LSA Art. 39 — Holiday Overtime",
          message: `${date} is a national holiday. Requires written consent. Must pay double rate (200%).`,
          message_zh: `⚠️ ${date} 為國定假日。加班需經勞工書面同意，須加倍發給工資（200%）。`,
          details: { date, is_holiday: true, required_rate: 2.0 },
        });
      }
    }
  }

  // ═══ NEW: 5. Overtime Pay Estimation with NT$ Amount ═══
  if (numHours > 0) {
    const overtimeType = (form_data.overtime_type || "").toLowerCase();
    const baseMonthlySalary = 50000; // Sample salary for estimation
    const baseHourlyRate = Math.round(baseMonthlySalary / 30 / 8);
    let estimatedPay = 0;
    let rateBreakdown = "";
    let rateBreakdownZh = "";

    if (overtimeType.includes("國定") || overtimeType.includes("national")) {
      estimatedPay = Math.round(baseHourlyRate * 2.0 * numHours);
      rateBreakdown = `All ${numHours}h × 2.0 = NT$${estimatedPay}`;
      rateBreakdownZh = `全部 ${numHours}小時 × 2.0倍 = NT$${estimatedPay.toLocaleString()}`;
    } else if (overtimeType.includes("假日") || overtimeType.includes("holiday") || overtimeType.includes("休息")) {
      const h1 = Math.min(numHours, 2);
      const h2 = Math.min(Math.max(numHours - 2, 0), 6);
      const h3 = Math.max(numHours - 8, 0);
      const pay1 = Math.round(baseHourlyRate * h1 * 1.34);
      const pay2 = Math.round(baseHourlyRate * h2 * 1.67);
      const pay3 = Math.round(baseHourlyRate * h3 * 2.67);
      estimatedPay = pay1 + pay2 + pay3;
      rateBreakdown = `${h1}h×1.34 + ${h2}h×1.67 = NT$${estimatedPay}`;
      rateBreakdownZh = `前${h1}小時×1.34倍 + ${h2}小時×1.67倍 = NT$${estimatedPay.toLocaleString()}`;
    } else {
      const h1 = Math.min(numHours, 2);
      const h2 = Math.max(numHours - 2, 0);
      const pay1 = Math.round(baseHourlyRate * h1 * 1.34);
      const pay2 = Math.round(baseHourlyRate * h2 * 1.67);
      estimatedPay = pay1 + pay2;
      rateBreakdown = `${h1}h×1.34 + ${h2}h×1.67 = NT$${estimatedPay}`;
      rateBreakdownZh = `前${h1}小時×1.34倍${h2 > 0 ? ` + ${h2}小時×1.67倍` : ""} = NT$${estimatedPay.toLocaleString()}`;
    }

    result.checks.push({
      check_type: "overtime_pay_estimate",
      status: "pass",
      rule_reference: "LSA Art. 24 — Overtime Pay",
      message: `Estimated OT pay: NT$${estimatedPay.toLocaleString()} (${rateBreakdown}). Based on NT$${baseMonthlySalary.toLocaleString()}/mo sample. Actual amount per your salary.`,
      message_zh: `💰 預估加班費：NT$${estimatedPay.toLocaleString()}（${rateBreakdownZh}）。以月薪NT$${baseMonthlySalary.toLocaleString()}估算，實際依個人薪資計算。`,
      details: {
        base_monthly_salary: baseMonthlySalary,
        base_hourly_rate: baseHourlyRate,
        hours: numHours,
        estimated_pay: estimatedPay,
        overtime_type: form_data.overtime_type,
      },
    });
  }
}

// ══════════════════════════════════════════════════════════════
// AI-POWERED COMPLIANCE ANALYSIS (RAG)
// ══════════════════════════════════════════════════════════════
async function runAIComplianceCheck(
  form_type: string,
  form_data: Record<string, any>,
  org_id: string
): Promise<{ en: string; zh: string; issues: { severity: string; rule: string; message_en: string; message_zh: string }[] } | null> {
  try {
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