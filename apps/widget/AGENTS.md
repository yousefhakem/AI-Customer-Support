# apps/widget

The chat widget that customers' sites load in an iframe (Next.js 15, Jotai). Data still comes from Convex (`@workspace/backend`) until each screen is migrated to `apps/api`.

- Everything lives in `modules/widget/` (screens, atoms, hooks). Shared components come from `@workspace/ui`.
- `pnpm build` also builds `apps/embed` into `public/widget.js`; don't edit that file.
- Check with `pnpm --filter widget typecheck` and `pnpm --filter widget lint`.
