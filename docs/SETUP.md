# Setup Guide

Everything this project needs, from zero to production. Work through it in order: each part produces values that later parts need.

| # | Service | What it's for | Needed for |
|---|---|---|---|
| 1 | Convex | Database, backend functions, AI agent, file storage | Everything |
| 2 | OpenAI | Support agent (`gpt-4o-mini`), file parsing (`gpt-4o`), embeddings (`text-embedding-3-small`) | Chat and knowledge base |
| 3 | Clerk | Sign-in, organizations, billing (`pro` plan) | Dashboard |
| 4 | AWS Secrets Manager | Stores each customer's Vapi keys | Vapi plugin |
| 5 | Local env files | Running `pnpm dev` | Local development |
| 6 | Sentry (optional) | Error tracking in the dashboard | Nothing; disabled when unset |
| 7 | Vercel | Hosting the dashboard and widget | Production |
| 8 | Self-hosted Convex (optional) | Replacing Convex Cloud with your own server | Lock-in escape hatch |

> **Vapi needs no platform setup.** Each customer pastes their own Vapi keys on the dashboard's Plugins page; they're stored in AWS Secrets Manager under `tenant/<orgId>/vapi`.

Keep a scratch note open while you go. You'll collect roughly these values:

```
CONVEX_DEPLOYMENT, NEXT_PUBLIC_CONVEX_URL   (dev)
CONVEX_DEPLOY_KEY, prod Convex URL           (prod)
OPENAI_API_KEY
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY, CLERK_JWT_ISSUER_DOMAIN, CLERK_WEBHOOK_SECRET   (dev and prod each)
AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
```

---

## 1. Convex

1. Sign up at <https://dashboard.convex.dev>.
2. From the repo root:
   ```bash
   pnpm install
   cd packages/backend
   npx convex dev
   ```
   Log in when prompted and choose **create a new project**. This:
   - creates your **dev** deployment,
   - writes `packages/backend/.env.local` with `CONVEX_DEPLOYMENT=dev:<name>`,
   - pushes the functions, schema, and the agent/RAG components.
3. Note the deployment URL it prints: `https://<name>.convex.cloud`. That's your dev `NEXT_PUBLIC_CONVEX_URL`.
   The HTTP-actions URL (for webhooks) is the same name on `.convex.site`.
4. Leave `npx convex dev` running in a terminal while developing. It redeploys on save.

Function errors about missing environment variables are expected until you finish steps 2–4.

---

## 2. OpenAI

1. Go to <https://platform.openai.com/api-keys> → **Create new secret key**.
2. Add a payment method and set a monthly budget limit under **Settings → Limits**. The agent calls the API on every customer message.
3. Store it on the Convex dev deployment:
   ```bash
   cd packages/backend
   npx convex env set OPENAI_API_KEY sk-...
   ```

---

## 3. Clerk

Clerk handles dashboard sign-in, organizations (every dashboard user works inside an org), and billing. Clerk has separate **Development** and **Production** instances, each with its own keys. Set up Development now and Production in step 7.

### 3.1 Application
1. <https://dashboard.clerk.com> → **Create application**. Pick whatever sign-in methods you want.
2. **API keys** page: copy
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (`pk_test_...`)
   - `CLERK_SECRET_KEY` (`sk_test_...`)

### 3.2 Organizations
1. **Configure → Organizations → Enable organizations.**
2. Turn **off** personal accounts if offered. The dashboard hides the personal workspace and requires an org (`apps/web/middleware.ts` redirects to `/org-selection` without one).
3. Set the default membership limit to **1**. The billing webhook raises it to 5 when an org subscribes and back to 1 when it lapses.

### 3.3 JWT template for Convex
Convex verifies Clerk tokens using a JWT template that must be named `convex` (`packages/backend/convex/auth.config.ts` expects `applicationID: "convex"`).

1. **Configure → JWT templates → New template → Convex.** Keep the name `convex`.
2. In **Claims**, add the org ID. Every private function reads `identity.orgId`, and without it the dashboard shows "Organization not found" errors:
   ```json
   {
     "orgId": "{{org.id}}"
   }
   ```
   (Keep any claims the preset already added.)
3. Save and copy the **Issuer** URL (for dev it looks like `https://<something>.clerk.accounts.dev`).
4. Store it on Convex:
   ```bash
   npx convex env set CLERK_JWT_ISSUER_DOMAIN https://<something>.clerk.accounts.dev
   npx convex env set CLERK_SECRET_KEY sk_test_...
   ```

### 3.4 Billing
The Files and Customization pages are gated on a plan with key `pro` (`<Protect condition={(has) => has({ plan: "pro" })}>`), and `/billing` shows Clerk's pricing table.

