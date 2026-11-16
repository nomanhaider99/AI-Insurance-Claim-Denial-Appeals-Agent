# One image for api, worker and migrate (different commands). Prod hardening lands in Phase 6.
FROM node:24-alpine AS base
RUN npm install -g pnpm@12.15.0
WORKDIR /app

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @appeal/api...
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @appeal/shared build && pnpm --filter @appeal/api build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app/apps/api
USER node
EXPOSE 4000
CMD ["node", "dist/server.js"]
