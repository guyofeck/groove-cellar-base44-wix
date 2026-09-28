# Agent notes

- Only the Vite frontend runs locally (`docker-compose.base44.yml`, service `web`, host port 3000 -> 5173).
  The backend is the **hosted** Base44 app (appId in `src/api/base44Client.js`): entities, auth and
  functions in `base44/` run in Base44's cloud, not in the sandbox. Editing `base44/functions/*` or
  `base44/entities/*` has no effect until deployed with `npx base44 deploy` (not done from here).
- Wix/Stripe secrets (`WIX_CLIENT_ID`, `WIX_CLIENT_SECRET`, `STRIPE_SECRET_KEY`) live as Base44 app
  secrets on the hosted app; the local frontend needs no credentials.
- `node_modules` is a named volume; `npm install` runs on container start.
- Verify: `curl localhost:3000/` serves the Vite dev HTML; the Shop page lists records from the
  hosted `Record` entity. A 401 on `User/me` in the console is normal when signed out.
- Wix checkout redirect is configured for the production domain, so the checkout handoff may be
  rejected from the preview origin.
- Stray empty file `cd` at repo root is unused.
