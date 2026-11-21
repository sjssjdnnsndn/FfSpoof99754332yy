FROM node:24-alpine

RUN corepack enable && corepack prepare pnpm@10.2.1 --activate

WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY tsconfig.base.json tsconfig.json ./
COPY lib ./lib
COPY artifacts ./artifacts
COPY scripts ./scripts

RUN pnpm install --frozen-lockfile || pnpm install
RUN pnpm --filter @workspace/api-server run build

ENV NODE_ENV=production
ENV PORT=5000
EXPOSE 5000

CMD ["node", "--enable-source-maps", "/home/user/persistent_dist/index.mjs"]
