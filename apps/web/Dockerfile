# ---- 构建阶段：安装依赖并构建前端 ----
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

# 先复制依赖清单，利用层缓存
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/config/package.json ./packages/config/
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile

# 复制源码并构建
COPY packages ./packages
COPY apps/web ./apps/web
RUN pnpm --filter shared build && pnpm --filter web build

# ---- 运行阶段：Nginx 托管静态产物 ----
FROM nginx:1.27-alpine
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
# 使用根目录共享的 nginx.conf（/api 代理 + SPA fallback）
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
