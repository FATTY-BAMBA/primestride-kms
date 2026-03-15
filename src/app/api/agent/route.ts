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

10. ANALYZE_TRENDS — Analyze leave and overtime submission trends from real data
    params: {} (no params needed)
    USE THIS when user asks about: trends, 趨勢, 分析, analyze submissions, 申請分析, 近3個月, last 3 months, leave patterns, overtime patterns, 請假趨勢, 加班趨勢, 勞工申請

11. REPLY — Just reply with text (no action needed)
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
              const now = new Date();
              const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
              const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString();

              const { data: allOT } = await supabase
                .from("workflow_submissions")
                .select("submitted_by, form_data, created_at, submitter_name")
                .eq("organization_id", orgId)
                .eq("form_type", "overtime")
                .eq("status", "approved")
                .gte("created_at", threeMonthsAgo);

              const { data: members } = await supabase
                .from("organization_members")
                .select("user_id")
                .eq("organization_id", orgId)
                .eq("is_active", true);

              const uids = (members || []).map((m: any) => m.user_id);
              const { data: profiles } = await supabase
                .from("profiles").select("id, full_name, email").in("id", uids);
              const pMap = new Map((profiles || []).map((p: any) => [
                p.id, p.full_name || p.email?.split("@")[0] || p.id.slice(0, 12)
              ]));

              const empMap: Record<string, any> = {};
              for (const sub of (allOT || [])) {
                const uid = sub.submitted_by;
                if (!empMap[uid]) {
                  empMap[uid] = {
                    name: sub.submitter_name || pMap.get(uid) || uid.slice(0, 12),
                    monthly: 0,
                    quarterly: 0,
                  };
                }
                const hrs = parseFloat(sub.form_data?.hours) || 0;
                if (new Date(sub.created_at) >= new Date(monthStart)) empMap[uid].monthly += hrs;
                empMap[uid].quarterly += hrs;
              }

              const critical: any[] = [];
              const warning: any[] = [];
              for (const [, e] of Object.entries(empMap)) {
                if ((e as any).monthly >= 46 || (e as any).quarterly >= 138) critical.push(e);
                else if ((e as any).monthly >= 38 || (e as any).quarterly >= 120) warning.push(e);
              }

              if (critical.length === 0 && warning.length === 0) {
                results.push(
                  "✅ 所有員工加班時數均在法定上限內，沒有發現超標風險。\n\n" +
                  "All employees are within overtime limits. No risk detected."
                );
              } else {
                const lines: string[] = [];
                lines.push("🔍 Shadow Audit 加班風險報告");
                lines.push("");
                lines.push(`掃描結果：${critical.length} 名超標，${warning.length} 名接近上限`);
                lines.push("");
                if (critical.length > 0) {
                  lines.push("🚨 超標員工（需立即處理）：");
                  critical.forEach((e: any) => {
                    lines.push(`• ${e.name}：本月 ${e.monthly}h / 46h，近3月 ${e.quarterly}h / 138h`);
                    if (e.monthly >= 46) lines.push("  ↳ 本月超過法定46小時上限 (LSA Art. 32) 罰款風險：NT$20,000–1,000,000");
                    if (e.quarterly >= 138) lines.push("  ↳ 近3月超過138小時絕對上限 (LSA Art. 32) 無例外");
                  });
                  lines.push("");
                }
                if (warning.length > 0) {
                  lines.push("⚠️ 接近上限員工（請注意）：");
                  warning.forEach((e: any) => {
                    lines.push(`• ${e.name}：本月 ${e.monthly}h，近3月 ${e.quarterly}h`);
                  });
                  lines.push("");
                }
                lines.push("依據 LSA Art. 32 即時監控。建議減少高風險員工的加班申請。");
                results.push(lines.join("\n"));
              }
            } catch (e: any) {
              results.push(`Shadow Audit 執行失敗：${e?.message || "未知錯誤"}`);
            }
            break;
          }

          case "SUBSIDY_HUNT": {
            try {
              const now2 = new Date();

              // Fetch members + org metadata in parallel
              const [memberRes, orgMetaRes, docsRes] = await Promise.all([
                supabase
                  .from("organization_members")
                  .select("user_id, joined_at")
                  .eq("organization_id", orgId)
                  .eq("is_active", true),
                supabase
                  .from("organization_metadata")
                  .select("company_name, company_size, industry, tax_id")
                  .eq("organization_id", orgId)
                  .single(),
                supabase
                  .from("documents")
                  .select("doc_id", { count: "exact", head: true })
                  .eq("organization_id", orgId),
              ]);

              const members2 = memberRes.data || [];
              const orgMeta = orgMetaRes.data;
              const memberCount = members2.length;
              const docCount = docsRes.count || 0;

              const uids2 = members2.map((m: any) => m.user_id);
              const { data: profiles2 } = await supabase
                .from("profiles").select("id, full_name, email").in("id", uids2);
              const pMap2 = new Map((profiles2 || []).map((p: any) => [
                p.id, p.full_name || p.email?.split("@")[0] || p.id.slice(0, 12)
              ]));

              // Employees approaching 1-year seniority (within 60 days)
              const soonSeniority = members2.filter((m: any) => {
                if (!m.joined_at) return false;
                const oneYear = new Date(m.joined_at);
                oneYear.setFullYear(oneYear.getFullYear() + 1);
                const days = Math.ceil((oneYear.getTime() - now2.getTime()) / (1000 * 60 * 60 * 24));
                return days >= 0 && days <= 60;
              });

              // Employees with > 1 year seniority (already eligible)
              const seniorEmployees = members2.filter((m: any) => {
                if (!m.joined_at) return false;
                const oneYear = new Date(m.joined_at);
                oneYear.setFullYear(oneYear.getFullYear() + 1);
                return now2 >= oneYear;
              });

              const companyName = orgMeta?.company_name || "貴公司";
              const industry = orgMeta?.industry || "";
              const size = orgMeta?.company_size || "";
              const hasTaxId = !!orgMeta?.tax_id;

              const lines: string[] = [];
              let found = 0;

              // ── Subsidy 1: Digital Transformation (MOEA) — always applicable with Atlas ──
              found++;
              lines.push("🏛️ 商業服務業智慧轉型補助 🔴 高優先");
              lines.push("金額：最高 NT$500,000");
              lines.push("符合原因：");
              lines.push(`  ✅ ${companyName} 已導入 Atlas EIP AI 人資管理系統`);
              lines.push(`  ✅ 系統涵蓋：AI 自然語言請假、2026 勞基法合規引擎、RAG 知識庫`);
              if (docCount > 0) lines.push(`  ✅ 已建立 ${docCount} 份數位化文件知識庫`);
              if (hasTaxId) lines.push(`  ✅ 統一編號已登記，符合申請資格`);
              lines.push("申請所需文件：系統導入合約、費用單據、成效說明書");
              lines.push("申請窗口：2026年3月（本月）及9月 | 主管機關：經濟部商業發展署");
              lines.push("🔗 申請連結：https://gcis.nat.gov.tw/mainNew/subclassNAction.do?method=getFile&pk=636");
              lines.push("");

              // ── Subsidy 1b: T-Cloud 雲市集 — 50% software cost subsidy ──
              found++;
              lines.push("☁️ T-Cloud 雲市集數位點數補助 🔴 高優先");
              lines.push("金額：最高 NT$30,000 數位點數（折抵軟體費用50%）");
              lines.push("符合原因：");
              lines.push(`  ✅ ${companyName} 使用符合資格的雲端 AI 軟體服務`);
              lines.push("  ✅ 政府補助50%訂閱費用，實質降低 Atlas EIP 導入成本");
              lines.push("  ✅ 適用中小企業，申請門檻低");
              lines.push("申請窗口：全年度開放 | 主管機關：經濟部中小及新創企業署");
              lines.push("🔗 申請連結：https://tcloud.nat.gov.tw");
              lines.push("");

              // ── Subsidy 2: Training for employees approaching 1-year ──
              if (soonSeniority.length > 0) {
                found++;
                const names = soonSeniority.map((m: any) => pMap2.get(m.user_id) || "員工").join("、");
                const maxAmount = soonSeniority.length * 6000;
                lines.push("🎓 數位轉型人才培訓補助 🔴 高優先");
                lines.push(`金額：最高 NT$${maxAmount.toLocaleString()}（每人 NT$6,000）`);
                lines.push("符合原因：");
                lines.push(`  ✅ ${soonSeniority.length} 位員工即將達到1年年資資格：${names}`);
                lines.push("  ✅ 可申請 AI 工具、數位辦公、軟體操作等培訓課程補助");
                lines.push("  ⏰ 需在年資達成後3個月內提出申請，請勿錯過");
                lines.push("申請窗口：年資達成後3個月內 | 主管機關：勞動力發展署");
                lines.push("🔗 申請連結：https://www.wda.gov.tw/News_Training.aspx");
                lines.push("");
              }

              // ── Subsidy 3: On-the-job training (5+ employees) ──
              if (memberCount >= 5) {
                found++;
                const smeSizeLabel = memberCount <= 30 ? "微型企業（最高補助80%）" : memberCount <= 200 ? "中小企業（最高補助70%）" : "一般企業（最高補助60%）";
                lines.push("💼 員工在職訓練補助 🟡 中優先");
                lines.push("金額：訓練費用最高80%補助");
                lines.push("符合原因：");
                lines.push(`  ✅ ${companyName} 現有 ${memberCount} 位員工，屬 ${smeSizeLabel}`);
                if (seniorEmployees.length > 0) lines.push(`  ✅ ${seniorEmployees.length} 位員工年資滿1年，可申請在職訓練補助`);
                if (industry) lines.push(`  ✅ 產業別：${industry}，符合數位化轉型訓練補助範圍`);
                lines.push("建議用途：AI 工具操作培訓、勞動法規教育訓練、數位管理技能");
                lines.push("申請窗口：全年度開放，按季申請 | 主管機關：勞動部勞動力發展署");
                lines.push("🔗 申請連結：https://ojt.wda.gov.tw");
                lines.push("");
              }

              // ── Subsidy 3b: Taipei SITI — if registered in Taipei ──
              // Note: We show this as advisory since we don't store city data yet
              found++;
              lines.push("🏙️ 台北市產業發展補助 (SITI) 🟡 中優先");
              lines.push("金額：最高 NT$1,000,000–5,000,000（研發/品牌/新創）");
              lines.push("符合原因（如登記於台北市）：");
              lines.push(`  ✅ ${companyName} 若設籍台北市，可申請台北市產業局補助`);
              lines.push("  ✅ 涵蓋：研發費用、品牌推廣、新創加速等項目");
              lines.push("  ℹ️ 請確認公司登記地址是否在台北市");
              lines.push("申請窗口：依計畫公告 | 主管機關：台北市政府產業發展局");
              lines.push("🔗 申請連結：https://www.siti.taipei");
              lines.push("");

              // ── Subsidy 4: Workplace safety (50+ employees) ──
              if (memberCount >= 50) {
                found++;
                lines.push("🛡️ 職場安全衛生改善補助 🟡 中優先");
                lines.push("金額：最高 NT$100,000");
                lines.push("符合原因：");
                lines.push(`  ✅ ${companyName} 達 ${memberCount} 人規模，符合職安法補助門檻`);
                lines.push("申請窗口：每年1月及7月 | 主管機關：勞動部職業安全衛生署");
                lines.push("");
              }

              // ── Summary & next steps ──
              const totalMax = (500000) +
                (soonSeniority.length > 0 ? soonSeniority.length * 6000 : 0) +
                (memberCount >= 50 ? 100000 : 0);

              lines.push(`📊 合計最高可申請：NT$${totalMax.toLocaleString()}`);
              lines.push("");
              lines.push("建議立即行動：");
              lines.push("  1. 商業服務業智慧轉型補助 — 本月（3月）是申請窗口，優先處理");
              if (soonSeniority.length > 0) lines.push("  2. 數位轉型培訓補助 — 追蹤年資到達日期，及時申請");
              lines.push("  如需協助準備申請文件或填寫申請表，請直接告訴我。");
              lines.push("");
              lines.push("💡 額外提醒：");
              lines.push("  若公司員工使用 Atlas 申請彈性育嬰假（按日請假），");
              lines.push("  雇主每日可向勞保局申請 NT$1,000 友善家庭雇主獎勵。");
              lines.push("  Atlas 可自動偵測符合條件的申請並協助草擬請領文件。");
              lines.push("  🔗 勞保局：https://www.bli.gov.tw");
              lines.push("");
              lines.push("---");
              lines.push("⚠️ 免責聲明：以上補助資訊依據 2026 年度已知方案整理，實際資格與金額以各主管機關公告為準。建議申請前諮詢專業勞資顧問或直接洽詢主管機關確認。");
              lines.push("Disclaimer: Based on known 2026 programs. Verify with the relevant agency or a labor affairs consultant before applying.");

              const header = `💰 補助獵人 Subsidy Hunter — ${companyName}\n\n共發現 ${found} 項符合資格的補助，合計最高 NT$${totalMax.toLocaleString()}\n\n`;
              results.push(header + lines.join("\n"));
            } catch (e: any) {
              results.push(`Subsidy Hunter 執行失敗：${e?.message || "未知錯誤"}`);
            }
            break;
          }

          case "ANALYZE_TRENDS": {
            try {
              const now3 = new Date();
              const threeMonthsAgo = new Date(now3.getFullYear(), now3.getMonth() - 2, 1).toISOString();
              const monthNames = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];

              const { data: recentSubs } = await supabase
                .from("workflow_submissions")
                .select("form_type, status, form_data, created_at, submitter_name, submitted_by")
                .eq("organization_id", orgId)
                .gte("created_at", threeMonthsAgo)
                .order("created_at", { ascending: false });

              const subs = recentSubs || [];
              if (subs.length === 0) {
                results.push("📊 近3個月內尚無申請紀錄。\n\nNo submissions found in the past 3 months.");
                break;
              }

              // Group by month
              const byMonth: Record<string, { leave: number; overtime: number; business_trip: number; total: number }> = {};
              const byType: Record<string, number> = { leave: 0, overtime: 0, business_trip: 0 };
              const byStatus: Record<string, number> = { pending: 0, approved: 0, rejected: 0 };
              const byPerson: Record<string, number> = {};
              const leaveTypes: Record<string, number> = {};

              for (const s of subs) {
                const d = new Date(s.created_at);
                const key = `${d.getFullYear()}/${monthNames[d.getMonth()]}`;
                if (!byMonth[key]) byMonth[key] = { leave: 0, overtime: 0, business_trip: 0, total: 0 };
                byMonth[key][s.form_type as keyof typeof byMonth[string]] = (byMonth[key][s.form_type as keyof typeof byMonth[string]] as number || 0) + 1;
                byMonth[key].total++;
                byType[s.form_type] = (byType[s.form_type] || 0) + 1;
                byStatus[s.status] = (byStatus[s.status] || 0) + 1;
                const name = s.submitter_name || s.submitted_by?.slice(0, 12) || "未知";
                byPerson[name] = (byPerson[name] || 0) + 1;
                if (s.form_type === "leave" && s.form_data?.leave_type) {
                  leaveTypes[s.form_data.leave_type] = (leaveTypes[s.form_data.leave_type] || 0) + 1;
                }
              }

              const approvalRate = subs.length > 0
                ? Math.round(((byStatus.approved || 0) / subs.length) * 100)
                : 0;

              const topPersons = Object.entries(byPerson)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3);

              const topLeaveTypes = Object.entries(leaveTypes)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3);

              const lines: string[] = [];
              lines.push("📊 近3個月勞工申請趨勢分析");
              lines.push(`分析期間：${threeMonthsAgo.slice(0,7)} → ${now3.toISOString().slice(0,7)}`);
              lines.push(`總申請件數：${subs.length} 件`);
              lines.push("");

              lines.push("── 按月份分佈 ──");
              for (const [month, data] of Object.entries(byMonth)) {
                lines.push(`${month}：共 ${data.total} 件（請假 ${data.leave}、加班 ${data.overtime}、出差 ${data.business_trip}）`);
              }
              lines.push("");

              lines.push("── 申請類型 ──");
              lines.push(`請假 Leave：${byType.leave || 0} 件 (${Math.round(((byType.leave||0)/subs.length)*100)}%)`);
              lines.push(`加班 Overtime：${byType.overtime || 0} 件 (${Math.round(((byType.overtime||0)/subs.length)*100)}%)`);
              lines.push(`出差 Business Trip：${byType.business_trip || 0} 件 (${Math.round(((byType.business_trip||0)/subs.length)*100)}%)`);
              lines.push("");

              lines.push("── 審核狀況 ──");
              lines.push(`✅ 核准：${byStatus.approved || 0} 件 | ⏳ 待審：${byStatus.pending || 0} 件 | ❌ 駁回：${byStatus.rejected || 0} 件`);
              lines.push(`整體核准率：${approvalRate}%`);
              lines.push("");

              if (topPersons.length > 0) {
                lines.push("── 申請最多員工 Top 3 ──");
                topPersons.forEach(([name, count], i) => {
                  lines.push(`${i+1}. ${name}：${count} 件`);
                });
                lines.push("");
              }

              if (topLeaveTypes.length > 0) {
                lines.push("── 最常見請假類型 ──");
                topLeaveTypes.forEach(([type, count]) => {
                  lines.push(`${type}：${count} 件`);
                });
                lines.push("");
              }

              // Insights
              lines.push("── 洞察 Insights ──");
              if ((byStatus.pending || 0) > 3) lines.push(`⚠️ 目前有 ${byStatus.pending} 件待審核，建議盡快處理`);
              if (approvalRate < 80) lines.push(`⚠️ 核准率偏低（${approvalRate}%），建議檢視駁回原因`);
              if ((byType.overtime || 0) > (byType.leave || 0)) lines.push("📈 加班申請多於請假申請，注意員工工時是否過高");
              if (approvalRate >= 90) lines.push("✅ 核准率良好，申請流程運作順暢");

              results.push(lines.join("\n"));
            } catch (e: any) {
              results.push(`趨勢分析執行失敗：${e?.message || "未知錯誤"}`);
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
