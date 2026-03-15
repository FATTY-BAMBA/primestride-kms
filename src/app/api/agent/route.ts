import { auth, currentUser } from "@clerk/nextjs/server";
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
 
interface AgentAction {
  type: string;
  params: Record<string, any>;
}
 
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 
    const membership = await getUserOrganization(userId);
    if (!membership) return NextResponse.json({ error: "No organization found" }, { status: 404 });
 
    const orgId = membership.organization_id;
    const body = await request.json();
    const { message, history } = body;
 
    if (!message?.trim()) return NextResponse.json({ error: "Message required" }, { status: 400 });
 
    // Fetch org context
    const { data: docs } = await supabase
      .from("documents")
      .select("doc_id, title, content, summary, doc_type, tags, folder_id, doc_source, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(50);
 
    const { data: folders } = await supabase
      .from("folders")
      .select("id, name, icon, color")
      .eq("organization_id", orgId);
 
    const { data: projects } = await supabase
      .from("projects")
      .select("id, name, description, icon")
      .eq("organization_id", orgId);
 
    const docSummaries = (docs || []).map(d =>
      `- "${d.title}" (ID: ${d.doc_id}, type: ${d.doc_type || "doc"}, source: ${d.doc_source || "upload"}, tags: ${(d.tags || []).join(", ") || "none"}, folder: ${d.folder_id || "unfiled"})`
    ).join("\n");
 
    const folderList = (folders || []).map(f => `- "${f.name}" (ID: ${f.id}, icon: ${f.icon})`).join("\n");
    const projectList = (projects || []).map(p => `- "${p.name}" (ID: ${p.id})`).join("\n");
 
    const planMessages: any[] = [
      {
        role: "system",
        content: `You are an AI Agent for PrimeStride Atlas, a knowledge management platform. You can perform actions autonomously.
 
AVAILABLE ACTIONS (respond with JSON array of actions):
 
1. CREATE_DOC — Create a new document
   params: { title, content, docType, tags[], folderId? }
 
2. MOVE_DOC — Move a document to a folder
   params: { docId, folderId }
 
3. CREATE_FOLDER — Create a new folder
   params: { name, icon?, color? }
 
4. SEARCH_DOCS — Search for documents by keyword
   params: { query }
 
5. SUMMARIZE_DOCS — Summarize specific documents
   params: { docIds[] }
 
6. TAG_DOCS — Add tags to documents
   params: { docId, tags[] }
 
7. ADD_TO_PROJECT — Add documents to a project
   params: { projectId, docIds[] }
 
8. SHADOW_AUDIT — Scan real-time overtime risk for all employees
   params: {} (no params needed)
   USE THIS when user asks about: overtime risk, 加班風險, employees near cap, 超標員工, monthly overtime, 本月加班, shadow audit, compliance risk
 
9. SUBSIDY_HUNT — Find government subsidies the company qualifies for
   params: {} (no params needed)
   USE THIS when user asks about: subsidies, 補助, 政府補助, grants, 申請補助, eligible benefits, 可申請
 
10. REPLY — Just reply with text (no action needed)
    params: { message }
 
CURRENT ORGANIZATION CONTEXT:
Documents (${(docs || []).length} total):
${docSummaries || "No documents yet"}
 
Folders:
${folderList || "No folders yet"}
 
Projects:
${projectList || "No projects yet"}
 
RULES:
- Analyze the user's request and decide which actions to perform
- You can chain multiple actions together
- Always respond with a JSON object: { "actions": [...], "summary": "what you did" }
- For REPLY action, just explain or answer
- Be smart about organizing — if user says "organize my docs", group by topic into folders
- Support English and Traditional Chinese
- Use document content/summaries to make informed decisions
- When creating content, be thorough and professional
- Return ONLY valid JSON, no markdown fences
- CRITICAL: When the user asks you to CREATE something, you MUST use the CREATE_DOC action with full content in the params. Do NOT just reply saying you created something — actually include the action.
- CRITICAL: Always prefer ACTIONS over REPLY. If the user wants something done, DO IT with actions. Only use REPLY for pure questions.
- Example: User says "Create meeting notes" → You respond with actions: [{"type":"CREATE_DOC","params":{"title":"Meeting Notes — Feb 28, 2026","content":"# Meeting Notes\\n\\n## Date: February 28, 2026\\n\\n## Attendees\\n- \\n\\n## Agenda\\n1. \\n\\n## Discussion\\n\\n\\n## Action Items\\n- [ ] \\n\\n## Next Steps\\n","docType":"meeting-notes","tags":["meeting","notes"]}}]`
      }
    ];
 
    if (history && Array.isArray(history)) {
      for (const h of history.slice(-6)) {
        planMessages.push({ role: h.role === "user" ? "user" : "assistant", content: h.content });
      }
    }
 
    planMessages.push({ role: "user", content: message });
 
    const planCompletion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: planMessages,
      max_tokens: 2000,
      temperature: 0.7,
    });
 
    const planRaw = planCompletion.choices[0].message.content?.trim() || '{"actions":[{"type":"REPLY","params":{"message":"I couldn\'t process that request."}}],"summary":"Failed to plan"}';
 
    let plan: { actions: AgentAction[]; summary: string };
    try {
      const cleaned = planRaw.replace(/```json\s*|```\s*/g, "").trim();
      plan = JSON.parse(cleaned);
    } catch {
      plan = { actions: [{ type: "REPLY", params: { message: planRaw } }], summary: "Response" };
    }
 
    // Execute actions
    const results: string[] = [];
    const createdItems: { type: string; id: string; title: string }[] = [];
 
    for (const action of plan.actions) {
      try {
        switch (action.type) {
          case "CREATE_DOC": {
            const docId = `PS-DOC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
            const { error } = await supabase
              .from("documents")
              .insert({
                doc_id: docId,
                title: action.params.title || "Untitled",
                content: action.params.content || "",
                doc_type: action.params.docType || "document",
                tags: action.params.tags || [],
                doc_source: "ai-agent",
                folder_id: action.params.folderId || null,
                organization_id: orgId,
                created_by: userId,
                current_version: "v1.0",
                status: "draft",
              });
 
            if (error) {
              results.push(`❌ Failed to create "${action.params.title}": ${error.message}`);
            } else {
              results.push(`✅ Created document: "${action.params.title}" (${docId})`);
              createdItems.push({ type: "doc", id: docId, title: action.params.title });
            }
            break;
          }
 
          case "MOVE_DOC": {
            const { error } = await supabase
              .from("documents")
              .update({ folder_id: action.params.folderId || null })
              .eq("doc_id", action.params.docId)
              .eq("organization_id", orgId);
 
            if (error) {
              results.push(`❌ Failed to move doc ${action.params.docId}: ${error.message}`);
            } else {
              const docTitle = docs?.find(d => d.doc_id === action.params.docId)?.title || action.params.docId;
              const folderName = folders?.find(f => f.id === action.params.folderId)?.name || "unfiled";
              results.push(`✅ Moved "${docTitle}" → ${folderName}`);
            }
            break;
          }
 
          case "CREATE_FOLDER": {
            const { data, error } = await supabase
              .from("folders")
              .insert({
                name: action.params.name,
                icon: action.params.icon || "📁",
                color: action.params.color || "#7C3AED",
                organization_id: orgId,
                created_by: userId,
              })
              .select()
              .single();
 
            if (error) {
              results.push(`❌ Failed to create folder "${action.params.name}": ${error.message}`);
            } else {
              results.push(`✅ Created folder: ${action.params.icon || "📁"} ${action.params.name}`);
              createdItems.push({ type: "folder", id: data.id, title: action.params.name });
            }
            break;
          }
 
          case "SEARCH_DOCS": {
            const query = (action.params.query || "").toLowerCase();
            const matches = (docs || []).filter(d =>
              d.title.toLowerCase().includes(query) ||
              (d.content || "").toLowerCase().includes(query) ||
              (d.tags || []).some((t: string) => t.toLowerCase().includes(query))
            ).slice(0, 5);
 
            if (matches.length > 0) {
              results.push(`🔍 Found ${matches.length} document(s):`);
              for (const m of matches) {
                createdItems.push({ type: "doc", id: m.doc_id, title: m.title });
              }
            } else {
              results.push(`🔍 No documents found matching "${action.params.query}"`);
            }
            break;
          }
 
          case "SUMMARIZE_DOCS": {
            const targetDocs = (docs || []).filter(d =>
              (action.params.docIds || []).includes(d.doc_id)
            );
 
            if (targetDocs.length === 0) {
              results.push("📝 No matching documents found to summarize.");
              break;
            }
 
            const contextForSummary = targetDocs.map(d =>
              `[${d.title}]\n${(d.content || "").slice(0, 2000)}`
            ).join("\n\n---\n\n");
 
            const summaryCompletion = await openai.chat.completions.create({
              model: "gpt-4o-mini",
              messages: [
                { role: "system", content: "Summarize these documents concisely. Support English and Chinese." },
                { role: "user", content: contextForSummary },
              ],
              max_tokens: 800,
            });
 
            const summary = summaryCompletion.choices[0].message.content || "Could not generate summary.";
            results.push(`📝 Summary:\n${summary}`);
            break;
          }
 
          case "TAG_DOCS": {
            const { error } = await supabase
              .from("documents")
              .update({ tags: action.params.tags })
              .eq("doc_id", action.params.docId)
              .eq("organization_id", orgId);
 
            if (error) {
              results.push(`❌ Failed to tag ${action.params.docId}: ${error.message}`);
            } else {
              const docTitle = docs?.find(d => d.doc_id === action.params.docId)?.title || action.params.docId;
              results.push(`🏷️ Tagged "${docTitle}" with: ${(action.params.tags || []).join(", ")}`);
            }
            break;
          }
 
          case "ADD_TO_PROJECT": {
            const inserts = (action.params.docIds || []).map((did: string) => ({
              project_id: action.params.projectId,
              doc_id: did,
              added_by: userId,
            }));
 
            const { error } = await supabase
              .from("project_documents")
              .upsert(inserts, { onConflict: "project_id,doc_id" });
 
            if (error) {
              results.push(`❌ Failed to add docs to project: ${error.message}`);
            } else {
              const projName = projects?.find(p => p.id === action.params.projectId)?.name || "project";
              results.push(`✅ Added ${(action.params.docIds || []).length} doc(s) to "${projName}"`);
            }
            break;
          }
 
          case "REPLY": {
            results.push(action.params.message || "");
            break;
          }
 
          case "SHADOW_AUDIT": {
            try {
              const auditRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "https://primestrideatlas.com"}/api/shadow-audit`, {
                headers: { Cookie: request.headers.get("cookie") || "" },
              });
              if (auditRes.ok) {
                const auditData = await auditRes.json();
                const risks = auditData.risks || [];
                const sum = auditData.summary || {};
                if (risks.length === 0) {
                  results.push("✅ 所有員工加班時數均在法定上限內，沒有發現超標風險。\n\nAll employees are within overtime limits. No risk detected.");
                } else {
                  const criticalList = risks.filter((r: any) => r.risk_level === "critical");
                  const warningList = risks.filter((r: any) => r.risk_level === "warning");
                  let report = `🔍 Shadow Audit 加班風險報告\n\n`;
                  report += `掃描結果：${sum.total_monitored || 0} 名員工中，${sum.critical || 0} 名超標，${sum.warning || 0} 名接近上限\n\n`;
                  if (criticalList.length > 0) {
                    report += `🚨 超標員工（需立即處理）：\n`;
                    criticalList.forEach((r: any) => {
                      report += `• ${r.name}：本月 ${r.monthly_hours}h / 46h，近3月 ${r.quarterly_hours}h / 138h\n`;
                      r.alerts?.forEach((a: any) => { report += `  ↳ ${a.message_zh} (${a.law})\n`; });
                    });
                    report += "\n";
                  }
                  if (warningList.length > 0) {
                    report += `⚠️ 接近上限員工（請注意）：\n`;
                    warningList.forEach((r: any) => {
                      report += `• ${r.name}：本月 ${r.monthly_hours}h，剩餘 ${r.monthly_remaining}h\n`;
                    });
                  }
                  report += `\n依據 LSA Art. 32 即時監控。建議減少高風險員工的加班申請。`;
                  results.push(report);
                }
              } else {
                results.push("無法取得加班風險資料，請稍後再試。");
              }
            } catch {
              results.push("Shadow Audit 執行失敗，請稍後再試。");
            }
            break;
          }
 
          case "SUBSIDY_HUNT": {
            try {
              const subsidyRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "https://primestrideatlas.com"}/api/subsidy-hunter`, {
                headers: { Cookie: request.headers.get("cookie") || "" },
              });
              if (subsidyRes.ok) {
                const subsidyData = await subsidyRes.json();
                const subsidies = subsidyData.subsidies || [];
                const sum = subsidyData.summary || {};
                if (subsidies.length === 0) {
                  results.push("目前未偵測到符合資格的政府補助項目。");
                } else {
                  let report = `💰 補助獵人 Subsidy Hunter 報告\n\n`;
                  report += `共發現 ${subsidies.length} 項可申請補助，最高可申請 NT$${(sum.total_potential_nt || 0).toLocaleString()}\n\n`;
                  subsidies.forEach((s: any) => {
                    const urgencyTag = s.urgency === "high" ? "🔴 高優先" : "🟡 中優先";
                    report += `${s.icon} ${s.name_zh} ${urgencyTag}\n`;
                    report += `金額：${s.amount}\n`;
                    report += `${s.description_zh}\n`;
                    report += `截止：${s.deadline} | 主管機關：${s.source}\n`;
                    if (s.eligible_employees?.length > 0) {
                      report += `符合員工：${s.eligible_employees.map((e: any) => e.name).join("、")}\n`;
                    }
                    report += "\n";
                  });
                  report += `建議優先申請高優先項目。如需準備申請文件，請繼續告訴我。`;
                  results.push(report);
                }
              } else {
                results.push("無法取得補助資料，請稍後再試。");
              }
            } catch {
              results.push("Subsidy Hunter 執行失敗，請稍後再試。");
            }
            break;
          }
 
          default:
            results.push(`⚠️ Unknown action: ${action.type}`);
        }
      } catch (err: any) {
        results.push(`❌ Error executing ${action.type}: ${err?.message || "Unknown error"}`);
      }
    }
 
    return NextResponse.json({
      reply: results.join("\n\n") || plan.summary,
      actions: plan.actions.map(a => a.type),
      createdItems,
      summary: plan.summary,
    });
  } catch (error) {
    console.error("AI Agent error:", error);
    return NextResponse.json({ error: "Agent failed" }, { status: 500 });
  }
}