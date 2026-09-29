# Agent notes

- Frontend-only locally: a Vite + React SPA. All data, auth and backend functions (`base44/functions/*`, Deno) run on the **hosted** Base44 app (`appId` hardcoded in `src/api/base44Client.js`). Nothing in `base44/` runs in the sandbox.
- Secrets (`WIX_CLIENT_ID`, `WIX_CLIENT_SECRET`, `STRIPE_SECRET_KEY`) are Base44 **server** secrets read by the hosted functions — none are needed locally.
- Run: `docker compose -f docker-compose.base44.yml up -d` → Vite dev on host port 3000. `node_modules` lives in a named volume; `npm ci` runs at container start.
- Expected console noise: `401 Authentication required to view users` from `User/me` when not signed in — not a bug.
- Wix checkout redirects only work on the allowed redirect domain (`music-shop-84400d31.base44.app`), not the sandbox preview origin.
- Verify: `curl localhost:3000/` serves the Vite dev HTML; the Shop page lists records (e.g. "Sunday Morning Soul").
- The empty root file `cd` is a stray artifact; ignore it.
