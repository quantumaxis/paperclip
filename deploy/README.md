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

- `.github/workflows/sync-upstream.yml` — hourly merge of `master` from `paperclipai/paperclip`, plus **stable tags only** (`vYYYY.MDD.P`) and their GitHub Releases  
  (requires `SYNC_PAT` secret)

Channel tags (`canary/…`, `nightly/…`, `beta/…`) are intentionally **not** mirrored. Dokploy’s Trigger Type **On Tag** has no name filter — every pushed tag would redeploy. Filtering in sync is the control point.

Dokploy note: **On Tag** only *triggers* the deploy; the build still checks out the configured **Branch** (`master`). Keep Branch = `master`, Trigger = **On Tag**.

That workflow file is still fork-only; upstream has no workflow with that name.

## Conflict risk

| Path | Upstream? | Conflict? |
|---|---|---|
| `deploy/**` | No | Never |
| `.github/workflows/sync-upstream.yml` | No | Never |
| `packages/**`, `Dockerfile`, etc. | Yes | Do not edit |
