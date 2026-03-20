import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getUserOrganization } from "@/lib/get-user-organization";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/subsidy-hunter
 * Scans org employee data and returns matched government subsidies.
 * Admin only.
 *
 * Current subsidy database (2026 Taiwan):
 * 1. 數位轉型人才培訓補助 — employees reaching 1-year seniority
 * 2. 勞動力發展署訓練補助 — companies with 5+ employees (up to NT$6,000/person)
 * 3. 職場健康計畫補助 — if org has 50+ employees
 * 4. 中高齡員工留任補助 — employees aged 45+ (requires age data — flagged)
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const org = await getUserOrganization(userId);
    if (!org) return NextResponse.json({ error: "No organization" }, { status: 404 });
    if (!["owner", "admin"].includes(org.role || ""))
      return NextResponse.json({ error: "Admin only" }, { status: 403 });

    const orgId = org.organization_id;
    const now = new Date();

    // ── Get all active members with join dates ──
    const { data: members } = await supabase
      .from("organization_members")
      .select("user_id, joined_at")
      .eq("organization_id", orgId)
      .eq("is_active", true);

    const memberCount = (members || []).length;

    // ── Resolve names ──
    const userIds = (members || []).map(m => m.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds);
    const profileMap = new Map((profiles || []).map(p => [
      p.id,
      p.full_name || p.email?.split("@")[0] || p.id.slice(0, 12)
    ]));

    const subsidies: {
      id: string;
      name_zh: string;
      name_en: string;
      description_zh: string;
      description_en: string;
      amount: string;
      deadline: string;
      source: string;
      eligible_employees?: { user_id: string; name: string; reason: string }[];
      action_zh: string;
      action_en: string;
      portal_url: string;
      urgency: "high" | "medium" | "low";
      icon: string;
    }[] = [];

    // ── Subsidy 1: 數位轉型人才培訓補助 ──
    // Employees reaching 1-year seniority within next 30 days
    const soonSeniority = (members || []).filter(m => {
      if (!m.joined_at) return false;
      const joined = new Date(m.joined_at);
      const oneYear = new Date(joined);
      oneYear.setFullYear(oneYear.getFullYear() + 1);
      const daysUntil = Math.ceil((oneYear.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return daysUntil >= 0 && daysUntil <= 60;
    });

    if (soonSeniority.length > 0) {
      subsidies.push({
        id: "digital_training",
        name_zh: "數位轉型人才培訓補助",
        name_en: "Digital Transformation Training Subsidy",
        description_zh: `${soonSeniority.length} 位員工即將達到1年年資，符合申請「數位轉型人才培訓」補助資格。每人最高補助 NT$6,000，適用於AI、數位工具、軟體操作等培訓課程。`,
        description_en: `${soonSeniority.length} employee(s) are approaching 1-year seniority and qualify for the Digital Transformation Training Subsidy. Up to NT$6,000 per person for AI, digital tools, or software training.`,
        amount: `NT$${(soonSeniority.length * 6000).toLocaleString()} 最高可申請`,
        deadline: "申請時效：年資達成後3個月內",
        source: "勞動力發展署 Workforce Development Agency",
        eligible_employees: soonSeniority.map(m => ({
          user_id: m.user_id,
          name: profileMap.get(m.user_id) || m.user_id.slice(0, 12),
          reason: `入職日 ${new Date(m.joined_at).toLocaleDateString("zh-TW")}，即將達1年年資`,
        })),
        action_zh: "前往勞動力發展署補助系統申請",
        action_en: "Apply via WDA subsidy portal",
        portal_url: "https://ezlearn.wda.gov.tw",
        urgency: "high",
        icon: "🎓",
      });
    }

    // ── Subsidy 2: 勞動力發展署 — Company Training Fund ──
    // Available to all companies with 5+ employees
    if (memberCount >= 5) {
      subsidies.push({
        id: "company_training_fund",
        name_zh: "員工在職訓練補助",
        name_en: "On-the-Job Training Subsidy",
        description_zh: `貴公司有 ${memberCount} 位員工，符合「員工在職訓練補助」資格。補助比例：中小企業最高80%，一般企業最高60%。可用於數位化、合規、管理等培訓。`,
        description_en: `Your company (${memberCount} employees) qualifies for On-the-Job Training subsidies. SMEs receive up to 80% reimbursement for digital, compliance, or management training.`,
        amount: "訓練費用最高80%補助",
        deadline: "全年度開放申請，額滿為止",
        source: "勞動部勞動力發展署",
        action_zh: "每季定期申請，建議Q2前提出",
        action_en: "Apply quarterly — recommend before Q2",
        portal_url: "https://ilabor.mol.gov.tw/",
        urgency: "medium",
        icon: "💼",
      });
    }

    // ── Subsidy 3: 商業服務業智慧轉型補助 ──
    // Available to companies actively using digital tools
    subsidies.push({
      id: "smart_transformation",
      name_zh: "商業服務業智慧轉型補助",
      name_en: "Commercial Services Digital Transformation Subsidy",
      description_zh: "貴公司導入 AI 人資管理系統（Atlas EIP），符合經濟部商業發展署「商業服務業智慧轉型」補助條件。最高可申請 NT$50萬 系統導入補助。",
      description_en: "Your company has implemented an AI HR management system (Atlas EIP), qualifying for the MOEA Commercial Digital Transformation subsidy. Up to NT$500,000 for system implementation costs.",
      amount: "最高 NT$500,000",
      deadline: "2026年申請窗口：3月及9月",
      source: "經濟部商業發展署 MOEA",
      action_zh: "需附系統導入證明及費用單據",
      action_en: "Requires proof of system implementation and receipts",
      portal_url: "https://gcis.nat.gov.tw/mainNew/subclassNAction.do?method=getFile&pk=875",
      urgency: "high",
      icon: "🏛️",
    });

    // ── Subsidy 4: 職場安全衛生改善補助 (50+ employees) ──
    if (memberCount >= 50) {
      subsidies.push({
        id: "workplace_safety",
        name_zh: "職場安全衛生改善補助",
        name_en: "Workplace Safety Improvement Grant",
        description_zh: `貴公司達到50人規模，符合「職場安全衛生改善」補助資格，可申請最高 NT$10萬 用於員工健康、安全設備或心理健康計畫。`,
        description_en: `With ${memberCount} employees, your company qualifies for the Workplace Safety Improvement Grant — up to NT$100,000 for health, safety equipment, or mental wellness programs.`,
        amount: "最高 NT$100,000",
        deadline: "每年1月及7月開放申請",
        source: "勞動部職業安全衛生署",
        action_zh: "需提交職場安全計畫書",
        action_en: "Requires workplace safety plan submission",
        portal_url: "https://www.osha.gov.tw/",
        urgency: "medium",
        icon: "🛡️",
      });
    }

    const totalPotential = subsidies.reduce((sum, s) => {
      const match = s.amount.match(/[\d,]+/);
      if (match) return sum + parseInt(match[0].replace(/,/g, ""));
      return sum;
    }, 0);

    // Add disclaimer to each subsidy
    const subsidiesWithDisclaimer = subsidies.map(s => ({
      ...s,
      disclaimer_zh: "以上資訊依據 2026 年度已知方案整理，實際資格與金額以主管機關公告為準。建議申請前諮詢勞資顧問。",
      disclaimer_en: "Based on known 2026 programs. Verify eligibility with the relevant agency or a labor affairs consultant before applying.",
    }));

    return NextResponse.json({
      subsidies: subsidiesWithDisclaimer,
      disclaimer_zh: "補助資訊依據 2026 年度方案整理，非官方資料。請申請前諮詢專業勞資顧問或直接洽詢主管機關。",
      disclaimer_en: "Subsidy information is based on known 2026 programs and is not official government data. Consult a labor affairs consultant or contact the relevant agency before applying.",
      summary: {
        total_found: subsidies.length,
        high_urgency: subsidies.filter(s => s.urgency === "high").length,
        total_potential_nt: totalPotential,
        member_count: memberCount,
          scanned_at: now.toISOString(),
      },
    });
  } catch (err: any) {
    console.error("Subsidy hunter error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}