import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { generateEmbedding, kMeansClustering } from "@/lib/ai-embeddings";
import OpenAI from "openai";
import { getUserOrganization } from "@/lib/get-user-organization";

export const dynamic = "force-dynamic";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Create Supabase admin client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Rate limit settings
const MAX_REFRESHES_PER_USER_PER_DAY = 3;
const MAX_DOCS_PER_ORG_PER_DAY = 500;
const EMBEDDING_COOLDOWN_HOURS = 24;

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization membership
    const membership = await getUserOrganization(userId);

    if (!membership) {
      return NextResponse.json(
        { error: "No organization found" },
        { status: 400 }
      );
    }

    // Only admins can generate embeddings
    if (!["admin", "owner"].includes(membership.role)) {
      return NextResponse.json(
        { error: "Only admins can generate embeddings" },
        { status: 403 }
      );
    }

    // ============ RATE LIMITING ============

    // Check user's refresh count in last 24 hours
    const { data: userRefreshes } = await supabase
      .from("graph_refresh_log")
      .select("id")
      .eq("organization_id", membership.organization_id)
      .eq("user_id", userId)
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const userRefreshCount = userRefreshes?.length || 0;

    if (userRefreshCount >= MAX_REFRESHES_PER_USER_PER_DAY) {
      return NextResponse.json(
        { 
          error: `Rate limit exceeded. You can only refresh the graph ${MAX_REFRESHES_PER_USER_PER_DAY} times per day.`,
          retryAfter: "24 hours",
          refreshesUsed: userRefreshCount,
          refreshesAllowed: MAX_REFRESHES_PER_USER_PER_DAY,
        },
        { status: 429 }
      );
    }

    // Check org's total docs processed in last 24 hours
    const { data: orgRefreshes } = await supabase
      .from("graph_refresh_log")
      .select("docs_processed")
      .eq("organization_id", membership.organization_id)
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const orgDocsProcessed = orgRefreshes?.reduce((sum, r) => sum + (r.docs_processed || 0), 0) || 0;

    if (orgDocsProcessed >= MAX_DOCS_PER_ORG_PER_DAY) {
      return NextResponse.json(
        { 
          error: `Organization budget exceeded. Max ${MAX_DOCS_PER_ORG_PER_DAY} documents can be processed per day.`,
          retryAfter: "24 hours",
          docsProcessed: orgDocsProcessed,
          docsAllowed: MAX_DOCS_PER_ORG_PER_DAY,
        },
        { status: 429 }
      );
    }

    // ============ GET DOCUMENTS ============

    // Get all documents for this organization
    const { data: documents } = await supabase
      .from("documents")
      .select("doc_id, title, content, organization_id")
      .eq("organization_id", membership.organization_id);

    if (!documents || documents.length === 0) {
      return NextResponse.json(
        { error: "No documents found" },
        { status: 404 }
      );
    }

    // Check remaining budget
    const remainingBudget = MAX_DOCS_PER_ORG_PER_DAY - orgDocsProcessed;
    const docsToProcess = Math.min(documents.length, remainingBudget);

    if (docsToProcess < documents.length) {
      console.log(`⚠️ Budget limit: processing ${docsToProcess} of ${documents.length} docs`);
    }

    // ============ COOLDOWN CHECK ============
    // Get existing embeddings to check cooldown
    const { data: existingEmbeddings } = await supabase
      .from("document_embeddings")
      .select("doc_id, last_generated_at")
      .eq("organization_id", membership.organization_id);

    const embeddingMap = new Map(
      existingEmbeddings?.map((e) => [e.doc_id, e.last_generated_at])
    );

    const cooldownThreshold = new Date(Date.now() - EMBEDDING_COOLDOWN_HOURS * 60 * 60 * 1000);

    let processed = 0;
    let skippedCooldown = 0;
    let skippedNoContent = 0;
    let errors = 0;

    // ============ GENERATE EMBEDDINGS ============
    for (const doc of documents.slice(0, docsToProcess)) {
      try {
        // Skip if no content
        if (!doc.content || doc.content.trim().length === 0) {
          console.log(`Skipping ${doc.doc_id} - no content`);
          skippedNoContent++;
          continue;
        }

        // Check cooldown (skip if recently generated)
        const lastGenerated = embeddingMap.get(doc.doc_id);
        if (lastGenerated && new Date(lastGenerated) > cooldownThreshold) {
          console.log(`Skipping ${doc.doc_id} - cooldown (generated ${lastGenerated})`);
          skippedCooldown++;
          continue;
        }

        // Combine title and content for better embeddings
        const text = `${doc.title}\n\n${doc.content}`;

        // Generate embedding
        const embedding = await generateEmbedding(text);

        // Store in database (upsert)
        await supabase
          .from("document_embeddings")
          .upsert({
            doc_id: doc.doc_id,
            organization_id: doc.organization_id,
            embedding: JSON.stringify(embedding),
            last_generated_at: new Date().toISOString(),
          }, {
            onConflict: "doc_id,organization_id"
          });

        processed++;
        console.log(`✅ Processed ${doc.doc_id}`);
      } catch (error) {
        console.error(`Error processing ${doc.doc_id}:`, error);
        errors++;
      }
    }

    // ============ GENERATE CLUSTER NAMES ============
    try {
      console.log("🤖 Generating AI cluster names...");
      
      // Get all embeddings to perform clustering
      const { data: embeddings } = await supabase
        .from("document_embeddings")
        .select("doc_id, embedding")
        .eq("organization_id", membership.organization_id);

      if (embeddings && embeddings.length > 0) {
        // Parse embeddings
        const parsedEmbeddings = embeddings.map((e) => ({
          id: e.doc_id,
          embedding: JSON.parse(e.embedding as string),
        }));

        // Perform clustering (adjust k based on number of documents)
        const k = Math.min(5, Math.max(2, Math.floor(parsedEmbeddings.length / 3)));
        const { clusters } = kMeansClustering(parsedEmbeddings, k);

        // Generate name for each cluster
        for (const [clusterIdx, docIds] of clusters.entries()) {
          if (docIds.length === 0) continue;

          // Get document titles in this cluster
          const { data: clusterDocs } = await supabase
            .from("documents")
            .select("title")
            .in("doc_id", docIds);

          const titles = clusterDocs?.map(d => d.title).join(", ") || "";

          // Ask GPT to name the cluster
          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: "You are a categorization expert. Given a list of document titles, generate a short, descriptive category name (2-4 words max) that captures the main theme. Respond with ONLY the category name, nothing else."
              },
              {
                role: "user",
                content: `Documents: ${titles}`
              }
            ],
            max_tokens: 20,
            temperature: 0.3,
          });

          const clusterName = completion.choices[0].message.content?.trim() || `Cluster ${clusterIdx + 1}`;

          // Store cluster name (upsert)
          await supabase
            .from("cluster_names")
            .upsert({
              organization_id: membership.organization_id,
              cluster_index: clusterIdx,
              cluster_name: clusterName,
            }, {
              onConflict: "organization_id,cluster_index"
            });

          console.log(`✅ Cluster ${clusterIdx}: "${clusterName}" (${docIds.length} docs)`);
        }
      }
    } catch (error) {
      console.error("⚠️ Failed to generate cluster names:", error);
      // Don't fail the whole request if cluster naming fails
    }

    // ============ LOG REFRESH & UPDATE METADATA ============
    
    // Log this refresh for rate limiting
    await supabase
      .from("graph_refresh_log")
      .insert({
        organization_id: membership.organization_id,
        user_id: userId,
        docs_processed: processed,
      });

    // Update graph metadata
    await supabase
      .from("graph_metadata")
      .upsert({
        organization_id: membership.organization_id,
        last_full_refresh: new Date().toISOString(),
        last_refresh_by: userId,
        total_docs_in_graph: processed + skippedCooldown,
      }, {
        onConflict: "organization_id"
      });

    // ============ RESPONSE ============
    return NextResponse.json({
      success: true,
      processed,
      skippedCooldown,
      skippedNoContent,
      errors,
      total: documents.length,
      message: `Generated embeddings for ${processed} documents`,
      rateLimits: {
        userRefreshesRemaining: MAX_REFRESHES_PER_USER_PER_DAY - userRefreshCount - 1,
        orgBudgetRemaining: remainingBudget - processed,
      },
    });
  } catch (error) {
    console.error("Error generating embeddings:", error);
    return NextResponse.json(
      {
        error: "Failed to generate embeddings",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}