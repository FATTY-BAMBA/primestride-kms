// src/lib/email/templates.ts
// Email templates for clock-in feature notifications.
// Uses existing Resend setup (RESEND_API_KEY + EMAIL_FROM env vars).

import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const EMAIL_FROM = process.env.EMAIL_FROM || 'Atlas EIP <noreply@primestrideatlas.com>';

// ── Types ─────────────────────────────────────────────────────────────────

export type ManualEntryEmailContext = {
  organizationId: string;
  requesterUserId: string;
  requesterName: string;
  workDate: string;
  requestedClockIn: string | null;
  requestedClockOut: string | null;
  reasonLabel: string;
  reasonNote: string | null;
  dashboardUrl: string;
};

export type ManualEntryResolutionContext = {
  organizationId: string;
  requesterUserId: string;
  requesterName: string;
  workDate: string;
  requestedClockIn: string | null;
  requestedClockOut: string | null;
  resolverName: string;
  resolutionNote: string | null;
  dashboardUrl: string;
};

// ── Shared helpers ────────────────────────────────────────────────────────

/** Format ISO timestamp to Taipei HH:mm. */
function formatTaipei(iso: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Taipei',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Submission notification (admins) ──────────────────────────────────────

export async function sendManualEntrySubmittedEmail(
  toEmails: string[],
  ctx: ManualEntryEmailContext,
): Promise<{ ok: boolean; error?: string }> {
  if (!resend) {
    // eslint-disable-next-line no-console
    console.warn('[email] RESEND_API_KEY missing, skipping email');
    return { ok: false, error: 'resend_not_configured' };
  }
  if (toEmails.length === 0) {
    return { ok: false, error: 'no_recipients' };
  }

  const subject = `[Atlas EIP] 新的補登申請 / New manual entry request — ${ctx.requesterName}`;

  const html = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:system-ui,-apple-system,'PingFang TC','Microsoft JhengHei',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F9FAFB;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="background:#FFFFFF;border-radius:12px;border:1px solid #E5E7EB;overflow:hidden;">
          <tr>
            <td style="padding:24px 28px 8px;">
              <div style="font-size:13px;color:#6B7280;letter-spacing:1px;">ATLAS EIP</div>
              <h1 style="margin:8px 0 0;font-size:20px;color:#111827;font-weight:700;">新的補登申請待審核</h1>
              <p style="margin:4px 0 0;font-size:14px;color:#6B7280;">New manual entry request awaiting your approval</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #E5E7EB;border-radius:8px;">
                <tr><td style="padding:12px 16px;border-bottom:1px solid #E5E7EB;font-size:13px;color:#6B7280;">員工 / Employee</td><td style="padding:12px 16px;border-bottom:1px solid #E5E7EB;font-size:14px;color:#111827;font-weight:600;">${escapeHtml(ctx.requesterName)}</td></tr>
                <tr><td style="padding:12px 16px;border-bottom:1px solid #E5E7EB;font-size:13px;color:#6B7280;">工作日期 / Work date</td><td style="padding:12px 16px;border-bottom:1px solid #E5E7EB;font-size:14px;color:#111827;">${escapeHtml(ctx.workDate)}</td></tr>
                <tr><td style="padding:12px 16px;border-bottom:1px solid #E5E7EB;font-size:13px;color:#6B7280;">上班時間 / Clock-in</td><td style="padding:12px 16px;border-bottom:1px solid #E5E7EB;font-size:14px;color:#111827;">${formatTaipei(ctx.requestedClockIn)}</td></tr>
                <tr><td style="padding:12px 16px;border-bottom:1px solid #E5E7EB;font-size:13px;color:#6B7280;">下班時間 / Clock-out</td><td style="padding:12px 16px;border-bottom:1px solid #E5E7EB;font-size:14px;color:#111827;">${formatTaipei(ctx.requestedClockOut)}</td></tr>
                <tr><td style="padding:12px 16px;border-bottom:1px solid #E5E7EB;font-size:13px;color:#6B7280;">原因 / Reason</td><td style="padding:12px 16px;border-bottom:1px solid #E5E7EB;font-size:14px;color:#111827;">${escapeHtml(ctx.reasonLabel)}</td></tr>
                ${ctx.reasonNote ? `<tr><td style="padding:12px 16px;font-size:13px;color:#6B7280;vertical-align:top;">說明 / Note</td><td style="padding:12px 16px;font-size:14px;color:#111827;">${escapeHtml(ctx.reasonNote)}</td></tr>` : ''}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 28px;" align="center">
              <a href="${ctx.dashboardUrl}" style="display:inline-block;background:#7C3AED;color:#FFFFFF;text-decoration:none;font-weight:600;font-size:15px;padding:12px 28px;border-radius:8px;">前往審核 / Review request →</a>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 24px;background:#F9FAFB;border-top:1px solid #E5E7EB;">
              <p style="margin:0;font-size:12px;color:#9CA3AF;line-height:1.5;">此通知由 Atlas EIP 自動發送。請勿直接回覆此郵件。<br/>This is an automated notification from Atlas EIP. Please do not reply directly.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: toEmails,
      subject,
      html,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'send_failed' };
  }
}

