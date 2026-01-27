import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cosineSimilarity, kMeansClustering } from '@/lib/ai-embeddings';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    // Check if profile exists
    if (!profile || !profile.organization_id) {
      return NextResponse.json({
        nodes: [],
        edges: [],
        clusters: {},
        clusterNames: {},
      });
    }

    // Get all embeddings for this organization
    const { data: embeddings } = await supabase
      .from('document_embeddings')
      .select('doc_id, embedding')
      .eq('organization_id', profile.organization_id);

    if (!embeddings || embeddings.length === 0) {
      return NextResponse.json({
        nodes: [],
        edges: [],
        clusters: {},
        clusterNames: {},
      });
    }

    // Get document details
    const { data: documents } = await supabase
      .from('documents')
      .select('doc_id, title')
      .eq('organization_id', profile.organization_id);

    const docMap = new Map(documents?.map((d) => [d.doc_id, d.title]));

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

    // Fetch AI-generated cluster names
    const { data: clusterNames } = await supabase
      .from('cluster_names')
      .select('cluster_index, cluster_name')
      .eq('organization_id', profile.organization_id);

    const clusterNameMap: { [key: number]: string } = {};
    clusterNames?.forEach((cn) => {
      clusterNameMap[cn.cluster_index] = cn.cluster_name;
    });

    return NextResponse.json({
      nodes,
      edges,
      clusters: clusterMap,
      clusterNames: clusterNameMap,
      totalDocuments: nodes.length,
      totalConnections: edges.length,
    });
  } catch (error) {
    console.error('Error getting similarities:', error);
    return NextResponse.json(
      {
        error: 'Failed to get similarities',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}