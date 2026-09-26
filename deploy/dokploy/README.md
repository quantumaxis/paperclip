# Dokploy deploy notes

See also the parent [`deploy/README.md`](../README.md).

## Compose path

Dokploy → Compose (GitHub) → `quantumaxis/paperclip`:

- **Compose path:** `deploy/dokploy/docker-compose.yml`
- **Service type:** Docker Compose (not Application / Dockerfile)

## Image

Thin build on top of `ghcr.io/paperclipai/paperclip:latest`:

- `deploy/dokploy/Dockerfile` — `FROM` GHCR, `COPY` `deploy/overlays` only
- Rebuilds in seconds (pull + overlay), not a full monorepo compile
- `build.pull: true` so Dokploy picks up newer `:latest` on each deploy

## Database

External Postgres only. Set `DATABASE_URL` in Dokploy env.

## Cursor Cloud overlay

On boot, `deploy/dokploy/entrypoint.sh` runs:

`node /app/deploy/overlays/cursor-cloud-stream-fix/apply.mjs`

then hands off to upstream `docker-entrypoint.sh`. If upstream refactors
`execute.ts`, boot fails loudly so the overlay can be updated.

## Volume backups

Use Dokploy **Volume Backups** on this Compose service for `paperclip-data`
(named volume → `/paperclip`). Database dumps are separate (Postgres → Backups).
