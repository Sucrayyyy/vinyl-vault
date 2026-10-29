#!/usr/bin/env bash
# Construit l'app et publie dist/ sur la branche gh-pages (GitHub Pages « Deploy from a branch »).
set -euo pipefail
cd "$(dirname "$0")/.."
REPO_NAME=$(basename -s .git "$(git config --get remote.origin.url)")
BASE_PATH="/${REPO_NAME}/" npm run build
cp dist/index.html dist/404.html
touch dist/.nojekyll
TMP=$(mktemp -d)
cp -R dist/. "$TMP"
cd "$TMP"
git init -q -b gh-pages
git add -A
git -c user.name="$(git -C "$OLDPWD" config user.name)" -c user.email="$(git -C "$OLDPWD" config user.email)" commit -q -m "Déploiement $(date -u +%Y-%m-%dT%H:%MZ)"
git push -q -f "$(git -C "$OLDPWD" config --get remote.origin.url)" gh-pages
rm -rf "$TMP"
echo "Publié sur la branche gh-pages."
