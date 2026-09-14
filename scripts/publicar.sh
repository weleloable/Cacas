#!/usr/bin/env bash
# Publica el build web en la rama gh-pages, que es lo que sirve
# https://weleloable.github.io/Gotita/
#
# Uso, desde la raíz del repo:   npm run publicar
#
# Se hace con un worktree temporal en vez de cambiando de rama, porque cambiar
# de rama mueve los ficheros del directorio en el que estás trabajando.
set -euo pipefail

cd "$(dirname "$0")/.."
APP=$(pwd)
RAIZ=$(git rev-parse --show-toplevel)
DIST="$APP/dist"
TEMPORAL="$RAIZ/.gh-pages-tmp"

if [ ! -f "$DIST/index.html" ] || [ ! -f "$DIST/manifest.json" ]; then
  echo "No hay build listo. Ejecuta antes: npm run build:web"
  exit 1
fi

git -C "$RAIZ" fetch -q origin

limpiar() {
  git -C "$RAIZ" worktree remove --force "$TEMPORAL" 2>/dev/null || true
}
trap limpiar EXIT

rm -rf "$TEMPORAL"
if git -C "$RAIZ" rev-parse -q --verify origin/gh-pages >/dev/null; then
  git -C "$RAIZ" worktree add -q --detach "$TEMPORAL" origin/gh-pages
  git -C "$TEMPORAL" switch -qC gh-pages
else
  git -C "$RAIZ" worktree add -q --detach "$TEMPORAL"
  git -C "$TEMPORAL" checkout -q --orphan gh-pages
fi

# Borra lo anterior menos .git, para que un fichero que ya no existe en dist
# tampoco siga vivo en el sitio publicado.
find "$TEMPORAL" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -R "$DIST"/. "$TEMPORAL"/

git -C "$TEMPORAL" add -A
if git -C "$TEMPORAL" diff --cached --quiet; then
  echo "El sitio ya está al día, nada que publicar."
  exit 0
fi

git -C "$TEMPORAL" commit -qm "Publicar Gotita ($(git -C "$RAIZ" rev-parse --short HEAD))"
git -C "$TEMPORAL" push -q origin gh-pages
echo "Publicado en https://weleloable.github.io/Gotita/ (tarda un minuto en refrescarse)"
