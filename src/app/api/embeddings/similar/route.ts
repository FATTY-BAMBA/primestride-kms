import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

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

    if (!profile?.organization_id) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Use the optimized database function for similarity search
    // This uses pgvector's ivfflat index - scales to 100k+ documents
    const { data: similar, error } = await supabase.rpc('find_similar_documents', {
      target_doc_id: docId,
      org_id: profile.organization_id,
      match_count: limit,
    });

    if (error) {
      console.error('Similarity search error:', error);
      
      // Fallback to legacy method if pgvector function doesn't exist yet
      if (error.message.includes('function') || error.code === '42883') {
        console.log('Falling back to legacy similarity search...');
        return await legacySimilaritySearch(supabase, docId, profile.organization_id, limit);
      }
      
      return NextResponse.json(
        { error: 'Failed to find similar documents', details: error.message },
        { status: 500 }
      );
    }

    // Transform results to match expected format
    const result = (similar || []).map((doc: { doc_id: string; title: string; doc_type: string | null; similarity: number }) => ({
      doc_id: doc.doc_id,
      title: doc.title,
      doc_type: doc.doc_type,
      similarity: Math.round(doc.similarity * 100), // Convert to percentage
    }));

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

// Legacy fallback for when pgvector isn't set up yet
// This is slow but works - should only be used temporarily
async function legacySimilaritySearch(
  supabase: Awaited<ReturnType<typeof createClient>>,
  docId: string,
  organizationId: string,
  limit: number
) {
  console.warn('Using legacy similarity search - consider running pgvector migration for better performance');

  // Get target document embedding
  const { data: targetEmb } = await supabase
    .from('document_embeddings')
    .select('embedding')
    .eq('doc_id', docId)
    .eq('organization_id', organizationId)
    .single();

  if (!targetEmb) {
    return NextResponse.json({ similar: [] });
  }

  // Get all embeddings (this is the slow part)
  const { data: embeddings } = await supabase
    .from('document_embeddings')
    .select('doc_id, embedding')
    .eq('organization_id', organizationId)
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
    .select('doc_id, title, doc_type')
    .in('doc_id', topSimilar.map((s) => s.doc_id));

  const result = topSimilar.map((sim) => {
    const doc = documents?.find((d) => d.doc_id === sim.doc_id);
    return {
      doc_id: doc?.doc_id || sim.doc_id,
      title: doc?.title || 'Unknown',
      doc_type: doc?.doc_type || null,
      similarity: Math.round(sim.similarity * 100),
    };
  });

  return NextResponse.json({ similar: result });
}

// Cosine similarity for legacy fallback
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