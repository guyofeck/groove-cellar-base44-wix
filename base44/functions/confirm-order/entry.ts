import { createClientFromRequest } from "npm:@base44/sdk";

/**
 * Confirms payment for an order and finalizes it: marks the order "paid" and
 * decrements stock for each purchased record.
 *
 * Request body: { order_id: string, session_id?: string, simulated?: boolean }
 * Response: { order }
 *
 * With a real Stripe session_id and a STRIPE_SECRET_KEY, the Stripe session is
 * verified as paid before finalizing. Simulated checkouts are accepted directly.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Not authenticated." }, { status: 401 });
    }

    const { order_id, session_id, simulated } = await req.json();
    if (!order_id) {
      return Response.json({ error: "order_id is required." }, { status: 400 });
    }

    const order = await base44.asServiceRole.entities.Order.get(order_id);
    if (!order) {
      return Response.json({ error: "Order not found." }, { status: 404 });
    }

    // Only the owner may confirm their own order.
    if (order.created_by !== user.email && user.role !== "admin") {
      return Response.json({ error: "Not authorized for this order." }, { status: 403 });
    }

    // Idempotent: already finalized.
    if (order.status === "paid") {
      return Response.json({ order });
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");

    // Verify payment with Stripe when a real session is involved.
    if (stripeKey && session_id && !simulated) {
      const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${session_id}`, {
        headers: { Authorization: `Bearer ${stripeKey}` },
      });
      const session = await res.json();
      if (!res.ok) {
        return Response.json(
          { error: session?.error?.message || "Could not verify Stripe session." },
          { status: 502 },
        );
      }
      if (session.payment_status !== "paid") {
        return Response.json({ error: "Payment not completed.", status: session.payment_status }, { status: 402 });
      }
    }

    // Finalize: mark paid and decrement stock.
    const updated = await base44.asServiceRole.entities.Order.update(order_id, { status: "paid" });

    for (const item of order.items ?? []) {
      if (!item.record_id) continue;
      const record = await base44.asServiceRole.entities.Record.get(item.record_id);
      if (record) {
        const newStock = Math.max(0, (record.stock ?? 0) - (item.quantity ?? 1));
        await base44.asServiceRole.entities.Record.update(item.record_id, { stock: newStock });
      }
    }

    return Response.json({ order: updated });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
