import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { docId, isHelpful } = await request.json();

    if (!docId || typeof isHelpful !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid request data' },
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
      return NextResponse.json({ error: 'Profile not found' }, { status: 400 });
    }

    // Check if user already gave feedback for this document
    const { data: existingFeedback } = await supabase
      .from('feedback')
      .select('id')
      .eq('doc_id', docId)
      .eq('user_id', user.id)
      .single();

    if (existingFeedback) {
      // Update existing feedback
      const { error } = await supabase
        .from('feedback')
        .update({ is_helpful: isHelpful, created_at: new Date().toISOString() })
        .eq('id', existingFeedback.id);

      if (error) {
        console.error('Error updating feedback:', error);
        return NextResponse.json({ error: 'Failed to update feedback' }, { status: 500 });
      }
    } else {
      // Insert new feedback
      const { error } = await supabase
        .from('feedback')
        .insert({
          doc_id: docId,
          user_id: user.id,
          organization_id: profile.organization_id,
          is_helpful: isHelpful,
        });

      if (error) {
        console.error('Error inserting feedback:', error);
        return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Feedback submitted successfully',
    });
  } catch (error) {
    console.error('Error in feedback API:', error);
    return NextResponse.json(
      { error: 'Failed to submit feedback' },
      { status: 500 }
    );
  }
}