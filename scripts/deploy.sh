#!/usr/bin/env bash
# Construit l'app et publie dist/ sur la branche gh-pages (GitHub Pages « Deploy from a branch »).
# Déploiement cumulatif : les fichiers des versions précédentes (assets/ hachés) restent en ligne,
# pour qu'une page encore en cache (CDN, navigateur) ne pointe jamais vers un fichier supprimé.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$(pwd)
URL=$(git config --get remote.origin.url)
REPO_NAME=$(basename -s .git "$URL")
BASE_PATH="/${REPO_NAME}/" npm run build
cp dist/index.html dist/404.html
touch dist/.nojekyll
TMP=$(mktemp -d)
if git ls-remote --exit-code --heads "$URL" gh-pages >/dev/null 2>&1; then
  git clone -q --depth 1 --branch gh-pages --single-branch "$URL" "$TMP"
else
  git -C "$TMP" init -q -b gh-pages
fi
# Copie par-dessus l'existant, sans rien supprimer.
cp -R dist/. "$TMP"
cd "$TMP"
git add -A
git -c user.name="$(git -C "$ROOT" config user.name)" -c user.email="$(git -C "$ROOT" config user.email)" commit -q -m "Déploiement $(date -u +%Y-%m-%dT%H:%MZ)" || { echo "Rien de nouveau à publier."; exit 0; }
git push -q "$URL" gh-pages
cd "$ROOT"
rm -rf "$TMP"
echo "Publié sur la branche gh-pages."
