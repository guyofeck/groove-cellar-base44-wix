import { createClient, OAuthStrategy } from "@wix/sdk";
import { redirects } from "@wix/redirects";
import { base44 } from "@/api/base44Client";

// The Wix Headless OAuth client ID is public (safe in the browser).
// The client SECRET lives only as a Base44 server secret, used by the wix-bridge function.
export const WIX_CLIENT_ID = "aa5c39e4-729d-4f1c-a6a6-59203b1383ae";

const TOKENS_KEY = "wix-member-tokens";

const loadTokens = () => {
  try {
    return JSON.parse(localStorage.getItem(TOKENS_KEY)) || undefined;
  } catch {
    return undefined;
  }
};
const saveTokens = (t) => t && localStorage.setItem(TOKENS_KEY, JSON.stringify(t));
const clearTokens = () => localStorage.removeItem(TOKENS_KEY);

let client;
export function getWixClient() {
  if (!client) {
    client = createClient({
      modules: { redirects },
      auth: OAuthStrategy({ clientId: WIX_CLIENT_ID, tokens: loadTokens() }),
    });
  }
  return client;
}

/**
 * Sign the current Base44 user into Wix.
 * Calls the server bridge (which runs Sign On with the client secret), then exchanges
 * the returned session token for Wix member tokens so this browser is a logged-in member.
 */
export async function signInToWix() {
  const c = getWixClient();
  const result = await base44.functions.invoke("wix-bridge", { action: "signon" });
  if (result?.error) throw new Error(result.error);

  if (result?.sessionToken) {
    const tokens = await c.auth.getMemberTokensForDirectLogin(result.sessionToken);
    c.auth.setTokens(tokens);
    saveTokens(tokens);
    return { member: true, memberId: result.memberId, signOnAvailable: true };
  }
  // Sign On not enabled yet — identity is synced (member looked up) but no sticky session.
  return { member: false, memberId: result?.memberId ?? null, signOnAvailable: !!result?.signOnAvailable };
}

export function wixLoggedIn() {
  try {
    return getWixClient().auth.loggedIn();
  } catch {
    return false;
  }
}

export function signOutWix() {
  clearTokens();
  client = undefined;
}

/**
 * Build a Wix eCom checkout from the cart (server-side, with trusted prices) and redirect
 * the browser to the Wix-hosted checkout. If a member session is available, the redirect
 * is created in member context so the buyer stays logged in ("sticky").
 */
export async function checkoutOnWix(items) {
  const c = getWixClient();
  const result = await base44.functions.invoke("wix-bridge", {
    action: "checkout",
    items: items.map((i) => ({
      title: i.title,
      artist: i.artist,
      price: i.price,
      quantity: i.quantity,
    })),
  });
  if (result?.error) throw new Error(result.error);
  if (!result?.checkoutId) throw new Error("Could not create the Wix checkout.");

  // Establish the right identity for the redirect session.
  if (result.sessionToken && !c.auth.loggedIn()) {
    const tokens = await c.auth.getMemberTokensForDirectLogin(result.sessionToken);
    c.auth.setTokens(tokens);
    saveTokens(tokens);
  } else if (!c.auth.loggedIn()) {
    await c.auth.generateVisitorTokens();
  }

  const { redirectSession } = await c.redirects.createRedirectSession({
    ecomCheckout: { checkoutId: result.checkoutId },
    callbacks: { postFlowUrl: `${window.location.origin}/account` },
  });
  if (!redirectSession?.fullUrl) throw new Error("Could not create the Wix redirect session.");

  window.location.href = redirectSession.fullUrl;
  return { member: !!result.sessionToken };
}
