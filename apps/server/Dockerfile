FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/config/package.json ./packages/config/
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json ./apps/server/
RUN pnpm install --frozen-lockfile --prod
COPY packages ./packages
COPY apps/server/dist ./apps/server/dist
COPY apps/server/prisma ./apps/server/prisma
RUN cd /app && node node_modules/.pnpm/prisma@*/node_modules/prisma/build/index.js generate --schema=apps/server/prisma/schema.prisma
EXPOSE 3001
CMD ["node", "apps/server/dist/main"]
