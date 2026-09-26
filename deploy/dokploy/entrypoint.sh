#!/bin/sh
set -e
# Apply fork overlays against the image tree (e.g. cursor-cloud execute.ts),
# then the upstream entrypoint (gosu / volume ownership) and server CMD.
node /app/deploy/overlays/cursor-cloud-stream-fix/apply.mjs
exec docker-entrypoint.sh "$@"
