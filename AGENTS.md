# Repository Guidelines

## Project Structure & Module Organization

Source code lives in `src/`. Routing logic sits in `src/routes`, mirrored in the generated `src/routeTree.gen.ts` and composed via `src/router.tsx`. Shared UI primitives belong in `src/components`, helpers in `src/utils`, and data mocks/fetchers in `src/data`. Global styling (Tailwind + tokens) starts in `src/styles.css`, while static assets remain under `public/`. Worker configuration is tracked in `wrangler.jsonc` with supporting types inside `worker-configuration.d.ts`.

## Build, Test, and Development Commands

`pnpm dev` launches the Vite dev server on port 3000 with fast-refresh routing. `pnpm build` generates the production SSR/client bundle, and `pnpm preview` serves that bundle locally. `pnpm test` runs the Vitest suite (append `--watch` while iterating). `pnpm deploy` runs the build and deploys to Cloudflare Workers via Wrangler, and `pnpm cf-typegen` regenerates Worker binding types whenever environment variables change.

## Coding Style & Naming Conventions

Use TypeScript and functional React components exclusively. Organize imports as external → aliased → relative, and prefer ES modules. Name components and files in PascalCase (`UserBadge.tsx`), hooks/utilities in camelCase, and assets in kebab-case. Tailwind utility strings should follow layout → spacing → color ordering to minimize churn. When creating new routes, export the `Route` object from `src/routes/<segment>` and allow the generator to update `routeTree.gen.ts` rather than hand-editing it.

## Deployment & Environment Tips

`wrangler.jsonc` defines Workers bindings; keep secrets out of git and store values in Cloudflare. After changing bindings, run `pnpm cf-typegen` and commit the resulting type updates. Validate bundles with `pnpm preview` before executing `pnpm deploy`, and monitor releases with `wrangler tail` if you need runtime logs.
