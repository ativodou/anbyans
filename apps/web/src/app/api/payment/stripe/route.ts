import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const Stripe = (await import("stripe")).default;
    const raw = process.env.STRIPE_SECRET_KEY ?? "";
    const secretKey = raw.trim();
    const stripe = new Stripe(secretKey);

    const { amount, applicationFeeAmount, currency = "usd", eventName, seats, connectedAccountId, ticketAmount, barTabAmount, serviceFee } = await req.json();

    const metadata: Record<string, string> = { eventName, seats: String(seats) };
    if (ticketAmount  != null) metadata.tickets    = `$${Number(ticketAmount).toFixed(2)}`;
    if (barTabAmount  != null && Number(barTabAmount) > 0) metadata.bar_food_preorder = `$${Number(barTabAmount).toFixed(2)}`;
    if (serviceFee    != null) metadata.platform_fee = `$${Number(serviceFee).toFixed(2)}`;

    const params: any = {
      amount: Math.round(amount * 100),
      currency,
      description: barTabAmount > 0
        ? `${eventName} — ${seats} ticket(s) + bar/food pre-order`
        : `${eventName} — ${seats} ticket(s)`,
      metadata,
      automatic_payment_methods: { enabled: true },
    };

    // If organizer has a Stripe Connect account, split the payment
    if (connectedAccountId) {
      params.application_fee_amount = Math.round((applicationFeeAmount ?? 0) * 100);
      params.transfer_data = { destination: connectedAccountId };
    }

    const paymentIntent = await stripe.paymentIntents.create(params);
    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const code = (err as any)?.code ?? null;
    const type = (err as any)?.type ?? null;
    return NextResponse.json({ error: message, code, type }, { status: 500 });
  }
}
