import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getUserOrganization } from "@/lib/get-user-organization";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const membership = await getUserOrganization(userId);
    if (!membership) return NextResponse.json({ error: "No organization found" }, { status: 404 });

    const body = await request.json();
    const { projectId, message, history } = body;

    if (!projectId || !message?.trim()) {
      return NextResponse.json({ error: "projectId and message are required" }, { status: 400 });
    }

    // Get project
    const { data: project } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .eq("organization_id", membership.organization_id)
      .single();

    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    // Get project document IDs
    const { data: projectDocs } = await supabase
      .from("project_documents")
      .select("doc_id")
      .eq("project_id", projectId);

    const docIds = (projectDocs || []).map(pd => pd.doc_id);

    if (docIds.length === 0) {
      return NextResponse.json({
        reply: `This project doesn't have any documents yet. Add some documents to the project first, then I can help you analyze and work with them.`,
        sources: [],
      });
    }

    // Get all project documents content
    const { data: docs } = await supabase
      .from("documents")
      .select("doc_id, title, content, summary, doc_type, tags")
      .in("doc_id", docIds);

    if (!docs || docs.length === 0) {
      return NextResponse.json({
        reply: "I couldn't find the documents for this project. They may have been removed.",
        sources: [],
      });
    }

    // Build context from all project documents
    const contextParts = docs.map(d => {
      const content = d.content?.slice(0, 3000) || "";
      return `[Document: ${d.title}] (ID: ${d.doc_id}, Type: ${d.doc_type || "general"})\n${d.summary ? `Summary: ${d.summary}\n` : ""}Content:\n${content}`;
    });

    const context = contextParts.join("\n\n---\n\n");

    // Build chat messages
    const systemPrompt = `You are an AI assistant for the project "${project.name}".${project.description ? ` Project description: ${project.description}` : ""}

You have access to ${docs.length} document(s) in this project. Use them to answer questions accurately.

Rules:
- Answer based on the project documents when possible
- If the answer is in the documents, cite which document it comes from
- If the answer isn't in the documents, say so clearly
- Be helpful, concise, and professional
- Support both English and Traditional Chinese — respond in whichever language the user writes in
- If asked to summarize, analyze, or compare documents, do so thoroughly

Project Documents Context:
${context}`;

    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: systemPrompt },
    ];

    // Add conversation history
    if (history && Array.isArray(history)) {
      for (const h of history.slice(-10)) {
        messages.push({
          role: h.role === "user" ? "user" : "assistant",
          content: h.content,
        });
      }
    }

    messages.push({ role: "user", content: message });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 1500,
      temperature: 0.7,
    });

    const reply = completion.choices[0].message.content || "I couldn't generate a response.";

    // Find which docs were likely referenced
    const sources = docs
      .filter(d => reply.toLowerCase().includes(d.title.toLowerCase().slice(0, 20)) || reply.includes(d.doc_id))
      .map(d => ({ doc_id: d.doc_id, title: d.title }))
      .slice(0, 3);

    return NextResponse.json({ reply, sources });
  } catch (error) {
    console.error("Project chat error:", error);
    return NextResponse.json({ error: "Failed to get AI response" }, { status: 500 });
  }
}
