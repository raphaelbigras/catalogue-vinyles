# Catalogue de disques

[English](#english) · [Français](#français)

## English

An installable web app (PWA) for cataloguing about 200 inherited vinyl records ahead of
selling them. It is designed for a non-technical user on an iPhone. The interface is
entirely in French, with large touch targets and nothing to configure before adding the
first record.

Production: <https://catalogue-disques.vercel.app>

### Features

- **Add a record** in three ways: barcode scan, Discogs search or manual entry. Once the
  pressing is chosen, only the record's condition, the sleeve's condition and the
  quantity are left to enter.
- **Pressing selection**: each candidate shows its country, year, label, cover and its
  catalogue number, highlighted. That number is printed on the record and confirms the
  right pressing.
- **Estimated value in CAD** taken from the Discogs marketplace, refreshable one record
  at a time or in bulk from the Settings. A value entered by hand is never overwritten.
- **List** with instant search, sorting by artist, year or value, and the total value of
  the collection.
- **Duplicate warning** when adding a pressing that is already in the collection.
- **Backup** of the collection as JSON through the iOS share sheet (to Files or iCloud
  Drive), and restore. A banner reminds the user of unsaved changes.
- **Exports**: a CSV spreadsheet for Excel, and listing text to copy from each record.
- **Works offline**, scanning included. Only the Discogs calls need the network.

### Why a PWA

Three constraints set the architecture:

1. no recurring cost (no Apple Developer Program at 99 USD per year);
2. a permanent install, with no upkeep and nothing that expires;
3. development from Windows, with no Mac and no Xcode.

Swift, Flutter, React Native with Expo and free Apple ID sideloading were all evaluated
and ruled out. The reasons are in the
[design document](docs/superpowers/specs/2026-08-18-catalogue-disques-design.md)
(in French).

The trade-off: a web app's storage is not included in the iPhone's iCloud backup. Hence
the manual backup, and the request for persistent storage
(`navigator.storage.persist()`) that keeps iOS from wiping the collection.

### Stack

Vite, React 19, TypeScript, React Router 7, Tailwind CSS 4, Dexie (IndexedDB),
vite-plugin-pwa (Workbox), zxing-wasm for scanning, Vitest for tests.

There is no backend, no server database and no user account. The data stays in the
device's browser. The Discogs API accepts direct calls from the browser (open CORS), so
no proxy is needed.

### Development

Requirement: Node 22.

```bash
npm install
npm run dev          # development server
npm test             # unit tests (Vitest)
npm run test:watch   # tests in watch mode
npm run lint         # Oxlint
npm run build        # type check, then production build into dist/
npm run preview      # serve the production build locally
```

The service worker is only active in the production build. To test offline mode or
installation, use `npm run build && npm run preview`.

To test on an iPhone during development, the server must be reachable from the local
network (`npm run dev -- --host`). The camera requires HTTPS, though, so scanning can
only really be tested on the deployed version.

#### Tests

Unit tests cover the logic (`src/lib/`, `src/db/`, `src/discogs/`, `src/scan/`), with
`fake-indexeddb` standing in for IndexedDB. The screens have no unit tests. A Playwright
script checks them end to end on an iPhone viewport:

```bash
pip install playwright && python -m playwright install chromium
npm run dev
python scripts/verifier-app.py
# or against production:
BASE_URL=https://catalogue-disques.vercel.app python scripts/verifier-app.py
```

#### Icons

The icons in `public/` are generated from `scripts/icone.svg`:

```bash
node scripts/generer-icones.mjs
```

### Discogs

The app works **without a Discogs token**. A personal token, entered in the Settings and
stored in the device's `localStorage`, adds two things: cover thumbnails, and a faster
request rate (60 requests per minute instead of 25). It does not change the accuracy of
the data.

The token must never be committed. The `.discogs-token` file at the root is ignored by
git.

The estimated value comes from `/marketplace/stats/{id}?curr_abbr=CAD`, not from the
`lowest_price` of `/releases/{id}`: the latter ignores the currency parameter and would
return a USD value labelled as CAD. The code refuses to store a value whose returned
currency is not `CAD`.

### Deployment

The site is hosted on Vercel as a static site and deployed with the Vercel CLI:

```bash
npm install -g vercel   # once, then: vercel login
vercel --prod
```

`vercel.json` rewrites every path to `index.html` for client-side routing, except
`diagnostic.html`.

`/diagnostic.html` is a standalone page that checks, on the actual device, what the app
needs: installed display mode, IndexedDB, camera, file sharing and protected storage.
It is the first thing to open when something does not work on the iPhone.

The service worker updates itself: the user never has to reinstall the app to get a fix.

#### Installing the app on the iPhone

1. Open the site in **Safari**.
2. Tap the Share button, then **Add to Home Screen**.
3. Launch the app from the **Disques** icon. It then opens full screen.

### Code layout

```
src/
  ecrans/      one component per screen (list, record, form, search, scan,
               settings, backup)
  composants/  shared pieces (record card, pressing card, cover…)
  db/          Dexie schema and record access
  discogs/     HTTP client, API calls, mapping to the model, value refresh
  scan/        camera reading and barcode variants
  lib/         logic with no UI: CSV, backup, duplicates, request queue,
               search, persistent storage
docs/superpowers/
  specs/       design document
  plans/       implementation plans, phase by phase
scripts/       icon generation, end-to-end check
```

---

## Français

Application web installable (PWA) pour inventorier une collection d'environ 200 vinyles
hérités en vue de leur revente. Elle est pensée pour une utilisatrice non technicienne
sur iPhone. L'interface est entièrement en français, avec de grandes zones tactiles et
rien à configurer avant d'ajouter un premier disque.

Production : <https://catalogue-disques.vercel.app>

### Fonctionnalités

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

### Pourquoi une PWA

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

### Stack

Vite, React 19, TypeScript, React Router 7, Tailwind CSS 4, Dexie (IndexedDB),
vite-plugin-pwa (Workbox), zxing-wasm pour le scan, Vitest pour les tests.

Il n'y a ni backend, ni base de données serveur, ni compte utilisateur. Les données
restent dans le navigateur de l'appareil. L'API Discogs accepte les appels directs depuis
le navigateur (CORS ouvert) : aucun proxy n'est nécessaire.

### Développement

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

#### Tests

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

#### Icônes

Les icônes de `public/` sont générées à partir de `scripts/icone.svg` :

```bash
node scripts/generer-icones.mjs
```

### Discogs

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

### Déploiement

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

#### Installer l'app sur l'iPhone

1. Ouvrir le site dans **Safari**.
2. Toucher le bouton Partager, puis **Sur l'écran d'accueil**.
3. Lancer l'app depuis l'icône **Disques**. Elle s'ouvre alors en plein écran.

### Organisation du code

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
