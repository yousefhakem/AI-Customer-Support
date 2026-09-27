# apps/web

The admin dashboard (Next.js 15 App Router, Clerk) where businesses configure their widget and manage conversations, files and plugins. Data still comes from Convex (`@workspace/backend`) until each screen is migrated to `apps/api`.

- `app/` holds routes; feature code lives in `modules/<feature>/`. Shared components come from `@workspace/ui`.
- Check with `pnpm --filter web typecheck` and `pnpm --filter web lint`.
