# Vinyl Vault

Application web installable (PWA) pour collectionneurs de vinyles : scan de pochettes, gestion de collection, valorisation honnête, découvertes, sorties à venir et alertes. Pensée pour l'iPhone, en mode écran d'accueil.

![Icône](public/icon-192.png)

## Fonctionnalités

| Onglet | Ce qui marche |
| --- | --- |
| **Collection** | Grille et liste de pochettes, recherche plein texte, filtres (genre, décennie, état, pressage, favoris, couleur), tri, fiche détaillée avec transition partagée, modification, suppression avec annulation, notes et rangement. |
| **Ajout / scan** | Photo de la pochette (appareil photo ou photothèque) → lecture du code-barres éventuel → reconnaissance (Claude Vision avec votre clé, sinon OCR embarqué) → éditions vinyle Discogs → confirmation (état, prix d'achat, photo) → ajout. Code-barres en direct, saisie manuelle et recherche manuelle en secours. |
| **Valorisation** | Valeur de la collection, prix d'achat total, plus-value, courbe par période reconstruite **uniquement** à partir d'observations datées, variation à périmètre constant, historique par disque, liens vers annonces et ventes comparables (Discogs, eBay, Leboncoin). |
| **Découvrir** | Recommandations par style, albums manquants d'artistes possédés, éditions alternatives, pressages rares (ratio recherché/possédé), bonnes affaires de la wishlist, tendances de vos disques. Prix Discogs à la demande avec lien vers la source. |
| **Sorties** | Fil MusicBrainz des sorties vinyles datées (artistes/labels suivis ou genres), rééditions identifiées, suivi d'album, rappel calendrier (.ics), wishlist (prix cible, date, statut, liens d'achat), centre d'alertes. |
| **Profil** | Goûts (genres, artistes, labels suivis), statistiques, notifications, confidentialité, connecteurs, sauvegarde/import, compte et synchronisation (Supabase, optionnel), préférences d'animation. |

## Honnêteté des données

- **Prix affiché ≠ prix de vente.** Chaque observation est typée : vente réelle, annonce, prix affiché le plus bas, suggestion par état, estimation personnelle.
- Estimation : médiane des ventes réelles sur 12 mois (même état si possible) › suggestion Discogs par état › estimation personnelle › prix affiché le plus bas (*indicatif*). Sinon : « Indisponible ».
- Les courbes relient des observations réelles, sans lissage ni extrapolation.
- La collection de démonstration (premier lancement) est **fictive** et signalée partout ; un bouton l'efface.
- Précommandes et restocks n'ont pas de source publique : ils sont présentés en mode démo explicitement identifié.

## Sources et connecteurs

| Source | Usage | Accès |
| --- | --- | --- |
| Discogs API | éditions, références, codes-barres, versions, prix affiché le plus bas, suggestions par état | sans clé (25 req/min) ; jeton personnel optionnel saisi dans l'app |
| MusicBrainz | sorties datées, rééditions | sans clé (1 req/s) |
| iTunes Search | pochettes haute définition | sans clé |
| Cover Art Archive | pochettes des sorties | sans clé |
| Claude (Anthropic) | reconnaissance visuelle des pochettes | **clé de l'utilisateur**, stockée sur l'appareil uniquement |
| eBay | ventes terminées / annonces | liens ; l'API nécessite un backend et un accès partenaire (Marketplace Insights) |
| Leboncoin | annonces | liens uniquement (pas d'API publique) |

Aucune clé secrète n'est dans le code ni dans le dépôt. Les clés saisies dans **Profil › Connecteurs** restent dans le stockage local de l'appareil et sont exclues des exports.

## Architecture

```
src/
  lib/          modèle de données, store (zustand), persistance IndexedDB, valorisation, utilitaires
  services/     connecteurs : discogs, musicbrainz, itunes, market (registre des sources), alerts, sync (Supabase)
    recognition/  vision (Claude), ocr (Tesseract.js, WASM), barcode (BarcodeDetector + polyfill ZXing)
  components/   design system : icônes vectorielles, pochettes, feuilles, graphiques, barre d'onglets, logo
  screens/      collection, discover, releases, profile
  styles/       tokens, base, composants, écrans
```

- **Stack** : React 19, TypeScript, Vite, Motion (Framer Motion), zustand, idb-keyval, vite-plugin-pwa (Workbox).
- **Persistance** : IndexedDB (état JSON + photos en Blob), écritures groupées, `navigator.storage.persist()`.
- **Hors ligne** : l'app et les pochettes déjà vues sont mises en cache par le service worker.
- **Performances** : `content-visibility` sur la grille, animations de mise en page désactivées au-delà de 150 disques, modules lourds (vision, OCR, code-barres) chargés à la demande.
- **Accessibilité du mouvement** : respect de `prefers-reduced-motion`, réglage manuel dans le profil.

## Développement

```bash
npm install
npm run dev        # http://localhost:5173 (accessible depuis l'iPhone sur le même Wi-Fi via l'adresse réseau affichée)
npm run build      # vérification TypeScript + build de production
npm run icons      # régénère les icônes PNG depuis public/favicon.svg
```

La caméra en direct nécessite HTTPS (ou `localhost`) : testez le scan sur l'URL GitHub Pages.

## Déploiement

L'app est servie par GitHub Pages depuis la branche `gh-pages` : `https://<utilisateur>.github.io/vinyl-vault/`.

```bash
npm run deploy     # build avec le bon chemin de base + publication sur gh-pages
```

**Déploiement automatique (optionnel)** : le workflow prêt à l'emploi est dans [docs/github-pages-workflow.yml](docs/github-pages-workflow.yml). Pour l'activer :

```bash
gh auth refresh -h github.com -s workflow
mkdir -p .github/workflows && git mv docs/github-pages-workflow.yml .github/workflows/deploy.yml
git commit -m "Déploiement automatique" && git push
```

puis, dans **Settings › Pages**, choisir la source **GitHub Actions**.

## Installer sur l'iPhone

1. Ouvrir l'URL publique dans **Safari**.
2. Bouton **Partager** → **Sur l'écran d'accueil** → **Ajouter**.
3. Lancer Vinyl Vault depuis son icône (plein écran, hors ligne, notifications possibles depuis iOS 16.4).

## Synchronisation (optionnelle)

Voir [docs/SUPABASE.md](docs/SUPABASE.md).
