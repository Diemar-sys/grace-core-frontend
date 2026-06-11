# Build multi-stage del frontend React de Panaderías Grace.
# Stage 1: compila el bundle Vite. Stage 2: nginx sirve dist + proxy al backend ERPNext.

# ── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10 --activate

# Cache de deps: solo manifiestos primero
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Resto del código (.env con VITE_* se hornea en el bundle)
COPY . .
RUN pnpm build

# ── Stage 2: serve ──────────────────────────────────────────────────────────
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