1. **Configure → Billing → Enable billing.** In development you can use Clerk's test payment gateway. For production you connect Stripe.
2. **Plans → Organization plans → Create plan.** Set the **key** to exactly `pro` and set any price.
3. Optional: a free plan for orgs to start on.

### 3.5 Webhook
Keeps `subscriptions` in Convex and org membership limits in sync with billing (`packages/backend/convex/http.ts`).

1. **Configure → Webhooks → Add endpoint.**
2. URL: `https://<dev-name>.convex.site/clerk-webhook` (note: **.site**, not .cloud).
3. Subscribe to the **`subscription.updated`** event. Other events are ignored.
4. Create it, then copy the **Signing Secret** (`whsec_...`):
   ```bash
   npx convex env set CLERK_WEBHOOK_SECRET whsec_...
   ```
5. Test it with the **Testing** tab. The Convex dashboard's **Logs** should show the request.

---

## 4. AWS Secrets Manager

The backend stores each customer's Vapi keys as secrets named `tenant/<orgId>/vapi`. It needs an IAM user limited to those secrets.

1. Pick a region, e.g. `us-east-1`, and use it everywhere below.
2. **IAM → Policies → Create policy → JSON**, replacing `REGION` and `ACCOUNT_ID`:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "secretsmanager:CreateSecret",
           "secretsmanager:GetSecretValue",
           "secretsmanager:PutSecretValue"
         ],
         "Resource": "arn:aws:secretsmanager:REGION:ACCOUNT_ID:secret:tenant/*"
       }
     ]
   }
   ```
   Name it `ai-support-tenant-secrets`.
3. **IAM → Users → Create user** (no console access) → attach that policy.
4. The user's **Security credentials → Create access key** → *Application running outside AWS*. Copy both values.
5. Store them on Convex:
   ```bash
   npx convex env set AWS_REGION us-east-1
   npx convex env set AWS_ACCESS_KEY_ID AKIA...
   npx convex env set AWS_SECRET_ACCESS_KEY ...
   ```

Secrets Manager costs about $0.40 per secret per month, so one per customer that enables Vapi.

Use separate IAM users (or at least separate secret prefixes) for dev and prod if dev and prod orgs might overlap. Clerk org IDs differ between instances, so in practice they won't collide.

---

## 5. Local environment and first run

Copy each `.env.example` to `.env.local` and fill it in:

```bash
cp apps/web/.env.example    apps/web/.env.local
cp apps/widget/.env.example apps/widget/.env.local
```

| File | Values |
|---|---|
| `apps/web/.env.local` | `NEXT_PUBLIC_CONVEX_URL` (dev), `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_WIDGET_URL=http://localhost:3001`. Leave `CONVEX_DEPLOY_KEY` and Sentry empty. |
| `apps/widget/.env.local` | `NEXT_PUBLIC_CONVEX_URL` (dev) |
| `packages/backend/.env.local` | Already written by `npx convex dev` |

Check the Convex deployment has everything:
```bash
cd packages/backend && npx convex env list
# Expect: OPENAI_API_KEY, CLERK_JWT_ISSUER_DOMAIN, CLERK_SECRET_KEY,
#         CLERK_WEBHOOK_SECRET, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
```

Run everything from the repo root:
```bash
pnpm dev
```

**Smoke test**
1. <http://localhost:3000>: sign up, create an organization, and land on Conversations.
2. Copy your org ID (Integrations page, or Clerk dashboard → Organizations).
3. <http://localhost:3001/?organizationId=org_...>: start a chat as a customer and send a message. You should get an AI reply.
4. The conversation should appear live in the dashboard.
5. Optional: <http://localhost:3002> runs the embed demo page with the floating chat button.

---

## 6. Sentry (optional)

Skip this step and the dashboard runs with Sentry disabled.

1. <https://sentry.io> → create a **Next.js** project.
2. Copy the **DSN** (*Project settings → Client Keys*) into `NEXT_PUBLIC_SENTRY_DSN`.
3. For readable stack traces in production, also set:
   - `SENTRY_ORG` and `SENTRY_PROJECT`: the slugs in your Sentry URL
   - `SENTRY_AUTH_TOKEN`: *Settings → Auth Tokens* (only needed on Vercel, for source-map upload)
4. `/sentry-example-page` in the dashboard triggers a test error.

---

## 7. Production on Vercel

### 7.1 Production Clerk instance
Clerk production instances **require a domain you own**; they don't work on `*.vercel.app`. Pick one now, e.g. `app.example.com` (dashboard) and `widget.example.com` (widget).

1. In Clerk, switch the instance toggle to **Production** and follow the prompts to add DNS records for your domain.
2. Repeat **3.2–3.5** on the production instance. Everything is per-instance: organizations, the `convex` JWT template with the `orgId` claim, billing with the `pro` plan (connect Stripe here), and the webhook, pointing at the **prod** Convex `.convex.site` URL from 7.2.
3. Collect the production values: `pk_live_...`, `sk_live_...`, the Issuer (`https://clerk.example.com`), and the new `whsec_...`.

