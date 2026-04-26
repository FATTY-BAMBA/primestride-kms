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