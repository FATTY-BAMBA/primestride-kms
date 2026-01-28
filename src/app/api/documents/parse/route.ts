import { NextRequest, NextResponse } from "next/server";

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

    // Handle plain text files directly (no external libraries needed)
    if (fileExtension === "txt" || fileExtension === "md") {
      content = buffer.toString("utf-8");
    } 
    // Handle PDF
    else if (fileExtension === "pdf") {
      try {
        // Use the lib path directly to avoid test file issues on Vercel
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pdfParse = require("pdf-parse/lib/pdf-parse");
        const pdfData = await pdfParse(buffer);
        content = pdfData.text;
      } catch (err) {
        console.error("PDF parsing error:", err);
        // Return partial success - file can still be stored
        return NextResponse.json({
          content: "",
          fileName,
          characterCount: 0,
          warning: "Could not extract text from PDF. The file will still be stored and viewable.",
          extractionFailed: true,
        });
      }
    } 
    // Handle DOCX/DOC
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
          warning: "Could not extract text from document. The file will still be stored and viewable.",
          extractionFailed: true,
        });
      }
    } 
    // Unsupported file type
    else {
      return NextResponse.json(
        { error: `Unsupported file type: .${fileExtension}. Supported: PDF, DOCX, DOC, TXT, MD` },
        { status: 400 }
      );
    }

    // Clean up the content
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