# Delivery

Read before committing or opening a PR. Commit, push or open a PR only when asked.

- **Base branch:** `master`. One issue = one branch = one PR; aim for under ~400 changed lines.
- **Branch names:** `slice-<n>/<slug>` for migration issues, `<type>/<slug>` otherwise (e.g. `chore/devcontainer-tmux-install`).
- **Commits:** Conventional Commits with the app as scope: `feat(api): …`, `feat(widget): …`, `fix(devcontainer): …`, `ci: …`, `docs: …`.
- **PR body:** `Closes #<n>` when there is an issue.
- **Before pushing,** run what CI runs:
  - `./gradlew check` in `apps/api` (if it changed)
  - `pnpm build` and `pnpm lint` from the root
- For migration PRs, the Definition of Done in `docs/spring-boot-migration-plan.md` also applies.
