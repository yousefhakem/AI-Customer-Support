# apps/api

The Spring Boot backend (Java 25, Spring Boot 4, Gradle Kotlin DSL) that replaces the Convex backend in `packages/backend`, one migration slice at a time. Migration work goes through the `spring-migration` skill.

- Run Gradle from this folder: `./gradlew check` runs all tests (what CI runs); `./gradlew bootRun` starts the app.
- Tests need Docker (Testcontainers). `docker compose up -d` starts a local Postgres for `bootRun`.

## Conventions

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
  - Tests that extend `IntegrationTest` run against Testcontainers Postgres (pgvector) with MockMvc.
  - `TestJwts` mints tokens.
  - Fake `ChatModel` / `EmbeddingModel` beans stand in for OpenAI; MockRestServiceServer or WireMock for HTTP APIs.
  - Test names describe the behaviour.

Some helpers named above (`@CurrentContactSession`, the fake AI beans) don't exist yet; they arrive with the slice that needs them.
