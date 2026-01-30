import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Create Supabase admin client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { docId, isHelpful } = await request.json();

    if (!docId || typeof isHelpful !== "boolean") {
      return NextResponse.json(
        { error: "Invalid request data" },
        { status: 400 }
      );
    }

    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization membership
    const { data: membership } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .single();

    if (!membership?.organization_id) {
      return NextResponse.json({ error: "No organization found" }, { status: 400 });
    }

    // Check if user already gave feedback for this document
    const { data: existingFeedback } = await supabase
      .from("feedback")
      .select("id")
      .eq("doc_id", docId)
      .eq("user_id", userId)
      .single();

    if (existingFeedback) {
      // Update existing feedback
      const { error } = await supabase
        .from("feedback")
        .update({ is_helpful: isHelpful, created_at: new Date().toISOString() })
        .eq("id", existingFeedback.id);

      if (error) {
        console.error("Error updating feedback:", error);
        return NextResponse.json({ error: "Failed to update feedback" }, { status: 500 });
      }
    } else {
      // Insert new feedback
      const { error } = await supabase
        .from("feedback")
        .insert({
          doc_id: docId,
          user_id: userId,
          organization_id: membership.organization_id,
          is_helpful: isHelpful,
        });

      if (error) {
        console.error("Error inserting feedback:", error);
        return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Feedback submitted successfully",
    });
  } catch (error) {
    console.error("Error in feedback API:", error);
    return NextResponse.json(
      { error: "Failed to submit feedback" },
      { status: 500 }
    );
  }
}