import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getUserOrganization } from "@/lib/get-user-organization";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const membership = await getUserOrganization(userId);
    if (!membership) return new NextResponse("No organization", { status: 404 });

    const { searchParams } = new URL(request.url);
    const docId = searchParams.get("docId");
    const format = searchParams.get("format") || "md";

    if (!docId) return new NextResponse("docId required", { status: 400 });

    // Fetch document
    const { data: doc, error } = await supabase
      .from("documents")
      .select("*")
      .eq("doc_id", docId)
      .eq("organization_id", membership.organization_id)
      .single();

    if (error || !doc) return new NextResponse("Document not found", { status: 404 });

    const title = doc.title || "Untitled";
    const content = doc.content || "";
    const summary = doc.summary || "";
    const tags = (doc.tags || []).join(", ");
    const version = doc.current_version || "v1.0";
    const createdAt = new Date(doc.created_at).toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
    });

    if (format === "md") {
      // Markdown export
      const md = `# ${title}\n\n**Document ID:** ${doc.doc_id}\n**Version:** ${version}\n**Created:** ${createdAt}\n${tags ? `**Tags:** ${tags}\n` : ""}${summary ? `\n## Summary\n\n${summary}\n` : ""}\n## Content\n\n${content}\n\n---\n*Exported from PrimeStride Atlas on ${new Date().toLocaleDateString()}*\n`;

      return new NextResponse(md, {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="${sanitizeFilename(title)}.md"`,
        },
      });
    }

    if (format === "txt") {
      // Plain text export
      const txt = `${title}\n${"=".repeat(title.length)}\n\nDocument ID: ${doc.doc_id}\nVersion: ${version}\nCreated: ${createdAt}\n${tags ? `Tags: ${tags}\n` : ""}\n${summary ? `Summary:\n${summary}\n\n` : ""}${content}\n\n---\nExported from PrimeStride Atlas on ${new Date().toLocaleDateString()}\n`;

      return new NextResponse(txt, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="${sanitizeFilename(title)}.txt"`,
        },
      });
    }

    if (format === "html") {
      // HTML export (can be opened in Word as .doc)
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1a1a1a; line-height: 1.8; }
  h1 { font-size: 28px; border-bottom: 2px solid #7C3AED; padding-bottom: 12px; margin-bottom: 24px; }
  .meta { color: #6B7280; font-size: 14px; margin-bottom: 24px; }
  .meta span { display: inline-block; margin-right: 20px; }
  .summary { background: #F5F3FF; border-left: 4px solid #7C3AED; padding: 16px 20px; margin-bottom: 24px; border-radius: 0 8px 8px 0; }
  .summary h2 { font-size: 16px; margin: 0 0 8px 0; color: #5B21B6; }
  .content { white-space: pre-wrap; font-size: 16px; }
  .tag { display: inline-block; padding: 2px 10px; background: #EEF2FF; color: #4F46E5; border-radius: 4px; font-size: 12px; font-weight: 600; margin-right: 6px; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #E5E7EB; color: #9CA3AF; font-size: 12px; }
</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">
    <span><strong>ID:</strong> ${doc.doc_id}</span>
    <span><strong>Version:</strong> ${version}</span>
    <span><strong>Created:</strong> ${createdAt}</span>
  </div>
  ${tags ? `<div class="meta">${(doc.tags || []).map((t: string) => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</div>` : ""}
  ${summary ? `<div class="summary"><h2>Summary</h2><p>${escapeHtml(summary)}</p></div>` : ""}
  <div class="content">${escapeHtml(content)}</div>
  <div class="footer">Exported from PrimeStride Atlas on ${new Date().toLocaleDateString()}</div>
</body>
</html>`;

      const filename = sanitizeFilename(title);
      const contentType = format === "html" ? "text/html" : "text/html";

      return new NextResponse(html, {
        headers: {
          "Content-Type": `${contentType}; charset=utf-8`,
          "Content-Disposition": `attachment; filename="${filename}.html"`,
        },
      });
    }

    if (format === "docx") {
      // Generate DOCX-compatible HTML that Word can open
      const docxHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(title)}</title>
<!--[if gte mso 9]>
<xml>
<w:WordDocument>
<w:View>Print</w:View>
<w:Zoom>100</w:Zoom>
</w:WordDocument>
</xml>
<![endif]-->
<style>
  body { font-family: Calibri, sans-serif; font-size: 11pt; color: #1a1a1a; line-height: 1.6; }
  h1 { font-size: 22pt; color: #7C3AED; border-bottom: 2pt solid #7C3AED; padding-bottom: 8pt; }
  h2 { font-size: 14pt; color: #5B21B6; margin-top: 16pt; }
  .meta { color: #6B7280; font-size: 10pt; margin-bottom: 16pt; }
  .summary { background: #F5F3FF; border-left: 3pt solid #7C3AED; padding: 10pt 14pt; margin-bottom: 16pt; }
  .content { white-space: pre-wrap; font-size: 11pt; }
  table { border-collapse: collapse; }
  td { padding: 4pt 8pt; }
  .footer { margin-top: 24pt; padding-top: 8pt; border-top: 1pt solid #E5E7EB; color: #9CA3AF; font-size: 9pt; }
</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <table class="meta">
    <tr><td><strong>Document ID:</strong></td><td>${doc.doc_id}</td></tr>
    <tr><td><strong>Version:</strong></td><td>${version}</td></tr>
    <tr><td><strong>Created:</strong></td><td>${createdAt}</td></tr>
    ${tags ? `<tr><td><strong>Tags:</strong></td><td>${escapeHtml(tags)}</td></tr>` : ""}
  </table>
  ${summary ? `<div class="summary"><h2>Summary</h2><p>${escapeHtml(summary)}</p></div>` : ""}
  <h2>Content</h2>
  <div class="content">${escapeHtml(content)}</div>
  <div class="footer">Exported from PrimeStride Atlas on ${new Date().toLocaleDateString()}</div>
</body>
</html>`;

      return new NextResponse(docxHtml, {
        headers: {
          "Content-Type": "application/vnd.ms-word; charset=utf-8",
          "Content-Disposition": `attachment; filename="${sanitizeFilename(title)}.doc"`,
        },
      });
    }

    if (format === "pdf") {
      // For PDF, we return styled HTML that the client will print-to-PDF
      // This is the most reliable cross-platform approach without heavy server deps
      const pdfHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${escapeHtml(title)}</title>
<style>
  @page { margin: 1in; size: A4; }
  @media print { body { margin: 0; } .no-print { display: none; } }
  body { font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 700px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a; line-height: 1.8; }
  h1 { font-size: 26px; color: #111827; border-bottom: 2px solid #7C3AED; padding-bottom: 12px; }
  .meta { color: #6B7280; font-size: 13px; margin-bottom: 24px; }
  .meta span { display: inline-block; margin-right: 20px; }
  .summary { background: #F5F3FF; border-left: 4px solid #7C3AED; padding: 14px 18px; margin-bottom: 24px; border-radius: 0 6px 6px 0; }
  .summary h2 { font-size: 15px; margin: 0 0 6px 0; color: #5B21B6; }
  .content { white-space: pre-wrap; font-size: 15px; }
  .tag { display: inline-block; padding: 2px 10px; background: #EEF2FF; color: #4F46E5; border-radius: 4px; font-size: 11px; font-weight: 600; margin-right: 4px; }
  .footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #E5E7EB; color: #9CA3AF; font-size: 11px; }
  .print-btn { position: fixed; top: 20px; right: 20px; padding: 12px 24px; background: #7C3AED; color: white; border: none; border-radius: 8px; font-size: 15px; font-weight: 700; cursor: pointer; z-index: 10; }
</style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">📥 Save as PDF</button>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">
    <span><strong>ID:</strong> ${doc.doc_id}</span>
    <span><strong>Version:</strong> ${version}</span>
    <span><strong>Created:</strong> ${createdAt}</span>
  </div>
  ${tags ? `<div class="meta">${(doc.tags || []).map((t: string) => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</div>` : ""}
  ${summary ? `<div class="summary"><h2>Summary</h2><p>${escapeHtml(summary)}</p></div>` : ""}
  <div class="content">${escapeHtml(content)}</div>
  <div class="footer">Exported from PrimeStride Atlas &bull; ${new Date().toLocaleDateString()}</div>
  <script class="no-print">
    // Auto-trigger print dialog
    window.onload = function() {
      // Small delay to let styles render
      setTimeout(function() { window.print(); }, 500);
    };
  </script>
</body>
</html>`;

      return new NextResponse(pdfHtml, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
        },
      });
    }

    return new NextResponse("Unsupported format. Use: md, txt, html, docx, pdf", { status: 400 });
  } catch (error) {
    console.error("Export error:", error);
    return new NextResponse("Export failed", { status: 500 });
  }
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9\u4e00-\u9fff\s._-]/g, "").replace(/\s+/g, "_").slice(0, 100);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
