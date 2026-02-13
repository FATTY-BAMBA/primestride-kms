// /src/app/api/learning-summary/route.ts

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import { getUserOrganization } from "@/lib/get-user-organization";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Document {
  doc_id: string;
  title: string;
  current_version: string;
  status: string;
  doc_type: string | null;
  domain: string | null;
  tags: string[] | null;
  file_url: string | null;
  file_name: string | null;
  organization_id: string;
  team_id: string | null;
}

interface FeedbackRow {
  doc_id: string;
  is_helpful: boolean;
}

interface Team {
  id: string;
  name: string;
  color: string;
}

// Helper to get user's team memberships
async function getUserTeams(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", userId);
  return (data || []).map(t => t.team_id);
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    }

    const membership = await getUserOrganization(userId);

    if (!membership) {
      return NextResponse.json(
        { documents: [], teams: [] },
        { headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    }

    // Get team filter from query params
    const { searchParams } = new URL(request.url);
    const teamFilter = searchParams.get("team");

    // Get user's teams for access control
    const userTeamIds = await getUserTeams(userId);
    const isOrgAdmin = ["owner", "admin"].includes(membership.role);

    // Build documents query
    let docsQuery = supabase
      .from("documents")
      .select("doc_id,title,current_version,status,doc_type,domain,tags,file_url,file_name,organization_id,team_id")
      .eq("organization_id", membership.organization_id);

    // Apply team filter
    if (teamFilter === "org-wide") {
      docsQuery = docsQuery.is("team_id", null);
    } else if (teamFilter && teamFilter !== "all") {
      docsQuery = docsQuery.eq("team_id", teamFilter);
    }

    const { data: docs, error: docsErr } = await docsQuery;

    console.log("ROUTE: /api/learning-summary");
    console.log("USER:", userId);
    console.log("ORG:", membership.organization_id);
    console.log("TEAM FILTER:", teamFilter);
    console.log("DOCS LENGTH:", docs?.length);

    if (docsErr) {
      return NextResponse.json(
        { error: docsErr.message },
        { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    }

    // Filter by access (if not admin and not filtering by specific team already)
    let filteredDocs = docs || [];
    if (!isOrgAdmin && teamFilter !== "org-wide" && (!teamFilter || teamFilter === "all")) {
      filteredDocs = filteredDocs.filter(doc => {
        if (!doc.team_id) return true; // Org-wide docs
        return userTeamIds.includes(doc.team_id); // User's team docs
      });
    }

    // Get team info for each document
    const teamIds = [...new Set(filteredDocs.filter(d => d.team_id).map(d => d.team_id))];
    let teamsMap: Record<string, Team> = {};
    
    if (teamIds.length > 0) {
      const { data: teamsData } = await supabase
        .from("teams")
        .select("id, name, color")
        .in("id", teamIds);
      
      if (teamsData) {
        teamsMap = Object.fromEntries(teamsData.map(t => [t.id, t]));
      }
    }

    // Get all teams in org for filter dropdown
    const { data: allTeams } = await supabase
      .from("teams")
      .select("id, name, color")
      .eq("organization_id", membership.organization_id)
      .order("name");

    // Get feedback counts
    const docIds = filteredDocs.map((d: Document) => d.doc_id);
    let feedbackCounts: Record<string, { helpful: number; not_helpful: number }> = {};
    
    if (docIds.length > 0) {
      const { data: feedback } = await supabase
        .from("feedback")
        .select("doc_id,is_helpful")
        .in("doc_id", docIds);

      if (feedback) {
        for (const f of feedback as FeedbackRow[]) {
          if (!feedbackCounts[f.doc_id]) {
            feedbackCounts[f.doc_id] = { helpful: 0, not_helpful: 0 };
          }
          if (f.is_helpful) {
            feedbackCounts[f.doc_id].helpful++;
          } else {
            feedbackCounts[f.doc_id].not_helpful++;
          }
        }
      }
    }

    // Build response
    const enriched = filteredDocs.map((d) => {
      const counts = feedbackCounts[d.doc_id] ?? { helpful: 0, not_helpful: 0 };
      return {
        doc_id: d.doc_id,
        title: d.title,
        current_version: d.current_version,
        status: d.status,
        doc_type: d.doc_type,
        domain: d.domain,
        tags: d.tags,
        file_url: d.file_url,
        team_id: d.team_id,
        teams: d.team_id ? teamsMap[d.team_id] || null : null,
        feedback_counts: {
          helped: counts.helpful,
          not_confident: 0,
          didnt_help: counts.not_helpful,
        },
      };
    });

    return NextResponse.json(
      { 
        documents: enriched,
        teams: allTeams || [],
        user_role: membership.role,
        user_teams: userTeamIds,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    console.error("Learning summary error:", e);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }
}