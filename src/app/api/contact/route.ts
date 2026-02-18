import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { name, email, company, message } = await request.json();

    // Validate required fields
    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'Name, email, and message are required' },
        { status: 400 }
      );
    }

    // Send email to your inbox
    await resend.emails.send({
      from: process.env.EMAIL_FROM || 'PrimeStride Atlas <onboarding@resend.dev>',
      to: ['primestrideai@gmail.com'],
      subject: `[Atlas 聯繫表單] ${name} - ${company || 'No company'}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4f6df5;">新的聯繫表單訊息</h2>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p><strong>姓名：</strong> ${name}</p>
          <p><strong>電子郵件：</strong> <a href="mailto:${email}">${email}</a></p>
          <p><strong>公司 / 組織：</strong> ${company || '未填寫'}</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p><strong>訊息內容：</strong></p>
          <div style="background: #f7f8fb; padding: 16px; border-radius: 8px; white-space: pre-wrap;">
${message}
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #999;">此訊息來自 PrimeStride Atlas 網站聯繫表單</p>
        </div>
      `,
    });

    // Send confirmation to the person who filled out the form
    await resend.emails.send({
      from: process.env.EMAIL_FROM || 'PrimeStride Atlas <onboarding@resend.dev>',
      to: [email],
      subject: '感謝您聯繫 PrimeStride Atlas',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4f6df5;">感謝您的來信！</h2>
          <p>嗨 ${name}，</p>
          <p>我們已收到您的訊息，會盡快回覆您。通常會在 24 小時內回覆。</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p><strong>您的訊息：</strong></p>
          <div style="background: #f7f8fb; padding: 16px; border-radius: 8px; white-space: pre-wrap;">
${message}
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p>PrimeStride Atlas 團隊</p>
          <p style="font-size: 12px; color: #999;">
            <a href="https://primestrideatlas.com" style="color: #4f6df5;">primestrideatlas.com</a>
          </p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Contact form error:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
