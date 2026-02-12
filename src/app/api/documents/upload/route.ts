import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getUserOrganization } from "@/lib/get-user-organization";

export const dynamic = "force-dynamic";

// Create Supabase admin client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization membership
    const membership = await getUserOrganization(userId);

    if (!membership) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    // Only admins and owners can upload
    if (!["owner", "admin"].includes(membership.role || "")) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const docId = formData.get("docId") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!docId) {
      return NextResponse.json({ error: "No document ID provided" }, { status: 400 });
    }

    const fileName = file.name;
    const fileExtension = fileName.split(".").pop()?.toLowerCase();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Determine content type
    const contentTypes: Record<string, string> = {
      pdf: "application/pdf",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      doc: "application/msword",
      txt: "text/plain",
      md: "text/markdown",
    };

    const contentType = contentTypes[fileExtension || ""] || "application/octet-stream";

    // Create a unique file path: org_id/doc_id/filename
    const filePath = `${membership.organization_id}/${docId}/${Date.now()}-${fileName}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("documents")
      .upload(filePath, buffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload file: " + uploadError.message },
        { status: 500 }
      );
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from("documents")
      .getPublicUrl(filePath);

    return NextResponse.json({
      fileUrl: urlData.publicUrl,
      fileName: fileName,
      fileType: fileExtension,
      filePath: filePath,
    });
  } catch (error) {
    console.error("File upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}