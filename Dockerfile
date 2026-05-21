FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

# --- Зависимости ---
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY lib/db/package.json lib/db/
COPY lib/api-spec/package.json lib/api-spec/
COPY lib/api-zod/package.json lib/api-zod/
COPY lib/api-client-react/package.json lib/api-client-react/
COPY artifacts/api-server/package.json artifacts/api-server/
COPY artifacts/hochu-to/package.json artifacts/hochu-to/
RUN pnpm install --no-frozen-lockfile

# --- Сборка фронтенда ---
FROM deps AS build-frontend
COPY tsconfig.base.json tsconfig.json ./
COPY lib/ lib/
COPY artifacts/hochu-to/ artifacts/hochu-to/
ENV PORT=3000
ENV BASE_PATH=/
ENV NODE_ENV=production
ENV API_PORT=8080
RUN pnpm --filter @workspace/hochu-to run build

# --- Сборка бэкенда ---
FROM deps AS build-backend
COPY tsconfig.base.json tsconfig.json ./
COPY lib/ lib/
COPY artifacts/api-server/ artifacts/api-server/
RUN pnpm --filter @workspace/api-server run build

# --- Продакшн-образ ---
FROM base AS production

# Stage 30B-Fix (heavy plan): шрифты с кириллицей для sharp/librsvg при генерации
# инфографики. Без них node:22-slim рендерит русский текст как "tofu" (□□□).
# fonts-dejavu-core ≈ 1.4MB, покрывает sans/serif/mono для всех кириллических глифов.
# fc-cache обновляет индекс fontconfig, чтобы librsvg сразу видел новые шрифты.
# Rebuild trigger: 13.05.2026
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        fontconfig \
        fonts-dejavu-core \
        fonts-liberation \
    && fc-cache -f \
    && rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY lib/db/package.json lib/db/
COPY lib/api-spec/package.json lib/api-spec/
COPY lib/api-zod/package.json lib/api-zod/
COPY lib/api-client-react/package.json lib/api-client-react/
COPY artifacts/api-server/package.json artifacts/api-server/
COPY artifacts/hochu-to/package.json artifacts/hochu-to/
RUN pnpm install --no-frozen-lockfile --prod

COPY lib/db/ lib/db/
COPY lib/api-spec/ lib/api-spec/
COPY lib/api-zod/ lib/api-zod/
COPY lib/api-client-react/ lib/api-client-react/

COPY --from=build-backend /app/artifacts/api-server/dist/ artifacts/api-server/dist/
COPY --from=build-frontend /app/artifacts/hochu-to/dist/public/ artifacts/api-server/dist/public/

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["sh", "-c", "node /app/lib/db/migrate-prod.mjs && node artifacts/api-server/dist/index.mjs"]
