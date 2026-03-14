import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST /api/stripe/connect
// Creates a Stripe Connect account for the organizer and returns onboarding URL
export async function POST(req: NextRequest) {
  try {
    const Stripe = (await import('stripe')).default;
    const raw = process.env.STRIPE_SECRET_KEY ?? '';
    const secretKey = raw.replace(/[^a-zA-Z0-9_]/g, '');
    const stripe = new Stripe(secretKey);

    const { organizerId, email, returnUrl, refreshUrl } = await req.json();
    if (!organizerId || !email) {
      return NextResponse.json({ error: 'organizerId and email required' }, { status: 400 });
    }

    // Create a Stripe Express account for the organizer
    const account = await stripe.accounts.create({
      type: 'express',
      email,
      capabilities: { transfers: { requested: true }, card_payments: { requested: true } },
      metadata: { organizerId },
    });

    // Create onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: refreshUrl || `${process.env.NEXT_PUBLIC_BASE_URL || 'https://anbyans.events'}/organizer/settings?stripe=refresh`,
      return_url:  returnUrl  || `${process.env.NEXT_PUBLIC_BASE_URL || 'https://anbyans.events'}/organizer/settings?stripe=success`,
      type: 'account_onboarding',
    });

    return NextResponse.json({ accountId: account.id, onboardingUrl: accountLink.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/stripe/connect?accountId=acct_xxx
// Returns account status
export async function GET(req: NextRequest) {
  try {
    const Stripe = (await import('stripe')).default;
    const raw = process.env.STRIPE_SECRET_KEY ?? '';
    const secretKey = raw.replace(/[^a-zA-Z0-9_]/g, '');
    const stripe = new Stripe(secretKey);

    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get('accountId');
    if (!accountId) return NextResponse.json({ error: 'accountId required' }, { status: 400 });

    const account = await stripe.accounts.retrieve(accountId);
    return NextResponse.json({
      id: account.id,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
