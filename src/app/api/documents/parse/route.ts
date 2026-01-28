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

    // Handle plain text files directly
    if (fileExtension === "txt" || fileExtension === "md") {
      content = buffer.toString("utf-8");
    }
    // Handle PDF using unpdf (serverless-compatible)
    else if (fileExtension === "pdf") {
      try {
        const { extractText } = await import("unpdf");
        const result = await extractText(new Uint8Array(arrayBuffer));
        // text is an array of strings (one per page), join them
        content = Array.isArray(result.text) ? result.text.join("\n\n") : result.text;
      } catch (err) {
        console.error("PDF parsing error:", err);
        return NextResponse.json({
          content: "",
          fileName,
          characterCount: 0,
          warning: "Could not extract text from PDF. The file will still be stored and viewable.",
          extractionFailed: true,
          error: String(err),
        });
      }
    }
    // Handle DOCX/DOC using mammoth
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
      .replace(/\s{2,}/g, " ")
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