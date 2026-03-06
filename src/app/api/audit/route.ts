import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ══════════════════════════════════════════════════════════════
// POST /api/audit
// PUBLIC endpoint — no auth required
// Scans employee handbook text for 2026 Taiwan labor law violations
// ══════════════════════════════════════════════════════════════

interface AuditFinding {
  severity: "critical" | "warning" | "info";
  category: string;
  title: string;
  title_zh: string;
  description: string;
  description_zh: string;
  law_reference: string;
  recommendation: string;
  recommendation_zh: string;
}

interface AuditResult {
  score: number;
  findings: AuditFinding[];
  summary: string;
  summary_zh: string;
  total_critical: number;
  total_warnings: number;
  total_info: number;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, company_name } = body;

    if (!text || text.trim().length < 50) {
      return NextResponse.json(
        { error: "Please provide at least 50 characters of document text to analyze." },
        { status: 400 }
      );
    }

    // Limit text to first 12000 chars to control costs
    const trimmedText = text.slice(0, 12000);

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: `You are a Taiwan Labor Law compliance auditor specializing in the 2026 amendments to the Labor Standards Act (勞動基準法).

Your job is to scan a company's Employee Handbook (員工工作規則) and identify paragraphs or policies that violate or conflict with the January 1, 2026 labor law amendments.

KEY 2026 CHANGES TO CHECK FOR:

1. HOURLY FAMILY CARE LEAVE (家庭照顧假按小時請假)
   - 2026 rule: Family Care Leave (7 days/year) can now be taken in 1-hour increments (56 hours total)
   - VIOLATION if handbook says "must take full day" or "minimum 1 day" for family care leave
   - Law: Gender Equality in Employment Act Art. 20

2. ATTENDANCE BONUS PROTECTION (全勤獎金比例扣減)
   - 2026 rule: Employers CANNOT fully deduct attendance bonuses for legally protected leave types
   - Must use pro-rata deduction for sick leave (e.g., NT$100/day deduction, not full NT$3,000 loss)
   - Family care, maternity, paternity, bereavement, marriage leave: NO deduction at all
   - VIOLATION if handbook says "any absence = lose full attendance bonus" or "sick leave = no bonus"
   - Law: LSA Art. 9-1

3. PARENTAL LEAVE FLEXIBILITY (育嬰假彈性)
   - 2026 rule: Parental leave can now be taken in daily increments (previously 6-month blocks minimum)
   - VIOLATION if handbook says "minimum 6 months" or "must take consecutive months"
   - Law: Gender Equality in Employment Act Art. 16

4. OVERTIME CAPS (加班上限)
   - Monthly: 46 hours standard, 54 hours with written consent
   - Quarterly: 138 hours in any 3-month period (absolute cap)
   - Daily: 4 hours (total 12 hours including regular work)
   - VIOLATION if handbook allows more than these limits or doesn't mention quarterly cap
   - Fine risk: NT$20,000 ~ NT$1,000,000
   - Law: LSA Art. 32

5. MINIMUM WAGE 2026 (基本工資)
   - Monthly: NT$29,500
   - Hourly: NT$196
   - VIOLATION if any salary references show lower amounts
   - Law: LSA Art. 21

6. ANNUAL LEAVE CALCULATION (特休假計算)
   - Must use employee's actual start date, not calendar year
   - Unused days must be paid out at year end or carried over by agreement
   - VIOLATION if handbook says "annual leave resets Jan 1" without pro-rata or "use it or lose it"
   - Law: LSA Art. 38

7. REST DAY / HOLIDAY OVERTIME PAY (休息日/假日加班費)
   - Rest day: first 2h at 1.34x, hours 3-8 at 1.67x
   - National holiday: all hours at 2x, requires written consent
   - VIOLATION if handbook shows different rates or doesn't require consent
   - Law: LSA Art. 24, 39

Respond in JSON ONLY (no markdown, no backticks):
{
  "score": <0-100 compliance score, 100 = fully compliant>,
  "summary_en": "2-3 sentence overall assessment in English",
  "summary_zh": "2-3 sentence overall assessment in Traditional Chinese",
  "findings": [
    {
      "severity": "critical" | "warning" | "info",
      "category": "leave" | "overtime" | "salary" | "bonus" | "general",
      "title": "Short title in English",
      "title_zh": "Short title in Traditional Chinese",
      "description": "What the handbook says or implies that's wrong (English)",
      "description_zh": "What the handbook says or implies that's wrong (Traditional Chinese)",
      "law_reference": "Specific article reference (e.g., LSA Art. 32)",
      "recommendation": "What to change (English)",
      "recommendation_zh": "What to change (Traditional Chinese)"
    }
  ]
}

CRITICAL RULES:
- Only flag REAL violations based on actual text in the document
- Do NOT flag things that aren't mentioned (missing policies are "info" level, not critical)
- "critical" = direct legal violation with fine risk
- "warning" = outdated policy that needs updating
- "info" = missing policy that should be added
- Be specific: quote or reference the exact section that's problematic
- Score 80-100 = good compliance, 60-79 = needs updates, below 60 = serious risk`,
        },
        {
          role: "user",
          content: `Scan this Employee Handbook for 2026 Taiwan Labor Law compliance issues:\n\n${trimmedText}`,
        },
      ],
    });

    const raw = response.choices[0]?.message?.content || "";
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    const findings: AuditFinding[] = (parsed.findings || []).map((f: any) => ({
      severity: f.severity || "info",
      category: f.category || "general",
      title: f.title || "",
      title_zh: f.title_zh || "",
      description: f.description || "",
      description_zh: f.description_zh || "",
      law_reference: f.law_reference || "",
      recommendation: f.recommendation || "",
      recommendation_zh: f.recommendation_zh || "",
    }));

    const result: AuditResult = {
      score: parsed.score || 0,
      findings,
      summary: parsed.summary_en || "",
      summary_zh: parsed.summary_zh || "",
      total_critical: findings.filter((f) => f.severity === "critical").length,
      total_warnings: findings.filter((f) => f.severity === "warning").length,
      total_info: findings.filter((f) => f.severity === "info").length,
    };

    return NextResponse.json({ data: result });
  } catch (err: any) {
    console.error("Audit error:", err);
    return NextResponse.json(
      { error: "Failed to analyze document. Please try again." },
      { status: 500 }
    );
  }
}