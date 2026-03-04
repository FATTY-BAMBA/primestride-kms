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

// ── Text extraction helpers ──

/**
 * Extract text from a PDF buffer using pdf-parse.
 * Falls back to empty string if extraction fails.
 */
async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pdfParse = require("pdf-parse");
    const data = await pdfParse(buffer);
    return data.text?.trim() || "";
  } catch (error) {
    console.error("PDF text extraction failed:", error);
    return "";
  }
}

/**
 * Extract text from a DOCX buffer.
 * DOCX is a ZIP of XML files — we pull text from word/document.xml.
 */
async function extractDocxText(buffer: Buffer): Promise<string> {
  try {
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(buffer);
    const docXml = await zip.file("word/document.xml")?.async("string");
    if (!docXml) return "";

    // Strip XML tags, decode entities, clean whitespace
    const text = docXml
      .replace(/<w:p[^>]*>/g, "\n")  // Paragraph breaks
      .replace(/<w:tab\/>/g, "\t")   // Tabs
      .replace(/<[^>]+>/g, "")       // Strip all XML tags
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/\n{3,}/g, "\n\n")    // Collapse excessive newlines
      .trim();

    return text;
  } catch (error) {
    console.error("DOCX text extraction failed:", error);
    return "";
  }
}

/**
 * Extract text based on file extension.
 */
async function extractText(buffer: Buffer, extension: string): Promise<string> {
  switch (extension) {
    case "pdf":
      return extractPdfText(buffer);

    case "docx":
      return extractDocxText(buffer);

    case "txt":
    case "md":
    case "csv":
    case "tsv":
    case "json":
    case "xml":
    case "html":
    case "rtf":
      // Plain text formats — just decode as UTF-8
      return buffer.toString("utf-8").trim();

    case "doc":
    case "pptx":
    case "ppt":
    case "xlsx":
    case "xls":
      // Binary Office formats — not supported for extraction yet
      // Could add mammoth (doc), pptx-parser, etc. later
      console.log(`⚠️ Text extraction not supported for .${extension} files yet`);
      return "";

    default:
      return "";
  }
}

// ── Main upload handler ──

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
    const fileExtension = fileName.split(".").pop()?.toLowerCase() || "";
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // ── Step 1: Extract text from the file ──
    console.log(`📄 Extracting text from ${fileName} (.${fileExtension})...`);
    const extractedText = await extractText(buffer, fileExtension);
    const textLength = extractedText.length;
    console.log(`✅ Extracted ${textLength} characters from ${fileName}`);

    // ── Step 2: Upload file to Supabase Storage ──
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

    const contentType = contentTypes[fileExtension] || "application/octet-stream";
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

    // ── Step 3: Return file URL + extracted text ──
    return NextResponse.json({
      fileUrl: urlData.publicUrl,
      fileName,
      fileType: fileExtension,
      filePath,
      // NEW: extracted text content for the document record
      extractedText: extractedText || null,
      extractedTextLength: textLength,
    });
  } catch (error) {
    console.error("File upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}