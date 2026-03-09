import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const Stripe = (await import("stripe")).default;
    const raw = process.env.STRIPE_SECRET_KEY ?? "";
    const secretKey = raw.replace(/[^a-zA-Z0-9_]/g, "");
    const stripe = new Stripe(secretKey);
    const { amount, currency = "usd", eventName, seats } = await req.json();
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency,
      metadata: { eventName, seats: String(seats) },
    });
    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const code = (err as any)?.code ?? null;
    const type = (err as any)?.type ?? null;
    return NextResponse.json({ error: message, code, type }, { status: 500 });
  }
}
