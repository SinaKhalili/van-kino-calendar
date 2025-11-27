# Repository Guidelines

## Project Structure & Module Organization
Source code lives in `src/`. Routing logic sits in `src/routes`, mirrored in the generated `src/routeTree.gen.ts` and composed via `src/router.tsx`. Shared UI primitives belong in `src/components`, helpers in `src/utils`, and data mocks/fetchers in `src/data`. Global styling (Tailwind + tokens) starts in `src/styles.css`, while static assets remain under `public/`. Worker configuration is tracked in `wrangler.jsonc` with supporting types inside `worker-configuration.d.ts`.

## Build, Test, and Development Commands
`pnpm dev` launches the Vite dev server on port 3000 with fast-refresh routing. `pnpm build` generates the production SSR/client bundle, and `pnpm preview` serves that bundle locally. `pnpm test` runs the Vitest suite (append `--watch` while iterating). `pnpm deploy` runs the build and deploys to Cloudflare Workers via Wrangler, and `pnpm cf-typegen` regenerates Worker binding types whenever environment variables change.

## Coding Style & Naming Conventions
Use TypeScript and functional React components exclusively. Keep 2-space indentation, organize imports as external → aliased → relative, and prefer ES modules. Name components and files in PascalCase (`UserBadge.tsx`), hooks/utilities in camelCase, and assets in kebab-case. Tailwind utility strings should follow layout → spacing → color ordering to minimize churn. When creating new routes, export the `Route` object from `src/routes/<segment>` and allow the generator to update `routeTree.gen.ts` rather than hand-editing it.

## Testing Guidelines
Vitest plus @testing-library/react drive testing. Name specs `<module>.test.tsx` (components) or `<hook>.test.ts` (logic) and colocate them next to the code. Cover loader logic, boundary states, and critical user flows; new screens need at least one interaction test. Run `pnpm test -- --watch=false` before pushing, and document any skipped suites in the pull request so reviewers understand the risk.

## Commit & Pull Request Guidelines
Git history favors short, imperative commit subjects (e.g., "Initialize web application via create-cloudflare CLI"); stick to that tense and reserve body text for context or follow-ups. Pull requests should describe the change, reference linked issues, list verification steps (`pnpm test`, manual checks, screenshots for UI work), and mention environment or Wrangler updates. Request review from teammates familiar with the touched route or Worker configuration to accelerate approval.

## Deployment & Environment Tips
`wrangler.jsonc` defines Workers bindings; keep secrets out of git and store values in Cloudflare. After changing bindings, run `pnpm cf-typegen` and commit the resulting type updates. Validate bundles with `pnpm preview` before executing `pnpm deploy`, and monitor releases with `wrangler tail` if you need runtime logs.
