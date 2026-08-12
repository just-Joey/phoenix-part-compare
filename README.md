# Phoenix Contact part comparison tool

An internal, single-user tool for a sales engineer. Three ways in:

- **By Phoenix part number** — enter a Phoenix Contact part number (and
  optionally a specific competitor part number), get a structured spec/price
  comparison, plus availability checks against four distributors.
- **By competitor part number** — the reverse direction: you have a
  competitor's part (and manufacturer) from a customer spec sheet, no known
  Phoenix equivalent yet. Same comparison output, just resolved from the
  other side.
- **By specs** — describe what you need in plain text (with optional filters
  to narrow it), get a ranked list of candidate parts across brands, then
  pick two — one must be a Phoenix Contact part — to run into the same
  detailed comparison flow.

## Why it's built this way

**The comparison engine** (Phoenix Contact vs. competitor spec research) is
the automatable half of this problem. It uses the Claude API's built-in web
search tool to do the same research a human would do by hand, then forces
the output into a fixed JSON schema via tool use — so the frontend never has
to parse free text.

**The distributor layer** is the half that doesn't automate cleanly, and the
code is honest about that rather than pretending otherwise:

| Distributor | Status | Why |
|---|---|---|
| RS Americas | Link-out only | DataDome/Akamai bot protection. Reliable bypass needs paid anti-bot infra — not worth building into a single-user tool. |
| Graybar Denver | Link-out only | No public catalog API; third-party scraping services exist specifically for Graybar, which is itself a sign it's not a lightweight scrape target. |
| Thorp Controls | Link-out only | Has a normal-looking catalog and carries Phoenix Contact directly, but a direct fetch during development was bot-blocked. Worth re-testing from a real browser session before ruling it out for good — see comments in `src/services/distributors/thorpControls.ts`. |
| Crum Electric Supply | Best-effort scrape, falls back to link-out | Fetched cleanly in testing, looks like a standard B2B storefront. The search URL and result selectors in `crumElectric.ts` are a best guess, not confirmed against a live search — verify and tighten before relying on it. |

Every distributor adapter implements the same interface
(`DistributorAdapter` in `src/services/distributors/types.ts`) and is run
through `Promise.allSettled`, so one distributor breaking never takes the
other three down with it.

**Spec search** (`src/services/specSearchEngine.ts`) is a separate engine
from part-number comparison, not a variant of it — there's no anchor part,
so it returns a ranked list of candidates across brands instead of a single
phoenix-vs-competitor pair. It's cached much more loosely
(`SPEC_SEARCH_CACHE_DAYS`, default 3 days) than part-number lookups, since
free-text queries rarely repeat verbatim — expect a lower cache hit rate
here than on the part-number flow. The frontend chains the two flows
together: pick two candidates from a spec search (one must be Phoenix
Contact) and it hands off into the existing detailed-comparison view.

**Reverse search** (competitor part in, Phoenix part out) reuses the same
comparison engine and schema as the forward direction — it's the same
`ComparisonResult` shape either way, just resolved from the other side. The
one real schema change this required: `phoenix` had to become nullable
(`PartSummary | null`), symmetric with `competitor`, since a reverse search
can honestly come back with no good Phoenix equivalent found. A reverse
search requires the competitor's manufacturer name alongside the part
number — part numbering schemes overlap across brands, so a bare part
number is ambiguous about which catalog to even check.

## Setup

```bash
# Backend
cp .env.example .env
# fill in ANTHROPIC_API_KEY, DATABASE_URL, and NEON_AUTH_URL
npm install
npx prisma generate   # requires network access to binaries.prisma.sh
npx prisma migrate dev --name init
npm run dev            # http://localhost:4000

# Frontend (separate terminal)
cd client
cp .env.example .env
# fill in VITE_NEON_AUTH_URL (same value as the backend's NEON_AUTH_URL)
npm install
npm run dev            # http://localhost:5173
```

The frontend proxies `/api/*` to `localhost:4000` in dev (see
`client/vite.config.ts`), so you don't need to deal with CORS locally beyond
what's already configured.

**Auth** — every `/api/*` route requires a signed-in Neon Auth session,
since each request can trigger paid Claude API calls. Both `NEON_AUTH_URL`
(backend) and `VITE_NEON_AUTH_URL` (frontend) come from Neon console > your
project > Auth > Configuration: take the JWKS URL shown there and strip the
trailing `/.well-known/jwks.json`. The first visit to the app shows a sign
in/sign up form (`client/src/components/AuthGate.tsx`).

