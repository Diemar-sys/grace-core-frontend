# Build multi-stage del frontend React de Panaderías Grace.
# Stage 1: compila el bundle Vite. Stage 2: nginx sirve dist + proxy al backend ERPNext.

# ── Stage 1: build ──────────────────────────────────────────────────────────
# node 22 LTS: pnpm 11 (el del packageManager) truena en node 20
FROM node:22-alpine AS build
WORKDIR /app
# corepack lee el campo packageManager de package.json — no clavar la versión
# aquí o divergen (ya pasó: pnpm@10 clavado vs packageManager 11).
RUN corepack enable

# Cache de deps: solo manifiestos primero. pnpm-workspace.yaml VA: ahí viven
# los overrides (axios, socket.io) que el lockfile ya tiene resueltos — sin él
# --frozen-lockfile no cuadra y el build truena.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Resto del código (.env con VITE_* se hornea en el bundle)
COPY . .
RUN pnpm build

# ── Stage 2: serve ──────────────────────────────────────────────────────────
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
