import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const FROM = 'Anbyans <noreply@anbyans.com>';

export async function POST(req: NextRequest) {
  try {
    const { type, to, data } = await req.json();

    if (!process.env.RESEND_API_KEY) {
      console.warn('RESEND_API_KEY not set — email skipped');
      return NextResponse.json({ skipped: true });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    let subject = '';
    let html = '';

    if (type === 'organizer_approved') {
      subject = 'Kont òganizatè ou a aprouve! 🎉';
      html = `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
          <h2 style="color:#f97316;">Felisitasyon, ${data.firstName}!</h2>
          <p>Kont òganizatè ou a sou Anbyans <strong>aprouve</strong>. Ou ka kounye a kreye evenman ak vann tikè.</p>
          <a href="https://anbyans.vercel.app/organizer/dashboard" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#f97316;color:#000;border-radius:8px;text-decoration:none;font-weight:bold;">
            Ale nan Dashboard ou
          </a>
          <p style="color:#888;font-size:12px;margin-top:24px;">Ekip Anbyans</p>
        </div>
      `;
    } else if (type === 'organizer_rejected') {
      subject = 'Demann òganizatè ou a pa aprouve';
      html = `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
          <h2 style="color:#ef4444;">Bonswa ${data.firstName},</h2>
          <p>Regrèt — demann òganizatè ou a sou Anbyans <strong>pa aprouve</strong> pou kounye a.</p>
          <p>Si ou kwè se yon erè, kontakte nou nan <a href="mailto:anbyanssa@gmail.com">anbyanssa@gmail.com</a>.</p>
          <p style="color:#888;font-size:12px;margin-top:24px;">Ekip Anbyans</p>
        </div>
      `;
    } else if (type === 'payout_paid') {
      subject = `Peman ou a trete — $${data.amount}`;
      html = `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
          <h2 style="color:#22c55e;">Peman Voye! 💸</h2>
          <p>Bonswa ${data.firstName}, peman <strong>$${data.amount}</strong> via <strong>${data.method}</strong> te trete.</p>
          <p style="color:#888;font-size:12px;margin-top:24px;">Ekip Anbyans</p>
        </div>
      `;
    } else if (type === 'payout_rejected') {
      subject = 'Demann peman ou a pa aprouve';
      html = `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
          <h2 style="color:#ef4444;">Bonswa ${data.firstName},</h2>
          <p>Demann peman <strong>$${data.amount}</strong> ou a pa aprouve. Kontakte nou pou plis detay.</p>
          <p style="color:#888;font-size:12px;margin-top:24px;">Ekip Anbyans</p>
        </div>
      `;
    } else if (type === 'ticket_verified') {
      subject = 'Tikè ou a verifye ✅';
      html = `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
          <h2 style="color:#22c55e;">Tikè Verifye!</h2>
          <p>Bonswa ${data.buyerName}, peman tikè ou a <strong>konfime</strong>. Tikè ou a aktif.</p>
          <p style="font-family:monospace;font-size:18px;font-weight:bold;letter-spacing:2px;">${data.ticketCode}</p>
          <p style="color:#888;font-size:12px;margin-top:24px;">Ekip Anbyans</p>
        </div>
      `;
    } else if (type === 'suspended') {
      subject = 'Kont ou a suspann';
      html = `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
          <h2 style="color:#ef4444;">Kont Suspann</h2>
          <p>Bonswa ${data.firstName}, kont Anbyans ou a suspann tanporèman. Kontakte nou pou plis enfòmasyon.</p>
          <a href="mailto:anbyanssa@gmail.com" style="color:#f97316;">anbyanssa@gmail.com</a>
          <p style="color:#888;font-size:12px;margin-top:24px;">Ekip Anbyans</p>
        </div>
      `;
    } else {
      return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
    }

    await resend.emails.send({ from: FROM, to, subject, html });
    return NextResponse.json({ sent: true });
  } catch (e: any) {
    console.error('notify error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
