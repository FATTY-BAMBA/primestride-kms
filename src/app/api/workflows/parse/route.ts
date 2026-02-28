import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getUserOrganization } from "@/lib/get-user-organization";
import OpenAI from "openai";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// POST /api/workflows/parse — NLP parse natural language to form data
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { text, form_type } = body;

    if (!text?.trim()) return NextResponse.json({ error: "Text required" }, { status: 400 });

    const today = new Date().toISOString().split("T")[0];
    const dayOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date().getDay()];

    let parsePrompt = "";

    if (form_type === "leave") {
      parsePrompt = `Parse this leave request into structured data. Today is ${today} (${dayOfWeek}).

Input: "${text}"

Return ONLY valid JSON with these fields:
{
  "leave_type": one of these exact strings: "特休 Annual", "病假 Sick", "事假 Personal", "婚假 Marriage", "喪假 Bereavement", "產假 Maternity", "陪產假 Paternity", "公假 Official",
  "start_date": "YYYY-MM-DD",
  "end_date": "YYYY-MM-DD",
  "days": number (calculate from dates, half days = 0.5),
  "reason": string (extract or generate a brief reason in the same language as input),
  "proxy": string or null
}

CRITICAL Rules:
- leave_type MUST be one of the exact strings listed above
- "明天" = tomorrow from today, "下週一" = next Monday, "下個月" = next month
- "三天" means 3 days, calculate end_date accordingly (include weekdays only if business days implied)
- If half day mentioned, days = 0.5
- If no specific leave type mentioned, default to "事假 Personal"
- If "特休" or "年假" mentioned, use "特休 Annual"
- If "病假" or "生病" mentioned, use "病假 Sick"
- If reason not explicitly stated, infer from context
- Return ONLY JSON, no markdown fences`;
    } else if (form_type === "overtime") {
      parsePrompt = `Parse this overtime request into structured data. Today is ${today} (${dayOfWeek}).

Input: "${text}"

Return ONLY valid JSON:
{
  "date": "YYYY-MM-DD",
  "start_time": "HH:MM" (24-hour format, e.g. "18:00"),
  "end_time": "HH:MM" (24-hour format, e.g. "21:30"),
  "hours": number (calculate: end_time minus start_time, e.g. 3.5),
  "overtime_type": one of these exact strings: "平日加班 Weekday", "假日加班 Holiday", "國定假日 National Holiday",
  "reason": string (in the same language as input),
  "project": string or null
}

CRITICAL Rules:
- start_time and end_time MUST be in "HH:MM" 24-hour format (e.g. "18:00", "21:30")
- overtime_type MUST be one of the exact strings above, NOT a time value
- If user says "加班到九點/九點半", end_time is "21:00"/"21:30" and start_time defaults to "18:00"
- If user says "晚上要加班", start_time defaults to "18:00"
- Always calculate hours = (end_time - start_time) in decimal (e.g. 3.5 hours)
- Weekend dates = "假日加班 Holiday", weekday dates = "平日加班 Weekday"
- If project name is mentioned, extract it
- Return ONLY JSON, no markdown fences`;
    } else if (form_type === "business_trip") {
      parsePrompt = `Parse this business trip request into structured data. Today is ${today} (${dayOfWeek}).

Input: "${text}"

Return ONLY valid JSON:
{
  "destination": string,
  "start_date": "YYYY-MM-DD",
  "end_date": "YYYY-MM-DD",
  "days": number,
  "purpose": string,
  "transport": one of: "高鐵 HSR", "飛機 Flight", "自駕 Driving", "火車 Train", "其他 Other",
  "budget": string or null,
  "accommodation": string or null
}

Rules:
- Infer transport from destination (domestic = 高鐵 HSR, international = 飛機 Flight)
- Calculate days from dates
- Return ONLY JSON, no markdown fences`;
    } else {
      return NextResponse.json({ error: "Unknown form_type" }, { status: 400 });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a form data parser for a Taiwanese HR/ERP system. Parse natural language into structured form data. Always return valid JSON only." },
        { role: "user", content: parsePrompt },
      ],
      max_tokens: 500,
      temperature: 0.1,
    });

    const raw = completion.choices[0].message.content?.trim() || "{}";
    let parsed;
    try {
      parsed = JSON.parse(raw.replace(/```json\n?/g, "").replace(/```/g, "").trim());
    } catch {
      parsed = {};
    }

    return NextResponse.json({ form_data: parsed, original_text: text });
  } catch (error) {
    console.error("Parse error:", error);
    return NextResponse.json({ error: "Failed to parse" }, { status: 500 });
  }
}
