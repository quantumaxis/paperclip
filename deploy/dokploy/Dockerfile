# Thin Dokploy image: official Paperclip + fork-only overlays.
# Avoids compiling the monorepo (~30m); pull + COPY is seconds.
FROM ghcr.io/paperclipai/paperclip:latest

COPY deploy/overlays /app/deploy/overlays
COPY deploy/dokploy/entrypoint.sh /usr/local/bin/paperclip-dokploy-entrypoint.sh
RUN chmod +x /usr/local/bin/paperclip-dokploy-entrypoint.sh

# Keep upstream tini as PID 1; our script applies overlays then hands off.
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/paperclip-dokploy-entrypoint.sh"]
CMD ["node", "--import", "./server/node_modules/tsx/dist/loader.mjs", "server/dist/index.js"]
