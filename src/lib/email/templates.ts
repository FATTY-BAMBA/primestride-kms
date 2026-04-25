// src/lib/email/templates.ts
// Email templates for clock-in feature notifications.
// Uses existing Resend setup (RESEND_API_KEY + EMAIL_FROM env vars).

import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const EMAIL_FROM = process.env.EMAIL_FROM || 'Atlas EIP <noreply@primestrideatlas.com>';

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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
