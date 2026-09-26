# quantumaxis Paperclip customizations

Everything fork-specific for Dokploy lives under **`deploy/`** so upstream
merges never touch it.

```
deploy/
  README.md                          ← this file
  dokploy/
    docker-compose.yml               ← Dokploy composePath
    .env.example
    README.md
  overlays/
    cursor-cloud-stream-fix/       ← Cursor Cloud wait()/envVars fix
      apply.mjs
      register.mjs
      README.md
```

## Dokploy

- Service type: **Docker Compose** (not Application / Dockerfile)
- Compose path: `deploy/dokploy/docker-compose.yml`
- Named volume `paperclip-data` → `/paperclip` (use Compose **Volume Backups**)
- External Postgres via `DATABASE_URL`

## Upstream sync

GitHub Actions must live under `.github/workflows/` (platform requirement), so:

- `.github/workflows/sync-upstream.yml` — hourly merge from `paperclipai/paperclip` + tags/releases  
  (requires `SYNC_PAT` secret)

That file is still fork-only; upstream has no workflow with that name.

## Conflict risk

| Path | Upstream? | Conflict? |
|---|---|---|
| `deploy/**` | No | Never |
| `.github/workflows/sync-upstream.yml` | No | Never |
| `packages/**`, `Dockerfile`, etc. | Yes | Do not edit |
