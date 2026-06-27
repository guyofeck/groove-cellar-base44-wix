import { createClientFromRequest } from "npm:@base44/sdk";

/**
 * Wix Headless bridge — runs server-side so the Wix client secret never reaches the browser.
 *
 * Base44 is the identity provider. This function:
 *   1. Elevates the server with the OAuth app's client_credentials (id + secret).
 *   2. Syncs the Base44-authenticated user into a Wix member (Sign On — creates/updates).
 *   3. For checkout, builds a Wix eCom checkout (custom line items, admin-only) from the cart.
 *
 * Actions (POST body { action, ... }):
 *   - "signon":   returns { sessionToken, memberId, signOnAvailable }
 *   - "checkout": returns { checkoutId, sessionToken, memberId, signOnAvailable }
 *
 * The frontend exchanges `sessionToken` for Wix member tokens via the SDK
 * (auth.getMemberTokensForDirectLogin) so the member is logged in on Wix and
 * therefore "sticky" when redirected to the Wix-hosted checkout.
 */

const WIX_API = "https://www.wixapis.com";

async function getElevatedToken(): Promise<string> {
  const clientId = Deno.env.get("WIX_CLIENT_ID");
  const clientSecret = Deno.env.get("WIX_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("WIX_CLIENT_ID / WIX_CLIENT_SECRET secrets are not configured.");
  }
  const res = await fetch(`${WIX_API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`Failed to elevate Wix server: ${data.errorDescription || res.status}`);
  }
  return data.access_token;
}

/** Find the Wix member ID for an email, or null. Works with the elevated token. */
async function queryMemberId(token: string, email: string): Promise<string | null> {
  const res = await fetch(`${WIX_API}/members/v1/members/query`, {
    method: "POST",
    headers: { Authorization: token, "Content-Type": "application/json" },
    body: JSON.stringify({ query: { filter: { loginEmail: email } } }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.members?.[0]?.id ?? null;
}

/**
 * Sync identity via Sign On — creates or updates the Wix member and returns a session token.
 * Requires the OAuth app to have the "Manage Members Authentication" permission.
 * Falls back to a read-only member lookup if that permission is missing (HTTP 403).
 */
async function syncMember(
  token: string,
  email: string,
  firstName: string,
  lastName: string,
): Promise<{ sessionToken: string | null; memberId: string | null; signOnAvailable: boolean }> {
  const res = await fetch(`${WIX_API}/_api/iam/authentication/v2/sign-on`, {
    method: "POST",
    headers: { Authorization: token, "Content-Type": "application/json" },
    body: JSON.stringify({
      loginId: { email },
      profile: { firstName, lastName, nickname: firstName || email.split("@")[0] },
      mergeExistingContact: true,
    }),
  });

  if (res.ok) {
    const data = await res.json();
    return {
      sessionToken: data.sessionToken ?? null,
      memberId: data.identity?.id ?? null,
      signOnAvailable: true,
    };
  }

  // Sign On not permitted yet — degrade gracefully to identity lookup (no sticky session).
  if (res.status === 403) {
    const memberId = await queryMemberId(token, email);
    return { sessionToken: null, memberId, signOnAvailable: false };
  }

  const err = await res.json().catch(() => ({}));
  throw new Error(`Wix Sign On failed (${res.status}): ${err.message || "unknown error"}`);
}

/** Create a Wix eCom checkout from custom line items (requires admin/elevated identity). */
async function createCheckout(
  token: string,
  items: Array<{ title: string; artist: string; price: number; quantity: number }>,
  email: string,
  memberId: string | null,
): Promise<string> {
  const body: Record<string, unknown> = {
    customLineItems: items.map((i) => ({
      price: String(i.price),
      quantity: Math.max(1, Number(i.quantity) || 1),
      productName: { original: `${i.title} — ${i.artist}` },
      itemType: { preset: "PHYSICAL" },
    })),
    channelType: "WEB",
    checkoutInfo: {
      buyerInfo: { email, ...(memberId ? { memberId } : {}) },
    },
  };
  const res = await fetch(`${WIX_API}/ecom/v1/checkouts`, {
    method: "POST",
    headers: { Authorization: token, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || !data.checkout?.id) {
    throw new Error(`Failed to create Wix checkout (${res.status}): ${data.message || "unknown error"}`);
  }
  return data.checkout.id;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "You must be logged in." }, { status: 401 });
    }

    const { action, items } = await req.json().catch(() => ({ action: "signon" }));
    const email: string = user.email;
    const [firstName, ...rest] = (user.full_name || "").trim().split(/\s+/);
    const lastName = rest.join(" ");

    const token = await getElevatedToken();
    const sync = await syncMember(token, email, firstName || "", lastName || "");

    if (action === "checkout") {
      if (!Array.isArray(items) || items.length === 0) {
        return Response.json({ error: "Cart is empty." }, { status: 400 });
      }
      const checkoutId = await createCheckout(token, items, email, sync.memberId);
      return Response.json({
        checkoutId,
        sessionToken: sync.sessionToken,
        memberId: sync.memberId,
        signOnAvailable: sync.signOnAvailable,
      });
    }

    // Default: "signon"
    return Response.json({
      sessionToken: sync.sessionToken,
      memberId: sync.memberId,
      signOnAvailable: sync.signOnAvailable,
      email,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
