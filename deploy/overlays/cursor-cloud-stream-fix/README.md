# Cursor Cloud stream_unavailable fix (Dokploy / quantumaxis fork)

## Problem

`@cursor/sdk` `run.wait()` returns `stream_unavailable` whenever `cloud.envVars`
is set, even if the remote Cursor agent finishes successfully. Paperclip then
marks the heartbeat as failed.

## Approach

This directory is **fork-only** (`overlays/…`). Upstream merges never touch it.

At container start, `register.mjs` / `apply.mjs` patches
`packages/adapters/cursor-cloud/src/server/execute.ts` in the running image to:

1. Omit `cloud.envVars` from `Agent.create` / `Agent.resume`
2. Put non-secret `PAPERCLIP_*` context in the prompt instead
3. Fall back to Cursor REST polling when SDK wait does not finish cleanly

Wired from `deploy/dokploy/entrypoint.sh` (thin image on GHCR `:latest`):

```sh
node /app/deploy/overlays/cursor-cloud-stream-fix/apply.mjs
```

If upstream refactors `execute.ts` enough that the patch markers no longer match,
boot fails loudly with `[cursor-cloud-stream-fix] … not found` so the overlay
can be updated — it will not silently no-op.
