import { createClientFromRequest } from "npm:@base44/sdk";

/**
 * Wix Headless bridge — runs entirely server-side so the Wix client secret never reaches
 * the browser and no fragile in-browser OAuth/iframe dance is required.
 *
 * Base44 is the identity provider. This function:
 *   1. Elevates with the OAuth app's client_credentials (id + secret).
 *   2. Syncs the Base44 user into a Wix member via Sign On (creates/updates).
 *   3. Mints Wix member tokens server-side (PKCE redirect-session → code → token).
 *   4. For checkout: creates a Wix eCom checkout (admin) and a member-context redirect
 *      session, returning a ready-to-use Wix checkout URL (member stays logged in).
 *
 * Actions (POST { action, items?, origin }):
 *   - "signon":   { memberId, signOnAvailable }
 *   - "checkout": { redirectUrl, member, memberId }
 */

const WIX_API = "https://www.wixapis.com";
const DEFAULT_ORIGIN = "https://music-shop-84400d31.base44.app";

const clientId = () => Deno.env.get("WIX_CLIENT_ID") || "";
const clientSecret = () => Deno.env.get("WIX_CLIENT_SECRET") || "";

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function sha256b64url(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return b64url(new Uint8Array(digest));
}

async function postJson(url: string, body: unknown, auth?: string) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(auth ? { Authorization: auth } : {}) },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function getElevatedToken(): Promise<string> {
  if (!clientId() || !clientSecret()) {
    throw new Error("WIX_CLIENT_ID / WIX_CLIENT_SECRET secrets are not configured.");
  }
  const { ok, status, data } = await postJson(`${WIX_API}/oauth2/token`, {
    grant_type: "client_credentials",
    client_id: clientId(),
    client_secret: clientSecret(),
  });
  if (!ok || !data.access_token) throw new Error(`Elevation failed (${status})`);
  return data.access_token;
}

async function getVisitorToken(): Promise<string> {
  const { data } = await postJson(`${WIX_API}/oauth2/token`, {
    grantType: "anonymous",
    clientId: clientId(),
  });
  return data.access_token;
}

async function queryMemberId(token: string, email: string): Promise<string | null> {
  const { ok, data } = await postJson(
    `${WIX_API}/members/v1/members/query`,
    { query: { filter: { loginEmail: email } } },
    token,
  );
  return ok ? (data.members?.[0]?.id ?? null) : null;
}

/** Sign On — creates/updates the Wix member and returns a session token. */
async function syncMember(token: string, email: string, firstName: string, lastName: string) {
  const { ok, status, data } = await postJson(
    `${WIX_API}/_api/iam/authentication/v2/sign-on`,
    {
      loginId: { email },
      profile: { firstName, lastName, nickname: firstName || email.split("@")[0] },
      mergeExistingContact: true,
    },
    token,
  );
  if (ok) {
    return { sessionToken: data.sessionToken ?? null, memberId: data.identity?.id ?? null, signOnAvailable: true };
  }
  console.error(`[wix-bridge] sign-on non-OK ${status}: ${data?.message ?? ""}`);
  return { sessionToken: null, memberId: await queryMemberId(token, email), signOnAvailable: false };
}

/**
 * Mint a Wix member access token from a Sign On session token, fully server-side:
 * PKCE redirect-session (auth request) → follow authorize → code → token exchange.
 * `redirectUri` must be an allowed authorization redirect URI in Headless settings.
 */
async function mintMemberToken(visitorToken: string, sessionToken: string, redirectUri: string): Promise<string | null> {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const codeChallenge = await sha256b64url(verifier);
  const state = b64url(crypto.getRandomValues(new Uint8Array(8)));

  const { data: rs } = await postJson(
    `${WIX_API}/_api/redirects-api/v1/redirect-session`,
    {
      auth: {
        authRequest: {
          redirectUri,
          clientId: clientId(),
          codeChallenge,
          codeChallengeMethod: "S256",
          responseMode: "query",
          responseType: "code",
          scope: "offline_access",
          state,
          sessionToken,
        },
      },
    },
    visitorToken,
  );
  const fullUrl = rs.redirectSession?.fullUrl;
  if (!fullUrl) {
    console.error("[wix-bridge] no authorize url from redirect-session");
    return null;
  }

  // The authorize URL is pre-authorized (sessionToken) and 302s to `${redirectUri}?code=...`.
  // fetch follows the redirect; the code lands in the final response URL.
  const authRes = await fetch(fullUrl);
  const code = new URL(authRes.url).searchParams.get("code");
  if (!code) {
    console.error(`[wix-bridge] no code in authorize redirect: ${authRes.url}`);
    return null;
  }

  const { ok, status, data: tok } = await postJson(`${WIX_API}/oauth2/token`, {
    clientId: clientId(),
    grantType: "authorization_code",
    code,
    codeVerifier: verifier,
    redirectUri,
  });
  if (!ok || !tok.access_token) {
    console.error(`[wix-bridge] token exchange failed (${status})`);
    return null;
  }
  return tok.access_token;
}

