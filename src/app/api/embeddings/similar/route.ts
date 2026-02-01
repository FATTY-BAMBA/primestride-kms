import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Create Supabase admin client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const docId = searchParams.get("docId");
    const limit = parseInt(searchParams.get("limit") || "5");

    if (!docId) {
      return NextResponse.json(
        { error: "Document ID required" },
        { status: 400 }
      );
    }

    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization membership
    const { data: membership } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .single();

    if (!membership?.organization_id) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Try optimized pgvector function first
    const { data: similar, error } = await supabase.rpc("find_similar_documents", {
      target_doc_id: docId,
      org_id: membership.organization_id,
      match_count: limit,
    });

    if (error) {
      console.error("Similarity search error:", error);

      // Fallback to legacy method if pgvector function doesn't exist
      if (error.message.includes("function") || error.code === "42883") {
        console.log("Falling back to legacy similarity search...");
        return await legacySimilaritySearch(docId, membership.organization_id, limit);
      }

      return NextResponse.json(
        { error: "Failed to find similar documents", details: error.message },
        { status: 500 }
      );
    }

    // Transform results
    const result = (similar || []).map((doc: { doc_id: string; title: string; doc_type: string | null; similarity: number }) => ({
      doc_id: doc.doc_id,
      title: doc.title,
      doc_type: doc.doc_type,
      similarity: Math.round(doc.similarity * 100),
    }));

    return NextResponse.json({ similar: result });
  } catch (error) {
    console.error("Error finding similar documents:", error);
    return NextResponse.json(
      {
        error: "Failed to find similar documents",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Legacy fallback when pgvector isn't set up
async function legacySimilaritySearch(
  docId: string,
  organizationId: string,
  limit: number
) {
  // Get target document embedding
  const { data: targetEmb } = await supabase
    .from("document_embeddings")
    .select("embedding")
    .eq("doc_id", docId)
    .eq("organization_id", organizationId)
    .single();

  if (!targetEmb) {
    return NextResponse.json({ similar: [] });
  }

  // Get all embeddings
  const { data: embeddings } = await supabase
    .from("document_embeddings")
    .select("doc_id, embedding")
    .eq("organization_id", organizationId)
    .neq("doc_id", docId);

  if (!embeddings || embeddings.length === 0) {
    return NextResponse.json({ similar: [] });
  }

  const targetVector = JSON.parse(targetEmb.embedding as string);

  // Calculate similarities
  const similarities = embeddings.map((emb) => {
    const vector = JSON.parse(emb.embedding as string);
    const score = cosineSimilarity(targetVector, vector);
    return {
      doc_id: emb.doc_id,
      similarity: score,
    };
  });

  // Sort by similarity and take top N
  similarities.sort((a, b) => b.similarity - a.similarity);
  const topSimilar = similarities.slice(0, limit);

  // Get document details
  const { data: documents } = await supabase
    .from("documents")
    .select("doc_id, title, doc_type")
    .in("doc_id", topSimilar.map((s) => s.doc_id));

  const result = topSimilar.map((sim) => {
    const doc = documents?.find((d) => d.doc_id === sim.doc_id);
    return {
      doc_id: doc?.doc_id || sim.doc_id,
      title: doc?.title || "Unknown",
      doc_type: doc?.doc_type || null,
      similarity: Math.round(sim.similarity * 100),
    };
  });

  return NextResponse.json({ similar: result });
}

// Cosine similarity calculation
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

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