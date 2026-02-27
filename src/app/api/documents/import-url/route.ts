import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getUserOrganization } from "@/lib/get-user-organization";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Extract main content from HTML
function extractContent(html: string): { title: string; content: string } {
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  let title = titleMatch ? titleMatch[1].trim() : "";
  // Decode HTML entities
  title = title.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");

  // Try og:title as fallback
  if (!title) {
    const ogTitle = html.match(/<meta\s+property=["']og:title["']\s+content=["']([\s\S]*?)["']/i);
    if (ogTitle) title = ogTitle[1].trim();
  }

  // Get meta description
  const metaDesc = html.match(/<meta\s+(?:name|property)=["'](?:description|og:description)["']\s+content=["']([\s\S]*?)["']/i);
  const description = metaDesc ? metaDesc[1].trim() : "";

  // Remove scripts, styles, nav, header, footer, aside
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<aside[\s\S]*?<\/aside>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "");

  // Try to find article or main content
  const articleMatch = cleaned.match(/<article[\s\S]*?>([\s\S]*?)<\/article>/i)
    || cleaned.match(/<main[\s\S]*?>([\s\S]*?)<\/main>/i)
    || cleaned.match(/<div[^>]*(?:class|id)=["'][^"']*(?:content|article|post|entry|body)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);

  const contentHtml = articleMatch ? articleMatch[1] : cleaned;

  // Convert HTML to readable text
  let content = contentHtml
    // Convert headings to text with markers
    .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, "\n\n## $1\n\n")
    // Convert paragraphs
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "\n$1\n")
    // Convert list items
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "\n• $1")
    // Convert line breaks
    .replace(/<br\s*\/?>/gi, "\n")
    // Remove all remaining HTML tags
    .replace(/<[^>]+>/g, "")
    // Decode common entities
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    // Clean up whitespace
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();

  // Prepend description if content is short
  if (description && content.length < 500) {
    content = description + "\n\n" + content;
  }

  return { title, content };
}

// Extract YouTube info from URL
function isYouTubeUrl(url: string): boolean {
  return /(?:youtube\.com|youtu\.be)/i.test(url);
}

function getYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([^&\s]+)/,
    /(?:youtu\.be\/)([^?\s]+)/,
    /(?:youtube\.com\/embed\/)([^?\s]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

// Generate metadata using AI
async function generateMetadata(
  title: string,
  content: string,
  sourceUrl: string,
  orgId: string
) {
  try {
    // Get existing tags for consistency
    const { data: existingDocs } = await supabase
      .from("documents")
      .select("tags")
      .eq("organization_id", orgId)
      .not("tags", "is", null)
      .limit(20);

    const existingTags = new Set<string>();
    existingDocs?.forEach((d) => {
      (d.tags || []).forEach((t: string) => existingTags.add(t));
    });
    const existingTagsList = Array.from(existingTags).slice(0, 30).join(", ");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a document metadata generator. Given a web page's title, content, and URL, generate metadata.

Return a JSON object with:
- "title": a clean, descriptive document title (improve on the page title if needed)
- "summary": 2-3 sentence TL;DR of the key content
- "docType": one of: article, blog, tutorial, documentation, video, news, reference, report, other
- "tags": array of 3-5 relevant tags as lowercase strings

Rules:
- If content is in Chinese, generate Chinese title/summary/tags
- If content is in English, generate English title/summary/tags
- If mixed, use appropriate language for each field
- Prefer reusing existing tags when they fit
- Return ONLY valid JSON, nothing else

${existingTagsList ? `Existing tags: ${existingTagsList}` : ""}`,
        },
        {
          role: "user",
          content: `URL: ${sourceUrl}\nTitle: ${title}\n\nContent:\n${content.slice(0, 3000)}`,
        },
      ],
      max_tokens: 300,
      temperature: 0.5,
    });

    const raw = completion.choices[0].message.content?.trim() || "{}";
    const cleaned = raw.replace(/```json\s*|```\s*/g, "").trim();
    return JSON.parse(cleaned);
  } catch (error) {
    console.error("Failed to generate metadata:", error);
    return {
      title: title || "Imported Document",
      summary: "",
      docType: "article",
      tags: [],
    };
  }
}

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

    const body = await request.json();
    const { url, teamId, folderId } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        throw new Error("Invalid protocol");
      }
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    console.log(`🔗 Importing URL: ${url}`);

    let title = "";
    let content = "";
    let docSource = "url";

    if (isYouTubeUrl(url)) {
      // YouTube — fetch oEmbed for title
      const videoId = getYouTubeVideoId(url);
      docSource = "youtube";

      try {
        const oembedRes = await fetch(
          `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
        );
        if (oembedRes.ok) {
          const oembed = await oembedRes.json();
          title = oembed.title || "";
          content = `YouTube Video: ${title}\n\nAuthor: ${oembed.author_name || "Unknown"}\nURL: ${url}\n\nVideo ID: ${videoId}`;
        }
      } catch {
        title = `YouTube Video (${videoId})`;
        content = `YouTube Video\nURL: ${url}\nVideo ID: ${videoId}`;
      }

      // Try fetching the page for more description
      try {
        const pageRes = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; PrimeStrideAtlas/1.0)" },
          signal: AbortSignal.timeout(10000),
        });
        if (pageRes.ok) {
          const html = await pageRes.text();
          const descMatch = html.match(/<meta\s+(?:name|property)=["'](?:description|og:description)["']\s+content=["']([\s\S]*?)["']/i);
          if (descMatch) {
            content += `\n\nDescription: ${descMatch[1].trim()}`;
          }
        }
      } catch {}
    } else {
      // Regular URL — fetch and extract
      try {
        const pageRes = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; PrimeStrideAtlas/1.0)",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9,zh-TW;q=0.8,zh;q=0.7",
          },
          signal: AbortSignal.timeout(15000),
          redirect: "follow",
        });

        if (!pageRes.ok) {
          return NextResponse.json(
            { error: `Failed to fetch URL (HTTP ${pageRes.status})` },
            { status: 400 }
          );
        }

        const contentType = pageRes.headers.get("content-type") || "";
        if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
          return NextResponse.json(
            { error: "URL does not point to an HTML page" },
            { status: 400 }
          );
        }

        const html = await pageRes.text();
        const extracted = extractContent(html);
        title = extracted.title;
        content = extracted.content;
      } catch (fetchErr: any) {
        if (fetchErr?.name === "AbortError" || fetchErr?.name === "TimeoutError") {
          return NextResponse.json({ error: "URL fetch timed out" }, { status: 408 });
        }
        return NextResponse.json(
          { error: "Failed to fetch URL: " + (fetchErr?.message || "Unknown error") },
          { status: 400 }
        );
      }
    }

    if (!content || content.length < 20) {
      return NextResponse.json(
        { error: "Could not extract meaningful content from this URL" },
        { status: 400 }
      );
    }

    // Truncate content if extremely long
    if (content.length > 50000) {
      content = content.slice(0, 50000) + "\n\n[Content truncated]";
    }

    // Generate AI metadata
    console.log("🤖 Generating AI metadata...");
    const metadata = await generateMetadata(title, content, url, membership.organization_id);

    // Generate doc ID
    const docId = `PS-DOC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Create document
    const { data: document, error } = await supabase
      .from("documents")
      .insert({
        doc_id: docId,
        title: metadata.title || title || "Imported from URL",
        content,
        summary: metadata.summary || "",
        doc_type: metadata.docType || "article",
        tags: metadata.tags || [],
        doc_source: docSource,
        source_url: url,
        organization_id: membership.organization_id,
        team_id: teamId || null,
        folder_id: folderId || null,
        created_by: userId,
        current_version: "v1.0",
        status: "published",
      })
      .select()
      .single();

    if (error) {
      console.error("Create error:", error);
      // If source_url column doesn't exist, retry without it
      if (error.message?.includes("source_url")) {
        const { data: doc2, error: err2 } = await supabase
          .from("documents")
          .insert({
            doc_id: docId,
            title: metadata.title || title || "Imported from URL",
            content: `Source: ${url}\n\n${content}`,
            summary: metadata.summary || "",
            doc_type: metadata.docType || "article",
            tags: metadata.tags || [],
            doc_source: docSource,
            organization_id: membership.organization_id,
            team_id: teamId || null,
            folder_id: folderId || null,
            created_by: userId,
            current_version: "v1.0",
            status: "published",
          })
          .select()
          .single();

        if (err2) {
          return NextResponse.json({ error: "Failed to create document: " + err2.message }, { status: 500 });
        }

        console.log(`✅ URL imported: ${docId} — ${metadata.title}`);
        return NextResponse.json({
          message: "URL imported successfully",
          docId: doc2.doc_id,
          title: doc2.title,
          document: doc2,
        });
      }

      return NextResponse.json({ error: "Failed to create document: " + error.message }, { status: 500 });
    }

    console.log(`✅ URL imported: ${docId} — ${metadata.title}`);

    return NextResponse.json({
      message: "URL imported successfully",
      docId: document.doc_id,
      title: document.title,
      document,
    });
  } catch (error) {
    console.error("Import URL error:", error);
    return NextResponse.json({ error: "Failed to import URL" }, { status: 500 });
  }
}
