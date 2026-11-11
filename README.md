# Catalogue de disques

Application web installable (PWA) pour inventorier une collection d'environ 200 vinyles
hérités en vue de leur revente. Elle est pensée pour une utilisatrice non technicienne
sur iPhone. L'interface est entièrement en français, avec de grandes zones tactiles et
rien à configurer avant d'ajouter un premier disque.

Production : <https://catalogue-disques.vercel.app>

## Fonctionnalités

- **Ajout d'un disque** de trois façons : scan du code-barres, recherche Discogs ou saisie
  manuelle. Après le choix du pressage, il ne reste à saisir que l'état du disque, l'état
  de la pochette et la quantité.
- **Choix du pressage** : chaque candidat affiche son pays, son année, son label, sa
  pochette et son n° de catalogue mis en évidence. Ce numéro, imprimé sur le disque,
  permet de confirmer le bon pressage.
- **Valeur estimée en CAD** tirée du marché Discogs, rafraîchissable disque par disque
  ou en lot depuis les Réglages. Une valeur saisie à la main n'est jamais écrasée.
- **Liste** avec recherche instantanée, tri par artiste, année ou valeur, et valeur
  totale de la collection.
- **Avertissement de doublon** quand on ajoute un pressage déjà présent.
- **Sauvegarde** de la collection en JSON via la feuille de partage d'iOS (vers Fichiers
  ou iCloud Drive), et restauration. Un bandeau rappelle les modifications non
  sauvegardées.
- **Exports** : tableur CSV pour Excel, et texte d'annonce à copier depuis chaque fiche.
- **Fonctionne hors ligne**, scan compris. Seuls les appels à Discogs exigent le réseau.

## Pourquoi une PWA

Trois contraintes ont fixé l'architecture :

1. aucun frais récurrent (pas d'Apple Developer Program à 99 USD par an) ;
2. une installation permanente, sans entretien ni expiration ;
3. un développement depuis Windows, sans Mac ni Xcode.

Swift, Flutter, React Native avec Expo et le sideload par Apple ID gratuit ont été évalués
puis écartés. Les raisons sont détaillées dans le
[document de conception](docs/superpowers/specs/2026-08-18-catalogue-disques-design.md).

Le prix à payer : le stockage d'une web app n'est pas inclus dans la sauvegarde iCloud de
l'iPhone. D'où la sauvegarde manuelle, et la demande de stockage persistant
(`navigator.storage.persist()`) qui évite qu'iOS efface la collection.

## Stack

Vite, React 19, TypeScript, React Router 7, Tailwind CSS 4, Dexie (IndexedDB),
vite-plugin-pwa (Workbox), zxing-wasm pour le scan, Vitest pour les tests.

Il n'y a ni backend, ni base de données serveur, ni compte utilisateur. Les données
restent dans le navigateur de l'appareil. L'API Discogs accepte les appels directs depuis
le navigateur (CORS ouvert) : aucun proxy n'est nécessaire.

## Développement

Prérequis : Node 22.

```bash
npm install
npm run dev          # serveur de développement
npm test             # tests unitaires (Vitest)
npm run test:watch   # tests en continu
npm run lint         # Oxlint
npm run build        # vérification des types puis build de production dans dist/
npm run preview      # sert le build de production en local
```

Le service worker n'est actif que dans le build de production. Pour tester le hors-ligne
ou l'installation, passer par `npm run build && npm run preview`.

Pour tester sur un iPhone pendant le développement, le serveur doit être joignable depuis
le réseau local (`npm run dev -- --host`). La caméra exige toutefois HTTPS : le scan ne
se teste donc vraiment que sur la version déployée.

### Tests

Les tests unitaires couvrent la logique (`src/lib/`, `src/db/`, `src/discogs/`,
`src/scan/`), avec `fake-indexeddb` à la place d'IndexedDB. Les écrans n'ont pas de tests
unitaires. Un script Playwright les vérifie de bout en bout sur un viewport d'iPhone :

```bash
pip install playwright && python -m playwright install chromium
npm run dev
python scripts/verifier-app.py
# ou contre la production :
BASE_URL=https://catalogue-disques.vercel.app python scripts/verifier-app.py
```

### Icônes

Les icônes de `public/` sont générées à partir de `scripts/icone.svg` :

```bash
node scripts/generer-icones.mjs
```

## Discogs

L'application fonctionne **sans jeton** Discogs. Un jeton personnel, saisi dans les
Réglages et stocké dans le `localStorage` de l'appareil, apporte deux choses : les
vignettes de pochette, et une cadence plus rapide (60 requêtes par minute au lieu de 25).
Il ne change rien à l'exactitude des données.

Le jeton ne doit jamais être commité. Le fichier `.discogs-token` à la racine est ignoré
par git.

La valeur estimée vient de `/marketplace/stats/{id}?curr_abbr=CAD`, et non du
`lowest_price` de `/releases/{id}` : ce dernier ignore le paramètre de devise et
renverrait une valeur en USD étiquetée CAD. Le code refuse d'enregistrer une valeur dont
la devise retournée n'est pas `CAD`.

## Déploiement

Le site est hébergé sur Vercel en statique et se déploie avec la CLI Vercel :

```bash
npm install -g vercel   # une seule fois, puis : vercel login
vercel --prod
```

`vercel.json` renvoie toutes les adresses vers `index.html` pour le routage côté client,
sauf `diagnostic.html`.

`/diagnostic.html` est une page autonome qui vérifie sur l'appareil réel ce dont l'app a
besoin : mode d'affichage installé, IndexedDB, caméra, partage de fichier et stockage
protégé. C'est la première chose à ouvrir si quelque chose ne fonctionne pas sur l'iPhone.

Le service worker se met à jour de lui-même : l'utilisatrice n'a jamais à réinstaller
l'app pour recevoir un correctif.

### Installer l'app sur l'iPhone

1. Ouvrir le site dans **Safari**.
2. Toucher le bouton Partager, puis **Sur l'écran d'accueil**.
3. Lancer l'app depuis l'icône **Disques**. Elle s'ouvre alors en plein écran.

## Organisation du code

```
src/
  ecrans/      un composant par écran (liste, fiche, formulaire, recherche, scan,
               réglages, sauvegarde)
  composants/  éléments réutilisés (carte de disque, carte de pressage, pochette…)
  db/          schéma Dexie et accès aux disques
  discogs/     client HTTP, appels à l'API, conversion vers le modèle, rafraîchissement
  scan/        lecture caméra et variantes d'un code-barres
  lib/         logique sans interface : CSV, sauvegarde, doublons, file d'attente,
               recherche, stockage persistant
docs/superpowers/
  specs/       document de conception
  plans/       plans d'implémentation, phase par phase
scripts/       génération des icônes, vérification de bout en bout
```