// ── Approval notification (employee) ──────────────────────────────────────

export async function sendManualEntryApprovedEmail(
  toEmail: string,
  ctx: ManualEntryResolutionContext,
): Promise<{ ok: boolean; error?: string }> {
  if (!resend) {
    // eslint-disable-next-line no-console
    console.warn('[email] RESEND_API_KEY missing, skipping email');
    return { ok: false, error: 'resend_not_configured' };
  }
  if (!toEmail) {
    return { ok: false, error: 'no_recipient' };
  }

  const subject = `[Atlas EIP] 您的補登申請已通過 / Your manual entry request was approved`;

  const html = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:system-ui,-apple-system,'PingFang TC','Microsoft JhengHei',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F9FAFB;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="background:#FFFFFF;border-radius:12px;border:1px solid #E5E7EB;overflow:hidden;">
          <tr>
            <td style="padding:24px 28px 8px;border-top:4px solid #10B981;">
              <div style="font-size:13px;color:#6B7280;letter-spacing:1px;">ATLAS EIP</div>
              <h1 style="margin:8px 0 0;font-size:20px;color:#111827;font-weight:700;">✓ 補登申請已通過</h1>
              <p style="margin:4px 0 0;font-size:14px;color:#6B7280;">Your manual entry request has been approved</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px 8px;">
              <p style="margin:0 0 16px;font-size:15px;color:#111827;line-height:1.6;">${escapeHtml(ctx.requesterName)} 您好,</p>
              <p style="margin:0 0 4px;font-size:14px;color:#374151;line-height:1.6;">您 <strong>${escapeHtml(ctx.workDate)}</strong> 的補登打卡申請已由 <strong>${escapeHtml(ctx.resolverName)}</strong> 審核通過。出勤紀錄已更新。</p>
              <p style="margin:0;font-size:13px;color:#6B7280;line-height:1.6;">Your manual entry for <strong>${escapeHtml(ctx.workDate)}</strong> has been approved by <strong>${escapeHtml(ctx.resolverName)}</strong>. Your attendance record has been updated.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #D1FAE5;background:#F0FDF4;border-radius:8px;">
                <tr><td style="padding:12px 16px;border-bottom:1px solid #D1FAE5;font-size:13px;color:#065F46;">工作日期 / Work date</td><td style="padding:12px 16px;border-bottom:1px solid #D1FAE5;font-size:14px;color:#064E3B;font-weight:600;">${escapeHtml(ctx.workDate)}</td></tr>
                <tr><td style="padding:12px 16px;border-bottom:1px solid #D1FAE5;font-size:13px;color:#065F46;">上班時間 / Clock-in</td><td style="padding:12px 16px;border-bottom:1px solid #D1FAE5;font-size:14px;color:#064E3B;">${formatTaipei(ctx.requestedClockIn)}</td></tr>
                <tr><td style="padding:12px 16px;border-bottom:1px solid #D1FAE5;font-size:13px;color:#065F46;">下班時間 / Clock-out</td><td style="padding:12px 16px;border-bottom:1px solid #D1FAE5;font-size:14px;color:#064E3B;">${formatTaipei(ctx.requestedClockOut)}</td></tr>
                <tr><td style="padding:12px 16px;font-size:13px;color:#065F46;">審核人 / Approved by</td><td style="padding:12px 16px;font-size:14px;color:#064E3B;font-weight:600;">${escapeHtml(ctx.resolverName)}</td></tr>
                ${ctx.resolutionNote ? `<tr><td style="padding:12px 16px;border-top:1px solid #D1FAE5;font-size:13px;color:#065F46;vertical-align:top;">備註 / Note</td><td style="padding:12px 16px;border-top:1px solid #D1FAE5;font-size:14px;color:#064E3B;">${escapeHtml(ctx.resolutionNote)}</td></tr>` : ''}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 28px;" align="center">
              <a href="${ctx.dashboardUrl}" style="display:inline-block;background:#10B981;color:#FFFFFF;text-decoration:none;font-weight:600;font-size:15px;padding:12px 28px;border-radius:8px;">查看出勤紀錄 / View attendance →</a>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 24px;background:#F9FAFB;border-top:1px solid #E5E7EB;">
              <p style="margin:0;font-size:12px;color:#9CA3AF;line-height:1.5;">此通知由 Atlas EIP 自動發送。請勿直接回覆此郵件。<br/>This is an automated notification from Atlas EIP. Please do not reply directly.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: [toEmail],
      subject,
      html,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'send_failed' };
  }
}

