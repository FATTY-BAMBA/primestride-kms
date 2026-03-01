import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ══════════════════════════════════════════════════════════════
// POST /api/workflows/parse
// Universal NLP parser — auto-detects form type if "auto"
// ══════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  try {
    const { text, form_type } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const dayOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][today.getDay()];
    const dayOfWeekZh = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"][today.getDay()];

    const isAuto = !form_type || form_type === "auto";

    const systemPrompt = `You are a Taiwan enterprise ERP assistant that parses natural language into structured form data.

Today is ${todayStr} (${dayOfWeekZh} ${dayOfWeek}).

${isAuto ? `STEP 1: Detect the form type from the user's text:
- "leave" — any mention of 請假, 休假, 病假, 特休, 事假, 假, leave, day off, sick, PTO, 照顧, family care
- "overtime" — any mention of 加班, OT, overtime, 晚上要做, 趕工, work late
- "business_trip" — any mention of 出差, 出去, trip, travel, 拜訪客戶, 去…, visit client, 高雄, 台中, etc.

STEP 2: ` : ""}Parse the text into the correct form fields.

FORM SCHEMAS:
- leave: { leave_type, start_date, end_date, days, reason, proxy }
  leave_type options: 特休 Annual, 病假 Sick, 事假 Personal, 家庭照顧假 Family Care, 婚假 Marriage, 喪假 Bereavement, 產假 Maternity, 陪產假 Paternity, 公假 Official
  Default leave_type: 事假 Personal (if not specified)
  If user mentions 小孩/家人/照顧/family/child → use 家庭照顧假 Family Care

- overtime: { date, start_time, end_time, hours, overtime_type, reason, project }
  overtime_type options: 平日加班 Weekday, 假日加班 Holiday, 國定假日 National Holiday
  Default start_time: 18:00 (standard work end)
  Auto-detect: weekend = 假日加班 Holiday

- business_trip: { destination, start_date, end_date, days, purpose, transport, budget, accommodation }
  transport options: 高鐵 HSR, 飛機 Flight, 自駕 Driving, 火車 Train, 其他 Other
  Default transport: 高鐵 HSR for domestic, 飛機 Flight for international

RULES:
- All dates in YYYY-MM-DD format
- Times in HH:MM 24-hour format
- Calculate days from start_date and end_date (inclusive)
- Calculate hours from start_time and end_time
- If "half day" or "半天" → days = 0.5
- Resolve relative dates: 明天=tomorrow, 下週一=next Monday, etc.
- Leave empty string for unknown optional fields (proxy, project, budget, accommodation)

Respond in JSON ONLY, no markdown, no backticks:
${isAuto ? '{"form_type": "leave"|"overtime"|"business_trip", "form_data": {...}}' : '{"form_data": {...}}'}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.1,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
    });

    const raw = response.choices[0]?.message?.content || "";
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    if (isAuto) {
      return NextResponse.json({
        form_type: parsed.form_type || "leave",
        form_data: parsed.form_data || {},
      });
    } else {
      return NextResponse.json({
        form_type: form_type,
        form_data: parsed.form_data || parsed,
      });
    }
  } catch (err: any) {
    console.error("NLP parse error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
