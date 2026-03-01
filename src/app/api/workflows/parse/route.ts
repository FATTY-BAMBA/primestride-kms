import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { getUserOrganization } from "@/lib/get-user-organization";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ══════════════════════════════════════════════════════════════
// POST /api/workflows/parse
// Universal NLP parser v3 — enhanced Taiwanese Mandarin,
// smart proxy suggestions from team data
// ══════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  try {
    const { text, form_type } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    // Get user context for smart proxy
    let teamMembers: string[] = [];
    let userName = "";
    try {
      const { userId } = await auth();
      if (userId) {
        const org = await getUserOrganization(userId);
        if (org) {
          // Get team members for proxy suggestion
          const { data: members } = await supabase
            .from("organization_members")
            .select("user_id, display_name")
            .eq("organization_id", org.organization_id)
            .eq("is_active", true)
            .neq("user_id", userId);

          if (members && members.length > 0) {
            // Get names from profiles
            const { data: profiles } = await supabase
              .from("profiles")
              .select("id, full_name")
              .in("id", members.map(m => m.user_id));

            teamMembers = (profiles || [])
              .map(p => p.full_name)
              .filter(Boolean) as string[];
          }

          // Get current user's name
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", userId)
            .single();
          userName = profile?.full_name || "";
        }
      }
    } catch {
      // Non-critical, continue without team context
    }

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const dayOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][today.getDay()];
    const dayOfWeekZh = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"][today.getDay()];

    const isAuto = !form_type || form_type === "auto";

    // ── Smart proxy context ──
    const proxyContext = teamMembers.length > 0
      ? `\nTEAM MEMBERS (for proxy suggestion): ${teamMembers.join(", ")}
If the user does not specify a proxy but is requesting leave >= 1 day, suggest the first available team member as proxy in the "proxy" field. If user names a specific person, use that person.`
      : "";

    const systemPrompt = `You are a Taiwan enterprise ERP assistant that parses natural language into structured form data.
You are an expert in Taiwanese workplace terminology and culture.

Today is ${todayStr} (${dayOfWeekZh} ${dayOfWeek}).
${userName ? `Current user: ${userName}` : ""}

${isAuto ? `STEP 1: Detect the form type from the user's text:
- "leave" — any mention of: 請假, 休假, 病假, 特休, 年假, 事假, 假, 補休, 調休, 公假, 喪假, 婚假, 產假, 陪產假, 家庭照顧假, 生理假, 育嬰假, leave, day off, sick, PTO, 照顧, family care, 不舒服, 身體不適, 看醫生, 看病
- "overtime" — any mention of: 加班, OT, overtime, 晚上要做, 趕工, work late, 留下來, 多做, 延長工時
- "business_trip" — any mention of: 出差, 出去, trip, travel, 拜訪客戶, 去…, visit client, 高雄, 台中, 台南, 新竹, 海外, 外地