// ── Rejection notification (employee) ─────────────────────────────────────

export async function sendManualEntryRejectedEmail(
  toEmail: string,
  ctx: ManualEntryResolutionContext,
): Promise<{ ok: boolean; error?: string }> {
  if (!resend) {
    // eslint-disable-next-line no-console
    console.warn('[email] RESEND_API_KEY missing, skipping email');
    return { ok: false, error: 'resend_not_configured' };
  }
  if (!toEmail) {
    return { ok: false, error: 'no_recipient' };
  }

  const subject = `[Atlas EIP] 您的補登申請未通過 / Your manual entry request was not approved`;

  const html = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:system-ui,-apple-system,'PingFang TC','Microsoft JhengHei',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F9FAFB;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="background:#FFFFFF;border-radius:12px;border:1px solid #E5E7EB;overflow:hidden;">
          <tr>
            <td style="padding:24px 28px 8px;border-top:4px solid #F59E0B;">
              <div style="font-size:13px;color:#6B7280;letter-spacing:1px;">ATLAS EIP</div>
              <h1 style="margin:8px 0 0;font-size:20px;color:#111827;font-weight:700;">補登申請未通過</h1>
              <p style="margin:4px 0 0;font-size:14px;color:#6B7280;">Your manual entry request was not approved</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px 8px;">
              <p style="margin:0 0 16px;font-size:15px;color:#111827;line-height:1.6;">${escapeHtml(ctx.requesterName)} 您好,</p>
              <p style="margin:0 0 4px;font-size:14px;color:#374151;line-height:1.6;">您 <strong>${escapeHtml(ctx.workDate)}</strong> 的補登打卡申請經 <strong>${escapeHtml(ctx.resolverName)}</strong> 審核後未通過。詳細原因請見下方說明,如有疑問請與主管聯繫。</p>
              <p style="margin:0;font-size:13px;color:#6B7280;line-height:1.6;">Your manual entry for <strong>${escapeHtml(ctx.workDate)}</strong> was reviewed by <strong>${escapeHtml(ctx.resolverName)}</strong> and not approved. Please see the reason below, and contact your manager with any questions.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #E5E7EB;border-radius:8px;">
                <tr><td style="padding:12px 16px;border-bottom:1px solid #E5E7EB;font-size:13px;color:#6B7280;">工作日期 / Work date</td><td style="padding:12px 16px;border-bottom:1px solid #E5E7EB;font-size:14px;color:#111827;font-weight:600;">${escapeHtml(ctx.workDate)}</td></tr>
                <tr><td style="padding:12px 16px;border-bottom:1px solid #E5E7EB;font-size:13px;color:#6B7280;">申請的上班時間 / Requested clock-in</td><td style="padding:12px 16px;border-bottom:1px solid #E5E7EB;font-size:14px;color:#111827;">${formatTaipei(ctx.requestedClockIn)}</td></tr>
                <tr><td style="padding:12px 16px;border-bottom:1px solid #E5E7EB;font-size:13px;color:#6B7280;">申請的下班時間 / Requested clock-out</td><td style="padding:12px 16px;border-bottom:1px solid #E5E7EB;font-size:14px;color:#111827;">${formatTaipei(ctx.requestedClockOut)}</td></tr>
                <tr><td style="padding:12px 16px;font-size:13px;color:#6B7280;">審核人 / Reviewed by</td><td style="padding:12px 16px;font-size:14px;color:#111827;font-weight:600;">${escapeHtml(ctx.resolverName)}</td></tr>
              </table>
            </td>
          </tr>
          ${ctx.resolutionNote ? `
          <tr>
            <td style="padding:8px 28px 16px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #FDE68A;background:#FFFBEB;border-radius:8px;">
                <tr>
                  <td style="padding:14px 16px;">
                    <div style="font-size:12px;color:#92400E;font-weight:600;letter-spacing:0.4px;text-transform:uppercase;margin-bottom:6px;">未通過原因 / Reason</div>
                    <p style="margin:0;font-size:14px;color:#78350F;line-height:1.6;">${escapeHtml(ctx.resolutionNote)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding:0 28px 28px;" align="center">
              <a href="${ctx.dashboardUrl}" style="display:inline-block;background:#7C3AED;color:#FFFFFF;text-decoration:none;font-weight:600;font-size:15px;padding:12px 28px;border-radius:8px;">重新提交申請 / Submit a new request →</a>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 24px;background:#F9FAFB;border-top:1px solid #E5E7EB;">
              <p style="margin:0;font-size:12px;color:#9CA3AF;line-height:1.5;">此通知由 Atlas EIP 自動發送。請勿直接回覆此郵件。<br/>This is an automated notification from Atlas EIP. Please do not reply directly.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: [toEmail],
      subject,
      html,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'send_failed' };
  }
}
// ── Absent alert email (sent by late-check cron) ──────────────────────────

export type AbsentAlertContext = {
  adminName: string;
  orgName: string;
  workDate: string;
  absentEmployees: { name: string; email: string }[];
  dashboardUrl: string;
};

export async function sendAbsentAlertEmail(
  to: string,
  ctx: AbsentAlertContext,
): Promise<void> {
  if (!resend) {
    console.warn('[sendAbsentAlertEmail] RESEND_API_KEY not set — skipping');
    return;
  }

  const employeeList = ctx.absentEmployees
    .map(e => `<div style="padding:8px 12px;background:#FEF3C7;border-radius:6px;margin-bottom:6px;color:#92400E;font-weight:600;">👤 ${e.name || e.email}</div>`)
    .join('');

  await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject: `⚠️ ${ctx.orgName} — ${ctx.absentEmployees.length} 位員工今日未打卡`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#7C3AED;padding:24px;border-radius:8px 8px 0 0;">
          <h1 style="color:white;margin:0;font-size:20px;">⚠️ 未打卡提醒</h1>
          <p style="color:#DDD6FE;margin:4px 0 0;font-size:14px;">Atlas EIP 出勤監控 · ${ctx.workDate}</p>
        </div>
        <div style="background:white;padding:24px;border:1px solid #E5E7EB;border-radius:0 0 8px 8px;">
          <p style="color:#374151;font-size:15px;"><strong>${ctx.adminName}</strong>，您好：</p>
          <p style="color:#374151;">今日截至上午 10:30，以下 <strong>${ctx.absentEmployees.length} 位員工</strong>尚未打卡：</p>
          <div style="margin:16px 0;">${employeeList}</div>
          <p style="color:#6B7280;font-size:13px;">可能原因：請假未申請、臨時事假、設備問題等。建議盡快確認員工狀況。</p>
          <a href="${ctx.dashboardUrl}/admin"
             style="display:inline-block;background:#7C3AED;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:700;margin-top:8px;">
            前往管理後台 →
          </a>
          <p style="color:#9CA3AF;font-size:11px;margin-top:24px;">Atlas EIP by PrimeStride AI · primestrideatlas.com</p>
        </div>
      </div>
    `,
  });
}

