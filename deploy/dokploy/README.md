# Dokploy deploy notes

See also the parent [`deploy/README.md`](../README.md).

## Compose path

Dokploy → Compose (GitHub) → `quantumaxis/paperclip`:

- **Compose path:** `deploy/dokploy/docker-compose.yml`

## Database

External Postgres only. Set `DATABASE_URL` in Dokploy env.

## Cursor Cloud overlay

On boot the entrypoint runs:

`node ./deploy/overlays/cursor-cloud-stream-fix/apply.mjs`

## Volume backups

Use Dokploy **Volume Backups** on this Compose service for `paperclip-data`
(named volume → `/paperclip`). Database dumps are separate (Postgres → Backups).
