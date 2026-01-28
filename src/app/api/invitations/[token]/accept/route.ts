import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Call the database function to accept invitation
    const { data, error } = await supabase.rpc("accept_invitation", {
      p_token: token,
    });

    if (error) {
      console.error("Accept invitation error:", error);
      return NextResponse.json(
        { error: error.message || "Failed to accept invitation" },
        { status: 400 }
      );
    }

    // The function returns a JSONB object
    const result = data as {
      success: boolean;
      error?: string;
      message?: string;
      organization_id?: string;
      organization_name?: string;
      role?: string;
    };

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to accept invitation" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message || "Successfully joined organization",
      organization_id: result.organization_id,
      organization_name: result.organization_name,
      role: result.role,
    });
  } catch (error) {
    console.error("Error accepting invitation:", error);
    return NextResponse.json(
      { error: "Failed to accept invitation" },
      { status: 500 }
    );
  }
}