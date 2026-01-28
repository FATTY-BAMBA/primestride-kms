import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateEmbedding } from '@/lib/ai-embeddings';

export const dynamic = 'force-dynamic';

// Update document
export async function PUT(
  request: NextRequest,
  { params }: { params: { docId: string } }
) {
  try {
    const { title, content, docType } = await request.json();

    if (!title || !content) {
      return NextResponse.json(
        { error: 'Title and content are required' },
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

    // Update document
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        title,
        content,
        doc_type: docType || null,
        updated_at: new Date().toISOString(),
      })
      .eq('doc_id', params.docId)
      .eq('organization_id', profile.organization_id);

    if (updateError) {
      console.error('Error updating document:', updateError);
      return NextResponse.json(
        { error: 'Failed to update document' },
        { status: 500 }
      );
    }

    // Regenerate embedding
    try {
      const text = `${title}\n\n${content}`;
      const embedding = await generateEmbedding(text);

      await supabase
        .from('document_embeddings')
        .upsert(
          {
            doc_id: params.docId,
            organization_id: profile.organization_id,
            embedding: JSON.stringify(embedding),
          },
          {
            onConflict: 'doc_id,organization_id',
          }
        );
    } catch (embError) {
      console.error('Error updating embedding:', embError);
      // Don't fail the request if embedding fails
    }

    return NextResponse.json({
      success: true,
      message: 'Document updated successfully',
    });
  } catch (error) {
    console.error('Error in PUT /api/documents/[docId]:', error);
    return NextResponse.json(
      { error: 'Failed to update document' },
      { status: 500 }
    );
  }
}

// Delete document
export async function DELETE(
  request: NextRequest,
  { params }: { params: { docId: string } }
) {
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
      .select('organization_id, role')
      .eq('id', user.id)
      .single();

    if (!profile || !['owner', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete document (cascade will handle embeddings and feedback)
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('doc_id', params.docId)
      .eq('organization_id', profile.organization_id);

    if (error) {
      console.error('Error deleting document:', error);
      return NextResponse.json(
        { error: 'Failed to delete document' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully',
    });
  } catch (error) {
    console.error('Error in DELETE /api/documents/[docId]:', error);
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    );
  }
}