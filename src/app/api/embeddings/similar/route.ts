import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cosineSimilarity } from '@/lib/ai-embeddings';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const docId = searchParams.get('docId');
    const limit = parseInt(searchParams.get('limit') || '5');

    if (!docId) {
      return NextResponse.json(
        { error: 'Document ID required' },
        { status: 400 }
      );
    }

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

    // Get target document embedding
    const { data: targetEmb } = await supabase
      .from('document_embeddings')
      .select('embedding')
      .eq('doc_id', docId)
      .eq('organization_id', profile?.organization_id)
      .single();

    if (!targetEmb) {
      return NextResponse.json(
        { error: 'Document embedding not found' },
        { status: 404 }
      );
    }

    // Get all embeddings
    const { data: embeddings } = await supabase
      .from('document_embeddings')
      .select('doc_id, embedding')
      .eq('organization_id', profile?.organization_id)
      .neq('doc_id', docId);

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
      .from('documents')
      .select('doc_id, title, doc_type, domain')
      .in('doc_id', topSimilar.map((s) => s.doc_id));

    const result = topSimilar.map((sim) => {
      const doc = documents?.find((d) => d.doc_id === sim.doc_id);
      return {
        ...doc,
        similarity: Math.round(sim.similarity * 100),
      };
    });

    return NextResponse.json({ similar: result });
  } catch (error) {
    console.error('Error finding similar documents:', error);
    return NextResponse.json(
      {
        error: 'Failed to find similar documents',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}