Neon Auth doesn't yet have a way to disable public sign-up, so anyone who
finds the app's URL can still register a session — the actual access
boundary is the backend's `ALLOWED_USER_EMAILS` (comma-separated), checked
against the `email` claim on every request in `src/middleware/auth.ts`.
Anyone signed in but not on that list gets a 403.

## Deploying to Vercel

Frontend and backend deploy together as one Vercel project — the Express
app is exported as a single serverless function (`api/index.ts` re-exports
the app built in `src/app.ts`; `src/server.ts` with its `.listen()` call is
local-dev-only and isn't used in production). `vercel.json` rewrites both
`/health` and everything under `/api/*` to that function and points the
static build at `client/dist`.

1. **Push this repo somewhere Vercel can import from** (GitHub/GitLab/etc.),
   then create the project in the Vercel dashboard, or run `vercel` from the
   repo root and follow the prompts (`vercel link` if the project already
   exists).
2. **Set environment variables** in Vercel's dashboard (Project > Settings >
   Environment Variables) — everything from `.env.example` (`ANTHROPIC_API_KEY`,
   `DATABASE_URL`, `NEON_AUTH_URL`, `ALLOWED_USER_EMAILS`, and the cache-tuning
   vars), **plus** `VITE_NEON_AUTH_URL` from `client/.env.example` — Vite bakes
   that one into the static build, so it has to be set before the build runs,
   not just at runtime.
3. **Add the deployed domain to Neon Auth's allowed origins** — Neon console
   > your project > Auth > Domains. Skip this and sign-in will fail in
   production with the same `INVALID_ORIGIN` error you'd get calling a
   Neon Auth endpoint from a browser origin it doesn't recognize — Better
   Auth checks the request's `Origin` header against this list on every
   call, not just admin ones. Add both your `*.vercel.app` preview domain
   and any custom domain you attach.
4. **Deploy**: `vercel --prod` (or push to the branch Vercel's watching).
   The `postinstall` script runs `prisma generate` automatically as part of
   `npm install`, so the generated client matches Vercel's build
   environment — no manual step needed there.

If the build fails with `prisma: command not found`, move `prisma` from
`devDependencies` to `dependencies` in `package.json` — Vercel installs
devDependencies during build, but some project configs skip that step, and
`postinstall` needs the CLI available either way.

## What to harden before relying on this daily

1. **Verify the Thorp Controls and Crum Electric search URLs and selectors.**
   Both are best guesses. Log into each site from a real browser, search a
   Phoenix Contact part number you know they carry, and update
   `SEARCH_URL_TEMPLATE` / the cheerio selectors in `crumElectric.ts` and the
   URL in `thorpControls.ts` to match reality.
2. **Check each site's robots.txt / terms of use** before turning any
   link-only adapter into a real scraper — this matters more once you go
   from "occasional personal lookup" to "always-on automated tool."
3. **If RS or Graybar pricing becomes a frequent need**, the better path is
   asking your rep about PunchOut/cXML/EDI trade access, or a licensed
   parts-data aggregator (e.g. oemsecrets.com, which already resells RS data
   legitimately) — not scraping around their bot protection.
4. **Cache tuning** — `COMPARISON_CACHE_DAYS` (default 14) and
   `AVAILABILITY_CACHE_HOURS` (default 6) in `.env` control how aggressively
   results are reused. Spec research is expensive (Claude + web search) and
   changes rarely; availability is cheap to re-check and changes daily —
   that's why they're cached on different clocks.

## Project structure

```
src/
  types/comparison.ts       — the shared result schema
  lib/claude.ts              — Anthropic SDK client
  lib/cache.ts                — Postgres-backed cache for both comparisons and availability
  middleware/auth.ts           — verifies Neon Auth JWTs, gates all /api/* routes
  services/comparisonEngine.ts  — Claude + web search → structured comparison
  services/distributors/         — one file per distributor, shared interface
  routes/compare.ts           — ties it all together
  app.ts                      — builds the Express app (shared by server.ts and api/index.ts)
  server.ts                   — local-dev entry point (calls app.listen())
api/index.ts                  — Vercel serverless entry point (re-exports the Express app)
vercel.json                    — build/routing config for the Vercel deploy
client/                        — Vite + React frontend (search box, results, availability grid)
  src/auth.ts                   — Neon Auth client (@neondatabase/neon-js)
  src/components/AuthGate.tsx    — sign-in/sign-up gate wrapping the app
prisma/schema.prisma            — Comparison + DistributorCheck tables
```
# phoenix-part-compare
