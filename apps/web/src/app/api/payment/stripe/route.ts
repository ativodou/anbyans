import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
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
    const raw = (err as any)?.raw ?? null;
    console.error("STRIPE ERROR:", { message, code, type, raw });
    return NextResponse.json({ error: message, code, type }, { status: 500 });
  }
}
