import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getUserOrganization } from "@/lib/get-user-organization";

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
    const debug = searchParams.get("debug") === "true";

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
    const membership = await getUserOrganization(userId);

    if (membershipError || !membership?.organization_id) {
      return NextResponse.json({ 
        error: "Organization not found",
        debug: debug ? { userId, membershipError } : undefined
      }, { status: 404 });
    }

    const organizationId = membership.organization_id;

    // Get target document embedding
    const { data: targetEmb, error: targetError } = await supabase
      .from("document_embeddings")
      .select("embedding")
      .eq("doc_id", docId)
      .eq("organization_id", organizationId)
      .single();

    if (targetError || !targetEmb) {
      if (debug) {
        return NextResponse.json({ 
          similar: [], 
          debug: { 
            message: "Target embedding not found",
            docId,
            organizationId,
            targetError 
          }
        });
      }
      return NextResponse.json({ similar: [] });
    }

    // Get all other embeddings in the organization
    const { data: embeddings, error: embeddingsError } = await supabase
      .from("document_embeddings")
      .select("doc_id, embedding")
      .eq("organization_id", organizationId)
      .neq("doc_id", docId);

    if (embeddingsError || !embeddings || embeddings.length === 0) {
      if (debug) {
        return NextResponse.json({ 
          similar: [], 
          debug: { 
            message: "No other embeddings found",
            organizationId,
            embeddingsError,
            count: embeddings?.length || 0
          }
        });
      }
      return NextResponse.json({ similar: [] });
    }

    // Parse target embedding
    let targetVector: number[];
    try {
      targetVector = typeof targetEmb.embedding === 'string' 
        ? JSON.parse(targetEmb.embedding) 
        : targetEmb.embedding;
    } catch (e) {
      if (debug) {
        return NextResponse.json({ 
          similar: [], 
          debug: { message: "Failed to parse target embedding", error: String(e) }
        });
      }
      return NextResponse.json({ similar: [] });
    }

    // Calculate similarities
    const similarities: { doc_id: string; similarity: number }[] = [];

    for (const emb of embeddings) {
      try {
        const vector = typeof emb.embedding === 'string' 
          ? JSON.parse(emb.embedding) 
          : emb.embedding;
        const score = cosineSimilarity(targetVector, vector);
        similarities.push({
          doc_id: emb.doc_id,
          similarity: score,
        });
      } catch (e) {
        console.error(`Failed to parse embedding for ${emb.doc_id}:`, e);
      }
    }

    // Sort by similarity and take top N
    similarities.sort((a, b) => b.similarity - a.similarity);
    const topSimilar = similarities.slice(0, limit);

    if (topSimilar.length === 0) {
      if (debug) {
        return NextResponse.json({ 
          similar: [], 
          debug: { 
            message: "No similarities calculated",
            embeddingsCount: embeddings.length 
          }
        });
      }
      return NextResponse.json({ similar: [] });
    }

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

    if (debug) {
      return NextResponse.json({ 
        similar: result,
        debug: {
          userId,
          organizationId,
          targetDocId: docId,
          totalEmbeddings: embeddings.length,
          calculatedSimilarities: similarities.length,
          topResults: topSimilar.length
        }
      });
    }

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