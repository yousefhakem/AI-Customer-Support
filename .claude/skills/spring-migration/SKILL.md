---
name: spring-migration
description: Orchestrate the Convex → Spring Boot migration. Use whenever the user asks to work on the migration (a slice, an issue labelled slice:N, apps/api, packages/api-client, or moving a screen off Convex). You are the orchestrator - you find and verify the context, split the work, brief migration-worker subagents, and check their results. Workers never see this skill.
---

# Spring migration orchestrator

You are the only agent that knows the whole migration. Workers (`migration-worker` subagents) know only what you put in their brief. If you don't give them something, they don't have it.

**Sources of truth**
- *What* to build: `docs/spring-boot-migration-plan.md` (slices, API mapping, data model, auth, *Fix, don't port*).
- *How it behaves*: the Convex code in `packages/backend/convex/`. Never rely on memory or on the plan's prose for behaviour; read the code.

## Loop (one issue at a time)

**1. Scope it.**
- Find the slice's section in the plan and its rows in *API mapping*, *Data model* and *Fix, don't port*.
- Check that earlier slices are finished: `gh issue list --label slice:<N-1> --state open` should be empty. If they aren't, stop and tell the user.

**2. Find the context by searching; don't guess.** For each Convex function in scope (e.g. `public.messages.create`):
- **Definition:** `packages/backend/convex/public/messages.ts`, the `export const create`.
- **What it depends on:** grep its body for `internal.`, `components.`, `ctx.db`, `ctx.storage`, `ctx.scheduler`, and imports. Follow them once.
- **Callers:** `grep -rn "api.public.messages.create" apps/`.
- **Existing Spring code to copy the pattern from:** the closest existing controller, service and test in `apps/api`, if any.

For wide searches you can delegate to an `Explore` agent. **Then open the key files yourself and confirm them.** Never pass unverified paths or behaviour to a worker.

**3. Write down the behaviour to match.** Use short bullets from the code:
- arguments
- validation
- each error as `code` + message
- side effects
- subscription checks

Apply the plan's *Fix, don't port* rows on top.

**4. Split into tasks.** Each task goes to one worker and should come out under ~400 changed lines. Typical tasks:
- migration + entity + repository
- endpoint + tests
- regenerate the client
- switch one screen
- delete dead Convex code

Run tasks one after another when they depend on each other.

**5. Brief the worker** using the template below. Spawn with `subagent_type: "migration-worker"`.

**6. Check the result yourself.** A worker saying "done" isn't evidence.
- Read the diff (`git diff`).
- Run `./gradlew check` in `apps/api`, plus `pnpm build` and `pnpm lint` from the root.
- Go through the rules below.
- If something is wrong, send the worker specific fixes (SendMessage); don't redo the work silently.

**7. Report to the user:**
- what changed
- the test results
- which rules or Definition of Done items aren't met yet
- anything where the plan and the code disagreed

Smoke steps need a signed-in browser: ask the user to run them. Commit or open a PR only when asked.

## Rules (you enforce these; put the relevant ones in each brief)

1. **One issue at a time, one slice at a time.** Nothing from later slices.
2. **Parity.** Same behaviour, error codes and messages as the Convex code. No UI, copy, prompt or model changes.
3. **Never port a *Fix, don't port* bug.** Each row gets a regression test.
4. **Tenant isolation.** Dashboard queries are scoped by `organization_id` from the JWT; widget queries by the contact session. Another tenant's resource → 404.
5. **Tests with every endpoint:** a success case, plus 401 for no/invalid/expired token, plus 404 for another org / another session.
6. **No real external services in tests** (OpenAI, Clerk, R2, Vapi): use fakes and stubs. No secrets in code or logs.
7. **Never edit a merged Flyway migration.** Add a new one.
8. **Never skip or weaken a test to get green.** `master` must always build.
9. **Delete a Convex function only when grep shows no callers** in `apps/` or `packages/backend/convex/`.
10. **If the plan is wrong or unclear, stop and ask the user.** Then update the plan or add an ADR (`docs/adr/`). Never deviate silently.

## Conventions to hand to workers (pick the relevant lines)

- **Package:** `io.github.yousefhakem.support.<feature>`, containing `XController`, `XService`, `XRepository`, entity `X`, and `dto/` records. Constructor injection, no Lombok.
- **Controllers are thin:**
  - Map to DTO records and call one service method. Never return entities.
  - Private endpoints take `@CurrentOrg String orgId`; public ones take `@CurrentContactSession ContactSession session`.
- **Services** own the business rules and `@Transactional`. Repositories use tenant-scoped finders (`findByIdAndOrganizationId`).
- **Errors:** throw `NotFoundException` / `BadRequestException` / `UnauthorizedException`. They become `ProblemDetail` with a `code` matching Convex's.
- **Data:**
  - Flyway files are named `V<n>__<what>.sql`.
  - UUID ids; `Instant` in Java, `timestamptz` in SQL.
  - Keyset pagination: `?cursor=&limit=` → `{ items, nextCursor }`.
- **Tests:**
  - `*IT` classes run against Testcontainers Postgres (pgvector).
  - `TestJwts` mints tokens.
  - Fake `ChatModel` / `EmbeddingModel` beans stand in for OpenAI; MockRestServiceServer or WireMock for HTTP APIs.
  - Test names describe the behaviour.
- **Frontend:**
  - Calls go only through `@workspace/api-client`.
  - Swap the data calls and leave markup, styling and copy alone.
  - Leave calls that belong to later slices on Convex.
- **Commits** (only if asked): `feat(api): …`, `feat(widget): …`, etc. Branch name: `slice-<n>/<slug>`.

(The concrete helpers named above are created in slice 0. Until they exist, tell the worker what to create instead.)

## Brief template

```
TASK: <one sentence>
CONTEXT: Slice <N> of the Convex→Spring migration. <one line on why this task exists>

READ FIRST (verified):
- <path>:<line> - <why it matters>
- <path>:<line> - existing pattern to copy

BEHAVIOUR TO MATCH:
- <arg / validation / error code+message / side effect>

DO:
1. <step>
2. <step>

DON'T:
- Touch files outside: <paths>
- <task-specific exclusions, e.g. "leave enhanceResponse on Convex">

CONVENTIONS: <only the relevant lines from the skill>

TESTS REQUIRED:
- <case> → <expected>

DONE WHEN: <exact commands> pass.

REPORT BACK: files changed, test command output (pass/fail counts), anything you
couldn't do, and anything in the code that contradicted this brief. Don't guess.
```
