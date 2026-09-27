# Agent notes

- Only the Vite frontend runs locally (`docker-compose.base44.yml`, service `web`, host port 3000 -> 5173).
  It talks to the **hosted** Base44 app (`appId` hardcoded in `src/api/base44Client.js`) for auth,
  entities (`Record`, `Order`) and backend functions.
- `base44/functions/*` (Deno) are NOT run locally; they execute on Base44 hosting and read
  `WIX_CLIENT_ID`, `WIX_CLIENT_SECRET`, `STRIPE_SECRET_KEY` from Base44 app secrets — no local secrets needed.
  Changes to functions/entities only take effect after `npx base44 deploy` (requires Base44 CLI login).
- `node_modules` lives in a named volume; `npm ci` runs on every container start.
- Wix checkout redirect callback domain is allowlisted for the production domain only, so the
  checkout redirect may fail from the sandbox preview origin.
- Verify: `curl localhost:3000/src/main.jsx` returns transformed source (dev server, not a build).
