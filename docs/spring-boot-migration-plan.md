# Spring Boot Migration Plan

Replace the Convex backend (`packages/backend/convex`) with a Java Spring Boot service backed by Postgres + pgvector. The Next.js dashboard (`apps/web`), the widget (`apps/widget`), and the embed script (`apps/embed`) stay as they are, except for their data layer, which moves from `convex/react` to a typed REST client.

This is a CV project. Clear, well-tested, conventional Spring code matters more than speed, and everything runs on free tiers except OpenAI.

**For AI agents:** don't work from this file directly. Migration work runs through the `spring-migration` skill (`.claude/skills/spring-migration/SKILL.md`), which uses this plan for *what* to build and finds the relevant code itself.

## Decisions

| # | Decision | Consequence |
|---|---|---|
| 1 | **Why Spring Boot:** portfolio project | Tests, CI, OpenAPI docs, ADRs and a readable README are deliverables, not extras |
| 2 | **No production data** | No data migration. Spring starts with an empty database |
| 3 | **The app doesn't need to run during the migration** | No Convex/Spring coexistence, no dual writes. Slices are ordered purely by dependency |
| 4 | **Small blast radius:** each change must be small and verified before the next | Bottom-up vertical slices, one PR per issue, CI must pass before merge (see *Guardrails*) |
| 5 | **Same repo** (`apps/api`) | One PR can change the API, the generated client, and the screens together |
| 6 | **Hosting:** Render (API) + Neon (Postgres) + Cloudflare R2 (files) + Vercel (apps) | See *Hosting*. Deployment happens in slice 7; the API is a plain container image, so the host can change without code changes |
| 7 | **Voice is out of scope** | Planned separately after the migration. The existing Vapi plugin is ported as-is (slice 6) |
| 8 | **No token streaming** | Parity with today; a "next step" for the README |

## Lessons from the reverted Express/Prisma port

The previous port (`bf109dc..542c4d5`, reverted in `45927b3`) failed for two reasons:

1. **The apps were never switched to it.** Here, every slice ends by switching its screens to Spring. A slice isn't done until its screens call the new API.
2. **Broken and insecure paths.** Here, every endpoint gets authorization tests (wrong org, wrong session, expired session) before it merges, and the known holes in today's code (*Fix, don't port*) are closed rather than copied.

## Non-goals
- New features or UI changes. Parity first.
- Token-by-token streaming of agent replies. Today's widget waits for the full reply too (`useThreadMessages` is not called with `stream: true`).
- Changing AI models, Clerk, or the UI component library.

---

## Delivery process

### SDLC model
**Iterative and incremental (Agile), run as Scrumban.** Requirements and design are done once, up front (this document). Implementation happens in small increments, each going through build → test → review before the next starts.

| SDLC phase | When | Output |
|---|---|---|
| Requirements | Once (done) | Current behaviour as the spec (*API mapping*), *Fix, don't port*, the *Smoke checklist* |
| Design | Once, updated as needed | This document + ADRs in `docs/adr/` |
| Build → Test → Review | Each slice | Issues → PRs → CI → manual check of that slice's screens |
| Deploy | Slice 7 | Render + Neon + R2 + Vercel |
| Maintenance | After slice 7 | Portfolio polish |

