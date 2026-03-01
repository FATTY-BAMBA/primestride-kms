import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM || "PrimeStride Atlas <hello@primestrideatlas.com>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://primestrideatlas.com";

// ══════════════════════════════════════════════════════════════
// WORKFLOW EMAIL NOTIFICATIONS
// ══════════════════════════════════════════════════════════════

const formLabels: Record<string, { zh: string; en: string; icon: string; color: string }> = {
  leave: { zh: "請假", en: "Leave", icon: "📝", color: "#7C3AED" },
  overtime: { zh: "加班", en: "Overtime", icon: "🕐", color: "#2563EB" },
  business_trip: { zh: "出差", en: "Business Trip", icon: "✈️", color: "#059669" },
};

const fieldLabelsZh: Record<string, string> = {
  leave_type: "假別", start_date: "開始日期", end_date: "結束日期", days: "天數",
  reason: "事由", proxy: "職務代理人", date: "日期", start_time: "開始時間",
  end_time: "結束時間", hours: "時數", overtime_type: "加班類別",
  project: "專案", destination: "目的地", purpose: "目的", transport: "交通",
};

// ── Notify admins: new submission ──
export async function notifyAdminsNewSubmission(params: {
  adminEmails: string[];
  submitterName: string;
  formType: string;
  formData: Record<string, any>;
  originalText?: string;
}) {
  const { adminEmails, submitterName, formType, formData, originalText } = params;
  const fl = formLabels[formType] || formLabels.leave;

  const detailRows = Object.entries(formData)
    .filter(([_, v]) => v && v !== "null")
    .map(([k, v]) => `
      <tr>
        <td style="padding:6px 12px;font-size:13px;color:#6B7280;border-bottom:1px solid #F3F4F6;">${fieldLabelsZh[k] || k}</td>
        <td style="padding:6px 12px;font-size:14px;color:#111827;font-weight:600;border-bottom:1px solid #F3F4F6;">${String(v)}</td>
      </tr>
    `).join("");

  const subject = `${fl.icon} 新${fl.zh}申請 — ${submitterName} | New ${fl.en} Request`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
    <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;background:#F9FAFB;">
      
      <!-- Header -->
      <div style="text-align:center;margin-bottom:24px;">
        <div style="width:48px;height:48px;background:linear-gradient(135deg,#7C3AED,#A78BFA);border-radius:12px;display:inline-block;line-height:48px;font-size:24px;margin-bottom:8px;">🧭</div>
        <h2 style="margin:0;font-size:18px;color:#111827;">PrimeStride Atlas</h2>
      </div>

      <!-- Alert Banner -->
      <div style="background:${fl.color};color:white;padding:16px 20px;border-radius:12px 12px 0 0;text-align:center;">
        <div style="font-size:28px;margin-bottom:4px;">${fl.icon}</div>
        <div style="font-size:16px;font-weight:700;">新${fl.zh}申請 New ${fl.en} Request</div>
        <div style="font-size:13px;opacity:0.9;margin-top:2px;">來自 ${submitterName}</div>
      </div>

      <!-- Content -->
      <div style="background:white;padding:24px;border:1px solid #E5E7EB;border-top:none;border-radius:0 0 12px 12px;">
        <table style="width:100%;border-collapse:collapse;">
          ${detailRows}
        </table>

        ${originalText ? `
          <div style="margin-top:16px;padding:10px 14px;background:#F5F3FF;border-radius:8px;font-size:13px;color:#6B7280;">
            💬 原始輸入: ${originalText}
          </div>
        ` : ""}

        <!-- CTA Button -->
        <div style="text-align:center;margin-top:24px;">
          <a href="${APP_URL}/admin" 
             style="display:inline-block;padding:12px 32px;background:${fl.color};color:white;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;">
            📋 前往審核 Review Now →
          </a>
        </div>
        
        <p style="text-align:center;font-size:12px;color:#9CA3AF;margin-top:16px;">
          登入管理員儀表板審核此申請 | Log in to review this request
        </p>
      </div>

      <!-- Footer -->
      <div style="text-align:center;margin-top:20px;font-size:11px;color:#9CA3AF;">
        PrimeStride Atlas — AI-Powered Enterprise Platform<br>
        此為系統自動通知，請勿直接回覆
      </div>
    </body>
    </html>
  `;

  // Send to all admins
  for (const email of adminEmails) {
    try {
      await resend.emails.send({ from: FROM, to: email, subject, html });
    } catch (err) {
      console.error(`Failed to notify admin ${email}:`, err);
    }
  }
}

// ── Notify submitter: approved/rejected ──
export async function notifySubmitterStatus(params: {
  submitterEmail: string;
  submitterName: string;
  reviewerName: string;
  formType: string;
  formData: Record<string, any>;
  status: "approved" | "rejected";
  reviewNote?: string;
}) {
  const { submitterEmail, submitterName, reviewerName, formType, formData, status, reviewNote } = params;
  const fl = formLabels[formType] || formLabels.leave;

  const isApproved = status === "approved";
  const statusEmoji = isApproved ? "✅" : "❌";
  const statusZh = isApproved ? "已核准" : "已駁回";
  const statusEn = isApproved ? "Approved" : "Rejected";
  const statusColor = isApproved ? "#059669" : "#DC2626";
  const statusBg = isApproved ? "#D1FAE5" : "#FEE2E2";

  const detail = formData.days ? `${formData.days} 天` : formData.hours ? `${formData.hours} 小時` : "";

  const subject = `${statusEmoji} ${fl.zh}申請${statusZh} | ${fl.en} Request ${statusEn}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
    <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;background:#F9FAFB;">
      
      <!-- Header -->
      <div style="text-align:center;margin-bottom:24px;">
        <div style="width:48px;height:48px;background:linear-gradient(135deg,#7C3AED,#A78BFA);border-radius:12px;display:inline-block;line-height:48px;font-size:24px;margin-bottom:8px;">🧭</div>
        <h2 style="margin:0;font-size:18px;color:#111827;">PrimeStride Atlas</h2>
      </div>

      <!-- Status Banner -->
      <div style="background:${statusBg};border:2px solid ${statusColor};padding:24px;border-radius:12px;text-align:center;margin-bottom:20px;">
        <div style="font-size:48px;margin-bottom:8px;">${statusEmoji}</div>
        <div style="font-size:20px;font-weight:800;color:${statusColor};">${fl.zh}申請${statusZh}</div>
        <div style="font-size:14px;color:${statusColor};opacity:0.8;margin-top:4px;">${fl.en} Request ${statusEn}</div>
      </div>

      <!-- Details -->
      <div style="background:white;padding:24px;border:1px solid #E5E7EB;border-radius:12px;">
        <div style="font-size:14px;color:#6B7280;margin-bottom:12px;">
          Hi ${submitterName}，您的${fl.zh}申請已由 <strong>${reviewerName}</strong> ${statusZh}。
        </div>

        <div style="display:flex;gap:12px;margin-bottom:16px;">
          <div style="padding:10px 16px;background:#F9FAFB;border-radius:8px;flex:1;text-align:center;">
            <div style="font-size:11px;color:#9CA3AF;">類型</div>
            <div style="font-size:14px;font-weight:700;color:#111827;">${fl.icon} ${fl.zh} ${fl.en}</div>
          </div>
          ${detail ? `
          <div style="padding:10px 16px;background:#F9FAFB;border-radius:8px;flex:1;text-align:center;">
            <div style="font-size:11px;color:#9CA3AF;">期間</div>
            <div style="font-size:14px;font-weight:700;color:#111827;">${detail}</div>
          </div>
          ` : ""}
        </div>

        ${formData.start_date ? `
        <div style="padding:8px 12px;background:#F9FAFB;border-radius:8px;font-size:13px;color:#374151;margin-bottom:12px;">
          📅 ${formData.start_date}${formData.end_date && formData.end_date !== formData.start_date ? ` → ${formData.end_date}` : ""}
          ${formData.leave_type ? ` · ${formData.leave_type}` : ""}
          ${formData.overtime_type ? ` · ${formData.overtime_type}` : ""}
        </div>
        ` : ""}

        ${reviewNote ? `
        <div style="padding:12px 16px;background:#FFF7ED;border-left:3px solid #F59E0B;border-radius:0 8px 8px 0;font-size:13px;color:#92400E;margin-bottom:12px;">
          💬 審核備註: ${reviewNote}
        </div>
        ` : ""}

        <!-- CTA -->
        <div style="text-align:center;margin-top:20px;">
          <a href="${APP_URL}/workflows"
             style="display:inline-block;padding:10px 28px;background:#7C3AED;color:white;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px;">
            查看詳情 View Details →
          </a>
        </div>
      </div>

      <!-- Footer -->
      <div style="text-align:center;margin-top:20px;font-size:11px;color:#9CA3AF;">
        PrimeStride Atlas — AI-Powered Enterprise Platform<br>
        此為系統自動通知，請勿直接回覆
      </div>
    </body>
    </html>
  `;

  try {
    await resend.emails.send({ from: FROM, to: submitterEmail, subject, html });
  } catch (err) {
    console.error(`Failed to notify submitter ${submitterEmail}:`, err);
  }
}
