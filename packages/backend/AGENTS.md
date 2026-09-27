# packages/backend

The Convex backend (`@workspace/backend`) that `apps/web` and `apps/widget` still call. It is being migrated to Spring Boot in `apps/api` and is deleted in slice 7.

- `convex/` is the behaviour spec for the migration: read it to learn how things work. Don't add features here.
- `convex/_generated/` is written by `convex dev`; don't edit it.
- Delete a Convex function only when grep shows no callers in `apps/` or `packages/backend/convex/`.