### 7.2 Production Convex deployment
Your Convex project already has a production deployment. In the Convex dashboard, switch to **Production** and note its URL (`https://<prod-name>.convex.cloud`).

Set its secrets with `--prod`:
```bash
cd packages/backend
npx convex env set --prod OPENAI_API_KEY sk-...
npx convex env set --prod CLERK_JWT_ISSUER_DOMAIN https://clerk.example.com
npx convex env set --prod CLERK_SECRET_KEY sk_live_...
npx convex env set --prod CLERK_WEBHOOK_SECRET whsec_...
npx convex env set --prod AWS_REGION us-east-1
npx convex env set --prod AWS_ACCESS_KEY_ID AKIA...
npx convex env set --prod AWS_SECRET_ACCESS_KEY ...
```

Then create a deploy key: **Production → Settings → Deploy keys → Generate production deploy key.** That's `CONVEX_DEPLOY_KEY`.

### 7.3 Vercel projects
Import the GitHub repo **twice** at <https://vercel.com/new>:

**Project `web`**
- Root Directory: `apps/web`. Build settings come from `apps/web/vercel.json`, which runs `convex deploy` and then `next build`.
- Environment variables (Production):
  | Name | Value |
  |---|---|
  | `CONVEX_DEPLOY_KEY` | from 7.2 |
  | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_...` |
  | `CLERK_SECRET_KEY` | `sk_live_...` |
  | `NEXT_PUBLIC_WIDGET_URL` | `https://widget.example.com` |
  | Sentry vars | optional, from step 6 |
- **Do not** set `NEXT_PUBLIC_CONVEX_URL`; `convex deploy` injects it.
- Domains: add `app.example.com`.

**Project `widget`**
- Root Directory: `apps/widget`. The build also compiles `apps/embed` into `/widget.js`.
- Environment variables: `NEXT_PUBLIC_CONVEX_URL` = `https://<prod-name>.convex.cloud`
- Domains: add `widget.example.com`.

Deploy **web first**, so the backend functions exist before the widget calls them.

### 7.4 Preview deployments (optional but recommended)
In Convex: **Production → Settings → Deploy keys → Generate preview deploy key.** In Vercel's `web` project, add it as `CONVEX_DEPLOY_KEY` for the **Preview** environment only. Each PR then gets its own throwaway backend. Preview deployments need the secrets too: set them as **default environment variables for preview deployments** in the Convex project settings.

Without a preview key, preview builds of `web` fail at `convex deploy`. Widget previews always use the production backend.

### 7.5 Go-live checklist
- [ ] Sign up on `https://app.example.com`, create an org, see Conversations
- [ ] Integrations page shows `<script src="https://widget.example.com/widget.js" ...>`
- [ ] Paste that snippet into a test HTML page; the chat button appears and the AI replies
- [ ] Subscribe an org to `pro` → Files/Customization unlock; Convex **Logs** show the webhook
- [ ] Upload a file on Files; ask the widget about it (tests OpenAI + RAG)
- [ ] Optional: enable Vapi on Plugins with test keys (tests AWS Secrets Manager)

---

## 8. Self-hosting Convex

Convex's backend is open source. Self-hosting supports the free-tier features of Convex Cloud; the code in this repo doesn't change. **Do a local trial first (8.1)** before moving production.

### 8.1 Local trial (Docker)
```bash
git clone https://github.com/get-convex/convex-backend
cd convex-backend/self-hosted/docker
docker compose up -d
docker compose exec backend ./generate_admin_key.sh   # copy the key
```
- `http://127.0.0.1:3210`: API (what apps connect to)
- `http://127.0.0.1:3211`: HTTP actions (webhooks, i.e. the `.convex.site` equivalent)
- `http://localhost:6791`: dashboard (log in with the admin key)

Point the backend at it. In `packages/backend/.env.local`, comment out `CONVEX_DEPLOYMENT` and add:
```
CONVEX_SELF_HOSTED_URL='http://127.0.0.1:3210'
CONVEX_SELF_HOSTED_ADMIN_KEY='<admin key>'
```
Then:
```bash
cd packages/backend
npx convex dev          # pushes functions + components to your container
npx convex env set OPENAI_API_KEY ...   # repeat for all 7 secrets from steps 2–4
```
Set `NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3210` in both apps' `.env.local` and run `pnpm dev`. The Clerk webhook can't reach localhost; use a tunnel (`cloudflared tunnel --url http://localhost:3211`) if you need to test billing.

**Copy real data in** (optional):
```bash
# with CONVEX_DEPLOYMENT (cloud) active:
npx convex export --path backup.zip
# with CONVEX_SELF_HOSTED_* active:
npx convex import --replace-all backup.zip
```

