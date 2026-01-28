import { createClient } from '@/lib/supabase/server';

/**
 * Store document embedding using pgvector-optimized function
 * This stores both the legacy text format and the new vector format
 */
export async function storeDocumentEmbedding(
  docId: string,
  organizationId: string,
  embedding: number[],
  model: string = 'text-embedding-3-small'
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    // Try the optimized pgvector function first
    const { error: rpcError } = await supabase.rpc('store_document_embedding', {
      p_doc_id: docId,
      p_organization_id: organizationId,
      p_embedding: embedding,
      p_model: model,
    });

    if (rpcError) {
      // Fallback to direct insert if function doesn't exist
      if (rpcError.message.includes('function') || rpcError.code === '42883') {
        console.log('Falling back to direct embedding insert...');
        return await legacyStoreEmbedding(supabase, docId, organizationId, embedding, model);
      }
      
      console.error('Error storing embedding:', rpcError);
      return { success: false, error: rpcError.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error storing embedding:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Legacy embedding storage for backward compatibility
 */
async function legacyStoreEmbedding(
  supabase: Awaited<ReturnType<typeof createClient>>,
  docId: string,
  organizationId: string,
  embedding: number[],
  model: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('document_embeddings')
    .upsert({
      doc_id: docId,
      organization_id: organizationId,
      embedding: JSON.stringify(embedding),
      model: model,
      created_at: new Date().toISOString(),
    }, {
      onConflict: 'doc_id,organization_id',
    });

  if (error) {
    console.error('Legacy embedding storage error:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Delete document embedding
 */
export async function deleteDocumentEmbedding(
  docId: string,
  organizationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from('document_embeddings')
      .delete()
      .eq('doc_id', docId)
      .eq('organization_id', organizationId);

    if (error) {
      console.error('Error deleting embedding:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error deleting embedding:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Batch store multiple embeddings efficiently
 */
export async function batchStoreEmbeddings(
  embeddings: Array<{
    docId: string;
    organizationId: string;
    embedding: number[];
    model?: string;
  }>
): Promise<{ success: boolean; stored: number; errors: string[] }> {
  const errors: string[] = [];
  let stored = 0;

  // Process in batches of 50 for efficiency
  const batchSize = 50;
  
  for (let i = 0; i < embeddings.length; i += batchSize) {
    const batch = embeddings.slice(i, i + batchSize);
    
    const results = await Promise.all(
      batch.map((item) =>
        storeDocumentEmbedding(
          item.docId,
          item.organizationId,
          item.embedding,
          item.model || 'text-embedding-3-small'
        )
      )
    );

    results.forEach((result, idx) => {
      if (result.success) {
        stored++;
      } else {
        errors.push(`${batch[idx].docId}: ${result.error}`);
      }
    });
  }

  return {
    success: errors.length === 0,
    stored,
    errors,
  };
}