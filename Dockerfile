FROM node:22-bookworm-slim AS frontend
WORKDIR /build/web
COPY web/package.json web/package-lock.json ./
RUN npm ci --include=dev
COPY web/ ./
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app/server
# npm start uses tsx; include its runtime loader without a global install.
COPY server/package.json server/package-lock.json ./
RUN npm ci --include=dev && npm cache clean --force
COPY --chown=node:node server/src ./src
COPY --chown=node:node server/tsconfig.json ./
COPY --from=frontend --chown=node:node /build/web/dist /app/web/dist
RUN mkdir -p /data && chown node:node /data
ENV NODE_ENV=production \
    PORT=10000 \
    DB_PATH=/data/teledrive.db \
    WEB_DIST_PATH=/app/web/dist
EXPOSE 10000
USER node
CMD ["node", "--import", "tsx", "src/index.ts"]
