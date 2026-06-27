import { base44 } from "@/api/base44Client";

// The Wix Headless OAuth client SECRET lives only as a Base44 server secret. The entire
// member federation + checkout flow runs server-side in the `wix-bridge` function; the
// browser only follows a ready-made redirect URL. No Wix client or tokens live here.

/**
 * Sync the current Base44 user into a Wix member (server-side Sign On).
 * Returns { member, memberId, signOnAvailable } for UI status.
 */
export async function signInToWix() {
  const r = await base44.functions.invoke("wix-bridge", {
    action: "signon",
    origin: window.location.origin,
  });
  if (r?.error) throw new Error(r.error);
  return {
    member: !!r.signOnAvailable && !!r.memberId,
    memberId: r.memberId ?? null,
    signOnAvailable: !!r.signOnAvailable,
  };
}

/**
 * Build a Wix eCom checkout from the cart server-side and redirect the browser to the
 * Wix-hosted checkout. The redirect session is created in member context, so the buyer
 * stays logged in ("sticky").
 */
export async function checkoutOnWix(items) {
  const r = await base44.functions.invoke("wix-bridge", {
    action: "checkout",
    origin: window.location.origin,
    items: items.map((i) => ({
      title: i.title,
      artist: i.artist,
      price: i.price,
      quantity: i.quantity,
    })),
  });
  // Be resilient to whatever envelope invoke returns (body, {data}, {result}).
  const payload = r?.redirectUrl ? r : (r?.data ?? r?.result ?? r) || {};
  if (payload?.error) throw new Error(payload.error);
  const redirectUrl = payload?.redirectUrl;
  if (!redirectUrl) {
    throw new Error("No redirectUrl. Raw response: " + JSON.stringify(r).slice(0, 400));
  }
  window.location.href = redirectUrl;
  return { member: !!payload.member };
}

// No client-side Wix session to clear anymore.
export function signOutWix() {}
