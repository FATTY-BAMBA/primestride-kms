import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateEmbedding, kMeansClustering } from '@/lib/ai-embeddings';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: NextRequest) {
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
      .select('organization_id, role, email')
      .eq('id', user.id)
      .single();

    // Only admins can generate embeddings
    if (!['admin', 'owner'].includes(profile?.role || '')) {
      return NextResponse.json(
        { error: 'Only admins can generate embeddings' },
        { status: 403 }
      );
    }

    // Get all documents for this organization
    const { data: documents } = await supabase
      .from('documents')
      .select('doc_id, title, content, organization_id')
      .eq('organization_id', profile.organization_id);

    if (!documents || documents.length === 0) {
      return NextResponse.json(
        { error: 'No documents found' },
        { status: 404 }
      );
    }

    let processed = 0;
    let errors = 0;

    // Generate embeddings for each document
    for (const doc of documents) {
      try {
        // Skip if no content
        if (!doc.content || doc.content.trim().length === 0) {
          console.log(`Skipping ${doc.doc_id} - no content`);
          continue;
        }

        // Combine title and content for better embeddings
        const text = `${doc.title}\n\n${doc.content}`;

        // Generate embedding
        const embedding = await generateEmbedding(text);

        // Store in database (upsert)
        await supabase
          .from('document_embeddings')
          .upsert({
            doc_id: doc.doc_id,
            organization_id: doc.organization_id,
            embedding: JSON.stringify(embedding),
          }, {
            onConflict: 'doc_id,organization_id'
          });

        processed++;
        console.log(`✅ Processed ${doc.doc_id}`);
      } catch (error) {
        console.error(`Error processing ${doc.doc_id}:`, error);
        errors++;
      }
    }

    // Generate AI cluster names
    try {
      console.log('🤖 Generating AI cluster names...');
      
      // Get all embeddings to perform clustering
      const { data: embeddings } = await supabase
        .from('document_embeddings')
        .select('doc_id, embedding')
        .eq('organization_id', profile.organization_id);

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
            .from('documents')
            .select('title')
            .in('doc_id', docIds);

          const titles = clusterDocs?.map(d => d.title).join(', ') || '';

          // Ask GPT to name the cluster
          const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'You are a categorization expert. Given a list of document titles, generate a short, descriptive category name (2-4 words max) that captures the main theme. Respond with ONLY the category name, nothing else.'
              },
              {
                role: 'user',
                content: `Documents: ${titles}`
              }
            ],
            max_tokens: 20,
            temperature: 0.3,
          });

          const clusterName = completion.choices[0].message.content?.trim() || `Cluster ${clusterIdx + 1}`;

          // Store cluster name (upsert)
          await supabase
            .from('cluster_names')
            .upsert({
              organization_id: profile.organization_id,
              cluster_index: clusterIdx,
              cluster_name: clusterName,
            }, {
              onConflict: 'organization_id,cluster_index'
            });

          console.log(`✅ Cluster ${clusterIdx}: "${clusterName}" (${docIds.length} docs)`);
        }
      }
    } catch (error) {
      console.error('⚠️ Failed to generate cluster names:', error);
      // Don't fail the whole request if cluster naming fails
    }

    return NextResponse.json({
      success: true,
      processed,
      errors,
      total: documents.length,
      message: `Generated embeddings for ${processed} documents`,
    });
  } catch (error) {
    console.error('Error generating embeddings:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate embeddings',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}