import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getUserOrganization } from "@/lib/get-user-organization";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const membership = await getUserOrganization(userId);
    if (!membership) return NextResponse.json({ error: "No organization found" }, { status: 404 });

    const body = await request.json();
    const { action, text, context, customPrompt } = body;

    if (!action) return NextResponse.json({ error: "Action required" }, { status: 400 });

    // Detect if content is primarily Chinese
    const chineseChars = (text || "").match(/[\u4e00-\u9fff]/g)?.length || 0;
    const totalChars = (text || "").replace(/\s/g, "").length || 1;
    const isChinese = chineseChars / totalChars > 0.3;
    const langHint = isChinese
      ? " IMPORTANT: The content is in Traditional Chinese (繁體中文). Your response MUST be in Traditional Chinese. Do not switch to English or Simplified Chinese."
      : "";

    let systemPrompt = "";
    let userPrompt = "";

    switch (action) {
      case "improve":
        systemPrompt = `You are a professional editor. Improve the writing quality, clarity, and flow while preserving the original meaning.${langHint} Return ONLY the improved text, nothing else.`;
        userPrompt = text;
        break;

      case "fix-grammar":
        systemPrompt = `Fix all grammar, spelling, and punctuation errors. Keep the original meaning and tone.${langHint} Return ONLY the corrected text, nothing else.`;
        userPrompt = text;
        break;

      case "make-shorter":
        systemPrompt = `Condense this text to be more concise while keeping all key information. Remove redundancy and wordiness.${langHint} Return ONLY the shortened text, nothing else.`;
        userPrompt = text;
        break;

      case "make-longer":
        systemPrompt = `Expand this text with more detail, examples, and explanation while maintaining the original tone and purpose.${langHint} Return ONLY the expanded text, nothing else.`;
        userPrompt = text;
        break;

      case "formal":
        systemPrompt = `Rewrite this text in a formal, professional tone suitable for business communication.${langHint} Return ONLY the rewritten text, nothing else.`;
        userPrompt = text;
        break;

      case "casual":
        systemPrompt = `Rewrite this text in a casual, friendly tone while keeping the same information.${langHint} Return ONLY the rewritten text, nothing else.`;
        userPrompt = text;
        break;

      case "technical":
        systemPrompt = `Rewrite this text in a precise, technical tone with accurate terminology.${langHint} Return ONLY the rewritten text, nothing else.`;
        userPrompt = text;
        break;

      case "translate-en":
        systemPrompt = "Translate this text to English. Maintain the original formatting and structure. Return ONLY the translated text, nothing else.";
        userPrompt = text;
        break;

      case "translate-zh":
        systemPrompt = "Translate this text to Traditional Chinese (繁體中文). Maintain the original formatting and structure. Return ONLY the translated text, nothing else.";
        userPrompt = text;
        break;

      case "summarize":
        systemPrompt = `Summarize this text into a brief, clear summary capturing all key points.${langHint} Return ONLY the summary, nothing else.`;
        userPrompt = text;
        break;

      case "bullet-points":
        systemPrompt = `Convert this text into clear, organized bullet points.${langHint} Return ONLY the bullet points, nothing else.`;
        userPrompt = text;
        break;

      case "generate":
        systemPrompt = `You are a helpful writing assistant. Generate content based on the user's prompt.${context ? ` Context from the document: ${context.slice(0, 1000)}` : ""}${langHint} Return ONLY the generated content, nothing else.`;
        userPrompt = customPrompt || text;
        break;

      case "custom":
        systemPrompt = `You are a helpful writing assistant. Follow the user's instruction to modify or create text.${langHint} Return ONLY the result, nothing else.`;
        userPrompt = `Instruction: ${customPrompt}\n\nText to modify:\n${text}`;
        break;

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 2000,
      temperature: 0.7,
    });

    const result = completion.choices[0].message.content?.trim() || "";

    return NextResponse.json({ result });
  } catch (error) {
    console.error("Writing assistant error:", error);
    return NextResponse.json({ error: "Failed to process" }, { status: 500 });
  }
}
