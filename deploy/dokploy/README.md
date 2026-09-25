# Dokploy deploy notes (quantumaxis/paperclip)

## Compose path

In Dokploy → Compose (GitHub):

- Repository: `quantumaxis/paperclip`
- Branch: `master` (or a release tag)
- **Compose path:** `deploy/dokploy/docker-compose.yml`

Do **not** use upstream `docker/docker-compose.yml`.

## Database

This compose expects an **external** Postgres (Dokploy Postgres service or managed DB).

Set `DATABASE_URL` in Dokploy env, e.g.:

`postgres://USER:PASSWORD@HOST:5432/DBNAME`

Also set:

- `BETTER_AUTH_SECRET`
- `PAPERCLIP_PUBLIC_URL`
- `PAPERCLIP_DEPLOYMENT_MODE=authenticated`
- `PAPERCLIP_DEPLOYMENT_EXPOSURE=private`
- `PAPERCLIP_ALLOWED_HOSTNAMES` (your hostname + localhost)

Migrations auto-apply on boot (`PAPERCLIP_MIGRATION_AUTO_APPLY=true`).

## Cursor Cloud fix

`overlays/cursor-cloud-stream-fix/` is applied on every container start.
See that directory’s README.

## Upstream sync

`.github/workflows/sync-upstream.yml` merges `paperclipai/paperclip` hourly.
Create a repo secret `SYNC_PAT` (PAT with `repo` + `workflow`) like the 9router fork.
