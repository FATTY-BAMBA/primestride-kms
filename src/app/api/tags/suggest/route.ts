import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getUserOrganization } from "@/lib/get-user-organization";

export const dynamic = "force-dynamic";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user belongs to an organization
    const membership = await getUserOrganization(userId);

    if (!membership) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    const { title, content, docType } = await request.json();

    if (!title && !content) {
      return NextResponse.json({ error: "Title or content required" }, { status: 400 });
    }

    // Get existing tags from organization's documents for context
    const { data: existingDocs } = await supabase
      .from("documents")
      .select("tags")
      .eq("organization_id", membership.organization_id)
      .not("tags", "is", null);

    const existingTags = new Set<string>();
    existingDocs?.forEach((doc) => {
      if (Array.isArray(doc.tags)) {
        doc.tags.forEach((t: string) => existingTags.add(t));
      }
    });

    const existingTagsList = Array.from(existingTags).slice(0, 30).join(", ");

    console.log(`🏷️ Generating tag suggestions for: "${title}"`);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a document tagging assistant. Suggest 3-5 relevant, concise tags for the given document.

Rules:
- Tags should be lowercase, single words or short hyphenated phrases
- Tags should describe the topic, purpose, or category
- Be specific and useful for filtering/searching
- Prefer reusing existing tags when they fit well
- Return ONLY a JSON array of strings, nothing else

${existingTagsList ? `Existing tags in use: ${existingTagsList}` : ""}`,
        },
        {
          role: "user",
          content: `Title: ${title || "Untitled"}\nType: ${docType || "general"}\n\nContent:\n${(content || "").slice(0, 2000)}`,
        },
      ],
      max_tokens: 100,
      temperature: 0.5,
    });

    const raw = completion.choices[0].message.content?.trim() || "[]";

    // Parse the response - handle potential markdown fences
    let tags: string[] = [];
    try {
      const cleaned = raw.replace(/```json\s*|```\s*/g, "").trim();
      tags = JSON.parse(cleaned);
      if (!Array.isArray(tags)) tags = [];
      // Sanitize tags
      tags = tags
        .map((t) => String(t).toLowerCase().trim().replace(/[^a-z0-9-]/g, ""))
        .filter((t) => t.length > 0 && t.length <= 30)
        .slice(0, 5);
    } catch {
      console.error("Failed to parse tags:", raw);
      tags = [];
    }

    console.log(`✅ Suggested tags:`, tags);

    return NextResponse.json({ tags });
  } catch (error) {
    console.error("Tag suggestion error:", error);
    return NextResponse.json(
      { error: "Failed to suggest tags" },
      { status: 500 }
    );
  }
}