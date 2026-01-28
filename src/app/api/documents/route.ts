import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateEmbedding } from '@/lib/ai-embeddings';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { docId, title, content, docType } = await request.json();

    if (!docId || !title || !content) {
      return NextResponse.json(
        { error: 'Document ID, title, and content are required' },
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
      .select('organization_id, role')
      .eq('id', user.id)
      .single();

    if (!profile || !['owner', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if document ID already exists
    const { data: existing } = await supabase
      .from('documents')
      .select('doc_id')
      .eq('doc_id', docId)
      .eq('organization_id', profile.organization_id)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Document ID already exists' },
        { status: 400 }
      );
    }

    // Create document
    const { error: insertError } = await supabase.from('documents').insert({
      doc_id: docId,
      title,
      content,
      doc_type: docType || null,
      organization_id: profile.organization_id,
      current_version: 'v1',
      status: 'published',
    });

    if (insertError) {
      console.error('Error creating document:', insertError);
      return NextResponse.json(
        { error: 'Failed to create document' },
        { status: 500 }
      );
    }

    // Generate embedding
    try {
      const text = `${title}\n\n${content}`;
      const embedding = await generateEmbedding(text);

      await supabase.from('document_embeddings').insert({
        doc_id: docId,
        organization_id: profile.organization_id,
        embedding: JSON.stringify(embedding),
      });
    } catch (embError) {
      console.error('Error creating embedding:', embError);
      // Don't fail the request if embedding fails
    }

    return NextResponse.json({
      success: true,
      docId,
      message: 'Document created successfully',
    });
  } catch (error) {
    console.error('Error in POST /api/documents:', error);
    return NextResponse.json(
      { error: 'Failed to create document' },
      { status: 500 }
    );
  }
}