import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";

// pdf-parse doesn't have proper ESM exports, use require
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse");

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const fileName = file.name;
    const fileExtension = fileName.split(".").pop()?.toLowerCase();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let content = "";

    if (fileExtension === "pdf") {
      // Parse PDF using pdf-parse
      try {
        const pdfData = await pdfParse(buffer);
        content = pdfData.text;
      } catch (err) {
        console.error("PDF parsing error:", err);
        return NextResponse.json(
          { error: "Failed to parse PDF. Make sure it contains readable text." },
          { status: 400 }
        );
      }
    } else if (fileExtension === "docx" || fileExtension === "doc") {
      // Parse DOCX using mammoth
      try {
        const result = await mammoth.extractRawText({ buffer });
        content = result.value;
      } catch (err) {
        console.error("DOCX parsing error:", err);
        return NextResponse.json(
          { error: "Failed to parse DOCX. Make sure it's a valid Word document." },
          { status: 400 }
        );
      }
    } else if (fileExtension === "txt" || fileExtension === "md") {
      // Plain text files
      content = buffer.toString("utf-8");
    } else {
      return NextResponse.json(
        { error: `Unsupported file type: .${fileExtension}` },
        { status: 400 }
      );
    }

    // Clean up the content
    content = content
      .replace(/\r\n/g, "\n") // Normalize line endings
      .replace(/\n{3,}/g, "\n\n") // Remove excessive blank lines
      .trim();

    if (!content) {
      return NextResponse.json(
        { error: "No text content could be extracted from the file" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      content,
      fileName,
      characterCount: content.length,
    });
  } catch (error) {
    console.error("File parse error:", error);
    return NextResponse.json(
      { error: "Failed to process file" },
      { status: 500 }
    );
  }
}