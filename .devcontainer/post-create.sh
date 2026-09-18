#!/usr/bin/env bash
# Runs once when the Codespace / dev container is created.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "▸ Activating pnpm 10.4.1"
corepack enable
corepack prepare pnpm@10.4.1 --activate

echo "▸ Installing workspace dependencies"
pnpm install

echo "▸ Installing Claude Code"
npm install -g @anthropic-ai/claude-code

echo "▸ Writing env files"
if [ ! -f packages/backend/.env.local ] && [ -n "${CONVEX_DEPLOYMENT:-}" ]; then
  cat > packages/backend/.env.local <<ENV
CONVEX_DEPLOYMENT=${CONVEX_DEPLOYMENT}
ENV
fi

if [ ! -f apps/web/.env.local ]; then
  cat > apps/web/.env.local <<ENV
NEXT_PUBLIC_CONVEX_URL=${NEXT_PUBLIC_CONVEX_URL:-}
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:-}
CLERK_SECRET_KEY=${CLERK_SECRET_KEY:-}
ENV
fi

if [ ! -f apps/widget/.env.local ]; then
  cat > apps/widget/.env.local <<ENV
NEXT_PUBLIC_CONVEX_URL=${NEXT_PUBLIC_CONVEX_URL:-}
ENV
fi

cat <<'DONE'

✓ Dev container ready.

  1. Link Convex     cd packages/backend && npx convex dev   (log in, pick/create the project)
  2. Server secrets  live in the Convex deployment, not in local files:
                     npx convex env set OPENAI_API_KEY ...
                     npx convex env set CLERK_JWT_ISSUER_DOMAIN ...
                     npx convex env set CLERK_SECRET_KEY ...
                     npx convex env set CLERK_WEBHOOK_SECRET ...
                     npx convex env set AWS_REGION / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY ...
  3. Everything      pnpm dev   → :3000 web  :3001 widget  :3002 embed
  Claude Code        claude
DONE
