#!/bin/sh -e
# preflight.sh — compila LO QUE ESTÁ EN GIT, no lo que está en disco.
#
# La clase de bug que mata: un archivo nuevo sin `git add` compila local
# (está en el working dir) pero HEAD queda roto en origin, y `typecheck`
# no lo atrapa (incidente hora.ts, 2026-08-05). `docker build` copia el
# working dir, así que tampoco lo ve. Este script extrae HEAD limpio a un
# tmp y corre ahí typecheck + tests + build.
#
# Correr ANTES de cada push de deploy:  bash preflight.sh

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

git archive HEAD | tar -x -C "$tmp"
# .env no está en git (correcto) pero el build lo necesita
[ -f .env ] && cp .env "$tmp/"

cd "$tmp"
pnpm install --frozen-lockfile --prefer-offline
pnpm typecheck
# 🔴 lint NO es cosmético aquí: tsconfig tiene checkJs:false, así que `tsc` NO
# revisa los .jsx. El 27-ago un refactor dejó `LIMITE_COSTEO_PAN` usado pero sin
# declarar y la pantalla de Catálogo murió EN PRODUCCIÓN. typecheck, tests y build
# pasaron los tres; eslint lo cachaba con no-undef y nadie lo corría.
pnpm lint
pnpm test
pnpm build

echo ""
echo "✅ OK: HEAD compila desde checkout limpio — seguro para push/deploy"
