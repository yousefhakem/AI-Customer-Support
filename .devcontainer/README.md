# Dev container

Everything the project needs runs inside the container — Node 22 and pnpm.
The backend is Convex, which runs in Convex's cloud, so there is no local
database. Nothing has to be installed on your machine.

## Open it

In the browser: **Code → Codespaces → Create codespace on master** on GitHub.

From a terminal:

```bash
gh codespace create -R yousefhakem/AI-Customer-Support
gh codespace ssh
```

`post-create.sh` then installs dependencies, installs Claude Code, and writes
starter env files.

## First run

```bash
cd packages/backend && npx convex dev   # log in and link your Convex project
```

Server-side secrets are stored in the Convex deployment (dashboard, or
`npx convex env set NAME value`), not in local files:

| Convex env var | Used by |
|---|---|
| `OPENAI_API_KEY` | agent, RAG embeddings, file text extraction |
| `CLERK_JWT_ISSUER_DOMAIN` | `convex/auth.config.ts` (Clerk "convex" JWT template) |
| `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET` | Clerk webhook in `convex/http.ts` |
| `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Secrets Manager (Vapi keys) |

## Codespaces secrets

Set these as **Codespaces secrets** (repo Settings → Secrets and variables →
Codespaces) and they are written into the app env files on create:

| Secret | Written to |
|---|---|
| `NEXT_PUBLIC_CONVEX_URL` | `apps/web/.env.local`, `apps/widget/.env.local` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | `apps/web/.env.local` |
| `CONVEX_DEPLOYMENT` | `packages/backend/.env.local` (optional; `npx convex dev` writes it) |
| `CLAUDE_CODE_OAUTH_TOKEN` | pre-authenticates Claude Code (`claude setup-token`) |

## Ports

3000 web · 3001 widget · 3002 embed.

Forwarded ports are private by default. The widget and embed script need public
URLs to be iframed from another site:

```bash
gh codespace ports visibility 3001:public 3002:public
```

Add the forwarded 3000 URL to Clerk's allowed origins. Clerk webhooks point at
your Convex deployment's HTTP URL (`https://<deployment>.convex.site/clerk-webhook`).
