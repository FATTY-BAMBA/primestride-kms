import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { cosineSimilarity, kMeansClustering } from "@/lib/ai-embeddings";

export const dynamic = "force-dynamic";

// Create Supabase admin client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization membership
    const { data: membership } = await supabase
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", userId)
      .eq("is_active", true)
      .single();

    if (!membership) {
      return NextResponse.json({
        nodes: [],
        edges: [],
        clusters: {},
        clusterNames: {},
      });
    }

    const isAdmin = ["owner", "admin"].includes(membership.role);

    // Get graph metadata (last updated info)
    const { data: graphMeta } = await supabase
      .from("graph_metadata")
      .select("last_full_refresh, total_docs_in_graph")
      .eq("organization_id", membership.organization_id)
      .single();

    // Get user's team memberships (for access control)
    let userTeamIds: string[] = [];
    if (!isAdmin) {
      const { data: teamMemberships } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", userId);

      userTeamIds = teamMemberships?.map((tm) => tm.team_id) || [];
    }

    // Build document query based on access
    let documentsQuery = supabase
      .from("documents")
      .select("doc_id, title, team_id")
      .eq("organization_id", membership.organization_id);

    // For non-admins, filter to accessible documents only
    // Accessible = org-wide (team_id IS NULL) OR in user's teams
    if (!isAdmin) {
      if (userTeamIds.length > 0) {
        // Can see org-wide docs OR docs in their teams
        documentsQuery = documentsQuery.or(
          `team_id.is.null,team_id.in.(${userTeamIds.join(",")})`
        );
      } else {
        // Can only see org-wide docs
        documentsQuery = documentsQuery.is("team_id", null);
      }
    }

    const { data: documents } = await documentsQuery;

    if (!documents || documents.length === 0) {
      return NextResponse.json({
        nodes: [],
        edges: [],
        clusters: {},
        clusterNames: {},
        totalDocuments: 0,
        totalConnections: 0,
        accessLevel: isAdmin ? "admin" : "member",
        lastUpdated: graphMeta?.last_full_refresh || null,
      });
    }

    // Get accessible doc IDs for filtering embeddings
    const accessibleDocIds = documents.map((d) => d.doc_id);
    const docMap = new Map(documents.map((d) => [d.doc_id, d.title]));

    // Get embeddings only for accessible documents
    const { data: embeddings } = await supabase
      .from("document_embeddings")
      .select("doc_id, embedding")
      .eq("organization_id", membership.organization_id)
      .in("doc_id", accessibleDocIds);

    if (!embeddings || embeddings.length === 0) {
      return NextResponse.json({
        nodes: [],
        edges: [],
        clusters: {},
        clusterNames: {},
        totalDocuments: 0,
        totalConnections: 0,
        accessLevel: isAdmin ? "admin" : "member",
        lastUpdated: graphMeta?.last_full_refresh || null,
      });
    }

    // Parse embeddings
    const parsedEmbeddings = embeddings.map((e) => ({
      id: e.doc_id,
      embedding: JSON.parse(e.embedding as string),
    }));

    // Calculate similarities
    const nodes: any[] = [];
    const edges: any[] = [];

    parsedEmbeddings.forEach((item, i) => {
      nodes.push({
        id: item.id,
        label: docMap.get(item.id) || item.id,
      });

      // Find top 3 most similar documents
      const similarities: { id: string; score: number }[] = [];

      parsedEmbeddings.forEach((other, j) => {
        if (i !== j) {
          const score = cosineSimilarity(item.embedding, other.embedding);
          similarities.push({ id: other.id, score });
        }
      });

      similarities.sort((a, b) => b.score - a.score);

      // Add edges for top 3 similarities (threshold: 0.5)
      // IMPORTANT: Both endpoints are already filtered to accessible docs,
      // so no need for additional edge filtering
      similarities.slice(0, 3).forEach((sim) => {
        if (sim.score > 0.5) {
          edges.push({
            source: item.id,
            target: sim.id,
            strength: sim.score,
          });
        }
      });
    });

    // Perform clustering (dynamic k based on document count)
    const k = Math.min(5, Math.max(2, Math.floor(parsedEmbeddings.length / 3)));
    const { clusters } = kMeansClustering(parsedEmbeddings, k);

    const clusterMap: { [key: string]: number } = {};
    clusters.forEach((docIds, clusterIdx) => {
      docIds.forEach((docId) => {
        clusterMap[docId] = clusterIdx;
      });
    });

    // Fetch AI-generated cluster names (if table exists)
    let clusterNameMap: { [key: number]: string } = {};
    try {
      const { data: clusterNames } = await supabase
        .from("cluster_names")
        .select("cluster_index, cluster_name")
        .eq("organization_id", membership.organization_id);

      clusterNames?.forEach((cn) => {
        clusterNameMap[cn.cluster_index] = cn.cluster_name;
      });
    } catch (e) {
      // cluster_names table may not exist yet
      console.log("cluster_names table not found, using defaults");
    }

    return NextResponse.json({
      nodes,
      edges,
      clusters: clusterMap,
      clusterNames: clusterNameMap,
      totalDocuments: nodes.length,
      totalConnections: edges.length,
      accessLevel: isAdmin ? "admin" : "member",
      lastUpdated: graphMeta?.last_full_refresh || null,
    });
  } catch (error) {
    console.error("Error getting similarities:", error);
    return NextResponse.json(
      {
        error: "Failed to get similarities",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}