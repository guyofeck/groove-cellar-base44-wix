# Groove Cellar 🎶 — Base44 + Wix Headless

A vinyl record shop built on **Base44** (frontend hosting, auth/IdP, entities, backend functions)
with **Wix Headless** as the commerce backend. Base44 is the identity provider; members are
federated into Wix so a shopper who logs into this app stays logged in ("sticky") when redirected
to the Wix‑hosted checkout.

**Live app:** https://music-shop-84400d31.base44.app

## Features

- **Storefront** — record catalog (`Record` entity), genre filters, detail pages, cart.
- **Members** — Base44 email/password + OTP auth, protected account/order area.
- **Identity federation** — on login, the Base44 user is synced into a Wix member via Wix
  **Sign On**, then exchanged for Wix member tokens in the browser.
- **Wix checkout** — the cart is turned into a Wix eCom checkout server‑side and the buyer is
  redirected to the Wix‑hosted checkout, still logged in as their member.

## Architecture

```
Base44 login (IdP)
   │  email + name
   ▼
Base44 fn "wix-bridge"  ──①── POST /oauth2/token  (grant_type=client_credentials, id+secret)
  (Deno, server-side)         → elevated access token (4h)
   │
   ├──②── POST /_api/iam/authentication/v2/sign-on   (Authorization: elevated token)
   │        → creates/updates the Wix member  ← IDENTITY SYNC
   │        → returns { sessionToken, identity.id }
   │
   └──(checkout)── POST /ecom/v1/checkouts  (custom line items, buyerInfo.memberId)
                   → checkoutId
   ▼
Frontend (@wix/sdk, clientId only)
   ├──③── auth.getMemberTokensForDirectLogin(sessionToken) → member tokens → setTokens()
   └──④── redirects.createRedirectSession({ ecomCheckout:{checkoutId}, callbacks })
            → redirect to Wix-hosted checkout, member STICKY
```

Why the split: creating a checkout with **custom‑priced** line items needs an admin identity, so it
runs server‑side with the elevated token; the redirect session must run in **member/visitor**
context, so it runs in the browser via the SDK. The Wix **client secret never leaves the server**
(stored as a Base44 secret).

## Project layout

- `base44/entities/` — `Record`, `Order` schemas (with RLS).
- `base44/functions/wix-bridge/` — elevation + Sign On + checkout creation.
- `base44/functions/create-checkout`, `confirm-order` — original Base44/Stripe checkout (kept; the
  cart now routes to Wix instead).
- `src/lib/wix.js` — Wix client, `signInToWix()`, `checkoutOnWix()`.
- `src/lib/auth.jsx` — Base44 auth + automatic Wix federation on login.
- `src/pages/`, `src/components/` — storefront UI.

## Configuration

Secrets are stored in Base44 (never in code):

| Secret | Purpose |
|--------|---------|
| `WIX_CLIENT_ID` | Wix Headless OAuth app client ID (also public, used in the frontend) |
| `WIX_CLIENT_SECRET` | Wix OAuth app secret — server‑only, used for client‑credentials elevation |

### Required Wix Headless settings

- **OAuth app permissions:** `Manage Members Authentication` (for Sign On), eCommerce admin, members.
- **Allowed redirect domain:** `music-shop-84400d31.base44.app` (for the checkout redirect callback).
- The connected Wix site must be **published** (the Redirects API renders Wix‑hosted pages).

## Develop & deploy

```bash
npm install
npx base44 dev            # local dev (backend + frontend)
npm run build
npx base44 deploy -y      # deploy entities, functions, and site
```

Built with the Base44 CLI and the Wix JavaScript SDK.
