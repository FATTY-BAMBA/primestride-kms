import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getUserOrganization } from "@/lib/get-user-organization";

export const dynamic = "force-dynamic";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Create Supabase admin client
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

    const { message, conversationHistory = [] } = await request.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // Get user's organization membership
    const membership = await getUserOrganization(userId);

    if (!membership?.organization_id) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Step 1: Generate embedding for the user's question
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: message,
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;

    // Step 2: Find similar documents using embeddings
    const { data: embeddings } = await supabase
      .from("document_embeddings")
      .select("doc_id, embedding")
      .eq("organization_id", membership.organization_id);

    if (!embeddings || embeddings.length === 0) {
      return NextResponse.json({
        answer: "I don't have any documents to search through yet. Please add some documents to your knowledge base first.",
        sources: [],
      });
    }

    // Calculate similarities
    const similarities: { doc_id: string; similarity: number }[] = [];
    
    for (const emb of embeddings) {
      const docEmbedding = typeof emb.embedding === "string" 
        ? JSON.parse(emb.embedding) 
        : emb.embedding;
      const similarity = cosineSimilarity(queryEmbedding, docEmbedding);
      similarities.push({ doc_id: emb.doc_id, similarity });
    }

    // Sort by similarity and get top 5 most relevant docs
    similarities.sort((a, b) => b.similarity - a.similarity);
    const topDocs = similarities.slice(0, 5).filter(s => s.similarity > 0.3);

    if (topDocs.length === 0) {
      return NextResponse.json({
        answer: "I couldn't find any relevant documents for your question. Try rephrasing or asking about a different topic.",
        sources: [],
      });
    }

    // Step 3: Fetch the actual document content
    const { data: documents } = await supabase
      .from("documents")
      .select("doc_id, title, content, doc_type")
      .in("doc_id", topDocs.map(d => d.doc_id));

    if (!documents || documents.length === 0) {
      return NextResponse.json({
        answer: "I found some relevant documents but couldn't retrieve their content. Please try again.",
        sources: [],
      });
    }

    // Step 4: Build context from documents
    const context = documents.map((doc, index) => {
      const similarity = topDocs.find(t => t.doc_id === doc.doc_id)?.similarity || 0;
      // Truncate content to avoid token limits
      const truncatedContent = doc.content?.slice(0, 2000) || "No content available";
      return `[Document ${index + 1}: "${doc.title}" (${doc.doc_id})]
${truncatedContent}
---`;
    }).join("\n\n");

    // Step 5: Generate answer using GPT-4
    const systemPrompt = `You are an AI assistant for a knowledge management system called PrimeStride Atlas. 
Your job is to answer questions based ONLY on the provided documents.

Guidelines:
- Answer based on the document content provided
- If the documents don't contain the answer, say "I couldn't find specific information about this in your documents"
- Be concise but thorough
- When citing information, mention which document it came from
- Use a helpful, professional tone
- Format your response with clear paragraphs
- If relevant, suggest related topics the user might want to explore

Documents available:
${context}`;

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.slice(-6).map((msg: { role: string; content: string }) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      { role: "user", content: message },
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 1000,
      temperature: 0.7,
    });

    const answer = completion.choices[0].message.content || "I couldn't generate a response.";

    // Step 6: Format sources
    const sources = documents.map(doc => {
      const similarity = topDocs.find(t => t.doc_id === doc.doc_id)?.similarity || 0;
      return {
        doc_id: doc.doc_id,
        title: doc.title,
        doc_type: doc.doc_type,
        relevance: Math.round(similarity * 100),
      };
    }).sort((a, b) => b.relevance - a.relevance);

    return NextResponse.json({
      answer,
      sources,
    });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json(
      { error: "Failed to process chat message" },
      { status: 500 }
    );
  }
}

// Cosine similarity calculation
function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}