// ── Overtime alert email (sent by overtime-check cron) ────────────────────

export type OvertimeAlertContext = {
  employeeName: string;
  orgName: string;
  workDate: string;
  elapsedHours: number;
  dashboardUrl: string;
  isAdminAlert: boolean;
  flaggedEmployees?: { name: string; email: string; elapsedHours: number }[];
};

export async function sendOvertimeAlertEmail(
  to: string,
  ctx: OvertimeAlertContext,
): Promise<void> {
  if (!resend) {
    console.warn('[sendOvertimeAlertEmail] RESEND_API_KEY not set — skipping');
    return;
  }

  const isAdmin = ctx.isAdminAlert;

  const employeeList = isAdmin && ctx.flaggedEmployees
    ? ctx.flaggedEmployees.map(e =>
        `<div style="padding:8px 12px;background:#FEF3C7;border-radius:6px;margin-bottom:6px;">
          <span style="color:#92400E;font-weight:600;">👤 ${e.name}</span>
          <span style="color:#B45309;font-size:12px;margin-left:8px;">已工作 ${e.elapsedHours} 小時</span>
        </div>`
      ).join('')
    : '';

  const subject = isAdmin
    ? `⏰ ${ctx.orgName} — ${ctx.flaggedEmployees?.length ?? 1} 位員工今日工時超過10小時未申請加班`
    : `⏰ 提醒：您今日已工作 ${ctx.elapsedHours} 小時，是否需要申請加班？`;

  const bodyHtml = isAdmin
    ? `
      <p style="color:#374151;font-size:15px;"><strong>${ctx.employeeName}</strong>，您好：</p>
      <p style="color:#374151;">今日（${ctx.workDate}）以下員工工時已超過 10 小時，但尚未申請加班：</p>
      <div style="margin:16px 0;">${employeeList}</div>
      <p style="color:#6B7280;font-size:13px;">依勞基法第32條，加班需事先申請並核准。請確認員工是否需要補申請。</p>
    `
    : `
      <p style="color:#374151;font-size:15px;"><strong>${ctx.employeeName}</strong>，您好：</p>
      <p style="color:#374151;">您今日（${ctx.workDate}）已工作 <strong>${ctx.elapsedHours} 小時</strong>，系統未偵測到加班申請。</p>
      <p style="color:#374151;">如有加班需求，請盡快透過 Atlas EIP 提交申請，以確保加班費計算正確。</p>
      <p style="color:#6B7280;font-size:13px;">依勞基法第24條，加班費為時薪1.34倍（前2小時）/ 1.67倍（後2小時）。</p>
    `;

  await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#7C3AED;padding:24px;border-radius:8px 8px 0 0;">
          <h1 style="color:white;margin:0;font-size:20px;">⏰ 加班提醒</h1>
          <p style="color:#DDD6FE;margin:4px 0 0;font-size:14px;">Atlas EIP 出勤監控 · ${ctx.workDate}</p>
        </div>
        <div style="background:white;padding:24px;border:1px solid #E5E7EB;border-radius:0 0 8px 8px;">
          ${bodyHtml}
          <a href="${ctx.dashboardUrl}${isAdmin ? '/admin' : '/workflows'}"
             style="display:inline-block;background:#7C3AED;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:700;margin-top:16px;">
            ${isAdmin ? '前往管理後台 →' : '申請加班 →'}
          </a>
          <p style="color:#9CA3AF;font-size:11px;margin-top:24px;">Atlas EIP by PrimeStride AI · primestrideatlas.com</p>
        </div>
      </div>
    `,
  });
}
