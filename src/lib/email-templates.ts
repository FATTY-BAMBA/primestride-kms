export const invitationEmail = ({
  inviteUrl,
  organizationName,
  inviterEmail,
  role,
}: {
  inviteUrl: string;
  organizationName: string;
  inviterEmail: string;
  role: string;
}) => {
  return {
    subject: `${inviterEmail} invited you to join ${organizationName} on PrimeStride Atlas`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          
          <!-- Header -->
          <div style="text-align: center; margin-bottom: 32px;">
            <div style="width: 56px; height: 56px; background: linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%); border-radius: 14px; display: inline-flex; align-items: center; justify-content: center; font-size: 28px; margin-bottom: 16px;">
              🧭
            </div>
            <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #111827;">PrimeStride Atlas</h1>
          </div>

          <!-- Personal Touch -->
          <div style="background: #F8F7FF; border-left: 4px solid #7C3AED; padding: 20px; margin-bottom: 24px; border-radius: 8px;">
            <p style="margin: 0; font-size: 16px; color: #374151;">
              <strong style="color: #7C3AED;">${inviterEmail}</strong> from <strong>${organizationName}</strong> invited you to join their team.
            </p>
          </div>

          <!-- Main Content -->
          <div style="background: white; border: 1px solid #E5E7EB; border-radius: 12px; padding: 32px; margin-bottom: 24px;">
            <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #111827;">
              You've been invited! 🎉
            </h2>
            
            <p style="margin: 0 0 16px 0; color: #6B7280; font-size: 15px;">
              You've been invited to join as a <strong>${role}</strong> on PrimeStride Atlas.
            </p>

            <p style="margin: 0 0 24px 0; color: #6B7280; font-size: 15px;">
              PrimeStride Atlas is a performance-aware knowledge management system that helps teams create, share, and improve documentation through real-time feedback.
            </p>

            <!-- CTA Button -->
            <div style="text-align: center;">
              <a href="${inviteUrl}" style="display: inline-block; background: linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px rgba(124, 58, 237, 0.25);">
                Accept Invitation →
              </a>
            </div>
          </div>

          <!-- Info Box -->
          <div style="background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
            <p style="margin: 0; font-size: 14px; color: #92400E;">
              <strong>⏰ This invitation expires in 7 days</strong>
            </p>
          </div>

          <!-- Reply Note -->
          <div style="background: #F3F4F6; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
            <p style="margin: 0; font-size: 14px; color: #6B7280;">
              💬 Have questions? Just reply to this email to reach <strong>${inviterEmail}</strong> directly.
            </p>
          </div>

          <!-- Alternative Link -->
          <p style="color: #9CA3AF; font-size: 13px; text-align: center; margin: 24px 0;">
            If the button doesn't work, copy and paste this link:
          </p>
          <p style="color: #6B7280; font-size: 12px; text-align: center; word-break: break-all; background: #F3F4F6; padding: 12px; border-radius: 6px; font-family: monospace;">
            ${inviteUrl}
          </p>

          <!-- Footer -->
          <div style="border-top: 1px solid #E5E7EB; padding-top: 24px; margin-top: 32px; text-align: center;">
            <p style="color: #9CA3AF; font-size: 13px; margin: 0;">
              © ${new Date().getFullYear()} PrimeStride Atlas
            </p>
          </div>

        </body>
      </html>
    `,
    text: `
${inviterEmail} from ${organizationName} invited you to join their team on PrimeStride Atlas!

You've been invited as a ${role}.

Accept your invitation:
${inviteUrl}

This invitation expires in 7 days.

Have questions? Reply to this email to reach ${inviterEmail} directly.

© ${new Date().getFullYear()} PrimeStride Atlas
    `.trim(),
  };
};