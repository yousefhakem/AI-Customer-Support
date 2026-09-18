# AI-Powered Customer Support Platform

A multi-tenant B2B SaaS platform that lets businesses embed an AI support widget — with text chat, voice, and contact flows — directly into their product via a single script tag.

---

## Overview

Built as a PNPM + Turborepo TypeScript monorepo with three apps sharing UI and backend packages:

| App | Purpose |
|-----|---------|
| `apps/web` | Admin dashboard — configure widgets, manage conversations, view analytics |
| `apps/widget` | Embeddable iframe chat interface (text, voice, inbox, contact) |
| `apps/embed` | Lightweight embed script distributed via a single `<script>` tag |

---

## Architecture

```
Customer's site
  └── <script data-organization-id="..."> (embed script)
        └── iframe → Widget App
              ├── Text chat  ──► Convex real-time backend ──► gpt-4o-mini agent
              ├── Voice      ──► Vapi AI SDK (WebRTC)
              ├── Inbox      ──► Conversation history (Convex)
              └── Contact    ──► Lead capture + analytics

Admin Dashboard (Next.js 15)
  └── Convex backend
        ├── Knowledge base  ──► OpenAI text-embedding-3-small (RAG)
        ├── Subscriptions   ──► Stripe + webhooks
        ├── Auth            ──► Clerk
        ├── File storage    ──► AWS S3 + Secrets Manager
        └── Error tracking  ──► Sentry
```

---

## Key Features

**Embeddable Widget**
- Distributed via a single `<script>` tag; reads `data-organization-id` attribute
- Exposes a global `EchoWidget` API: `init()`, `show()`, `hide()`, `destroy()`
- Communicates with the parent page via `postMessage` (resize, close events)
- Supports four interaction modes: text chat, voice (Vapi), inbox, and contact flows

**AI Agent**
- RAG layer uses OpenAI `text-embedding-3-small` (1,536-dim) for per-organisation knowledge base retrieval
- Agent (`gpt-4o-mini` via `@convex-dev/agent`) has three action tools:
  - Knowledge base search
  - Escalation to human agent
  - Conversation resolution
- Conversation states: `unresolved` → `escalated` → `resolved`

**Multi-Tenant Backend**
- Convex real-time data layer with schema covering: subscriptions, widget settings, plugins, conversations, and contact sessions
- Contact sessions capture user agent, timezone, referrer, and screen dimensions for analytics
- AWS S3 for file/document storage; Secrets Manager for credential isolation per tenant
- Svix webhooks for event delivery; Stripe for subscription lifecycle management

**Admin Dashboard**
- Built with Next.js 15, Jotai state management, React Hook Form + Zod validation
- shadcn/ui component library with Sentry for production error tracking

---

## Tech Stack

**Monorepo**
- PNPM workspaces + Turborepo
- Shared `packages/ui` and `packages/backend` across all apps

**Frontend**
- Next.js 15, React 19, Tailwind CSS
- Jotai, React Hook Form, Zod, shadcn/ui

**Backend & Infrastructure**
- Convex (real-time data + serverless functions)
- AWS S3, AWS Secrets Manager
- Clerk (auth), Stripe (billing), Svix (webhooks)

**AI & Voice**
- OpenAI `gpt-4o-mini` (agent), `text-embedding-3-small` (RAG embeddings)
- Vapi AI SDK (voice — WebRTC-based)
- `@convex-dev/agent` (agent framework)

**Monitoring**
- Sentry (error tracking + performance)

---

## Convex Schema

```
subscriptions       — plan, limits, billing cycle per organisation
widgetSettings      — branding, allowed domains, interaction modes
conversations       — status (unresolved/escalated/resolved), assigned agent
contactSessions     — userAgent, timezone, referrer, screen, timestamps
knowledgeBase       — documents + 1536-dim embeddings per organisation
plugins             — extensible feature flags per organisation
```

---

## Running Locally

```bash
# Install dependencies
pnpm install

# First-time setup: follow docs/SETUP.md (steps 1–5)
# Needs: Convex, OpenAI, Clerk (+ AWS for the Vapi plugin, Sentry optional)

# Run all apps in dev mode
pnpm dev
```

Each app runs on its own port:
- Admin dashboard: `http://localhost:3000`
- Widget: `http://localhost:3001`
- Embed script: `http://localhost:3002`

---

## Deploying to Vercel

Full step-by-step setup for every service (Convex, OpenAI, Clerk, AWS, Sentry, Vercel, self-hosting) is in [docs/SETUP.md](docs/SETUP.md).

The frontends run on Vercel; the backend stays on Convex. Create **two** Vercel projects from this repo:

| Project | Root Directory | Serves |
|---|---|---|
| web | `apps/web` | Admin dashboard. Its build also deploys the Convex backend (`apps/web/vercel.json`). |
| widget | `apps/widget` | Chat widget iframe **and** `/widget.js`, the embed script built from `apps/embed`. |

**Environment variables**

- **web:** `CONVEX_DEPLOY_KEY` (Convex dashboard → Settings → production deploy key), `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_WIDGET_URL` (the widget project's URL). Optional: `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`. Do not set `NEXT_PUBLIC_CONVEX_URL` here; `convex deploy` provides it.
- **widget:** `NEXT_PUBLIC_CONVEX_URL` (the production `https://<name>.convex.cloud` URL).
- **Convex production deployment:** `npx convex env set --prod <NAME> <value>` for each secret in `packages/backend/.env.example`.

**Preview deployments:** add a Convex *preview* deploy key as `CONVEX_DEPLOY_KEY` in the web project's Preview environment to get a separate backend per branch. Without it, preview builds of web fail. Widget previews always talk to the production backend.

**After the first deploy**

1. Deploy the web project first so the Convex functions exist before the widget uses them.
2. Point the Clerk webhook at `https://<name>.convex.site/clerk-webhook` and use a Clerk *production* instance (update `CLERK_JWT_ISSUER_DOMAIN` to match).
3. Customers embed `<script src="https://<widget-domain>/widget.js" data-organization-id="org_..."></script>`. The dashboard's Integrations page generates this from `NEXT_PUBLIC_WIDGET_URL`.
