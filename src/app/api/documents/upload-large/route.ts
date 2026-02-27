import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getUserOrganization } from "@/lib/get-user-organization";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Use service role key to bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// This endpoint receives the file as base64 in JSON body
// to work around Vercel's 4.5MB FormData limit
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const membership = await getUserOrganization(userId);
    if (!membership) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    if (!["owner", "admin"].includes(membership.role || "")) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    // Get a signed upload URL for the client to upload directly
    const body = await request.json();
    const { fileName, contentType } = body;

    if (!fileName) {
      return NextResponse.json({ error: "fileName is required" }, { status: 400 });
    }

    const timestamp = Date.now();
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `${membership.organization_id}/uploads/${timestamp}-${safeName}`;

    // Create a signed upload URL so the client can upload directly
    const { data: signedData, error: signedError } = await supabase.storage
      .from("documents")
      .createSignedUploadUrl(filePath);

    if (signedError) {
      console.error("Signed URL error:", signedError);

      // Fallback: try uploading an empty placeholder and return public URL
      // The client will use the public URL pattern
      const { data: urlData } = supabase.storage
        .from("documents")
        .getPublicUrl(filePath);

      return NextResponse.json({
        filePath,
        fileUrl: urlData.publicUrl,
        fileName,
        fileType: fileName.split(".").pop()?.toLowerCase(),
        uploadMethod: "direct",
        signedUrl: null,
        token: null,
      });
    }

    const { data: urlData } = supabase.storage
      .from("documents")
      .getPublicUrl(filePath);

    return NextResponse.json({
      filePath,
      fileUrl: urlData.publicUrl,
      fileName,
      fileType: fileName.split(".").pop()?.toLowerCase(),
      signedUrl: signedData.signedUrl,
      token: signedData.token,
      uploadMethod: "signed",
    });
  } catch (error) {
    console.error("Large upload error:", error);
    return NextResponse.json(
      { error: "Failed to prepare upload" },
      { status: 500 }
    );
  }
}
