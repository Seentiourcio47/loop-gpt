# Loop GPT spike: stock LibreChat + our endpoints config + MCP media tools
FROM ghcr.io/danny-avila/librechat:latest

ENV CONFIG_PATH=/app/librechat.yaml

WORKDIR /app
# NOTE: flat build context (nested dirs were dropped by the railway CLI indexer)
COPY librechat.yaml /app/librechat.yaml
COPY mcp-package.json /app/loop-mcp/package.json
USER root
RUN npm install --omit=dev --no-audit --no-fund --prefix /app/loop-mcp
COPY media-server.mjs /app/loop-mcp/media-server.mjs
COPY selftest.mjs /app/loop-mcp/selftest.mjs
RUN chown -R node:node /app/loop-mcp
USER node

EXPOSE 3080
# Boot: selftest output goes to container stdout (visible in deploy logs); app starts immediately
CMD ["sh", "-c", "(node /app/loop-mcp/selftest.mjs &) ; exec node api/server/index.js"]
