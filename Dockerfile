# syntax=docker/dockerfile:1
# cmd-usage-kb —— 单容器：后端 Koa 同端口托管 /api 与构建好的前端静态文件
# 布局：/app/backend/src + /app/backend/node_modules + /app/frontend/dist
#       后端 index.js 计算 distDir = /app/frontend/dist，dataDir = /app/backend/data

############ Stage 1: 构建前端 ############
FROM node:20-bookworm-slim AS frontend
WORKDIR /app
# 国内网络加速 npm
RUN npm config set registry https://registry.npmmirror.com
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm ci
COPY frontend/ ./frontend/
RUN cd frontend && npm run build

############ Stage 2: 后端依赖（编译 better-sqlite3 原生模块） ############
FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN npm config set registry https://registry.npmmirror.com \
 && apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci && npm prune --omit=dev

############ Stage 3: 运行时 ############
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    BACKEND_PORT=3000
COPY backend/package.json ./backend/
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY backend/src ./backend/src
COPY --from=frontend /app/frontend/dist ./frontend/dist
WORKDIR /app/backend
EXPOSE 3000
CMD ["node", "src/index.js"]
