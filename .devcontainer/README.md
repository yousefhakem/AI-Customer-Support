# Dev container

Everything the project needs runs inside the container — Node 22, pnpm, and
Postgres 17 with the `pgvector` extension already installed. Nothing has to be
installed on your machine.

## Open it

In the browser: **Code → Codespaces → Create codespace on master** on GitHub.

From a terminal:

```bash
gh codespace create -R yousefhakem/AI-Customer-Support
gh codespace ssh
```

`post-create.sh` then installs dependencies, generates the Prisma client,
pushes the schema, adds the pgvector column/index, installs Claude Code, and
writes starter env files.

## Secrets

Set these as **Codespaces secrets** (repo Settings → Secrets and variables →
Codespaces) and they are written into the env files on create:

| Secret | Used by |
|---|---|
| `OPENAI_API_KEY` | agent + RAG embeddings |
| `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`, `CLERK_JWT_ISSUER_DOMAIN` | API auth |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | admin dashboard |
| `NEXT_PUBLIC_CONVEX_URL` | web + widget (while they are still on Convex) |
| `AWS_*` | file storage (optional) |
| `CLAUDE_CODE_OAUTH_TOKEN` | pre-authenticates Claude Code (`claude setup-token`) |

## Ports

3000 web · 3001 widget · 3002 embed · 4000 API · 5432 Postgres.

Forwarded ports are private by default. The widget and embed script need public
URLs to be iframed from another site:

```bash
gh codespace ports visibility 3001:public 3002:public
```

Add the forwarded 3000 URL to Clerk's allowed origins, and point Clerk/Stripe
webhooks at the forwarded 4000 URL.
