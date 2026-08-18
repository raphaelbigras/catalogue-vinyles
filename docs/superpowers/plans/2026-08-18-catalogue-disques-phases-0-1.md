# Catalogue de disques — Plan d'implémentation, phases 0 et 1

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer une PWA installable sur l'écran d'accueil d'un iPhone, permettant de saisir manuellement des disques vinyles, de les consulter, de les rechercher et de voir la valeur totale de la collection — le tout hors-ligne et sans backend.

**Architecture :** Application React statique buildée par Vite, déployée sur Vercel. Les données vivent dans IndexedDB via Dexie, sur l'appareil uniquement. La logique métier pure (calcul de valeur, recherche, tri, normalisation des accents) est isolée dans `src/lib/` et testée par Vitest ; l'accès aux données est isolé dans `src/db/` et testé contre `fake-indexeddb`. Les composants React ne contiennent aucune logique métier et ne sont pas testés automatiquement.

**Tech Stack :** Vite 8, React 19, TypeScript 6, React Router 7, Dexie 4, vite-plugin-pwa 1, Tailwind CSS 4, Vitest 4, fake-indexeddb, sharp (génération d'icônes uniquement).

**Spec de référence :** [docs/superpowers/specs/2026-08-18-catalogue-disques-design.md](../specs/2026-08-18-catalogue-disques-design.md)

---

## Structure de fichiers

Chaque fichier a une responsabilité unique. Le découpage sépare la **logique pure** (testable sans navigateur) de l'**accès aux données** (testable avec fake-indexeddb) et de l'**affichage** (vérifié à la main).

| Fichier | Responsabilité |
|---|---|
| `src/db/schema.ts` | Types `Disque` et `Etat`, constantes des grades. Aucune logique. |
| `src/db/db.ts` | Instance Dexie et déclaration des index. Rien d'autre. |
| `src/db/disques.ts` | Opérations CRUD. Seul module autorisé à toucher `db.disques`. |
| `src/lib/valeur.ts` | Calcul de la valeur totale et formatage monétaire CAD. |
| `src/lib/recherche.ts` | Normalisation des accents, filtrage, tri. Fonctions pures. |
| `src/composants/ChampEtat.tsx` | Sélecteur de grade réutilisé pour disque et pochette. |
| `src/composants/CarteDisque.tsx` | Une ligne de la liste. |
| `src/ecrans/ListeEcran.tsx` | Écran principal : recherche, tri, total. |
| `src/ecrans/FormulaireEcran.tsx` | Création et édition, même formulaire pour les deux. |
| `src/ecrans/FicheEcran.tsx` | Consultation d'un disque et suppression. |
| `src/App.tsx` | Routage uniquement. |
| `public/diagnostic.html` | Page de test de la phase 0, autonome, sans dépendance au build. |
| `scripts/generer-icones.mjs` | Génère les PNG de l'app à partir d'un SVG. Exécuté à la main. |

---

# Phase 0 — Valider les risques avant de construire

## Task 1: Échafaudage du projet

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx` (générés par Vite)
- Create: `.gitattributes`
- Create: `.gitignore` (généré par Vite)

- [ ] **Step 1: Vérifier la version de Node**

Vite 8 exige Node 20.19+ ou 22.12+.

Run: `node --version`
Expected: `v20.19.0` ou plus, ou `v22.12.0` ou plus. Si la version est inférieure, installer Node 22 LTS depuis https://nodejs.org avant de continuer.

- [ ] **Step 2: Générer le projet Vite dans le répertoire courant**

Le `.` cible le répertoire courant, qui contient déjà `.git`, `CLAUDE.md` et `docs/`. Vite accepte un répertoire non vide et ne supprime rien.

```bash
npm create vite@latest . -- --template react-ts
```

Répondre « Ignore files and continue » si l'outil signale que le répertoire n'est pas vide.

- [ ] **Step 3: Installer les dépendances et vérifier que ça démarre**

```bash
npm install
npm run dev
```

Expected: Vite affiche `Local: http://localhost:5173/`. Ouvrir l'URL, voir la page d'accueil React par défaut. Arrêter avec `Ctrl+C`.

- [ ] **Step 4: Ajouter `.gitattributes`**

Sous Windows, Git convertit les fins de ligne et pollue les diffs. Ce fichier normalise le dépôt.

```
* text=auto eol=lf
*.png binary
*.jpg binary
*.ico binary
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: echafauder le projet Vite + React + TypeScript"
```

---

## Task 2: Outillage — Tailwind, Vitest, fake-indexeddb

**Files:**
- Modify: `vite.config.ts`
- Modify: `src/index.css`
- Create: `src/test-setup.ts`
- Create: `src/lib/sanite.test.ts` (supprimé à la fin de la tâche)
- Modify: `package.json`

- [ ] **Step 1: Installer les paquets**

```bash
npm install dexie dexie-react-hooks react-router
npm install -D tailwindcss @tailwindcss/vite vitest fake-indexeddb sharp
```

- [ ] **Step 2: Brancher Tailwind et Vitest dans `vite.config.ts`**

Tailwind 4 n'utilise plus de fichier `tailwind.config.js` ni de directives PostCSS : tout passe par le plugin Vite et un unique `@import` CSS.

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
    setupFiles: ['./src/test-setup.ts'],
  },
});
```

- [ ] **Step 3: Remplacer entièrement le contenu de `src/index.css`**

```css
@import "tailwindcss";
```

- [ ] **Step 4: Créer `src/test-setup.ts`**

`fake-indexeddb/auto` installe une implémentation d'IndexedDB dans les globales de Node, ce qui permet de tester Dexie sans navigateur.

```ts
import 'fake-indexeddb/auto';
```

- [ ] **Step 5: Ajouter le script de test dans `package.json`**

Ajouter dans la section `"scripts"` :

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: Écrire un test de sanité temporaire**

Create `src/lib/sanite.test.ts` :

```ts
import { expect, test } from 'vitest';