To switch back to cloud, restore `CONVEX_DEPLOYMENT` and remove the two self-hosted lines.

### 8.2 Production server
A single VPS is enough to start (e.g. Hetzner, DigitalOcean, or a Fly.io machine with a volume). Put it in the **same region as your database**.

**Database: use Postgres, not the default SQLite volume.**
1. Create a managed Postgres (Neon, Supabase, RDS, ...) in the same region as the server.
2. Create the database Convex uses:
   ```bash
   psql "<connection string>" -c "CREATE DATABASE convex_self_hosted"
   ```
3. Set `POSTGRES_URL` to the connection string **without the database name or query params** (e.g. `postgresql://user:pass@host.neon.tech`). Only set `DO_NOT_REQUIRE_SSL=1` for a local, non-TLS Postgres.

**File storage: S3 or Cloudflare R2** (needed for uploaded knowledge-base files, and so the server's disk isn't the only copy). Create five buckets and set:
```
AWS_REGION=...                 # "auto" for R2
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_ENDPOINT_URL=...            # only for R2 / other S3-compatible providers
S3_STORAGE_EXPORTS_BUCKET=convex-exports
S3_STORAGE_SNAPSHOT_IMPORTS_BUCKET=convex-imports
S3_STORAGE_MODULES_BUCKET=convex-modules
S3_STORAGE_FILES_BUCKET=convex-files
S3_STORAGE_SEARCH_BUCKET=convex-search
```
> These `AWS_*` variables are **container** environment for Convex's own storage. They are separate from the `AWS_*` values you set with `npx convex env set` for Secrets Manager (step 4). Use a different IAM user for each.

**Public URLs and HTTPS.** Browsers need `https://` and `wss://`. Pick two subdomains and put a reverse proxy in front. Caddy handles certificates automatically:
```
# /etc/caddy/Caddyfile
convex.example.com {
  reverse_proxy 127.0.0.1:3210
}
convex-site.example.com {
  reverse_proxy 127.0.0.1:3211
}
convex-dashboard.example.com {
  reverse_proxy 127.0.0.1:6791
}
```
Then create a `.env` next to `docker-compose.yml`:
```
CONVEX_CLOUD_ORIGIN=https://convex.example.com
CONVEX_SITE_ORIGIN=https://convex-site.example.com
NEXT_PUBLIC_DEPLOYMENT_URL=https://convex.example.com
INSTANCE_SECRET=<openssl rand -hex 32>
POSTGRES_URL=...
# ...plus the S3 variables above
```
Keep `INSTANCE_SECRET` safe and stable: admin keys are derived from it. Generate the admin key after setting it (`docker compose exec backend ./generate_admin_key.sh`), and restrict or IP-allowlist the dashboard subdomain.

**Hardening:** pin the image tags (`convex-backend:<rev>` instead of `:latest`) so upgrades are deliberate, firewall everything except 80/443, and turn on automatic security updates on the host.

### 8.3 Moving production over
1. Deploy functions and set secrets on the new server:
   ```bash
   export CONVEX_SELF_HOSTED_URL=https://convex.example.com
   export CONVEX_SELF_HOSTED_ADMIN_KEY=<prod admin key>
   npx convex deploy
   npx convex env set OPENAI_API_KEY ...   # all 7, with production values
   ```
2. Pick a quiet time. Export from cloud (`npx convex export --prod --path prod.zip`) and import (`npx convex import --replace-all prod.zip`). Writes made between export and cutover are lost, so keep this window short.
3. Vercel, `web` project: remove `CONVEX_DEPLOY_KEY` and add `CONVEX_SELF_HOSTED_URL` + `CONVEX_SELF_HOSTED_ADMIN_KEY`. The same build command then deploys to your server and injects its URL.
4. Vercel, `widget` project: `NEXT_PUBLIC_CONVEX_URL=https://convex.example.com`.
5. Clerk (production): change the webhook URL to `https://convex-site.example.com/clerk-webhook`.
6. Redeploy both Vercel projects and run the go-live checklist (7.5) again.
7. Keep the cloud deployment untouched for a week as your rollback.

Preview deploy keys don't exist for self-hosted, so drop the Preview `CONVEX_DEPLOY_KEY`, or keep previews on Convex Cloud.

### 8.4 Running it
- **Backups:** schedule `npx convex export --path backup-$(date +%F).zip` daily (cron on the server, or a GitHub Action) and copy it off the box. Postgres point-in-time recovery from your provider is a second layer.
- **Upgrades:** read the convex-backend release notes, bump the pinned tag, `docker compose pull && docker compose up -d`. Take an export first.
- **Monitoring:** watch the `/version` health endpoint with an uptime checker, and check container logs (`docker compose logs -f backend`).
- **Help:** the Convex Discord `#self-hosted` channel and GitHub issues on `get-convex/convex-backend`.