/** Create a Wix eCom checkout from custom line items (requires admin/elevated identity). */
async function createCheckout(
  token: string,
  items: Array<{ title: string; artist: string; price: number; quantity: number }>,
  email: string,
  memberId: string | null,
): Promise<string> {
  const { ok, status, data } = await postJson(
    `${WIX_API}/ecom/v1/checkouts`,
    {
      customLineItems: items.map((i) => ({
        price: String(i.price),
        quantity: Math.max(1, Number(i.quantity) || 1),
        productName: { original: `${i.title} — ${i.artist}` },
        itemType: { preset: "PHYSICAL" },
      })),
      channelType: "WEB",
      checkoutInfo: { buyerInfo: { email, ...(memberId ? { memberId } : {}) } },
    },
    token,
  );
  if (!ok || !data.checkout?.id) throw new Error(`createCheckout failed (${status}): ${data.message || ""}`);
  return data.checkout.id;
}

/** Create a redirect session to the Wix-hosted checkout, in the caller's identity context. */
async function checkoutRedirectUrl(authToken: string, checkoutId: string, postFlowUrl: string): Promise<string | null> {
  const { data } = await postJson(
    `${WIX_API}/_api/redirects-api/v1/redirect-session`,
    { ecomCheckout: { checkoutId }, callbacks: { postFlowUrl } },
    authToken,
  );
  return data.redirectSession?.fullUrl ?? null;
}

Deno.serve(async (req) => {
  let step = "init";
  try {
    step = "auth";
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "You must be logged in." }, { status: 401 });

    step = "parse-body";
    const { action, items, origin } = await req.json().catch(() => ({ action: "signon" }));
    const appOrigin = (origin || DEFAULT_ORIGIN).replace(/\/$/, "");
    const redirectUri = `${appOrigin}/login`;
    const email: string = user.email;
    const [firstName, ...rest] = (user.full_name || "").trim().split(/\s+/);
    const lastName = rest.join(" ");
    console.log(`[wix-bridge] action=${action} email=${email}`);

    step = "elevate";
    const token = await getElevatedToken();

    step = "sync-member";
    const sync = await syncMember(token, email, firstName || "", lastName || "");
    console.log(`[wix-bridge] memberId=${sync.memberId} signOnAvailable=${sync.signOnAvailable}`);

    if (action !== "checkout") {
      return Response.json({
        memberId: sync.memberId,
        signOnAvailable: sync.signOnAvailable,
        email,
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return Response.json({ error: "Cart is empty." }, { status: 400 });
    }

    // Guaranteed path: visitor token + checkout creation (elevated). Proven to work.
    step = "visitor-token";
    const visitorToken = await getVisitorToken();

    step = "create-checkout";
    const checkoutId = await createCheckout(token, items, email, sync.memberId);
    console.log(`[wix-bridge] checkoutId=${checkoutId}`);

    // Best-effort member upgrade for sticky login. Never allowed to block or fail checkout.
    // NOTE: temporarily forced to visitor-only while we validate the base checkout redirect;
    // flip FORCE_VISITOR to false to re-enable member-context (sticky) checkout.
    const FORCE_VISITOR = true;
    step = "mint-member-token";
    let authToken = visitorToken;
    if (!FORCE_VISITOR && sync.sessionToken) {
      try {
        const memberToken = await Promise.race([
          mintMemberToken(visitorToken, sync.sessionToken, redirectUri),
          new Promise<string | null>((_, rej) => setTimeout(() => rej(new Error("mint timeout")), 8000)),
        ]);
        if (memberToken) authToken = memberToken;
      } catch (e) {
        console.error(`[wix-bridge] member mint skipped (non-fatal): ${(e as Error).message}`);
      }
    }

    step = "checkout-redirect";
    const member = authToken !== visitorToken;
    const redirectUrl = await checkoutRedirectUrl(authToken, checkoutId, `${appOrigin}/account`);
    if (!redirectUrl) throw new Error("Failed to create the Wix checkout redirect session.");
    console.log(`[wix-bridge] redirect ready member=${member}`);

    return Response.json({ redirectUrl, member, memberId: sync.memberId });
  } catch (error) {
    const msg = (error as Error).message;
    console.error(`[wix-bridge] FAILED at step=${step}: ${msg}\n${(error as Error).stack}`);
    return Response.json({ error: msg, step }, { status: 500 });
  }
});
