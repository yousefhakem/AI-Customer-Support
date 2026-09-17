#!/usr/bin/env bash
# Runs once when the Codespace / dev container is created.
set -euo pipefail

cd "$(dirname "$0")/.."

DB_URL="postgresql://postgres:postgres@localhost:5432/ai_customer_support"
export PGPASSWORD=postgres

echo "▸ Installing psql client"
sudo apt-get update -qq
sudo apt-get install -y -qq postgresql-client >/dev/null

echo "▸ Activating pnpm 10.4.1"
corepack enable
corepack prepare pnpm@10.4.1 --activate

echo "▸ Installing workspace dependencies"
pnpm install

echo "▸ Installing Claude Code"
npm install -g @anthropic-ai/claude-code

echo "▸ Writing env files"
if [ ! -f packages/backend/.env ]; then
  cat > packages/backend/.env <<EOF
PORT=4000
DATABASE_URL=$DB_URL
CLERK_SECRET_KEY=${CLERK_SECRET_KEY:-}
CLERK_WEBHOOK_SECRET=${CLERK_WEBHOOK_SECRET:-}
CLERK_JWT_ISSUER_DOMAIN=${CLERK_JWT_ISSUER_DOMAIN:-}
OPENAI_API_KEY=${OPENAI_API_KEY:-}
AWS_REGION=${AWS_REGION:-}
AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID:-}
AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY:-}
AWS_S3_BUCKET=${AWS_S3_BUCKET:-}
WEB_APP_URL=http://localhost:3000
WIDGET_APP_URL=http://localhost:3001
EOF
fi

if [ ! -f apps/web/.env.local ]; then
  cat > apps/web/.env.local <<EOF
NEXT_PUBLIC_CONVEX_URL=${NEXT_PUBLIC_CONVEX_URL:-}
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:-}
EOF
fi

if [ ! -f apps/widget/.env.local ]; then
  cat > apps/widget/.env.local <<EOF
NEXT_PUBLIC_CONVEX_URL=${NEXT_PUBLIC_CONVEX_URL:-}
EOF
fi

echo "▸ Waiting for Postgres"
for _ in $(seq 1 60); do
  pg_isready -h localhost -U postgres -q && break
  sleep 1
done

echo "▸ Enabling pgvector"
psql "$DB_URL" -q -c "CREATE EXTENSION IF NOT EXISTS vector;"

echo "▸ Generating Prisma client and pushing schema"
(cd packages/backend && npx prisma generate && npx prisma db push --skip-generate)

echo "▸ Adding the pgvector column and index (see prisma/schema.prisma)"
psql "$DB_URL" -q -c "ALTER TABLE rag_entries ADD COLUMN IF NOT EXISTS embedding vector(1536);"
psql "$DB_URL" -q -c "CREATE INDEX IF NOT EXISTS rag_entries_embedding_idx ON rag_entries USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);"

cat <<'DONE'

✓ Dev container ready.

  API           pnpm --filter @workspace/backend dev   → :4000  (/health)
  Everything    pnpm dev                               → :3000 :3001 :3002 :4000
  Claude Code   claude

  Fill in keys: packages/backend/.env, apps/web/.env.local, apps/widget/.env.local
  (or set them as Codespaces secrets so they land there automatically).
DONE
