import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getUserOrganization } from "@/lib/get-user-organization";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

    const membership = await getUserOrganization(userId);
    if (!membership) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    if (!["owner", "admin"].includes(membership.role || "")) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const docId = formData.get("docId") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Use docId or generate a timestamp-based one for auto mode
    const effectiveDocId = (!docId || docId === "auto") 
      ? `upload-${Date.now()}` 
      : docId;

    const fileName = file.name;
    const fileExtension = fileName.split(".").pop()?.toLowerCase();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const contentTypes: Record<string, string> = {
      pdf: "application/pdf",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      doc: "application/msword",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ppt: "application/vnd.ms-powerpoint",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      xls: "application/vnd.ms-excel",
      csv: "text/csv",
      tsv: "text/tab-separated-values",
      txt: "text/plain",
      md: "text/markdown",
      rtf: "application/rtf",
      json: "application/json",
      xml: "application/xml",
      html: "text/html",
    };

    const contentType = contentTypes[fileExtension || ""] || "application/octet-stream";
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `${membership.organization_id}/${effectiveDocId}/${Date.now()}-${safeName}`;

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

    const { data: urlData } = supabase.storage
      .from("documents")
      .getPublicUrl(filePath);

    return NextResponse.json({
      fileUrl: urlData.publicUrl,
      fileName,
      fileType: fileExtension,
      filePath,
    });
  } catch (error) {
    console.error("File upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
