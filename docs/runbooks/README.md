# Runbooks

## DB migrate (Prisma)

Schema lives in `services/identity-service/prisma/`.

```bash
cd services/identity-service
export DATABASE_URL="postgresql://opsengine:opsengine@localhost:5432/opsengine"
npx prisma migrate deploy              # apply recorded migrations
# After schema.prisma changes:
npx prisma generate
# then RESTART the dev server (it holds a stale client):
pkill -f "next dev"
cd ../../apps/web && setsid nohup pnpm dev > /tmp/next-shell.log 2>&1 < /dev/null & disown
```

Quirk: `prisma migrate dev` fails non-interactively here — write SQL into a migration folder, `prisma migrate deploy`; baseline pre-existing tables with `npx prisma migrate resolve --applied <name>`.

## Seed

```bash
cd apps/web && DATABASE_URL="postgresql://opsengine:opsengine@localhost:5432/opsengine" node scripts/seed.mjs
```
Idempotent (upserts). Seed credentials are printed by the script; tenant A admin holds org.* + recruit.* TENANT grants.

## Dev server

```bash
cd apps/web && pnpm dev      # http://localhost:3000 (Next 16, Turbopack)
tail -f /tmp/next-shell.log
```

## Quality gates (before claiming anything works)

```bash
cd apps/web
npx vitest run
npx tsc --noEmit
```
Then curl smokes (`/tmp/opencode/ats-smoke.sh`, `ats-smoke2.sh`) and Chrome probes (`verify-hrms.mjs`, `verify-ats.mjs`) — see `docs/operations/task.md` for current numbers.

## Postgres shell

```bash
psql "postgresql://opsengine:opsengine@localhost:5432/opsengine"
```
