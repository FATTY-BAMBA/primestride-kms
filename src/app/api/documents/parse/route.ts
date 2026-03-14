import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB hard limit

export async function POST(request: NextRequest) {
  try {
    // Auth check — no anonymous file parsing
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // File size check before processing
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File too large. Maximum size is 10MB. Your file is ${(file.size / 1024 / 1024).toFixed(1)}MB.` },
        { status: 413 }
      );
    }

    const fileName = file.name;
    const fileExtension = fileName.split(".").pop()?.toLowerCase();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let content = "";

    // ── Plain text formats ──
    if (["txt", "md", "csv", "tsv", "json", "xml", "html", "rtf"].includes(fileExtension || "")) {
      content = buffer.toString("utf-8");

      // For RTF, strip RTF control codes to get plain text
      if (fileExtension === "rtf") {
        content = content
          .replace(/\\[a-z]+[-]?\d*\s?/g, "") // Remove RTF control words
          .replace(/[{}]/g, "")                 // Remove braces
          .replace(/\\'[0-9a-f]{2}/gi, "")   // Remove hex escapes
          .replace(/\r\n/g, "\n")
          .trim();
      }

      // For JSON, pretty-print for readability
      if (fileExtension === "json") {
        try {
          const parsed = JSON.parse(content);
          content = JSON.stringify(parsed, null, 2);
        } catch {
          // Keep raw content if not valid JSON
        }
      }

      // For HTML, strip tags but keep text
      if (fileExtension === "html") {
        content = content
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/\s+/g, " ")
          .trim();
      }
    }
    // ── PDF ──
    else if (fileExtension === "pdf") {
      try {
        const { extractText } = await import("unpdf");
        const result = await extractText(new Uint8Array(arrayBuffer));
        content = Array.isArray(result.text) ? result.text.join("\n\n") : result.text;
      } catch (err) {
        console.error("PDF parsing error:", err);
        return NextResponse.json({
          content: "",
          fileName,
          characterCount: 0,
          warning: "Could not extract text from PDF.",
          extractionFailed: true,
          error: String(err),
        });
      }
    }
    // ── Word documents (DOCX/DOC) ──
    else if (fileExtension === "docx" || fileExtension === "doc") {
      try {
        const mammoth = await import("mammoth");
        const result = await mammoth.extractRawText({ buffer });
        content = result.value;
      } catch (err) {
        console.error("DOCX parsing error:", err);
        return NextResponse.json({
          content: "",
          fileName,
          characterCount: 0,
          warning: "Could not extract text from document.",
          extractionFailed: true,
        });
      }
    }
    // ── PowerPoint (PPTX) ──
    else if (fileExtension === "pptx" || fileExtension === "ppt") {
      try {
        // Use JSZip to extract text from PPTX (it's a zip of XML files)
        const JSZip = (await import("jszip")).default;
        const zip = await JSZip.loadAsync(buffer);

        const slideTexts: string[] = [];
        const slideFiles = Object.keys(zip.files)
          .filter(name => name.match(/ppt\/slides\/slide\d+\.xml/))
          .sort((a, b) => {
            const numA = parseInt(a.match(/slide(\d+)/)?.[1] || "0");
            const numB = parseInt(b.match(/slide(\d+)/)?.[1] || "0");
            return numA - numB;
          });

        for (const slidePath of slideFiles) {
          const xml = await zip.files[slidePath].async("text");
          // Extract text content from XML tags
          const texts = xml.match(/<a:t>([^<]*)<\/a:t>/g);
          if (texts) {
            const slideNum = slidePath.match(/slide(\d+)/)?.[1] || "?";
            const slideText = texts
              .map(t => t.replace(/<\/?a:t>/g, ""))
              .join(" ");
            slideTexts.push(`[Slide ${slideNum}]\n${slideText}`);
          }
        }

        content = slideTexts.join("\n\n");
      } catch (err) {
        console.error("PPTX parsing error:", err);
        return NextResponse.json({
          content: "",
          fileName,
          characterCount: 0,
          warning: "Could not extract text from presentation.",
          extractionFailed: true,
        });
      }
    }
    // ── Excel (XLSX/XLS) ──
    else if (fileExtension === "xlsx" || fileExtension === "xls") {
      try {
        const XLSX = await import("xlsx");
        const workbook = XLSX.read(buffer, { type: "buffer" });

        const sheetTexts: string[] = [];
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const csv = XLSX.utils.sheet_to_csv(sheet);
          if (csv.trim()) {
            sheetTexts.push(`[Sheet: ${sheetName}]\n${csv}`);
          }
        }

        content = sheetTexts.join("\n\n");
      } catch (err) {
        console.error("XLSX parsing error:", err);
        return NextResponse.json({
          content: "",
          fileName,
          characterCount: 0,
          warning: "Could not extract text from spreadsheet.",
          extractionFailed: true,
        });
      }
    }
    // ── Unsupported ──
    else {
      return NextResponse.json(
        { error: `Unsupported file type: .${fileExtension}. Supported: PDF, DOCX, DOC, PPTX, XLSX, CSV, TXT, MD, RTF, JSON, XML, HTML` },
        { status: 400 }
      );
    }

    // Clean up content
    content = content
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return NextResponse.json({
      content,
      fileName,
      characterCount: content.length,
      extractionFailed: !content,
    });
  } catch (error) {
    console.error("File parse error:", error);
    return NextResponse.json(
      { error: "Failed to process file: " + (error as Error).message },
      { status: 500 }
    );
  }
}