test('vitest est branché et fake-indexeddb est chargé', () => {
  expect(typeof indexedDB).toBe('object');
});
```

- [ ] **Step 7: Lancer les tests**

Run: `npm test`
Expected: PASS, `1 passed`. Si `indexedDB` est `undefined`, le `setupFiles` n'est pas pris en compte — revérifier le chemin dans `vite.config.ts`.

- [ ] **Step 8: Supprimer le test de sanité et commiter**

```bash
rm src/lib/sanite.test.ts
git add -A
git commit -m "chore: configurer Tailwind 4, Vitest et fake-indexeddb"
```

---

## Task 3: Page de diagnostic et déploiement initial

Cette tâche existe pour trancher le seul risque technique non vérifié du projet : l'accès caméra dans une web app iOS installée sur l'écran d'accueil. Elle se termine par une vérification **manuelle sur l'iPhone de l'utilisatrice finale**.

**Files:**
- Create: `public/diagnostic.html`

- [ ] **Step 1: Créer `public/diagnostic.html`**

Fichier autonome, sans dépendance au build React, pour que le diagnostic reste valable même si l'app casse. Les verdicts sont écrits avec `textContent` et non `innerHTML` : les messages d'erreur viennent du navigateur et ne doivent jamais être interprétés comme du HTML.

```html
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="mobile-web-app-capable" content="yes">
  <title>Diagnostic</title>
  <style>
    body { font-family: -apple-system, system-ui, sans-serif; margin: 0; padding: 1rem;
           background: #1c1917; color: #fafaf9; }
    .test { border: 1px solid #44403c; border-radius: .5rem; padding: .75rem; margin-bottom: .75rem; }
    .ok { color: #4ade80; } .ko { color: #f87171; }
    h2 { font-size: 1rem; margin: 0 0 .5rem; }
    video { width: 100%; border-radius: .5rem; background: #000; }
    button { font-size: 1rem; padding: .75rem 1rem; border-radius: .5rem;
             border: 0; background: #f59e0b; color: #1c1917; font-weight: 600; }
  </style>
</head>
<body>
  <h1>Diagnostic</h1>

  <div class="test">
    <h2>1. Mode d'affichage</h2>
    <p id="mode">…</p>
  </div>

  <div class="test">
    <h2>2. Stockage IndexedDB</h2>
    <p id="stockage">…</p>
  </div>

  <div class="test">
    <h2>3. Caméra</h2>
    <button id="btn-camera">Activer la caméra</button>
    <p id="camera">…</p>
    <video id="apercu" playsinline autoplay muted></video>
  </div>

  <div class="test">
    <h2>4. Partage de fichier</h2>
    <button id="btn-partage">Tester l'enregistrement d'un fichier</button>
    <p id="partage">…</p>
  </div>

<script>
/** Écrit un verdict sans jamais interpréter le texte comme du HTML. */
function verdict(id, reussi, texte) {
  const element = document.getElementById(id);
  element.textContent = texte;
  element.className = reussi ? 'ok' : 'ko';
}

// 1. Mode d'affichage : « standalone » confirme que l'ajout à l'écran d'accueil masque Safari.
const installe = window.matchMedia('(display-mode: standalone)').matches
              || window.navigator.standalone === true;
verdict('mode', installe,
  installe
    ? 'standalone — installée sur l\'écran d\'accueil'
    : 'ouverte dans Safari — ajoutez la page à l\'écran d\'accueil puis rouvrez-la');

// 2. Stockage : écrire puis relire une valeur prouve que la persistance fonctionne.
const req = indexedDB.open('diagnostic', 1);
req.onupgradeneeded = () => req.result.createObjectStore('t');
req.onsuccess = () => {
  const bd = req.result;
  const ecriture = bd.transaction('t', 'readwrite');
  ecriture.objectStore('t').put(Date.now(), 'dernier-passage');
  ecriture.oncomplete = () => {
    const lecture = bd.transaction('t').objectStore('t').get('dernier-passage');
    lecture.onsuccess = () => {
      verdict('stockage', true,
        'écriture et lecture réussies (' + new Date(lecture.result).toLocaleString('fr-CA') + ')');
    };
  };
};
req.onerror = () => verdict('stockage', false, 'IndexedDB inaccessible');

// 3. Caméra : getUserMedia exige un geste utilisateur et HTTPS.
document.getElementById('btn-camera').onclick = async () => {
  try {
    const flux = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    document.getElementById('apercu').srcObject = flux;
    verdict('camera', true, 'caméra arrière accessible — le scan de codes-barres est viable');
  } catch (e) {
    verdict('camera', false, 'échec : ' + e.name + ' — ' + e.message);
  }
};

// 4. Partage : chemin utilisé plus tard pour enregistrer les sauvegardes dans Fichiers.
document.getElementById('btn-partage').onclick = async () => {
  const fichier = new File(['test'], 'test.json', { type: 'application/json' });
  if (!navigator.canShare || !navigator.canShare({ files: [fichier] })) {
    verdict('partage', false, 'partage de fichiers non supporté');
    return;
  }
  try {
    await navigator.share({ files: [fichier], title: 'Test' });
    verdict('partage', true, 'feuille de partage ouverte — la sauvegarde vers Fichiers est viable');
  } catch (e) {
    e.name === 'AbortError'
      ? verdict('partage', true, 'partage annulé par l\'utilisateur — le mécanisme fonctionne')
      : verdict('partage', false, 'échec : ' + e.name);
  }
};
</script>
</body>
</html>
```

- [ ] **Step 2: Builder et vérifier localement**

```bash
npm run build
npm run preview
```

Expected: `npm run build` termine sans erreur. Ouvrir `http://localhost:4173/diagnostic.html` — les tests 1 et 2 doivent s'afficher. Le test caméra échouera peut-être en local : `getUserMedia` exige HTTPS, sauf sur `localhost`.

- [ ] **Step 3: Déployer sur Vercel**

```bash
npm install -g vercel
vercel login
vercel --prod
```

À la question du framework, accepter la détection automatique (Vite). Répertoire de sortie : `dist`.

Expected: Vercel affiche une URL en `https://….vercel.app`.

- [ ] **Step 4: Vérification manuelle sur l'iPhone de l'utilisatrice finale**

⚠️ **Cette étape doit se faire sur son appareil à elle, pas sur un autre iPhone.** Les versions d'iOS et les réglages de confidentialité varient.

1. Lui envoyer `https://<url-vercel>/diagnostic.html`
2. Ouvrir dans Safari → bouton Partager → « Sur l'écran d'accueil »
3. Ouvrir depuis l'icône créée
4. Noter les 4 résultats

Résultats attendus et conséquences :

| Test | Attendu | Si ça échoue |
|---|---|---|
| 1. Mode | standalone | Bloquant : revoir le manifeste et les métas |
| 2. Stockage | écriture et lecture réussies | **Bloquant** : le projet entier repose là-dessus |
| 3. Caméra | caméra arrière accessible | Non bloquant : la phase 4 (scan) devient optionnelle, la recherche texte reste le mode principal |
| 4. Partage | feuille de partage ouverte | Non bloquant : la phase 3 utilisera un téléchargement classique à la place |

- [ ] **Step 5: Consigner les résultats et commiter**

Ajouter ce bloc en fin de fichier spec, complété avec ce qui a réellement été observé :

```markdown
## Résultats du diagnostic (phase 0)

Testé le <date> sur <modèle d'iPhone>, iOS <version>.

| Test | Résultat | Note |
|---|---|---|
| Mode d'affichage | <standalone / Safari> | |
| Stockage IndexedDB | <réussi / échec> | |
| Caméra arrière | <accessible / échec + code d'erreur> | décide du sort de la phase 4 |
| Partage de fichier | <réussi / non supporté> | décide de la forme de la sauvegarde en phase 3 |
```

```bash
git add -A
git commit -m "feat: ajouter la page de diagnostic et consigner les resultats phase 0"
```

---

# Phase 1 — Une app utilisable

## Task 4: Types et échelle de grades

**Files:**
- Create: `src/db/schema.ts`
- Test: `src/db/schema.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

Create `src/db/schema.test.ts` :

```ts
import { describe, expect, test } from 'vitest';
import { ETATS, ETATS_LIBELLES } from './schema';

describe('échelle de grades', () => {
  test('contient les 8 grades Discogs du meilleur au pire', () => {
    expect(ETATS).toEqual(['M', 'NM', 'VG+', 'VG', 'G+', 'G', 'F', 'P']);
  });

  test('chaque grade a un libellé en français', () => {
    for (const etat of ETATS) {
      expect(ETATS_LIBELLES[etat]).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npm test`
Expected: FAIL, `Failed to resolve import "./schema"`

- [ ] **Step 3: Écrire `src/db/schema.ts`**

L'ordre du tableau `ETATS` est significatif : il est repris tel quel dans les menus déroulants, du meilleur au pire.

```ts
export const ETATS = ['M', 'NM', 'VG+', 'VG', 'G+', 'G', 'F', 'P'] as const;

export type Etat = (typeof ETATS)[number];

export const ETATS_LIBELLES: Record<Etat, string> = {
  'M': 'Mint — neuf, jamais joué',
  'NM': 'Near Mint — quasi neuf',
  'VG+': 'Very Good Plus — légères marques, inaudibles',
  'VG': 'Very Good — marques audibles en fond',
  'G+': 'Good Plus — usé mais jouable en entier',
  'G': 'Good — très usé, bruit constant',
  'F': 'Fair — dommages importants, sauts possibles',
  'P': 'Poor — à peine jouable',
};

export interface Disque {
  id: number;
  artiste: string;
  album: string;
  annee: number | null;
  label: string;
  noCatalogue: string;
  pays: string;
  format: string;
  etatDisque: Etat;
  etatPochette: Etat;
  pochetteGenerique: boolean;
  quantite: number;
  valeurEstimee: number | null;
  valeurSource: 'discogs' | 'manuelle';
  valeurMaj: Date | null;
  discogsReleaseId: number | null;
  discogsNumForSale: number | null;
  notes: string;
  dateAjout: Date;
  dateModif: Date;
}

/** Ce que fournit un formulaire : les 3 champs gérés par la couche données sont exclus. */
export type NouveauDisque = Omit<Disque, 'id' | 'dateAjout' | 'dateModif'>;

/** Valeurs par défaut d'un formulaire de création. */
export const DISQUE_VIDE: NouveauDisque = {
  artiste: '',
  album: '',
  annee: null,
  label: '',
  noCatalogue: '',
  pays: '',
  format: 'LP',
  etatDisque: 'VG+',
  etatPochette: 'VG+',
  pochetteGenerique: false,
  quantite: 1,
  valeurEstimee: null,
  valeurSource: 'manuelle',
  valeurMaj: null,
  discogsReleaseId: null,
  discogsNumForSale: null,
  notes: '',
};
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `npm test`
Expected: PASS, `2 passed`

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts src/db/schema.test.ts
git commit -m "feat: definir le type Disque et l'echelle de grades a 8 niveaux"
```

---

## Task 5: Base de données et opérations CRUD

**Files:**
- Create: `src/db/db.ts`
- Create: `src/db/disques.ts`
- Test: `src/db/disques.test.ts`

- [ ] **Step 1: Écrire les tests qui échouent**

Create `src/db/disques.test.ts` :

```ts
import { beforeEach, describe, expect, test } from 'vitest';
import { db } from './db';
import { ajouterDisque, listerDisques, modifierDisque, obtenirDisque, supprimerDisque } from './disques';
import { DISQUE_VIDE } from './schema';

const HARMONIUM = { ...DISQUE_VIDE, artiste: 'Harmonium', album: 'L\'heptade' };
const BEAU_DOMMAGE = { ...DISQUE_VIDE, artiste: 'Beau Dommage', album: 'Beau Dommage' };

beforeEach(async () => {
  await db.disques.clear();
});

describe('ajouterDisque', () => {
  test('attribue un numéro d\'inventaire croissant', async () => {
    const premier = await ajouterDisque(HARMONIUM);
    const second = await ajouterDisque(BEAU_DOMMAGE);
    expect(second).toBeGreaterThan(premier);
  });

  test('horodate la création et la modification', async () => {
    const id = await ajouterDisque(HARMONIUM);
    const disque = await obtenirDisque(id);
    expect(disque?.dateAjout).toBeInstanceOf(Date);
    expect(disque?.dateModif).toBeInstanceOf(Date);
  });
});

describe('modifierDisque', () => {
  test('applique les champs fournis sans toucher aux autres', async () => {
    const id = await ajouterDisque(HARMONIUM);
    await modifierDisque(id, { etatDisque: 'NM' });
    const disque = await obtenirDisque(id);
    expect(disque?.etatDisque).toBe('NM');
    expect(disque?.artiste).toBe('Harmonium');
  });

  test('met à jour dateModif mais pas dateAjout', async () => {
    const id = await ajouterDisque(HARMONIUM);
    const avant = await obtenirDisque(id);
    await new Promise((r) => setTimeout(r, 5));
    await modifierDisque(id, { quantite: 2 });
    const apres = await obtenirDisque(id);
    expect(apres!.dateModif.getTime()).toBeGreaterThan(avant!.dateModif.getTime());
    expect(apres!.dateAjout.getTime()).toBe(avant!.dateAjout.getTime());
  });
});

describe('supprimerDisque', () => {
  test('retire le disque de la liste', async () => {
    const id = await ajouterDisque(HARMONIUM);
    await supprimerDisque(id);
    expect(await obtenirDisque(id)).toBeUndefined();
    expect(await listerDisques()).toHaveLength(0);
  });
});

describe('listerDisques', () => {
  test('retourne tous les disques enregistrés', async () => {
    await ajouterDisque(HARMONIUM);
    await ajouterDisque(BEAU_DOMMAGE);
    expect(await listerDisques()).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npm test`
Expected: FAIL, `Failed to resolve import "./db"`

- [ ] **Step 3: Écrire `src/db/db.ts`**

La chaîne passée à `stores()` ne liste **que les champs indexés**, pas tous les champs. `++id` déclare une clé primaire auto-incrémentée.

```ts
import Dexie, { type EntityTable } from 'dexie';
import type { Disque } from './schema';

export const db = new Dexie('catalogue-disques') as Dexie & {
  disques: EntityTable<Disque, 'id'>;
};

db.version(1).stores({
  disques: '++id, artiste, album, annee, noCatalogue, etatDisque',
});
```

- [ ] **Step 4: Écrire `src/db/disques.ts`**

Seul module autorisé à toucher `db.disques` : tout le reste de l'app passe par ces cinq fonctions.

```ts
import { db } from './db';
import type { Disque, NouveauDisque } from './schema';

export async function ajouterDisque(nouveau: NouveauDisque): Promise<number> {
  const maintenant = new Date();
  return await db.disques.add({
    ...nouveau,
    dateAjout: maintenant,
    dateModif: maintenant,
  } as Disque);
}

export async function modifierDisque(id: number, champs: Partial<NouveauDisque>): Promise<void> {
  await db.disques.update(id, { ...champs, dateModif: new Date() });
}

export async function supprimerDisque(id: number): Promise<void> {
  await db.disques.delete(id);
}

export async function obtenirDisque(id: number): Promise<Disque | undefined> {
  return await db.disques.get(id);
}

export async function listerDisques(): Promise<Disque[]> {
  return await db.disques.toArray();
}
```

- [ ] **Step 5: Lancer les tests pour vérifier qu'ils passent**

Run: `npm test`
Expected: PASS, `8 passed`

- [ ] **Step 6: Commit**

```bash
git add src/db/db.ts src/db/disques.ts src/db/disques.test.ts
git commit -m "feat: ajouter la base Dexie et les operations CRUD sur les disques"
```

---

## Task 6: Calcul et formatage de la valeur

**Files:**
- Create: `src/lib/valeur.ts`
- Test: `src/lib/valeur.test.ts`

- [ ] **Step 1: Écrire les tests qui échouent**

Create `src/lib/valeur.test.ts` :

```ts
import { describe, expect, test } from 'vitest';
import { formaterCAD, valeurTotale } from './valeur';
import { DISQUE_VIDE, type Disque } from '../db/schema';

/** Fabrique un Disque complet à partir de quelques champs, pour alléger les tests. */
function disque(champs: Partial<Disque>): Disque {
  return {
    ...DISQUE_VIDE,
    id: 1,
    dateAjout: new Date(),
    dateModif: new Date(),
    ...champs,
  };
}

/** Intl insère des espaces insécables variables selon la version d'ICU ; on les normalise. */
function espacesNormalises(texte: string): string {
  return texte.replace(/ | /g, ' ');
}

describe('valeurTotale', () => {
  test('vaut 0 pour une collection vide', () => {
    expect(valeurTotale([])).toBe(0);
  });

  test('multiplie la valeur par la quantité', () => {
    expect(valeurTotale([disque({ valeurEstimee: 12.5, quantite: 2 })])).toBe(25);
  });

  test('ignore les disques sans valeur estimée', () => {
    const collection = [
      disque({ valeurEstimee: 10, quantite: 1 }),
      disque({ valeurEstimee: null, quantite: 3 }),
    ];
    expect(valeurTotale(collection)).toBe(10);
  });

  test('arrondit au cent près malgré les erreurs de virgule flottante', () => {
    const collection = [
      disque({ valeurEstimee: 0.1, quantite: 1 }),
      disque({ valeurEstimee: 0.2, quantite: 1 }),
    ];
    expect(valeurTotale(collection)).toBe(0.3);
  });
});

describe('formaterCAD', () => {
  test('formate en dollars canadiens à la française', () => {
    expect(espacesNormalises(formaterCAD(1234.5))).toBe('1 234,50 $');
  });

  test('formate zéro', () => {
    expect(espacesNormalises(formaterCAD(0))).toBe('0,00 $');
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npm test`
Expected: FAIL, `Failed to resolve import "./valeur"`

- [ ] **Step 3: Écrire `src/lib/valeur.ts`**

Sans l'arrondi, `0.1 + 0.2` donne `0.30000000000000004` et la valeur totale affichée dérive de quelques cents sur 200 disques.

```ts
import type { Disque } from '../db/schema';

export function valeurTotale(disques: Disque[]): number {
  const total = disques.reduce(
    (somme, d) => somme + (d.valeurEstimee ?? 0) * d.quantite,
    0,
  );
  return Math.round(total * 100) / 100;
}

const FORMAT_CAD = new Intl.NumberFormat('fr-CA', {
  style: 'currency',
  currency: 'CAD',
});

export function formaterCAD(montant: number): string {
  return FORMAT_CAD.format(montant);
}
```

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `npm test`
Expected: PASS, `14 passed`

- [ ] **Step 5: Commit**

```bash
git add src/lib/valeur.ts src/lib/valeur.test.ts
git commit -m "feat: calculer et formater la valeur totale de la collection"
```

---

## Task 7: Recherche et tri insensibles aux accents

**Files:**
- Create: `src/lib/recherche.ts`
- Test: `src/lib/recherche.test.ts`

- [ ] **Step 1: Écrire les tests qui échouent**

Create `src/lib/recherche.test.ts` :

```ts
import { describe, expect, test } from 'vitest';
import { filtrerDisques, normaliser, trierDisques } from './recherche';
import { DISQUE_VIDE, type Disque } from '../db/schema';

function disque(champs: Partial<Disque>): Disque {
  return { ...DISQUE_VIDE, id: 1, dateAjout: new Date(), dateModif: new Date(), ...champs };
}

const CATALOGUE = [
  disque({ id: 1, artiste: 'Harmonium', album: 'L\'heptade', annee: 1976, valeurEstimee: 45 }),
  disque({ id: 2, artiste: 'Beau Dommage', album: 'Beau Dommage', annee: 1974, valeurEstimee: 12 }),
  disque({ id: 3, artiste: 'Félix Leclerc', album: 'Le tour de l\'île', annee: 1975, valeurEstimee: null }),
];

describe('normaliser', () => {
  test('retire les accents et met en minuscules', () => {
    expect(normaliser('Félix Leclerc')).toBe('felix leclerc');
  });

  test('gère la cédille', () => {
    expect(normaliser('Garçon')).toBe('garcon');
  });
});

describe('filtrerDisques', () => {
  test('retourne tout quand la requête est vide ou blanche', () => {
    expect(filtrerDisques(CATALOGUE, '')).toHaveLength(3);
    expect(filtrerDisques(CATALOGUE, '   ')).toHaveLength(3);
  });

  test('trouve un disque même si l\'utilisatrice tape sans accents', () => {
    expect(filtrerDisques(CATALOGUE, 'felix').map((d) => d.id)).toEqual([3]);
  });

  test('ignore la casse', () => {
    expect(filtrerDisques(CATALOGUE, 'HARMONIUM').map((d) => d.id)).toEqual([1]);
  });

  test('exige que tous les mots correspondent, dans n\'importe quel ordre', () => {
    expect(filtrerDisques(CATALOGUE, 'heptade harmonium').map((d) => d.id)).toEqual([1]);
    expect(filtrerDisques(CATALOGUE, 'harmonium dommage')).toHaveLength(0);
  });

  test('cherche aussi dans le numéro de catalogue', () => {
    const avecCatno = [disque({ id: 9, noCatalogue: 'CEL 6922' })];
    expect(filtrerDisques(avecCatno, 'cel 6922').map((d) => d.id)).toEqual([9]);
  });
});

describe('trierDisques', () => {
  test('trie par artiste sans tenir compte des accents', () => {
    expect(trierDisques(CATALOGUE, 'artiste').map((d) => d.id)).toEqual([2, 3, 1]);
  });

  test('trie par année, la plus récente en premier', () => {
    expect(trierDisques(CATALOGUE, 'annee').map((d) => d.id)).toEqual([1, 3, 2]);
  });

  test('trie par valeur décroissante en reléguant les valeurs absentes à la fin', () => {
    expect(trierDisques(CATALOGUE, 'valeur').map((d) => d.id)).toEqual([1, 2, 3]);
  });

  test('ne modifie pas le tableau reçu', () => {
    const original = [...CATALOGUE];
    trierDisques(CATALOGUE, 'valeur');
    expect(CATALOGUE).toEqual(original);
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npm test`
Expected: FAIL, `Failed to resolve import "./recherche"`

- [ ] **Step 3: Écrire `src/lib/recherche.ts`**

La normalisation des accents est ce qui rend la recherche utilisable : sans elle, taper « felix » ne trouverait jamais « Félix », et personne ne tape les accents sur un clavier de téléphone.

```ts
import type { Disque } from '../db/schema';

export type Tri = 'artiste' | 'annee' | 'valeur';

export const TRIS_LIBELLES: Record<Tri, string> = {
  artiste: 'Artiste',
  annee: 'Année',
  valeur: 'Valeur',
};

/**
 * NFD sépare chaque lettre accentuée en lettre + diacritique,
 * ce qui permet de supprimer les diacritiques par une regex Unicode.
 */
export function normaliser(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

export function filtrerDisques(disques: Disque[], requete: string): Disque[] {
  const mots = normaliser(requete.trim()).split(/\s+/).filter(Boolean);
  if (mots.length === 0) return disques;

  return disques.filter((d) => {
    const champs = normaliser(
      [d.artiste, d.album, d.label, d.noCatalogue, d.pays, d.notes].join(' '),
    );
    return mots.every((mot) => champs.includes(mot));
  });
}

/** Trie en décroissant, en plaçant toujours les valeurs absentes à la fin. */
function comparerDecroissant(a: number | null, b: number | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

export function trierDisques(disques: Disque[], tri: Tri): Disque[] {
  const copie = [...disques];

  switch (tri) {
    case 'artiste':
      return copie.sort(
        (a, b) =>
          normaliser(a.artiste).localeCompare(normaliser(b.artiste)) ||
          normaliser(a.album).localeCompare(normaliser(b.album)),
      );
    case 'annee':
      return copie.sort((a, b) => comparerDecroissant(a.annee, b.annee));
    case 'valeur':
      return copie.sort((a, b) => comparerDecroissant(a.valeurEstimee, b.valeurEstimee));
  }
}
```

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `npm test`
Expected: PASS, `25 passed`

- [ ] **Step 5: Commit**

```bash
git add src/lib/recherche.ts src/lib/recherche.test.ts
git commit -m "feat: rechercher et trier en ignorant accents et casse"
```

---

## Task 8: Icônes et configuration PWA

**Files:**
- Create: `scripts/icone.svg`
- Create: `scripts/generer-icones.mjs`
- Create: `public/pwa-192.png`, `public/pwa-512.png`, `public/pwa-512-maskable.png`, `public/apple-touch-icon.png`
- Modify: `vite.config.ts`
- Modify: `index.html`

- [ ] **Step 1: Créer `scripts/icone.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#1c1917"/>
  <circle cx="256" cy="256" r="200" fill="#0c0a09"/>
  <circle cx="256" cy="256" r="172" fill="none" stroke="#292524" stroke-width="7"/>
  <circle cx="256" cy="256" r="142" fill="none" stroke="#292524" stroke-width="7"/>
  <circle cx="256" cy="256" r="112" fill="none" stroke="#292524" stroke-width="7"/>
  <circle cx="256" cy="256" r="72" fill="#f59e0b"/>
  <circle cx="256" cy="256" r="11" fill="#1c1917"/>
</svg>
```

- [ ] **Step 2: Créer `scripts/generer-icones.mjs`**

```js
import sharp from 'sharp';
import { readFileSync } from 'node:fs';

const svg = readFileSync(new URL('./icone.svg', import.meta.url));

await sharp(svg).resize(192, 192).png().toFile('public/pwa-192.png');
await sharp(svg).resize(512, 512).png().toFile('public/pwa-512.png');
await sharp(svg).resize(180, 180).png().toFile('public/apple-touch-icon.png');

// Variante « maskable » : Android recadre l'icône en cercle ou en losange.
// Le contenu doit tenir dans les 80 % centraux, d'où le pochoir à 320 px sur 512.
const coeur = await sharp(svg).resize(320, 320).png().toBuffer();
await sharp({
  create: { width: 512, height: 512, channels: 4, background: '#1c1917' },
})
  .composite([{ input: coeur, gravity: 'center' }])
  .png()
  .toFile('public/pwa-512-maskable.png');

console.log('Icônes générées dans public/');
```

- [ ] **Step 3: Générer les icônes**

Run: `node scripts/generer-icones.mjs`
Expected: `Icônes générées dans public/`. Vérifier que les 4 PNG existent avec `ls public/*.png`.

- [ ] **Step 4: Installer et configurer vite-plugin-pwa**

```bash
npm install -D vite-plugin-pwa
```

Remplacer entièrement `vite.config.ts` :

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Le service worker se met à jour tout seul : l'utilisatrice n'a jamais
      // à « réinstaller » l'app pour recevoir un correctif.
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'Catalogue de disques',
        short_name: 'Disques',
        description: 'Inventaire d\'une collection de disques vinyles',
        lang: 'fr-CA',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#1c1917',
        background_color: '#1c1917',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    setupFiles: ['./src/test-setup.ts'],
  },
});
```

- [ ] **Step 5: Mettre à jour `index.html`**

`viewport-fit=cover` permet à l'app d'aller sous l'encoche ; `apple-touch-icon` est ce qu'iOS utilise réellement pour l'icône de l'écran d'accueil.

```html
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="theme-color" content="#1c1917" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <title>Catalogue de disques</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Vérifier que le build produit le manifeste et le service worker**

```bash
npm run build
ls dist/manifest.webmanifest dist/sw.js
```

Expected: les deux fichiers existent.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: configurer le manifeste PWA, le service worker et les icones"
```

---

## Task 9: Composants réutilisables

**Files:**
- Create: `src/composants/ChampEtat.tsx`
- Create: `src/composants/CarteDisque.tsx`

- [ ] **Step 1: Créer `src/composants/ChampEtat.tsx`**

Le libellé complet est affiché sous le menu pour que l'utilisatrice n'ait pas à mémoriser ce que « VG+ » veut dire — c'est le seul jargon incontournable de l'app.

```tsx
import { ETATS, ETATS_LIBELLES, type Etat } from '../db/schema';

interface Props {
  etiquette: string;
  valeur: Etat;
  onChange: (etat: Etat) => void;
}

export default function ChampEtat({ etiquette, valeur, onChange }: Props) {
  return (
    <label className="block">
      <span className="text-sm text-stone-400">{etiquette}</span>
      <select
        className="mt-1 w-full rounded-lg bg-stone-800 p-3 text-base"
        value={valeur}
        onChange={(e) => onChange(e.target.value as Etat)}
      >
        {ETATS.map((etat) => (
          <option key={etat} value={etat}>{etat}</option>
        ))}
      </select>
      <span className="mt-1 block text-xs text-stone-500">{ETATS_LIBELLES[valeur]}</span>
    </label>
  );
}
```

- [ ] **Step 2: Créer `src/composants/CarteDisque.tsx`**

```tsx
import { Link } from 'react-router';
import type { Disque } from '../db/schema';
import { formaterCAD } from '../lib/valeur';

export default function CarteDisque({ disque }: { disque: Disque }) {
  return (
    <Link
      to={`/disque/${disque.id}`}
      className="flex items-center gap-3 border-b border-stone-800 p-4 active:bg-stone-800"
    >
      <span className="w-10 shrink-0 text-sm text-stone-500">#{disque.id}</span>

      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{disque.album}</span>
        <span className="block truncate text-sm text-stone-400">{disque.artiste}</span>
        <span className="block text-xs text-stone-500">
          {[disque.annee, disque.noCatalogue, `${disque.etatDisque}/${disque.etatPochette}`]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </span>

      <span className="shrink-0 text-right text-sm">
        {disque.valeurEstimee === null
          ? <span className="text-stone-600">—</span>
          : formaterCAD(disque.valeurEstimee)}
        {disque.quantite > 1 && (
          <span className="block text-xs text-stone-500">× {disque.quantite}</span>
        )}
      </span>
    </Link>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/composants
git commit -m "feat: ajouter les composants ChampEtat et CarteDisque"
```

---

## Task 10: Écran Liste

**Files:**
- Create: `src/ecrans/ListeEcran.tsx`

- [ ] **Step 1: Créer `src/ecrans/ListeEcran.tsx`**

`useLiveQuery` réexécute la requête et rafraîchit l'affichage dès que la base change — pas besoin d'état global ni de rechargement manuel après un ajout.

```tsx
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import CarteDisque from '../composants/CarteDisque';
import { listerDisques } from '../db/disques';
import { filtrerDisques, trierDisques, TRIS_LIBELLES, type Tri } from '../lib/recherche';
import { formaterCAD, valeurTotale } from '../lib/valeur';

export default function ListeEcran() {
  const [requete, setRequete] = useState('');
  const [tri, setTri] = useState<Tri>('artiste');

  // Le 3e argument est la valeur affichée pendant le premier chargement.
  const disques = useLiveQuery(() => listerDisques(), [], []);

  const affiches = useMemo(
    () => trierDisques(filtrerDisques(disques, requete), tri),
    [disques, requete, tri],
  );

  return (
    <div>
      <header className="sticky top-0 z-10 bg-stone-900 pt-[env(safe-area-inset-top)]">
        <div className="flex items-baseline justify-between px-4 pt-4">
          <h1 className="text-xl font-semibold">Ma collection</h1>
          <span className="text-sm text-stone-400">
            {disques.length} {disques.length > 1 ? 'disques' : 'disque'}
          </span>
        </div>

        <p className="px-4 text-2xl font-semibold text-amber-500">
          {formaterCAD(valeurTotale(disques))}
        </p>

        <div className="flex gap-2 p-4">
          <input
            type="search"
            value={requete}
            onChange={(e) => setRequete(e.target.value)}
            placeholder="Artiste, album, n° de catalogue…"
            className="min-w-0 flex-1 rounded-lg bg-stone-800 p-3 text-base"
          />
          <select
            value={tri}
            onChange={(e) => setTri(e.target.value as Tri)}
            className="rounded-lg bg-stone-800 p-3 text-base"
          >
            {Object.entries(TRIS_LIBELLES).map(([cle, libelle]) => (
              <option key={cle} value={cle}>{libelle}</option>
            ))}
          </select>
        </div>
      </header>

      {affiches.length === 0 && (
        <p className="p-8 text-center text-stone-500">
          {disques.length === 0
            ? 'Aucun disque. Touchez + pour ajouter le premier.'
            : 'Aucun résultat pour cette recherche.'}
        </p>
      )}

      <ul className="pb-24">
        {affiches.map((disque) => (
          <li key={disque.id}>
            <CarteDisque disque={disque} />
          </li>
        ))}
      </ul>

      <Link
        to="/ajouter"
        aria-label="Ajouter un disque"
        className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] right-6 flex h-16 w-16
                   items-center justify-center rounded-full bg-amber-500 text-3xl
                   font-light text-stone-900 shadow-lg"
      >
        +
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/ecrans/ListeEcran.tsx
git commit -m "feat: ajouter l'ecran Liste avec recherche, tri et valeur totale"
```

---

## Task 11: Écran Formulaire et écran Fiche

**Files:**
- Create: `src/ecrans/FormulaireEcran.tsx`
- Create: `src/ecrans/FicheEcran.tsx`

- [ ] **Step 1: Créer `src/ecrans/FormulaireEcran.tsx`**

Le même écran sert à créer et à modifier : la présence de `:id` dans l'URL décide du mode. Ça évite de dupliquer un formulaire de 13 champs.

```tsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import ChampEtat from '../composants/ChampEtat';
import { ajouterDisque, modifierDisque, obtenirDisque } from '../db/disques';
import { DISQUE_VIDE, type NouveauDisque } from '../db/schema';

/** Champs texte simples, déclarés en données pour ne pas répéter 6 fois le même JSX. */
const CHAMPS_TEXTE = [
  { cle: 'artiste', etiquette: 'Artiste' },
  { cle: 'album', etiquette: 'Album' },
  { cle: 'label', etiquette: 'Label' },
  { cle: 'noCatalogue', etiquette: 'N° de catalogue' },
  { cle: 'pays', etiquette: 'Pays' },
  { cle: 'format', etiquette: 'Format (LP, 45t, 2xLP…)' },
] as const;

export default function FormulaireEcran() {
  const { id } = useParams();
  const navigate = useNavigate();
  const modeEdition = id !== undefined;
  const [disque, setDisque] = useState<NouveauDisque>(DISQUE_VIDE);
  const [charge, setCharge] = useState(!modeEdition);

  useEffect(() => {
    if (!modeEdition) return;
    obtenirDisque(Number(id)).then((existant) => {
      if (existant) setDisque(existant);
      setCharge(true);
    });
  }, [id, modeEdition]);

  function majChamp<C extends keyof NouveauDisque>(cle: C, valeur: NouveauDisque[C]) {
    setDisque((precedent) => ({ ...precedent, [cle]: valeur }));
  }

  async function enregistrer(evenement: React.FormEvent) {
    evenement.preventDefault();
    if (modeEdition) {
      await modifierDisque(Number(id), disque);
      navigate(`/disque/${id}`);
    } else {
      const nouvelId = await ajouterDisque(disque);
      navigate(`/disque/${nouvelId}`);
    }
  }

  if (!charge) return <p className="p-8 text-stone-500">Chargement…</p>;

  return (
    <form onSubmit={enregistrer} className="space-y-4 p-4 pt-[calc(1rem+env(safe-area-inset-top))]">
      <h1 className="text-xl font-semibold">
        {modeEdition ? 'Modifier le disque' : 'Nouveau disque'}
      </h1>

      {CHAMPS_TEXTE.map(({ cle, etiquette }) => (
        <label key={cle} className="block">
          <span className="text-sm text-stone-400">{etiquette}</span>
          <input
            type="text"
            value={disque[cle]}
            onChange={(e) => majChamp(cle, e.target.value)}
            required={cle === 'artiste' || cle === 'album'}
            className="mt-1 w-full rounded-lg bg-stone-800 p-3 text-base"
          />
        </label>
      ))}

      <label className="block">
        <span className="text-sm text-stone-400">Année</span>
        <input
          type="number"
          inputMode="numeric"
          value={disque.annee ?? ''}
          onChange={(e) => majChamp('annee', e.target.value === '' ? null : Number(e.target.value))}
          className="mt-1 w-full rounded-lg bg-stone-800 p-3 text-base"
        />
      </label>

      <ChampEtat
        etiquette="État du disque"
        valeur={disque.etatDisque}
        onChange={(etat) => majChamp('etatDisque', etat)}
      />

      <ChampEtat
        etiquette="État de la pochette"
        valeur={disque.etatPochette}
        onChange={(etat) => majChamp('etatPochette', etat)}
      />

      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={disque.pochetteGenerique}
          onChange={(e) => majChamp('pochetteGenerique', e.target.checked)}
          className="h-5 w-5"
        />
        <span className="text-sm">Pochette générique ou absente</span>
      </label>

      <label className="block">
        <span className="text-sm text-stone-400">Quantité</span>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          value={disque.quantite}
          onChange={(e) => majChamp('quantite', Math.max(1, Number(e.target.value)))}
          className="mt-1 w-full rounded-lg bg-stone-800 p-3 text-base"
        />
      </label>

      <label className="block">
        <span className="text-sm text-stone-400">Valeur estimée (CAD)</span>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min={0}
          value={disque.valeurEstimee ?? ''}
          onChange={(e) => {
            const brut = e.target.value;
            majChamp('valeurEstimee', brut === '' ? null : Number(brut));
            majChamp('valeurSource', 'manuelle');
            majChamp('valeurMaj', brut === '' ? null : new Date());
          }}
          className="mt-1 w-full rounded-lg bg-stone-800 p-3 text-base"
        />
      </label>

      <label className="block">
        <span className="text-sm text-stone-400">Notes</span>
        <textarea
          value={disque.notes}
          onChange={(e) => majChamp('notes', e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg bg-stone-800 p-3 text-base"
        />
      </label>

      <div className="flex gap-3 pb-8">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex-1 rounded-lg bg-stone-800 p-4 text-base"
        >
          Annuler
        </button>
        <button
          type="submit"
          className="flex-1 rounded-lg bg-amber-500 p-4 text-base font-semibold text-stone-900"
        >
          Enregistrer
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Créer `src/ecrans/FicheEcran.tsx`**

`useLiveQuery` retourne `undefined` pendant le chargement et `null` si la requête aboutit sans résultat : les deux cas sont distincts et doivent être traités séparément.

```tsx
import { Link, useNavigate, useParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { obtenirDisque, supprimerDisque } from '../db/disques';
import { ETATS_LIBELLES } from '../db/schema';
import { formaterCAD } from '../lib/valeur';

export default function FicheEcran() {
  const { id } = useParams();
  const navigate = useNavigate();
  const disque = useLiveQuery(async () => (await obtenirDisque(Number(id))) ?? null, [id]);

  if (disque === undefined) return <p className="p-8 text-stone-500">Chargement…</p>;
  if (disque === null) return <p className="p-8 text-stone-500">Disque introuvable.</p>;

  async function effacer() {
    if (!confirm(`Supprimer définitivement « ${disque!.album} » ?`)) return;
    await supprimerDisque(Number(id));
    navigate('/');
  }

  const lignes: [string, string][] = [
    ['Artiste', disque.artiste],
    ['Album', disque.album],
    ['Année', disque.annee?.toString() ?? '—'],
    ['Label', disque.label || '—'],
    ['N° de catalogue', disque.noCatalogue || '—'],
    ['Pays', disque.pays || '—'],
    ['Format', disque.format || '—'],
    ['État du disque', `${disque.etatDisque} — ${ETATS_LIBELLES[disque.etatDisque]}`],
    ['État de la pochette', `${disque.etatPochette} — ${ETATS_LIBELLES[disque.etatPochette]}`],
    ['Pochette générique', disque.pochetteGenerique ? 'Oui' : 'Non'],
    ['Quantité', disque.quantite.toString()],
    ['Valeur estimée', disque.valeurEstimee === null ? '—' : formaterCAD(disque.valeurEstimee)],
    ['Notes', disque.notes || '—'],
  ];

  return (
    <div className="p-4 pt-[calc(1rem+env(safe-area-inset-top))]">
      <Link to="/" className="text-sm text-amber-500">← Retour à la collection</Link>

      <h1 className="mt-3 text-xl font-semibold">{disque.album}</h1>
      <p className="text-stone-400">{disque.artiste}</p>
      <p className="mt-1 text-sm text-stone-500">Inventaire n° {disque.id}</p>

      <dl className="mt-6 divide-y divide-stone-800">
        {lignes.map(([etiquette, valeur]) => (
          <div key={etiquette} className="flex gap-4 py-3">
            <dt className="w-40 shrink-0 text-sm text-stone-400">{etiquette}</dt>
            <dd className="min-w-0 flex-1 text-sm">{valeur}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 flex gap-3 pb-8">
        <button
          type="button"
          onClick={effacer}
          className="flex-1 rounded-lg border border-red-900 p-4 text-base text-red-400"
        >
          Supprimer
        </button>
        <Link
          to={`/disque/${disque.id}/modifier`}
          className="flex-1 rounded-lg bg-amber-500 p-4 text-center text-base font-semibold text-stone-900"
        >
          Modifier
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Vérifier que tout compile**

Les deux écrans ne sont encore référencés par aucune route, mais `tsc` type-vérifie
l'ensemble de `src/`, donc une erreur de type serait détectée dès maintenant.

```bash
npm run build
npm test
```

Expected: build sans erreur TypeScript, `25 passed`.

- [ ] **Step 4: Commit**

```bash
git add src/ecrans
git commit -m "feat: ajouter les ecrans Formulaire et Fiche"
```

---

## Task 12: Coquille de l'application et routage

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/main.tsx`
- Delete: `src/App.css`
- Create: `vercel.json`

- [ ] **Step 1: Supprimer le CSS de démonstration de Vite**

```bash
rm src/App.css
```

- [ ] **Step 2: Remplacer `src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
```

- [ ] **Step 3: Remplacer `src/App.tsx`**

Ce fichier ne fait que du routage. `pb-[env(safe-area-inset-bottom)]` évite que le contenu passe sous la barre d'accueil de l'iPhone.

```tsx
import { Route, Routes } from 'react-router';
import ListeEcran from './ecrans/ListeEcran';
import FicheEcran from './ecrans/FicheEcran';
import FormulaireEcran from './ecrans/FormulaireEcran';

export default function App() {
  return (
    <div className="min-h-dvh bg-stone-900 text-stone-100 pb-[env(safe-area-inset-bottom)]">
      <Routes>
        <Route path="/" element={<ListeEcran />} />
        <Route path="/disque/:id" element={<FicheEcran />} />
        <Route path="/ajouter" element={<FormulaireEcran />} />
        <Route path="/disque/:id/modifier" element={<FormulaireEcran />} />
      </Routes>
    </div>
  );
}
```

- [ ] **Step 4: Créer `vercel.json`**

Sans ce fichier, ouvrir `/disque/12` directement renvoie une 404 : Vercel cherche un fichier à ce chemin. La réécriture renvoie toujours `index.html` et React Router prend le relais. La page de diagnostic est exclue pour rester servie telle quelle.

```json
{
  "rewrites": [{ "source": "/((?!diagnostic.html).*)", "destination": "/index.html" }]
}
```

- [ ] **Step 5: Vérifier que tout compile et que les tests passent**

```bash
npm run build
npm test
```

Expected: build sans erreur TypeScript, `25 passed`.

- [ ] **Step 6: Vérification manuelle dans le navigateur**

```bash
npm run dev
```

Ouvrir `http://localhost:5173/`, activer le mode appareil mobile dans les outils de développement, puis vérifier :

1. La liste vide affiche « Aucun disque. Touchez + pour ajouter le premier. »
2. Le bouton + ouvre le formulaire
3. Enregistrer un disque redirige vers sa fiche
4. Le disque apparaît dans la liste avec son numéro d'inventaire
5. La valeur totale en haut reflète valeur × quantité
6. Taper « felix » trouve un disque saisi « Félix »
7. Changer le tri réordonne la liste
8. Modifier un disque conserve les champs non touchés
9. Supprimer demande confirmation et ramène à la liste
10. Recharger la page conserve tous les disques

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: mettre en place le routage et la coquille de l'app"
```

---

## Task 13: Déploiement et installation sur l'iPhone

**Files:** aucun

- [ ] **Step 1: Builder et prévisualiser une dernière fois**

```bash
npm run build
npm run preview
```

Expected: aucune erreur. Ouvrir `http://localhost:4173/` et refaire les points 1 à 4 de la vérification manuelle.

- [ ] **Step 2: Déployer en production**

```bash
vercel --prod
```

Expected: Vercel affiche l'URL de production.

- [ ] **Step 3: Installer sur l'iPhone de l'utilisatrice finale**

1. Lui envoyer l'URL de production
2. Ouvrir dans Safari → bouton Partager → « Sur l'écran d'accueil »
3. Ouvrir depuis l'icône

Vérifier sur l'appareil :

- l'icône affiche le disque vinyle, pas une capture de la page
- l'app s'ouvre en plein écran, sans barre d'adresse ni onglets
- le contenu ne passe ni sous l'encoche ni sous la barre d'accueil
- ajouter un disque fonctionne
- fermer complètement l'app puis la rouvrir conserve le disque
- passer en mode avion et rouvrir l'app : elle démarre quand même et les disques sont là

- [ ] **Step 4: Commit final**

```bash
git add -A
git commit -m "chore: livrer la phase 1 en production"
```

---

## Ce qui suit

Les phases 2 à 5 du spec feront chacune l'objet d'un plan distinct :

| Plan | Contenu |
|---|---|
| Phase 2 | Client Discogs, recherche, écran de sélection du pressage, autofill, valeur en CAD, file d'attente throttlée |
| Phase 3 | Sauvegarde et restauration JSON, export CSV, texte d'annonce, bandeau de rappel |
| Phase 4 | Scan de code-barres avec zxing-wasm — **conditionnel au résultat du test caméra de la tâche 3** |
| Phase 5 | Polish, écran Réglages, accompagnement à la saisie des 200 disques |