STEP 2: ` : ""}Parse the text into the correct form fields.

FORM SCHEMAS:

LEAVE: { leave_type, start_date, end_date, days, reason, proxy }
  leave_type options and Taiwanese detection rules:
  ┌──────────────────────────────────────────────────────────────┐
  │ 特休 Annual     │ 特休, 年假, 年休, annual leave, PTO        │
  │ 補休 Comp       │ 補休, 調休, 換休, 補假, comp leave, comp off│
  │                 │ NOTE: 補休 is DIFFERENT from 特休!          │
  │                 │ 補休 = compensatory leave for past overtime │
  │                 │ 特休 = annual leave entitlement             │
  │ 病假 Sick       │ 病假, 不舒服, 身體不適, 看醫生, 看病,      │
  │                 │ 生病, 感冒, 發燒, 頭痛, sick, unwell        │
  │ 事假 Personal   │ 事假, 有事, 私事, 辦事, personal            │
  │ 家庭照顧假 Family Care │ 家庭照顧, 小孩, 家人, 照顧, 接小孩, │
  │                 │ 孩子生病, family, child, 幼兒園, 學校活動   │
  │                 │ NOTE: 2026 can be taken by hour (小時)      │
  │ 生理假 Menstrual│ 生理假, 生理期, 經期, menstrual             │
  │                 │ NOTE: 1 day/month, counts toward sick leave │
  │ 婚假 Marriage   │ 婚假, 結婚, 婚禮, wedding, marriage         │
  │ 喪假 Bereavement│ 喪假, 喪事, 過世, 去世, 告別式, funeral     │
  │ 產假 Maternity  │ 產假, 生產, 預產期, 分娩, maternity         │
  │ 陪產假 Paternity│ 陪產假, 陪產, 太太生, paternity             │
  │ 公假 Official   │ 公假, 公務, 開會, 政府, 法院, official      │
  │ 育嬰假 Parental │ 育嬰假, 育嬰留停, parental leave            │
  │ 公傷假 Work Injury│ 公傷假, 工傷, 職災, work injury           │
  └──────────────────────────────────────────────────────────────┘
  Default leave_type: 事假 Personal (if type cannot be determined)
  CRITICAL: 補休 ≠ 特休. Never confuse these two.
  If user says 半天 or "half day" → days = 0.5
  If user says 幾個小時/N小時 for 家庭照顧假 → convert to fraction of day (8hr = 1 day)
${proxyContext}

OVERTIME: { date, start_time, end_time, hours, overtime_type, reason, project }
  overtime_type options: 平日加班 Weekday, 假日加班 Holiday, 國定假日 National Holiday
  Default start_time: 18:00 (standard work end in Taiwan)
  Auto-detect: if date falls on Saturday/Sunday → 假日加班 Holiday
  If user mentions 趕 or deadline → extract as reason
  If user mentions a project name → extract to project field

BUSINESS TRIP: { destination, start_date, end_date, days, purpose, transport, budget, accommodation }
  transport options: 高鐵 HSR, 飛機 Flight, 自駕 Driving, 火車 Train, 客運 Bus, 其他 Other
  Default transport: 高鐵 HSR for domestic Taiwan, 飛機 Flight for international
  Common destinations: 高雄, 台中, 台南, 新竹, 花蓮, 台東, 桃園 (domestic)

RULES:
- All dates in YYYY-MM-DD format
- Times in HH:MM 24-hour format
- Calculate days from start_date and end_date (inclusive)
- Calculate hours from start_time and end_time
- Resolve relative dates correctly:
  明天 = tomorrow, 後天 = day after tomorrow
  下週一 = next Monday, 這週五 = this Friday
  下個月 = next month
  大後天 = 3 days from now
  月底 = last day of current month
- Handle Taiwanese date patterns: 3/5 = March 5th, 三月五號 = March 5th
- If user mentions only one date for leave, end_date = start_date
- Leave empty string for unknown optional fields

TAIWANESE MANDARIN NUANCES:
- 請一天假 = requesting 1 day leave
- 請個假 = requesting leave (duration unclear, default 1 day)
- 掛號/看診 = doctor visit → 病假 Sick
- 接小孩 = pick up child → 家庭照顧假 Family Care
- 回南部 = going to southern Taiwan → reason (not a business trip)
- 跑客戶 = visiting clients → could be business_trip
- 處理私事 = handling personal matters → 事假 Personal
- 要去一趟XX = going to XX → if city name, likely business_trip
- 不來了/不進公司 = not coming in → leave (ask for type)

Respond in JSON ONLY, no markdown, no backticks:
${isAuto ? '{"form_type": "leave"|"overtime"|"business_trip", "form_data": {...}}' : '{"form_data": {...}}'}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.1,
      max_tokens: 600,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
    });

    const raw = response.choices[0]?.message?.content || "";
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    // ── Enrich with smart proxy metadata ──
    const result = isAuto
      ? {
          form_type: parsed.form_type || "leave",
          form_data: parsed.form_data || {},
        }
      : {
          form_type: form_type,
          form_data: parsed.form_data || parsed,
        };

    // Add proxy suggestion metadata if we suggested one
    if (result.form_data.proxy && teamMembers.includes(result.form_data.proxy)) {
      result.form_data._proxy_suggested = true;
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("NLP parse error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