Two ideas borrowed from other models:
- **Riskiest parts first (Spiral).** Slice 0 includes time-boxed spikes for the parts that could force a redesign: Spring Boot on Render's free tier, SSE through Render, Spring AI tool calling, and pgvector on Neon.
- **Tests defined before code (V-model).** The requirements are fixed (match today's behaviour), so each issue's acceptance criteria, authorization tests and regression tests are written into the issue before coding starts.

### GitHub organization
- **Milestone per slice**, with a one-line goal and the smoke checklist steps it unlocks.
- **Issues as stories**, one PR each, listed under each slice below. Each has acceptance criteria as a checklist.
- **Project board:** Backlog → Ready → In progress → Review → Done, with an Iteration field for 1-week sprints.
- **Labels:** `slice:0`…`slice:8`, `backend`, `frontend`, `infra`, `security`, `test`, `spike`.
- **Issue template** with acceptance criteria and the Definition of Done below.
- **Branch per issue** → PR with `Closes #n` → squash-merge to `master`. No long-lived migration branch.

### Sprint routine (solo)
- **Planning (start of week, 15 min):** pick issues from the next slice and write a one-sentence sprint goal.
- **Review + retro (end of week, 20 min):** click through the slice's screens (or record a short GIF once the slice is done), and add three retro bullets to the milestone: went well / didn't / change.

### Definition of Ready
An issue is ready when it has acceptance criteria, names the endpoints/screens it touches, and all its dependencies are merged.

### Definition of Done
- [ ] CI is green (`./gradlew check` + `pnpm build` + `pnpm lint`)
- [ ] New endpoints have a success test and authorization tests (other org → 404, other session → 404, expired/missing token → 401)
- [ ] Any related *Fix, don't port* item has a regression test
- [ ] OpenAPI spec and the generated client are regenerated and committed
- [ ] If this is the slice's last issue, its screens call Spring and the matching smoke checklist steps pass locally
- [ ] Convex functions no longer called by anything are deleted

---

## Guardrails (keeping the blast radius small)

1. **One slice at a time.** Finish, test and merge a slice before opening issues from the next. WIP limit: one issue in progress.
2. **One issue = one PR = one resource.** "Conversations API" is a PR; "switch the inbox screen" is another. Aim for PRs under ~400 changed lines.
3. **Breaks show up at compile time.** The TypeScript client is generated from the Spring OpenAPI spec. If an endpoint changes shape, the frontend fails to compile instead of failing at runtime.
4. **`master` always builds.** CI runs Java tests plus the frontend build and lint on every PR; nothing merges red. The app doesn't need to work end to end until slice 7, but it always compiles.
5. **Both data layers live side by side in the frontends until slice 7.** `ConvexProvider` and `QueryClientProvider` wrap the apps together, so unswitched screens still compile. Slice 7 removes Convex.
6. **Delete as you go.** Once a slice's screens are switched, delete the Convex functions nothing calls anymore. Two implementations of the same thing never exist at once.
7. **Endpoint tests use a real database.** Postgres + pgvector runs in Testcontainers. Each endpoint is proven to work without starting the app.
8. **No external services in tests.** Test-signed JWTs instead of Clerk, MinIO (Testcontainers) instead of R2, a fake `ChatModel`/`EmbeddingModel` instead of OpenAI, a stub HTTP server instead of Vapi and the Clerk Backend API. When a test fails, it's your code.
9. **Schema grows with the slices.** Each slice adds its own Flyway migration for its tables, instead of creating the whole schema up front.
10. **Record decisions.** Anything you'd have to explain in an interview ("why SSE and not WebSockets?") gets a short ADR.

---

## What Convex does for us today

Everything below has to be rebuilt or replaced. The first four are why this migration is bigger than the ~2,400 lines of backend code suggest.

| Convex feature | Where it's used | Spring replacement |
|---|---|---|
| **Reactive queries** (UI updates live when data changes) | Every `useQuery` / `usePaginatedQuery` / `useThreadMessages` in `apps/` | Server-Sent Events that tell the client which data changed + TanStack Query refetch |
| **`@convex-dev/agent`** (threads, message storage, tool loop) | `system/ai/agents/supportAgent.ts`, `public/messages.ts`, tools | Spring AI `ChatClient` + `@Tool` methods + our own `messages` table |
| **`@convex-dev/rag`** (chunking, embeddings, vector search per namespace) | `system/ai/rag.ts`, `private/files.ts`, `tools/search.ts` | Spring AI `PgVectorStore`, filtered by `organization_id` |
| **File storage** (`ctx.storage`) | `private/files.ts`, `lib/extractTextContent.ts` | Cloudflare R2 (S3 API) |
| Auth (`ctx.auth.getUserIdentity()`) | Every `private/*` function | Spring Security OAuth2 resource server verifying Clerk JWTs |
| HTTP actions | `http.ts` (Clerk billing webhook) | A `@RestController` + Svix Java SDK for signature checks |
| Scheduler (`ctx.scheduler.runAfter`) | `private/secrets.ts`, `rag.deleteAsync` | `@Async` |
| Generated typed client (`api.public.*`) | Every frontend call | OpenAPI spec (springdoc) → generated TypeScript client |
| AWS Secrets Manager (not Convex, but goes away) | Vapi keys (`lib/secrets.ts`) | AES-GCM encrypted column in Postgres (free) |

---

## Target architecture

```
apps/web (Next.js, Clerk)     apps/widget (Next.js)          Clerk
  │ Bearer <Clerk JWT>          │ Bearer <widget session token>  │ billing webhook (Svix)
  ▼                             ▼                                ▼
┌──────────────────────── apps/api (Spring Boot, on Render) ──────────────┐
│ /api/private/**  (org from JWT)   /api/public/**  (contact session)     │
│ /api/webhooks/clerk               /api/**/events  (SSE)                 │
│                                                                         │
│ services: conversations, messages, contactSessions, widgetSettings,     │
│           files/knowledge base, plugins, vapi, subscriptions            │
│ ai: SupportAgent (Spring AI ChatClient + tools), text extraction, RAG   │
└───────┬───────────────┬─────────────────┬─────────────────┬─────────────┘
        ▼               ▼                 ▼                 ▼
  Postgres+pgvector  Cloudflare R2     OpenAI API          Vapi API
  (Neon, Flyway)     (knowledge files)
```

### Stack
| Concern | Choice | Why |
|---|---|---|
| Language / framework | Java 25 (LTS), Spring Boot 4.x, Gradle (Kotlin DSL) | Current LTS and Boot line; pin exact versions when scaffolding |
| Web | Spring MVC on virtual threads | Blocking code is simpler than WebFlux; virtual threads handle open SSE connections and slow OpenAI calls cheaply |
| DB access | Spring Data JPA + Flyway | Small schema, standard tooling. Use `JdbcClient` where JPA gets in the way (vector queries go through Spring AI) |
| AI | Spring AI (OpenAI starter, `PgVectorStore`, `@Tool`) | Chat, tools, embeddings and vector store in one library. LangChain4j is the fallback if the slice 0 spike shows Spring AI's tool loop doesn't fit |
| Auth | `spring-boot-starter-oauth2-resource-server` | Verifies Clerk JWTs against Clerk's JWKS; no Clerk SDK needed for auth |
| Clerk admin calls | Clerk Backend REST API via `RestClient` | Only two calls: get organization, update membership limit |
| Webhooks | `com.svix:svix` | Same verification as `http.ts` |
| Storage | AWS SDK v2 S3 client pointed at Cloudflare R2 | S3-compatible and free; could move to real S3 without code changes |
| API contract | springdoc-openapi → `openapi-typescript` + `openapi-fetch` | Typed frontend client like Convex's `api` object |
| Tests | JUnit 5, Testcontainers (`pgvector/pgvector`, MinIO), MockMvc | Real Postgres in tests; fakes for every external service |

### Repo layout
- `apps/api/`: the Spring Boot project (Gradle). A small `package.json` with `dev`/`build` scripts that call `./gradlew`, so `turbo dev` starts everything.
- `packages/api-client/`: the generated TypeScript client, React Query hooks, and the SSE hook.
- `docs/adr/`: architecture decision records.
- `packages/backend/`: deleted in slice 7.

---

## Data model (Postgres)

Convex splits a conversation into our `conversations` row plus an agent-component "thread". Postgres merges them: messages point at `conversation_id`, and `threadId` goes away. The frontend is switching data layers anyway, so this costs nothing extra. Each table is created by the slice that introduces it.

```sql
-- slice 1
subscriptions    (organization_id text PK, status text, updated_at timestamptz)
widget_settings  (organization_id text PK, greet_message text,
                  suggestion_1 text, suggestion_2 text, suggestion_3 text,
                  vapi_assistant_id text, vapi_phone_number text)
contact_sessions (id uuid PK, organization_id text, name text, email text,
                  expires_at timestamptz, metadata jsonb, created_at timestamptz)
-- slice 2
conversations    (id uuid PK, organization_id text, contact_session_id uuid FK,
                  status text CHECK (status IN ('unresolved','escalated','resolved')),
                  created_at timestamptz)
                  -- indexes: (organization_id, created_at desc),
                  --          (organization_id, status, created_at desc), (contact_session_id, created_at desc)
messages         (id uuid PK, conversation_id uuid FK, seq bigint, role text,  -- user | assistant | tool
                  content text, agent_name text, tool_calls jsonb, created_at timestamptz)
                  -- index: (conversation_id, seq desc)
-- slice 4
knowledge_files  (id uuid PK, organization_id text, filename text, category text,
                  mime_type text, size_bytes bigint, storage_key text, content_hash text,
                  status text,  -- processing | ready | error
                  created_at timestamptz, UNIQUE (organization_id, filename))
vector_store     -- Spring AI PgVectorStore table; metadata holds organization_id + file_id
-- slice 6
plugins          (id uuid PK, organization_id text, service text,
                  encrypted_secret bytea,  -- AES-GCM, key from SECRETS_ENCRYPTION_KEY
                  UNIQUE (organization_id, service))
```

Denormalise `last_message_at` / `last_message_preview` onto `conversations` only if the inbox query (one "last message" lookup per row, as Convex does today) becomes slow.

---

## Auth

### Dashboard (`/api/private/**`)
- The web app sends `Authorization: Bearer ${await getToken({ template: "api" })}`. Copy the existing `convex` JWT template as `api`. It must include an `orgId` claim (`{{org.id}}`) and a family-name claim (used as `agentName` on operator messages).
- Spring validates signature (JWKS at `${CLERK_JWT_ISSUER_DOMAIN}/.well-known/jwks.json`), issuer, audience, and expiry.
- One `@CurrentOrg String orgId` argument resolver returns 401 if the claim is missing. This replaces the identity/orgId block copy-pasted into every `private/*` function.
- Every lookup by id is scoped (`findByIdAndOrganizationId`). Anything in another org returns **404**, not 403, so ids from other orgs can't be probed.

### Widget (`/api/public/**`)
Today the raw `contactSessionId` is the credential and is sent as a function argument. Replace it with:
- `POST /api/public/contact-sessions` returns `{ sessionId, token }`. The token is a short signed JWT (HS256, `WIDGET_TOKEN_SECRET`) with `sub=sessionId, org=orgId`.
- The widget sends `Authorization: Bearer <token>`. A filter loads the session, rejects it if expired, and applies the sliding refresh (the 4-hour threshold from `system/contactSessions.ts`).
- Every public endpoint checks that the resource belongs to **this session**.

### Fix, don't port
These are in today's Convex code. The Spring version must not copy them, and each gets a regression test in the slice listed:

| Issue | Where | Fix | Slice |
|---|---|---|---|
| Any valid contact session can read **any** conversation's messages by `threadId` | `public/messages.ts` `getMany` | Check `conversation.contactSessionId == session.id` | 2 |
| Any valid contact session can post into **any** conversation (and trigger the paid agent) | `public/messages.ts` `create` | Same ownership check | 2 |
| A session from org A can create a conversation in org B | `public/conversations.ts` `create` takes `organizationId` from the client | Take the org from the session | 2 |
| Contact sessions can be created for any string as the org id | `public/contactSessions.ts` `create` | Validate the org exists (cache Clerk lookups) | 1 |
| Anyone can save Vapi secrets without a subscription (`// TODO`) | `private/secrets.ts` | Enforce `active` subscription; validate the body shape instead of `v.any()` | 6 |
| Category filter applied after pagination (pages come back short or empty) | `private/files.ts` `list` | Filter in SQL | 4 |
| Test leftovers (`throw new Error("Tracking test")`) | `users.ts`, `apps/web/app/(dashboard)/page.tsx` | Don't port; remove the dashboard call | 0 |
| Agent playground API exposed | `playground.ts` | Don't port | — |

---

## API mapping

All 27 functions the apps call, plus the webhook. Paginated endpoints use `?cursor=&limit=` and return `{ items, nextCursor }`, where the cursor is `(created_at, id)`.

### Public (widget)
| Convex | Spring | Slice |
|---|---|---|
| `public.organizations.validate` | `GET /api/public/organizations/{orgId}/validate` | 1 |
| `public.contactSessions.create` | `POST /api/public/contact-sessions` | 1 |
| `public.contactSessions.validate` | `GET /api/public/contact-sessions/me` | 1 |
| `public.widgetSettings.getByOrganizationId` | `GET /api/public/organizations/{orgId}/widget-settings` | 1 |
| `public.conversations.getMany` | `GET /api/public/conversations` | 2 |
| `public.conversations.getOne` | `GET /api/public/conversations/{id}` | 2 |
| `public.conversations.create` | `POST /api/public/conversations` | 2 |
| `public.messages.getMany` | `GET /api/public/conversations/{id}/messages` | 2 |
| `public.messages.create` | `POST /api/public/conversations/{id}/messages` (returns after the agent replies, from slice 5) | 2 |
| *(new)* | `GET /api/public/conversations/{id}/events` (SSE) | 3 |
| `public.secrets.getVapiSecrets` | `GET /api/public/organizations/{orgId}/vapi-public-key` | 6 |

### Private (dashboard)
| Convex | Spring | Slice |
|---|---|---|
| *(new)* | `GET /api/private/me` | 0 |
| `private.widgetSettings.getOne` / `upsert` | `GET` / `PUT /api/private/widget-settings` | 1 |
| `private.conversations.getMany` | `GET /api/private/conversations?status=` | 2 |
| `private.conversations.getOne` | `GET /api/private/conversations/{id}` | 2 |
| `private.conversations.updateStatus` | `PATCH /api/private/conversations/{id}` | 2 |
| `private.contactSessions.getOneByConversationId` | `GET /api/private/conversations/{id}/contact-session` | 2 |
| `private.messages.getMany` | `GET /api/private/conversations/{id}/messages` | 2 |
| `private.messages.create` | `POST /api/private/conversations/{id}/messages` | 2 |
| *(new)* | `GET /api/private/events` (SSE, org-wide) | 3 |
| `private.files.list` | `GET /api/private/files?category=` | 4 |
| `private.files.addFile` | `POST /api/private/files` (multipart) | 4 |
| `private.files.deleteFile` | `DELETE /api/private/files/{id}` | 4 |
| `private.messages.enhanceResponse` | `POST /api/private/messages/enhance` | 5 |
| `private.plugins.getOne` / `remove` | `GET` / `DELETE /api/private/plugins/{service}` | 6 |
| `private.secrets.upsert` | `PUT /api/private/plugins/{service}/secret` | 6 |
| `private.vapi.getAssistants` / `getPhoneNumbers` | `GET /api/private/vapi/assistants` / `phone-numbers` | 6 |

### Webhooks
| Convex | Spring | Slice |
|---|---|---|
| `http.ts` `/clerk-webhook` | `POST /api/webhooks/clerk` (verify Svix; on `subscription.updated`, upsert subscription and set `maxAllowedMemberships` 5/1) | 1 |

---

## Live updates

Convex re-runs queries when data changes. We replace that with **SSE notifications + refetch**, not by pushing full data:

1. After a transaction that changes a conversation, message or file commits (`@TransactionalEventListener(phase = AFTER_COMMIT)`), publish `{ type, conversationId }` (e.g. `message.created`, `conversation.updated`, `file.updated`) to an in-process event bus.
2. SSE endpoints forward matching events: the org stream gets everything for that org; the widget stream gets events only for conversations the session owns.
3. `packages/api-client` has a `useLiveEvents()` hook that invalidates the matching TanStack Query keys, which refetch.

Screens that depend on this: widget chat (operator replies), widget inbox, dashboard conversations list, dashboard conversation view, status button, files list (processing → ready).

Details:
- Send a heartbeat comment every ~20 s so proxies don't close idle streams; clients reconnect automatically.
- Browser `EventSource` can't set headers, so use `fetch`-based SSE (`@microsoft/fetch-event-source`) to send the bearer token.
- One instance is enough. If the API ever scales out, fan events out with Postgres `LISTEN/NOTIFY` (no Redis). Good "at scale" material for the README.

---

## AI layer

### Support agent (`public/messages.ts` → `MessageService.handleCustomerMessage`)
Keep the same logic:
1. Check the session, ownership, and that the conversation isn't `resolved`. Refresh the session.
2. Save the user message.
3. If `status == unresolved` and the subscription is `active`: load the conversation history (last N messages) and call `ChatClient` with `SUPPORT_AGENT_PROMPT` and three tools. Save the assistant reply and the tool messages.
4. Otherwise just save the message. It waits for an operator.

Tools (a `SupportTools` bean with `@Tool` methods; conversation id passed via `ToolContext`):
- `escalateConversation`: set status to `escalated`, save "Conversation escalated to a human operator."
- `resolveConversation`: set status to `resolved`, save "Conversation resolved."
- `search(query)`: vector search, top 5, filtered by `organization_id`. Then the `SEARCH_INTERPRETER_PROMPT` summarisation call with `gpt-4o-mini`, and save the answer as an assistant message. This two-step behaviour and the "save from inside the tool" pattern are kept on purpose for parity.

Prompts in `system/ai/constants.ts` move verbatim to `src/main/resources/prompts/*.st`.

Models stay as they are (`gpt-4o-mini` chat, `gpt-4o` for PDF/HTML extraction, `text-embedding-3-small` at 1536 dims).

**Concurrency:** two customer messages arriving together must not run the agent twice on the same history. Lock the conversation row (`SELECT … FOR UPDATE`) around the agent turn.

### Knowledge base (`private/files.ts`, `lib/extractTextContent.ts`)
1. Upload: check the subscription, then store the bytes in R2 at `tenants/{orgId}/files/{uuid}`. Compute the SHA-256 content hash; if an identical file already exists under the same name, skip it (same as Convex's `contentHash`). Insert `knowledge_files` with `status=processing`.
2. `@Async` ingest: extract text (port `extractTextContent`: images → `gpt-4o-mini` vision, PDF → `gpt-4o` file input, HTML → markdown via `gpt-4o`, text as-is), split into chunks (`TokenTextSplitter`), embed, write to `vector_store` with `organization_id` + `file_id` metadata. Set `ready` or `error`. Re-uploading the same filename replaces the old chunks.
3. Delete: org check, delete the vectors, R2 object, and row.
4. List: from `knowledge_files`, with size and a presigned R2 URL.

Retrieval quality will change slightly because Convex RAG's chunker differs from Spring AI's. Slice 5 includes a small retrieval check (5 questions against a test knowledge base) to catch regressions.

---

## Frontend changes

### `packages/api-client` (new, slice 0)
- `openapi.d.ts` generated from the API's spec (`pnpm gen`), committed.
- `createApiClient(getToken)`, React Query hooks per endpoint, `useLiveEvents()` (slice 3).
- A `toUIMessages()` replacement that maps our `messages` rows to the shape `@workspace/ui/components/ai/*` renders (slice 2).

### Swap map
| Today | After |
|---|---|
| `ConvexProviderWithClerk` (`apps/web/components/providers.tsx`) | `QueryClientProvider` + API client using Clerk `getToken({ template: "api" })` |
| `ConvexProvider` (`apps/widget/components/providers.tsx`) | `QueryClientProvider` + API client using the widget token from the Jotai store |
| `Authenticated / Unauthenticated / AuthLoading` (`auth-guard.tsx`) | Clerk's `<SignedIn>` / `<SignedOut>` / `<ClerkLoading>` |
| `useQuery(api.x.y, args)` | `useQuery({ queryKey, queryFn })` |
| `usePaginatedQuery` / `useThreadMessages` | `useInfiniteQuery` (existing `use-infinite-scroll` still works) |
| `useMutation` / `useAction` | `useMutation` (TanStack) + invalidation |
| `Id<"conversations">` types | `string` (UUID) |
| `threadId` everywhere | `conversationId` |
| `NEXT_PUBLIC_CONVEX_URL` | `NEXT_PUBLIC_API_URL` |

**Done (slice 7):** `grep -ri "convex" apps/` returns nothing, and `@workspace/backend` has no dependents.

---

## Slices

Each slice is a GitHub milestone. Each bullet is an issue and one PR. The last issue in each slice switches its screens and runs the listed smoke steps locally.

### Slice 0: Foundation
Goal: an empty but fully wired Spring app, with auth, tests and CI, and the risky tech checked.


- **Scaffold `apps/api`:** Gradle (Kotlin DSL), Java 25, Spring Boot 4, virtual threads, Actuator, `package.json` wrapper for turbo, `Dockerfile`. Dev container: add a JDK and a `pgvector/pgvector` Postgres service.
- **Error format + OpenAPI:** `ProblemDetail` responses via `@RestControllerAdvice`, springdoc with Swagger UI at `/swagger-ui`.
- **Test harness:** base integration test class (Testcontainers Postgres + pgvector, MockMvc), a helper that mints test Clerk JWTs, Flyway baseline.
- **Dashboard auth:** OAuth2 resource server with Clerk JWKS, `@CurrentOrg` resolver, CORS, `GET /api/private/me`. Tests: valid token, missing `orgId`, bad signature, expired.
- **CI:** GitHub Actions running `./gradlew check` (path filter `apps/api/**`) and `pnpm build && pnpm lint`. Required for merge.
- **`packages/api-client` + dashboard wiring:** generate the client, add `QueryClientProvider` next to `ConvexProviderWithClerk`, create the `api` Clerk JWT template, and call `/me` from the dashboard layout. Remove the `users.add` test call from `apps/web/app/(dashboard)/page.tsx`.
- **Spike: Render** *(time-box 1 day, throwaway)*: deploy the scaffold to Render free with the JVM settings from *Hosting*. Measure memory at idle and cold-start time. Check that an SSE stream with heartbeats stays open through Render's proxy.
- **Spike: Spring AI** *(time-box 1 day)*: a `ChatClient` with one `@Tool` (escalate) against `gpt-4o-mini`, and a `PgVectorStore` add + filtered search on Neon. Confirm the tool loop and metadata filter behave as needed.
- **ADRs:** Spring MVC + virtual threads over WebFlux; SSE over WebSockets; pgvector over a separate vector DB; Render + Neon + R2 hosting; widget token instead of raw session id. Update them with the spike results.

Done when: CI is green, `/me` returns the org id from the dashboard, and both spikes have written conclusions.

### Slice 1: Org basics
Goal: the widget can boot and a customer can identify themselves; the dashboard can save widget settings.


- **Org validation:** Clerk Backend API client (`RestClient`), cached lookup, `GET /api/public/organizations/{orgId}/validate`.
- **Subscriptions + billing webhook:** migration, Svix verification, upsert, membership limit update via Clerk. Tests with signed and unsigned payloads.
- **Widget settings:** migration, `GET`/`PUT /api/private/widget-settings`, `GET /api/public/organizations/{orgId}/widget-settings`.
- **Contact sessions + widget token:** migration, `POST /api/public/contact-sessions` (rejects unknown orgs), `GET /api/public/contact-sessions/me`, token filter with sliding refresh. Tests: expired session, tampered token, token for another org.
- **Switch screens:** widget `providers.tsx` (add `QueryClientProvider`), loading screen (org, session and settings steps; the Vapi step stays on Convex until slice 6), auth screen; dashboard customization page. Delete the Convex functions nothing calls anymore.

Smoke steps: 7 (without the "new conversation" part), 9.

### Slice 2: Conversations and messages (no AI, no live updates)
Goal: a customer and an operator can exchange messages, refreshing the page to see new ones.


- **Conversations API (public):** migration, list/get/create for the session's own conversations, greeting message from widget settings. Tests for the cross-org and cross-session fixes.
- **Messages API (public):** list and create (saves only; the agent comes in slice 5), ownership checks, refuses `resolved` conversations.
- **Conversations API (private):** list with status filter and last message, get with contact session, status update, `GET …/contact-session`.
- **Messages API (private):** list, operator reply (escalates `unresolved` conversations, sets `agentName`).
- **Message mapping in `api-client`:** replacement for `toUIMessages()`.
- **Switch widget screens:** selection, inbox, chat.
- **Switch dashboard screens:** conversations panel, conversation view, contact panel, status button.

Smoke steps: 1, 4 and 7 (with refreshes instead of live updates), 10 (for these endpoints).

### Slice 3: Live updates
Goal: everything from slice 2 updates without a refresh.


- **Event bus:** after-commit domain events from the conversation and message services.
- **SSE endpoints:** org stream and session stream, heartbeat, per-session filtering. Tests: a session never receives another session's events.
- **`useLiveEvents()` + wiring:** fetch-based SSE client, query invalidation on the slice 2 screens.

Smoke steps: 3, 4 (live).

### Slice 4: Knowledge base
Goal: the dashboard can manage knowledge files, and they get indexed.


- **Storage service:** S3 client for R2, MinIO in tests, presigned URLs.
- **Files API:** migration, upload (subscription check, content hash dedupe), list (category filter in SQL), delete (vectors + object + row).
- **Text extraction:** port `extractTextContent` (image, PDF, HTML, text) with a fake chat model in tests.
- **Ingestion:** `@Async` chunk → embed → `PgVectorStore`, status updates, `file.updated` event.
- **Switch screens:** files page, upload dialog, delete dialog.

Smoke steps: 6.

### Slice 5: AI agent
Goal: the AI answers customers again, using the knowledge base.


- **Agent core:** prompts moved to resources, `ChatClient` configuration, conversation history loader, row lock per turn.
- **Escalate and resolve tools.**
- **Search tool:** filtered vector search + interpreter call, saves the answer.
- **Wire into public message create:** runs only for `unresolved` conversations with an `active` subscription. Tests with a fake `ChatModel` that requests each tool.
- **Enhance response:** `POST /api/private/messages/enhance` (subscription check) + dashboard switch.
- **Retrieval check:** 5 questions against a small test knowledge base, run manually with real OpenAI; results noted in the milestone.

Smoke steps: 2, 5.

### Slice 6: Vapi plugin
Goal: the existing bring-your-own-Vapi feature works on Spring.


- **Encrypted secrets:** AES-GCM helper with a key from env, round-trip and tamper tests.
- **Plugins API:** migration, get/remove, secret upsert (subscription check, validated body).
- **Vapi client:** assistants and phone numbers via Vapi's REST API (stub server in tests). Public Vapi key endpoint.
- **Switch screens:** plugins page, Vapi view and tabs, the widget loading screen's Vapi step.

Smoke steps: 8.

### Slice 7: Remove Convex and deploy
Goal: the app runs end to end on the new stack, on public URLs.


- **Remove Convex:** delete `packages/backend`, Convex providers and dependencies, `CONVEX_*` env. `grep -ri convex apps/` is empty.
- **Infra as code:** `render.yaml` (web service from `apps/api/Dockerfile`, health check `/actuator/health`, env vars), Neon project, R2 bucket, Clerk webhook URL → Render.
- **CD:** turn off Render's auto-deploy; CI calls Render's deploy hook after `./gradlew check` passes on `master`.
- **Vercel:** set `NEXT_PUBLIC_API_URL` for web and widget, redeploy.
- **Docs:** rewrite `docs/SETUP.md` for the new stack; update `.devcontainer`.
- **Full smoke checklist** on the live URLs.

### Slice 8: Portfolio polish
- README: architecture diagram, stack, how to run locally, links to ADRs and Swagger UI, a demo GIF.
- "What I'd do at scale": `LISTEN/NOTIFY` fan-out, token streaming, GraalVM native image, paid hosting without sleep.
- Test coverage report (JaCoCo) in CI.

---

## Smoke checklist
1. Sign in, pick an org, open the inbox.
2. Widget: enter name/email → start a chat → the agent answers a question from an uploaded file.
3. The customer message appears live in the dashboard inbox, without a reload.
4. The operator replies from the dashboard → the reply appears live in the widget, and the status changes to `escalated`.
5. "I want a human" → the agent escalates. "Thanks, solved" → it resolves; the widget blocks further input.
6. Upload a PDF, image, and HTML file → they show `processing` → `ready`; delete one.
7. Customization: save greeting + suggestions → a new widget conversation uses them.
8. Plugins: connect Vapi → assistants and phone numbers load → the widget shows voice.
9. Billing: a test subscription webhook flips the org to `active` and raises the membership limit to 5.
10. Isolation: with a second org and a second widget session, try another tenant's ids on every endpoint → 404 everywhere.

---

## Hosting (slice 7)

| Piece | Service | Free allowance | Catch |
|---|---|---|---|
| API | **Render** free web service (Docker) | 512 MB RAM, 0.1 CPU, 750 instance-hours/month | Sleeps after 15 min without inbound traffic. Spring startup on 0.1 CPU is slow (measure in the slice 0 spike) |
| Postgres + pgvector | **Neon** | 0.5 GB storage, 100 CU-hours/month | Suspends after 5 min idle (sub-second wake). Don't use Render's free Postgres: it's deleted after 30 days |
| File storage | **Cloudflare R2** | 10 GB, no egress fees | S3-compatible |
| Web + widget | **Vercel** (Hobby) | Already set up | Non-commercial use only; fine for a CV project |
| Auth | **Clerk** | Free dev instance | Already in use |
| Vapi keys | Encrypted column in Postgres | Free | Replaces AWS Secrets Manager |
| **OpenAI** | — | **Not free** | Pay per use. Set a hard monthly limit ($5–10). The only real cost |

### Making Spring fit Render's free tier
- **JVM flags** (`JAVA_TOOL_OPTIONS`): `-XX:MaxRAMPercentage=75 -XX:+UseSerialGC -XX:TieredStopAtLevel=1 -Xss512k`.
- **Faster startup:** Java 25's AOT cache (a training run during the Docker build) and `spring.main.lazy-initialization=true`. Keep the Hikari pool small (≤5), since Neon's free tier limits connections.
- **Cold starts:** if the spike's cold start is too slow for a demo link, either ping `/actuator/health` every ~10 min (750 hours covers one service 24/7, but it goes against the spirit of the free tier and Render could change the rules), or upgrade to Render Starter ($7/month: same RAM, 0.5 CPU, no sleep).
- **Portable:** the API is a plain container image with env-var config, so moving to Cloud Run, Koyeb or a paid host is a config change.

### Other ops
- **CORS:** allow the web and widget origins only. The embed script loads the widget in an iframe, so customer sites never call the API directly.
- **Config:** `OPENAI_API_KEY`, `CLERK_SECRET_KEY`, `CLERK_JWT_ISSUER_DOMAIN`, `CLERK_WEBHOOK_SECRET`, `DATABASE_URL`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `WIDGET_TOKEN_SECRET`, `SECRETS_ENCRYPTION_KEY`, `CORS_ORIGINS`.
- **Observability:** Actuator health endpoint; Sentry Java SDK (free Developer plan; the dashboard already uses Sentry).
