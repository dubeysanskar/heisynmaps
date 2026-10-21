<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Naksha project rules

- JavaScript only (no TypeScript). Next.js 16 App Router, Tailwind 4. Product plan and decisions: `docs/PRD.md`.
- Every public endpoint is `src/app/api/v1/**/route.js` wrapped in `apiRoute(sku, handler)` from `src/lib/gateway.js` (key auth, origin check, rate limit, metering, CORS, error envelope). Add new SKUs/endpoints to `src/lib/catalog.js` — docs, pricing and console read from it.
- DB access goes through `src/lib/db.js` with `?` placeholders; SQL must run on both SQLite and Postgres.
- Engines are adapters in `src/lib/engines/`; unset `*_URL` env vars fall back to public demo services (dev only).
- MapLibre 6 is ESM-only with a separate module worker: load it via `src/components/map/loadMaplibre.js` (worker is copied to `public/vendor` by `scripts/copy-maplibre-worker.mjs`).
- `maplibre-gl.css` is unlayered and sets `position: relative` on the map element — size a wrapper div, not the map container itself.
- Overlays on the map must be re-added after `setStyle`; use the `style.load` event (not `isStyleLoaded()`, which waits for tiles).
- `npm run smoke` runs an end-to-end check of every endpoint against a running server.
