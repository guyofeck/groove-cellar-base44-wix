import { createClientFromRequest } from "npm:@base44/sdk";

/**
 * Creates an Order (pending) from a cart, then starts a Stripe Checkout Session.
 *
 * Request body: { items: [{ record_id, quantity }], origin: string }
 * Response: { url: string, order_id: string, simulated: boolean }
 *
 * If a STRIPE_SECRET_KEY secret is configured, a real Stripe Checkout Session is
 * created. Otherwise the checkout is simulated (success URL points straight back
 * to the app) so the shop works end-to-end without payment credentials.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "You must be logged in to check out." }, { status: 401 });
    }

    const { items, origin } = await req.json();
    if (!Array.isArray(items) || items.length === 0) {
      return Response.json({ error: "Cart is empty." }, { status: 400 });
    }

    const baseUrl = (origin || "").replace(/\/$/, "");

    // Validate every item against the live catalog (service role = trusted prices/stock).
    const lineItems: Array<{ record_id: string; title: string; artist: string; price: number; quantity: number }> = [];
    let total = 0;

    for (const item of items) {
      const qty = Math.max(1, parseInt(String(item.quantity ?? 1), 10));
      const record = await base44.asServiceRole.entities.Record.get(item.record_id);
      if (!record) {
        return Response.json({ error: `Record ${item.record_id} not found.` }, { status: 404 });
      }
      if ((record.stock ?? 0) < qty) {
        return Response.json(
          { error: `"${record.title}" is out of stock (only ${record.stock ?? 0} left).` },
          { status: 409 },
        );
      }
      lineItems.push({
        record_id: record.id,
        title: record.title,
        artist: record.artist,
        price: record.price,
        quantity: qty,
      });
      total += record.price * qty;
    }

    total = Math.round(total * 100) / 100;

    // Create the pending order (created_by is set to the caller automatically).
    const order = await base44.entities.Order.create({
      customer_email: user.email,
      items: lineItems,
      total,
      status: "pending",
    });

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");

    // No Stripe key configured -> simulate a successful payment redirect.
    if (!stripeKey) {
      return Response.json({
        url: `${baseUrl}/checkout/return?order=${order.id}&simulated=1`,
        order_id: order.id,
        simulated: true,
      });
    }

    // Build a Stripe Checkout Session via the REST API.
    const form = new URLSearchParams();
    form.set("mode", "payment");
    form.set("success_url", `${baseUrl}/checkout/return?order=${order.id}&session_id={CHECKOUT_SESSION_ID}`);
    form.set("cancel_url", `${baseUrl}/cart?canceled=1`);
    form.set("customer_email", user.email);
    form.set("metadata[order_id]", order.id);
    lineItems.forEach((li, i) => {
      form.set(`line_items[${i}][quantity]`, String(li.quantity));
      form.set(`line_items[${i}][price_data][currency]`, "usd");
      form.set(`line_items[${i}][price_data][unit_amount]`, String(Math.round(li.price * 100)));
      form.set(`line_items[${i}][price_data][product_data][name]`, `${li.title} — ${li.artist}`);
    });

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    const session = await stripeRes.json();
    if (!stripeRes.ok) {
      return Response.json(
        { error: session?.error?.message || "Failed to create Stripe session." },
        { status: 502 },
      );
    }

    await base44.asServiceRole.entities.Order.update(order.id, { stripe_session_id: session.id });

    return Response.json({ url: session.url, order_id: order.id, simulated: false });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
