# Catalogue de disques — Plan d'implémentation, phase 2 (intégration Discogs)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre d'ajouter un disque en cherchant son titre sur Discogs, en choisissant le bon pressage, et en laissant l'app remplir label, n° de catalogue, pays, année, format et valeur marchande en CAD — pour ne saisir à la main que les deux états et la quantité.

**Architecture :** Une couche `src/discogs/` isolée : `client.ts` fait les requêtes HTTP, `mapping.ts` ne contient que des fonctions pures transformant les réponses en types de l'app, `api.ts` compose les deux. Les composants React n'appellent jamais `fetch` directement. Tout le mapping est testé sans réseau ; la couche API est testée avec `fetch` remplacé par un doublure.

**Tech Stack :** inchangé (Vite 8, React 19, TypeScript 6, React Router 7.18.2, Dexie 4, Tailwind 4, Vitest 4). Aucune dépendance nouvelle.

**Spec de référence :** [docs/superpowers/specs/2026-08-18-catalogue-disques-design.md](../specs/2026-08-18-catalogue-disques-design.md), section « Intégration Discogs ».

**Plan précédent :** [phases 0 et 1](2026-08-18-catalogue-disques-phases-0-1.md) — livrées, fusionnées, en production.

---

## Ce que les mesures sur l'API imposent

Ces faits ont été vérifiés en direct le 2026-08-18 et dictent la conception. Ne pas les
re-supposer autrement sans les remesurer.

1. **Le prix ne vient pas de `/releases/`.** Son `curr_abbr` est ignoré et le prix sort
   dans la devise du compte appelant. Le prix vient de
   `GET /marketplace/stats/{id}?curr_abbr=CAD`, qui retourne `{value, currency}` et
   fonctionne sans jeton.
2. **La réponse porte sa devise.** Le code doit **vérifier** `currency === 'CAD'` et
   refuser la valeur sinon, plutôt que de faire confiance au paramètre envoyé.
3. **La recherche suffit pour l'écran de sélection.** Elle renvoie déjà `catno`,
   `country`, `year`, `label[]`, `formats[]` et un `title` « Artiste - Album ».
4. **Le champ `label` de la recherche est pollué** par les usines de pressage et les
   sociétés de gestion (`['CBS', 'CBS Inc.', 'Columbia Records Pressing Plant, Don Mills, ON', …]`).
   Le `labels[]` de `/releases/{id}` est propre.
5. **Les vignettes exigent un jeton.** Sans jeton, `thumb` revient vide sur tous les
   résultats. L'écran doit donc fonctionner sans image.
6. **Cadence : 25 req/min sans jeton, 60 avec.**
7. **Ne pas envoyer de `User-Agent`.** Mesuré depuis Chromium sur l'origine de
   l'application : `User-Agent` est un en-tête interdit dans `fetch`, le navigateur le
   supprime silencieusement. Un appel sans aucun en-tête renvoie `200` — le navigateur
   fournit son propre `User-Agent`, ce qui suffit à Discogs. Écrire cet en-tête serait
   du code qui ne fait rien.
8. **`Authorization` passe bien en cross-origin.** Le preflight l'autorise ; un jeton
   invalide produit un `401`, qu'il faut donc traiter — un jeton mal collé est un cas
   réel.

---

## Structure de fichiers

| Fichier | Responsabilité |
|---|---|
| `src/discogs/types.ts` | Formes des réponses Discogs qu'on consomme, et le type `Pressage`. Aucune logique. |
| `src/discogs/client.ts` | Un seul point d'entrée HTTP : en-têtes, jeton, erreurs. Ne connaît rien au domaine. |
| `src/discogs/mapping.ts` | Fonctions **pures** : réponse Discogs → types de l'app. Tout le risque métier est ici, donc tout est testé. |
| `src/discogs/api.ts` | Compose client + mapping : `chercher`, `obtenirFiche`, `obtenirPrix`. |
| `src/reglages.ts` | Lecture/écriture du jeton dans `localStorage`. |
| `src/composants/CartePressage.tsx` | Une ligne de résultat de recherche. |
| `src/ecrans/RechercheEcran.tsx` | Saisie de la recherche et choix du pressage. |
| `src/ecrans/ReglagesEcran.tsx` | Saisie du jeton et explication de ce qu'il apporte. |
| `src/ecrans/ChoixAjoutEcran.tsx` | Le « + » propose désormais *Chercher sur Discogs* ou *Saisie manuelle*. |

Fichiers modifiés : `src/App.tsx` (routes), `src/ecrans/FormulaireEcran.tsx`
(préremplissage), `src/ecrans/FicheEcran.tsx` (bouton rafraîchir le prix),
`src/ecrans/ListeEcran.tsx` (accès aux Réglages, le « + » pointe vers le choix).

---

## Task 1: Réglages — le jeton Discogs

**Files:**
- Create: `src/reglages.ts`
- Test: `src/reglages.test.ts`

- [ ] **Step 1: Écrire les tests qui échouent**

Create `src/reglages.test.ts` :

```ts
import { beforeEach, describe, expect, test } from 'vitest';
import { lireJeton, effacerJeton, enregistrerJeton } from './reglages';

beforeEach(() => localStorage.clear());

describe('jeton Discogs', () => {
  test('vaut null quand rien n\'a été enregistré', () => {
    expect(lireJeton()).toBeNull();
  });

  test('se relit après enregistrement', () => {
    enregistrerJeton('abcdef123456');
    expect(lireJeton()).toBe('abcdef123456');
  });

  test('retire les espaces autour — un copier-coller en traîne toujours', () => {
    enregistrerJeton('  abcdef123456 \n');
    expect(lireJeton()).toBe('abcdef123456');
  });

  test('enregistrer une chaîne vide revient à effacer', () => {
    enregistrerJeton('abcdef123456');
    enregistrerJeton('   ');
    expect(lireJeton()).toBeNull();
  });

  test('effacerJeton supprime la valeur', () => {
    enregistrerJeton('abcdef123456');
    effacerJeton();
    expect(lireJeton()).toBeNull();
  });
});
```

- [ ] **Step 2: Ajouter `localStorage` à l'environnement de test**

Les tests tournent en `environment: 'node'`, où `localStorage` n'existe pas. Ajouter à la
fin de `src/test-setup.ts` :

```ts
import 'fake-indexeddb/auto';

// Node n'a pas localStorage ; une implémentation minimale en mémoire suffit ici.
class StockageMemoire implements Storage {
  private donnees = new Map<string, string>();
  get length() { return this.donnees.size; }
  clear() { this.donnees.clear(); }
  getItem(cle: string) { return this.donnees.get(cle) ?? null; }
  key(index: number) { return [...this.donnees.keys()][index] ?? null; }
  removeItem(cle: string) { this.donnees.delete(cle); }
  setItem(cle: string, valeur: string) { this.donnees.set(cle, valeur); }
}

globalThis.localStorage = new StockageMemoire();
```

- [ ] **Step 3: Lancer les tests pour vérifier qu'ils échouent**

Run: `npm test`
Expected: FAIL, impossible de résoudre `./reglages`

- [ ] **Step 4: Écrire `src/reglages.ts`**

```ts
const CLE_JETON = 'discogs-token';

/** Retourne le jeton, ou null s'il n'y en a pas. Jamais une chaîne vide. */
export function lireJeton(): string | null {
  const valeur = localStorage.getItem(CLE_JETON);
  return valeur === null || valeur === '' ? null : valeur;
}

export function enregistrerJeton(jeton: string): void {
  const propre = jeton.trim();
  if (propre === '') {
    effacerJeton();
    return;
  }
  localStorage.setItem(CLE_JETON, propre);
}

export function effacerJeton(): void {
  localStorage.removeItem(CLE_JETON);
}
```

- [ ] **Step 5: Lancer les tests pour vérifier qu'ils passent**

Run: `npm test`
Expected: PASS, `31 passed` (26 existants + 5 nouveaux)

- [ ] **Step 6: Commit**

```bash
git add src/reglages.ts src/reglages.test.ts src/test-setup.ts
git commit -m "feat: stocker le jeton Discogs dans le navigateur"
```

---

## Task 2: Types Discogs et client HTTP

**Files:**
- Create: `src/discogs/types.ts`
- Create: `src/discogs/client.ts`
- Test: `src/discogs/client.test.ts`

- [ ] **Step 1: Écrire `src/discogs/types.ts`**

On ne déclare que ce qu'on consomme réellement. Les champs marqués optionnels le sont
parce qu'ils ont été observés absents ou vides sur de vraies réponses.

```ts
/** Un résultat de `GET /database/search`. */
export interface ResultatRecherche {
  id: number;
  /** Sous la forme « Artiste - Album ». Discogs ne les sépare pas ici. */
  title: string;
  year?: number;
  country?: string;
  catno?: string;
  /** Pollué par les usines de pressage et les sociétés de gestion. */
  label?: string[];
  formats?: FormatDiscogs[];
  /** Vide sans jeton d'authentification. */
  thumb?: string;
}

export interface FormatDiscogs {
  name: string;
  qty?: string;
  descriptions?: string[];
}

/** Une fiche `GET /releases/{id}`. */
export interface ReleaseDiscogs {
  id: number;
  title: string;
  artists?: { name: string }[];
  year?: number;
  country?: string;
  labels?: { name: string; catno?: string }[];
  formats?: FormatDiscogs[];
}

/** `GET /marketplace/stats/{id}`. `lowest_price` est null si rien n'est en vente. */
export interface StatsMarche {
  num_for_sale?: number;
  lowest_price: { value: number; currency: string } | null;
}

/** Ce qu'on montre à l'utilisatrice pour qu'elle choisisse son pressage. */
export interface Pressage {
  releaseId: number;
  titre: string;
  annee: number | null;
  pays: string;
  noCatalogue: string;
  label: string;
  format: string;
  vignette: string | null;
}
```

- [ ] **Step 2: Écrire les tests du client qui échouent**

Create `src/discogs/client.test.ts` :

```ts
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ErreurDiscogs, appelerDiscogs } from './client';
import { enregistrerJeton } from '../reglages';

function reponse(corps: unknown, statut = 200) {
  return new Response(JSON.stringify(corps), { status: statut });
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('appelerDiscogs', () => {
  test('appelle l\'API sur le bon chemin et retourne le JSON', async () => {
    const fetchDoublure = vi.fn().mockResolvedValue(reponse({ ok: true }));
    vi.stubGlobal('fetch', fetchDoublure);

    const resultat = await appelerDiscogs('/releases/1');

    expect(resultat).toEqual({ ok: true });
    expect(fetchDoublure.mock.calls[0][0]).toBe('https://api.discogs.com/releases/1');
  });

  test('explique qu'un jeton refusé est un jeton à corriger', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponse({}, 401)));

    await expect(appelerDiscogs('/releases/1')).rejects.toThrow(/jeton/i);
  });

  test('n\'envoie pas d\'en-tête Authorization sans jeton', async () => {
    const fetchDoublure = vi.fn().mockResolvedValue(reponse({}));
    vi.stubGlobal('fetch', fetchDoublure);

    await appelerDiscogs('/releases/1');

    const entetes = fetchDoublure.mock.calls[0][1].headers as Record<string, string>;
    expect(entetes.Authorization).toBeUndefined();
  });

  test('envoie le jeton quand il y en a un', async () => {
    enregistrerJeton('mon-jeton');
    const fetchDoublure = vi.fn().mockResolvedValue(reponse({}));
    vi.stubGlobal('fetch', fetchDoublure);

    await appelerDiscogs('/releases/1');

    const entetes = fetchDoublure.mock.calls[0][1].headers as Record<string, string>;
    expect(entetes.Authorization).toBe('Discogs token=mon-jeton');
  });

  test('traduit un dépassement de cadence en message compréhensible', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponse({}, 429)));

    await expect(appelerDiscogs('/releases/1')).rejects.toThrow(ErreurDiscogs);
    await expect(appelerDiscogs('/releases/1')).rejects.toThrow(/trop de recherches/i);
  });

  test('traduit une panne réseau en message compréhensible', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(appelerDiscogs('/releases/1')).rejects.toThrow(/connexion/i);
  });

  test('signale les autres erreurs HTTP avec leur code', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponse({}, 500)));

    await expect(appelerDiscogs('/releases/1')).rejects.toThrow(/500/);
  });
});
```

- [ ] **Step 3: Lancer les tests pour vérifier qu'ils échouent**

Run: `npm test`
Expected: FAIL, impossible de résoudre `./client`

- [ ] **Step 4: Écrire `src/discogs/client.ts`**

Les messages d'erreur sont destinés à être affichés tels quels à une utilisatrice non
technicienne : pas de code HTTP brut ni de jargon quand on peut faire mieux.

```ts
import { lireJeton } from '../reglages';

const BASE = 'https://api.discogs.com';

/** Erreur portant un message déjà rédigé pour l'utilisatrice. */
export class ErreurDiscogs extends Error {}

/**
 * On n'envoie volontairement pas de `User-Agent` : c'est un en-tête interdit dans
 * `fetch`, que le navigateur supprime. Il fournit le sien, que Discogs accepte —
 * vérifié depuis Chromium le 2026-08-18.
 */
export async function appelerDiscogs<T>(chemin: string): Promise<T> {
  const entetes: Record<string, string> = {};

  const jeton = lireJeton();
  if (jeton !== null) entetes.Authorization = `Discogs token=${jeton}`;

  let reponse: Response;
  try {
    reponse = await fetch(BASE + chemin, { headers: entetes });
  } catch {
    throw new ErreurDiscogs(
      'Pas de connexion à Discogs. Vérifiez votre connexion Internet et réessayez.',
    );
  }

  if (reponse.status === 429) {
    throw new ErreurDiscogs(
      'Trop de recherches d\'un coup. Attendez une minute avant de réessayer.',
    );
  }
  if (!reponse.ok) {
    throw new ErreurDiscogs(`Discogs a répondu une erreur ${reponse.status}.`);
  }

  return (await reponse.json()) as T;
}
```

- [ ] **Step 5: Lancer les tests pour vérifier qu'ils passent**

Run: `npm test`
Expected: PASS, `38 passed`

- [ ] **Step 6: Commit**

```bash
git add src/discogs/types.ts src/discogs/client.ts src/discogs/client.test.ts
git commit -m "feat: ajouter le client HTTP Discogs et ses types"
```

---

## Task 3: Mapping d'un résultat de recherche en pressage

**Files:**
- Create: `src/discogs/mapping.ts`
- Test: `src/discogs/mapping.test.ts`

- [ ] **Step 1: Écrire les tests qui échouent**

Les cas de test viennent de vraies réponses observées sur « Harmonium — L'Heptade », qui
existe en cinq pressages.

Create `src/discogs/mapping.test.ts` :

```ts
import { describe, expect, test } from 'vitest';
import { versPressage } from './mapping';
import type { ResultatRecherche } from './types';

/** Réponse réelle observée le 2026-08-18 pour le pressage canadien de 1976. */
const HEPTADE_1976: ResultatRecherche = {
  id: 1887068,
  title: "Harmonium - L'Heptade",
  year: 1976,
  country: 'Canada',
  catno: 'PGF 90348',
  label: ['CBS', 'CBS Inc.', 'Columbia Records Pressing Plant, Don Mills, ON', 'Customatrix'],
  formats: [{ name: 'Vinyl', qty: '2', descriptions: ['LP', 'Album', 'Stereo'] }],
  thumb: '',
};

describe('versPressage', () => {
  test('reprend l\'identifiant, le titre, l\'année, le pays et le n° de catalogue', () => {
    const p = versPressage(HEPTADE_1976);
    expect(p.releaseId).toBe(1887068);
    expect(p.titre).toBe("Harmonium - L'Heptade");
    expect(p.annee).toBe(1976);
    expect(p.pays).toBe('Canada');
    expect(p.noCatalogue).toBe('PGF 90348');
  });

  test('ne garde que le premier label, les suivants étant des usines de pressage', () => {
    expect(versPressage(HEPTADE_1976).label).toBe('CBS');
  });

  test('note la quantité pour un double album', () => {
    expect(versPressage(HEPTADE_1976).format).toBe('2xLP');
  });

  test('omet la quantité pour un disque simple', () => {
    const simple = { ...HEPTADE_1976, formats: [{ name: 'Vinyl', qty: '1', descriptions: ['LP', 'Album'] }] };
    expect(versPressage(simple).format).toBe('LP');
  });

  test('reconnaît un 45 tours', () => {
    const quaranteCinq = { ...HEPTADE_1976, formats: [{ name: 'Vinyl', qty: '1', descriptions: ['7"', 'Single', '45 RPM'] }] };
    expect(versPressage(quaranteCinq).format).toBe('7"');
  });

  test('retombe sur le nom du format quand aucune description n\'est reconnue', () => {
    const inconnu = { ...HEPTADE_1976, formats: [{ name: 'Vinyl', qty: '1', descriptions: ['Misprint'] }] };
    expect(versPressage(inconnu).format).toBe('Vinyl');
  });

  test('convertit une vignette vide en null plutôt qu\'en chaîne vide', () => {
    expect(versPressage(HEPTADE_1976).vignette).toBeNull();
  });

  test('conserve une vignette présente', () => {
    const avecImage = { ...HEPTADE_1976, thumb: 'https://i.discogs.com/abc.jpg' };
    expect(versPressage(avecImage).vignette).toBe('https://i.discogs.com/abc.jpg');
  });

  test('survit à un résultat dépouillé de tous ses champs optionnels', () => {
    const minimal: ResultatRecherche = { id: 42, title: 'Inconnu' };
    const p = versPressage(minimal);
    expect(p).toEqual({
      releaseId: 42,
      titre: 'Inconnu',
      annee: null,
      pays: '',
      noCatalogue: '',
      label: '',
      format: '',
      vignette: null,
    });
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npm test`
Expected: FAIL, impossible de résoudre `./mapping`

- [ ] **Step 3: Écrire `src/discogs/mapping.ts`**

```ts
import type { FormatDiscogs, Pressage, ResultatRecherche } from './types';

/**
 * Supports que l'on sait nommer, du plus précis au plus général.
 * Discogs range le support parmi les descriptions, mêlé à « Album », « Stereo », etc.
 */
const SUPPORTS = ['LP', 'EP', '7"', '10"', '12"', 'Single'];

/** Construit « 2xLP », « LP », « 7" »… à partir du bloc formats de Discogs. */
export function formaterSupport(formats: FormatDiscogs[] | undefined): string {
  const premier = formats?.[0];
  if (premier === undefined) return '';

  const descriptions = premier.descriptions ?? [];
  const support = SUPPORTS.find((s) => descriptions.includes(s)) ?? premier.name;

  const quantite = Number(premier.qty ?? '1');
  return quantite > 1 ? `${quantite}x${support}` : support;
}

export function versPressage(resultat: ResultatRecherche): Pressage {
  return {
    releaseId: resultat.id,
    titre: resultat.title,
    annee: resultat.year ?? null,
    pays: resultat.country ?? '',
    noCatalogue: resultat.catno ?? '',
    // Discogs empile ici le label, ses filiales, l'usine de pressage et la société
    // de gestion. Le premier est le bon dans les réponses observées.
    label: resultat.label?.[0] ?? '',
    format: formaterSupport(resultat.formats),
    vignette: resultat.thumb === undefined || resultat.thumb === '' ? null : resultat.thumb,
  };
}
```

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `npm test`
Expected: PASS, `47 passed`

- [ ] **Step 5: Commit**

```bash
git add src/discogs/mapping.ts src/discogs/mapping.test.ts
git commit -m "feat: convertir un resultat de recherche Discogs en pressage"
```

---

## Task 4: Mapping d'une fiche et d'un prix vers un disque

Le garde-fou sur la devise est le point le plus important de tout ce plan. Une valeur
en devise étrangère étiquetée « CAD » fausserait chaque disque et le total de la
collection d'environ 35 %.

**Files:**
- Modify: `src/discogs/mapping.ts`
- Modify: `src/discogs/mapping.test.ts`

- [ ] **Step 1: Ajouter les tests qui échouent**

Ajouter à la fin de `src/discogs/mapping.test.ts` :

```ts
import { prixCAD, versChampsDisque } from './mapping';
import type { ReleaseDiscogs, StatsMarche } from './types';

/** Fiche réelle observée le 2026-08-18. */
const RELEASE_1976: ReleaseDiscogs = {
  id: 1887068,
  title: "L'Heptade",
  artists: [{ name: 'Harmonium' }],
  year: 1976,
  country: 'Canada',
  labels: [{ name: 'CBS', catno: 'PGF 90348' }],
  formats: [{ name: 'Vinyl', qty: '2', descriptions: ['LP', 'Album', 'Stereo'] }],
};

describe('versChampsDisque', () => {
  test('sépare correctement artiste et album, contrairement à la recherche', () => {
    const champs = versChampsDisque(RELEASE_1976);
    expect(champs.artiste).toBe('Harmonium');
    expect(champs.album).toBe("L'Heptade");
  });

  test('reprend année, pays, label, n° de catalogue et format', () => {
    const champs = versChampsDisque(RELEASE_1976);
    expect(champs.annee).toBe(1976);
    expect(champs.pays).toBe('Canada');
    expect(champs.label).toBe('CBS');
    expect(champs.noCatalogue).toBe('PGF 90348');
    expect(champs.format).toBe('2xLP');
  });

  test('joint les artistes multiples', () => {
    const duo = { ...RELEASE_1976, artists: [{ name: 'Sonny' }, { name: 'Cher' }] };
    expect(versChampsDisque(duo).artiste).toBe('Sonny, Cher');
  });

  test('conserve l\'identifiant Discogs pour pouvoir rafraîchir le prix plus tard', () => {
    expect(versChampsDisque(RELEASE_1976).discogsReleaseId).toBe(1887068);
  });

  test('survit à une fiche sans artiste, sans label et sans année', () => {
    const champs = versChampsDisque({ id: 7, title: 'Inconnu' });
    expect(champs.artiste).toBe('');
    expect(champs.label).toBe('');
    expect(champs.noCatalogue).toBe('');
    expect(champs.annee).toBeNull();
  });
});

describe('prixCAD', () => {
  test('accepte une valeur dont la devise est bien CAD', () => {
    const stats: StatsMarche = { num_for_sale: 35, lowest_price: { value: 5, currency: 'CAD' } };
    expect(prixCAD(stats)).toEqual({ valeur: 5, nombreEnVente: 35 });
  });

  test('REFUSE une valeur dans une autre devise plutôt que de la faire passer pour du CAD', () => {
    const stats: StatsMarche = { num_for_sale: 35, lowest_price: { value: 3.6, currency: 'USD' } };
    expect(prixCAD(stats)).toEqual({ valeur: null, nombreEnVente: 35 });
  });

  test('retourne null quand aucun exemplaire n\'est en vente', () => {
    const stats: StatsMarche = { num_for_sale: 0, lowest_price: null };
    expect(prixCAD(stats)).toEqual({ valeur: null, nombreEnVente: 0 });
  });

  test('retourne null si le nombre en vente est absent', () => {
    expect(prixCAD({ lowest_price: null })).toEqual({ valeur: null, nombreEnVente: null });
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npm test`
Expected: FAIL, `versChampsDisque` et `prixCAD` ne sont pas exportés

- [ ] **Step 3: Compléter `src/discogs/mapping.ts`**

Ajouter à la fin du fichier :

```ts
import type { NouveauDisque } from '../db/schema';
import type { ReleaseDiscogs, StatsMarche } from './types';

/** Ce que Discogs peut remplir. Les états et la quantité restent à l'utilisatrice. */
export type ChampsDiscogs = Pick<
  NouveauDisque,
  'artiste' | 'album' | 'annee' | 'label' | 'noCatalogue' | 'pays' | 'format' | 'discogsReleaseId'
>;

export function versChampsDisque(release: ReleaseDiscogs): ChampsDiscogs {
  return {
    artiste: (release.artists ?? []).map((a) => a.name).join(', '),
    album: release.title,
    annee: release.year ?? null,
    label: release.labels?.[0]?.name ?? '',
    noCatalogue: release.labels?.[0]?.catno ?? '',
    pays: release.country ?? '',
    format: formaterSupport(release.formats),
    discogsReleaseId: release.id,
  };
}

/**
 * Extrait le prix, et SEULEMENT s'il est réellement en dollars canadiens.
 *
 * Discogs ignore le paramètre `curr_abbr` sur `/releases/` et y renvoie la devise du
 * compte appelant. On n'utilise donc que `/marketplace/stats/`, et on vérifie malgré
 * tout la devise de la réponse : afficher des dollars US comme des dollars canadiens
 * fausserait l'estimation de toute la collection d'environ 35 %.
 */
export function prixCAD(stats: StatsMarche): { valeur: number | null; nombreEnVente: number | null } {
  const prix = stats.lowest_price;
  return {
    valeur: prix !== null && prix.currency === 'CAD' ? prix.value : null,
    nombreEnVente: stats.num_for_sale ?? null,
  };
}
```

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `npm test`
Expected: PASS, `56 passed`

- [ ] **Step 5: Commit**

```bash
git add src/discogs/mapping.ts src/discogs/mapping.test.ts
git commit -m "feat: mapper une fiche Discogs en disque et verifier la devise"
```

---

## Task 5: Couche API

**Files:**
- Create: `src/discogs/api.ts`
- Test: `src/discogs/api.test.ts`

- [ ] **Step 1: Écrire les tests qui échouent**

Create `src/discogs/api.test.ts` :

```ts
import { afterEach, expect, describe, test, vi } from 'vitest';
import { chercher, obtenirFiche, obtenirPrix } from './api';

function doublureFetch(corpsParUrl: Record<string, unknown>) {
  return vi.fn((url: string) => {
    const cle = Object.keys(corpsParUrl).find((c) => url.includes(c));
    if (cle === undefined) throw new Error(`URL inattendue : ${url}`);
    return Promise.resolve(new Response(JSON.stringify(corpsParUrl[cle])));
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('chercher', () => {
  test('restreint la recherche aux vinyles et retourne des pressages', async () => {
    const f = doublureFetch({
      '/database/search': { results: [{ id: 1, title: 'A - B', catno: 'X1' }] },
    });
    vi.stubGlobal('fetch', f);

    const pressages = await chercher('harmonium heptade');

    expect(pressages).toHaveLength(1);
    expect(pressages[0].noCatalogue).toBe('X1');
    const url = f.mock.calls[0][0] as string;
    expect(url).toContain('format=Vinyl');
    expect(url).toContain('type=release');
  });

  test('encode la requête pour ne pas casser l\'URL', async () => {
    const f = doublureFetch({ '/database/search': { results: [] } });
    vi.stubGlobal('fetch', f);

    await chercher("L'Heptade & Cie");

    const url = f.mock.calls[0][0] as string;
    expect(url).toContain(encodeURIComponent("L'Heptade & Cie"));
  });

  test('cherche par code-barres quand on le lui demande', async () => {
    const f = doublureFetch({ '/database/search': { results: [] } });
    vi.stubGlobal('fetch', f);

    await chercher('602537351169', { parCodeBarres: true });

    expect(f.mock.calls[0][0] as string).toContain('barcode=602537351169');
  });

  test('retourne une liste vide quand Discogs ne renvoie pas de résultats', async () => {
    vi.stubGlobal('fetch', doublureFetch({ '/database/search': {} }));
    expect(await chercher('zzzz')).toEqual([]);
  });
});

describe('obtenirPrix', () => {
  test('demande explicitement des dollars canadiens', async () => {
    const f = doublureFetch({
      '/marketplace/stats': { num_for_sale: 3, lowest_price: { value: 12, currency: 'CAD' } },
    });
    vi.stubGlobal('fetch', f);

    const prix = await obtenirPrix(1887068);

    expect(prix.valeur).toBe(12);
    expect(f.mock.calls[0][0] as string).toContain('curr_abbr=CAD');
  });

  test('rejette silencieusement une réponse dans une autre devise', async () => {
    vi.stubGlobal('fetch', doublureFetch({
      '/marketplace/stats': { num_for_sale: 3, lowest_price: { value: 12, currency: 'USD' } },
    }));

    expect((await obtenirPrix(1)).valeur).toBeNull();
  });
});

describe('obtenirFiche', () => {
  test('retourne les champs remplissables d\'un disque', async () => {
    vi.stubGlobal('fetch', doublureFetch({
      '/releases/': { id: 5, title: 'Album', artists: [{ name: 'Artiste' }] },
    }));

    const champs = await obtenirFiche(5);

    expect(champs.artiste).toBe('Artiste');
    expect(champs.album).toBe('Album');
    expect(champs.discogsReleaseId).toBe(5);
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npm test`
Expected: FAIL, impossible de résoudre `./api`

- [ ] **Step 3: Écrire `src/discogs/api.ts`**

```ts
import { appelerDiscogs } from './client';
import { prixCAD, versChampsDisque, versPressage, type ChampsDiscogs } from './mapping';
import type { Pressage, ReleaseDiscogs, ResultatRecherche, StatsMarche } from './types';

interface ReponseRecherche {
  results?: ResultatRecherche[];
}

/**
 * Cherche des pressages vinyle. `parCodeBarres` bascule sur la recherche par code-barres,
 * qui ne donne rien sur les disques pressés avant ~1980 — ils n'en portent pas.
 */
export async function chercher(
  requete: string,
  options: { parCodeBarres?: boolean } = {},
): Promise<Pressage[]> {
  const champ = options.parCodeBarres === true ? 'barcode' : 'q';
  const chemin =
    `/database/search?${champ}=${encodeURIComponent(requete)}` +
    '&type=release&format=Vinyl&per_page=25';

  const reponse = await appelerDiscogs<ReponseRecherche>(chemin);
  return (reponse.results ?? []).map(versPressage);
}

/** Récupère artiste et album séparés, et un label non pollué. */
export async function obtenirFiche(releaseId: number): Promise<ChampsDiscogs> {
  return versChampsDisque(await appelerDiscogs<ReleaseDiscogs>(`/releases/${releaseId}`));
}

/** Seul endpoint qui respecte réellement la devise demandée. */
export async function obtenirPrix(
  releaseId: number,
): Promise<{ valeur: number | null; nombreEnVente: number | null }> {
  return prixCAD(
    await appelerDiscogs<StatsMarche>(`/marketplace/stats/${releaseId}?curr_abbr=CAD`),
  );
}
```

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `npm test`
Expected: PASS, `63 passed`

- [ ] **Step 5: Vérifier la couche API contre la vraie API, une seule fois**

Les doublures prouvent que le code fait ce qu'on croit ; seul un appel réel prouve que
Discogs se comporte comme mesuré. Créer un fichier temporaire `verif-api.mjs` à la racine :

```js
const BASE = 'https://api.discogs.com';
// Ce script tourne dans Node, où User-Agent n'est pas un en-tête interdit,
// contrairement au navigateur. L'application, elle, n'en envoie pas.
const entetes = { 'User-Agent': 'CatalogueDisques/1.0' };

const recherche = await (await fetch(
  `${BASE}/database/search?q=${encodeURIComponent('Harmonium heptade')}&type=release&format=Vinyl&per_page=3`,
  { headers: entetes })).json();
console.log('pressages trouves :', recherche.results.length);
for (const r of recherche.results) {
  console.log(' -', r.id, '|', r.title, '|', r.year, '|', r.country, '|', r.catno);
}

const stats = await (await fetch(
  `${BASE}/marketplace/stats/1887068?curr_abbr=CAD`, { headers: entetes })).json();
console.log('prix :', JSON.stringify(stats.lowest_price));
if (stats.lowest_price && stats.lowest_price.currency !== 'CAD') {
  throw new Error('La devise renvoyee n est pas CAD — le garde-fou du mapping est justifie.');
}
```

Run: `node verif-api.mjs`
Expected: au moins 3 pressages listés avec des n° de catalogue distincts, et un prix dont
`currency` vaut `CAD`. Puis supprimer le fichier : `rm verif-api.mjs`

Si la devise n'est plus `CAD`, **ne pas contourner** : le rapporter, le mapping refusera
la valeur et c'est le comportement voulu.

- [ ] **Step 6: Commit**

```bash
git add src/discogs/api.ts src/discogs/api.test.ts
git commit -m "feat: ajouter la couche API Discogs (recherche, fiche, prix)"
```

---

## Task 6: Écran Réglages

**Files:**
- Create: `src/ecrans/ReglagesEcran.tsx`
- Modify: `src/App.tsx`
- Modify: `src/ecrans/ListeEcran.tsx`

- [ ] **Step 1: Créer `src/ecrans/ReglagesEcran.tsx`**

Le texte explique ce que le jeton apporte et ce qu'il n'apporte pas, pour que le champ
vide ne ressemble pas à une configuration obligatoire bloquant l'usage de l'app.

```tsx
import { useState } from 'react';
import { Link } from 'react-router';
import { effacerJeton, enregistrerJeton, lireJeton } from '../reglages';

export default function ReglagesEcran() {
  const [jeton, setJeton] = useState(lireJeton() ?? '');
  const [enregistre, setEnregistre] = useState(false);

  function soumettre(evenement: React.FormEvent) {
    evenement.preventDefault();
    if (jeton.trim() === '') effacerJeton();
    else enregistrerJeton(jeton);
    setEnregistre(true);
  }

  return (
    <div className="p-4 pt-[calc(1rem+env(safe-area-inset-top))]">
      <Link to="/" className="text-sm text-amber-500">← Retour à la collection</Link>
      <h1 className="mt-3 text-xl font-semibold">Réglages</h1>

      <form onSubmit={soumettre} className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm text-stone-400">Jeton Discogs (facultatif)</span>
          <input
            type="text"
            value={jeton}
            onChange={(e) => { setJeton(e.target.value); setEnregistre(false); }}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="mt-1 w-full rounded-lg bg-stone-800 p-3 font-mono text-sm"
          />
        </label>

        <div className="rounded-lg bg-stone-800 p-4 text-sm text-stone-400">
          <p className="text-stone-300">L'application fonctionne très bien sans jeton.</p>
          <p className="mt-2">Avec un jeton, vous obtenez en plus :</p>
          <ul className="mt-1 list-disc pl-5">
            <li>les images des pochettes dans les résultats de recherche</li>
            <li>des recherches plus rapides quand vous en enchaînez beaucoup</li>
          </ul>
          <p className="mt-2">
            Les valeurs en dollars canadiens sont exactes dans les deux cas.
          </p>
          <p className="mt-2">
            Pour en créer un : <span className="text-stone-300">discogs.com/settings/developers</span>,
            bouton « Générer un jeton ».
          </p>
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-amber-500 p-4 text-base font-semibold text-stone-900"
        >
          Enregistrer
        </button>

        {enregistre && <p className="text-center text-sm text-green-400">Enregistré.</p>}
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Ajouter la route dans `src/App.tsx`**

Ajouter l'import et la route, en conservant les quatre existantes :

```tsx
import ReglagesEcran from './ecrans/ReglagesEcran';
```

```tsx
        <Route path="/reglages" element={<ReglagesEcran />} />
```

- [ ] **Step 3: Ajouter l'accès aux Réglages depuis la liste**

Dans `src/ecrans/ListeEcran.tsx`, remplacer le bloc du titre :

```tsx
        <div className="flex items-baseline justify-between px-4 pt-4">
          <h1 className="text-xl font-semibold">Ma collection</h1>
          <span className="text-sm text-stone-400">
            {disques.length} {disques.length > 1 ? 'disques' : 'disque'}
          </span>
        </div>
```

par :

```tsx
        <div className="flex items-baseline justify-between px-4 pt-4">
          <h1 className="text-xl font-semibold">Ma collection</h1>
          <span className="flex items-baseline gap-3">
            <span className="text-sm text-stone-400">
              {disques.length} {disques.length > 1 ? 'disques' : 'disque'}
            </span>
            <Link to="/reglages" aria-label="Réglages" className="text-sm text-amber-500">
              Réglages
            </Link>
          </span>
        </div>
```

- [ ] **Step 4: Vérifier la compilation**

Run: `npm run build && npm test`
Expected: build propre, `63 passed`

- [ ] **Step 5: Commit**

```bash
git add src/ecrans/ReglagesEcran.tsx src/App.tsx src/ecrans/ListeEcran.tsx
git commit -m "feat: ajouter l'ecran Reglages pour le jeton Discogs"
```

---

## Task 7: Écran de recherche et sélection du pressage

C'est l'écran central du projet : c'est là que se joue l'exactitude de la valeur estimée,
puisque deux pressages du même album peuvent valoir dix fois moins l'un que l'autre.

**Files:**
- Create: `src/composants/CartePressage.tsx`
- Create: `src/ecrans/RechercheEcran.tsx`
- Create: `src/ecrans/ChoixAjoutEcran.tsx`
- Modify: `src/App.tsx`
- Modify: `src/ecrans/ListeEcran.tsx`

- [ ] **Step 1: Créer `src/composants/CartePressage.tsx`**

Le n° de catalogue est mis en évidence : c'est la valeur imprimée sur le disque physique
qui permet de confirmer qu'on a le bon pressage.

```tsx
import type { Pressage } from '../discogs/types';

interface Props {
  pressage: Pressage;
  onChoisir: (pressage: Pressage) => void;
}

export default function CartePressage({ pressage, onChoisir }: Props) {
  return (
    <button
      type="button"
      onClick={() => onChoisir(pressage)}
      className="flex w-full items-center gap-3 border-b border-stone-800 p-4 text-left active:bg-stone-800"
    >
      {pressage.vignette !== null && (
        <img src={pressage.vignette} alt="" className="h-14 w-14 shrink-0 rounded object-cover" />
      )}

      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{pressage.titre}</span>
        <span className="block text-sm text-stone-400">
          {[pressage.annee, pressage.pays, pressage.label, pressage.format]
            .filter((x) => x !== null && x !== '')
            .join(' · ')}
        </span>
        {pressage.noCatalogue !== '' && (
          <span className="mt-1 block font-mono text-sm text-amber-500">
            {pressage.noCatalogue}
          </span>
        )}
      </span>
    </button>
  );
}
```

- [ ] **Step 2: Créer `src/ecrans/RechercheEcran.tsx`**

```tsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import CartePressage from '../composants/CartePressage';
import { chercher, obtenirFiche, obtenirPrix } from '../discogs/api';
import { ErreurDiscogs } from '../discogs/client';
import type { Pressage } from '../discogs/types';

export default function RechercheEcran() {
  const navigate = useNavigate();
  const [requete, setRequete] = useState('');
  const [pressages, setPressages] = useState<Pressage[] | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function lancerRecherche(evenement: React.FormEvent) {
    evenement.preventDefault();
    if (requete.trim() === '') return;
    setEnCours(true);
    setErreur(null);
    try {
      setPressages(await chercher(requete));
    } catch (e) {
      setErreur(e instanceof ErreurDiscogs ? e.message : 'Une erreur est survenue.');
      setPressages(null);
    } finally {
      setEnCours(false);
    }
  }

  /**
   * Deux requêtes : la fiche donne artiste et album séparés et un label propre,
   * le prix vient de l'endpoint marché, seul à respecter la devise.
   */
  async function choisir(pressage: Pressage) {
    setEnCours(true);
    setErreur(null);
    try {
      const champs = await obtenirFiche(pressage.releaseId);
      const prix = await obtenirPrix(pressage.releaseId);
      navigate('/ajouter', {
        state: {
          ...champs,
          valeurEstimee: prix.valeur,
          discogsNumForSale: prix.nombreEnVente,
        },
      });
    } catch (e) {
      setErreur(e instanceof ErreurDiscogs ? e.message : 'Une erreur est survenue.');
      setEnCours(false);
    }
  }

  return (
    <div className="p-4 pt-[calc(1rem+env(safe-area-inset-top))]">
      <Link to="/ajouter-choix" className="text-sm text-amber-500">← Retour</Link>
      <h1 className="mt-3 text-xl font-semibold">Chercher un disque</h1>

      <form onSubmit={lancerRecherche} className="mt-4 flex gap-2">
        <input
          type="search"
          value={requete}
          onChange={(e) => setRequete(e.target.value)}
          placeholder="Ex. : Harmonium Heptade"
          className="min-w-0 flex-1 rounded-lg bg-stone-800 p-3 text-base"
        />
        <button
          type="submit"
          className="rounded-lg bg-amber-500 px-5 text-base font-semibold text-stone-900"
        >
          Chercher
        </button>
      </form>

      {enCours && <p className="mt-8 text-center text-stone-500">Recherche en cours…</p>}

      {erreur !== null && (
        <p className="mt-6 rounded-lg border border-red-900 p-4 text-sm text-red-400">{erreur}</p>
      )}

      {!enCours && pressages !== null && pressages.length === 0 && (
        <div className="mt-8 text-center text-stone-500">
          <p>Aucun disque trouvé.</p>
          <p className="mt-2 text-sm">
            Essayez avec moins de mots, ou{' '}
            <Link to="/ajouter" className="text-amber-500">saisissez-le à la main</Link>.
          </p>
        </div>
      )}

      {!enCours && pressages !== null && pressages.length > 0 && (
        <>
          <p className="mt-6 text-sm text-stone-400">
            Plusieurs pressages du même album peuvent avoir des valeurs très différentes.
            Comparez le numéro en orange avec celui imprimé sur votre disque ou sa pochette.
          </p>
          <ul className="mt-2 pb-8">
            {pressages.map((pressage) => (
              <li key={pressage.releaseId}>
                <CartePressage pressage={pressage} onChoisir={choisir} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Créer `src/ecrans/ChoixAjoutEcran.tsx`**

```tsx
import { Link } from 'react-router';

export default function ChoixAjoutEcran() {
  return (
    <div className="p-4 pt-[calc(1rem+env(safe-area-inset-top))]">
      <Link to="/" className="text-sm text-amber-500">← Retour à la collection</Link>
      <h1 className="mt-3 text-xl font-semibold">Ajouter un disque</h1>

      <div className="mt-8 space-y-4">
        <Link
          to="/chercher"
          className="block rounded-lg bg-amber-500 p-5 text-center text-stone-900"
        >
          <span className="block text-lg font-semibold">Chercher sur Discogs</span>
          <span className="mt-1 block text-sm">
            Remplit le label, le pays, l'année et la valeur à votre place
          </span>
        </Link>

        <Link to="/ajouter" className="block rounded-lg bg-stone-800 p-5 text-center">
          <span className="block text-lg font-semibold">Saisir à la main</span>
          <span className="mt-1 block text-sm text-stone-400">
            Pour un disque introuvable sur Discogs
          </span>
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Ajouter les routes dans `src/App.tsx`**

```tsx
import ChoixAjoutEcran from './ecrans/ChoixAjoutEcran';
import RechercheEcran from './ecrans/RechercheEcran';
```

```tsx
        <Route path="/ajouter-choix" element={<ChoixAjoutEcran />} />
        <Route path="/chercher" element={<RechercheEcran />} />
```

- [ ] **Step 5: Faire pointer le bouton « + » vers l'écran de choix**

Dans `src/ecrans/ListeEcran.tsx`, remplacer `to="/ajouter"` par `to="/ajouter-choix"`
dans le lien flottant (celui portant `aria-label="Ajouter un disque"`).

- [ ] **Step 6: Vérifier la compilation**

Run: `npm run build && npm test`
Expected: build propre, `63 passed`

- [ ] **Step 7: Commit**

```bash
git add src/composants/CartePressage.tsx src/ecrans/RechercheEcran.tsx src/ecrans/ChoixAjoutEcran.tsx src/App.tsx src/ecrans/ListeEcran.tsx
git commit -m "feat: chercher un disque sur Discogs et choisir son pressage"
```

---

## Task 8: Préremplissage du formulaire

**Files:**
- Modify: `src/ecrans/FormulaireEcran.tsx`

- [ ] **Step 1: Lire l'état de navigation au montage**

Dans `src/ecrans/FormulaireEcran.tsx`, ajouter `useLocation` à l'import de `react-router` :

```tsx
import { useLocation, useNavigate, useParams } from 'react-router';
```

Puis, juste après `const modeEdition = id !== undefined;`, remplacer l'initialisation de
l'état par :

```tsx
  const location = useLocation();

  /**
   * L'écran de recherche transmet les champs Discogs par l'état de navigation plutôt que
   * par l'URL : ils sont trop nombreux et contiennent des apostrophes et des accents.
   */
  const preremplissage = (location.state ?? null) as Partial<NouveauDisque> | null;

  const [disque, setDisque] = useState<NouveauDisque>(
    preremplissage === null
      ? DISQUE_VIDE
      : { ...DISQUE_VIDE, ...preremplissage, valeurSource: 'discogs', valeurMaj: new Date() },
  );
```

- [ ] **Step 2: Signaler visuellement ce qui vient de Discogs**

Juste sous le `<h1>` du formulaire, ajouter :

```tsx
      {preremplissage !== null && (
        <p className="rounded-lg bg-stone-800 p-3 text-sm text-stone-400">
          Rempli depuis Discogs. Vérifiez, puis indiquez l'état du disque et de la pochette.
        </p>
      )}
```

- [ ] **Step 3: Vérifier la compilation**

Run: `npm run build && npm test`
Expected: build propre, `63 passed`

- [ ] **Step 4: Vérification manuelle du parcours complet**

```bash
npm run dev
```

Sur `http://localhost:5173/` en mode appareil mobile :

1. Le « + » ouvre l'écran de choix
2. « Chercher sur Discogs » puis taper `Harmonium Heptade` retourne plusieurs pressages
3. Chaque résultat affiche un n° de catalogue en orange, et ils diffèrent entre eux
4. Choisir le pressage canadien de 1976 (`PGF 90348`) ouvre le formulaire prérempli
5. Artiste vaut `Harmonium`, album `L'Heptade`, label `CBS`, pays `Canada`, année `1976`,
   format `2xLP`
6. La valeur estimée est remplie et **plausible en dollars canadiens**
7. Enregistrer, puis vérifier sur la fiche que le n° de catalogue est bien `PGF 90348`

- [ ] **Step 5: Commit**

```bash
git add src/ecrans/FormulaireEcran.tsx
git commit -m "feat: preremplir le formulaire depuis le pressage choisi"
```

---

## Task 9: Rafraîchir le prix d'un disque

**Files:**
- Modify: `src/ecrans/FicheEcran.tsx`

- [ ] **Step 1: Ajouter le bouton et son traitement**

Dans `src/ecrans/FicheEcran.tsx`, ajouter les imports :

```tsx
import { useState } from 'react';
import { modifierDisque, obtenirDisque, supprimerDisque } from '../db/disques';
import { obtenirPrix } from '../discogs/api';
import { ErreurDiscogs } from '../discogs/client';
```

Ajouter l'état et la fonction, juste avant `const lignes` :

```tsx
  const [messagePrix, setMessagePrix] = useState<string | null>(null);

  async function rafraichirPrix() {
    setMessagePrix('Consultation de Discogs…');
    try {
      const prix = await obtenirPrix(disque!.discogsReleaseId!);
      if (prix.valeur === null) {
        setMessagePrix('Aucun exemplaire en vente en ce moment — valeur inchangée.');
        return;
      }
      await modifierDisque(Number(id), {
        valeurEstimee: prix.valeur,
        valeurSource: 'discogs',
        valeurMaj: new Date(),
        discogsNumForSale: prix.nombreEnVente,
      });
      setMessagePrix('Valeur mise à jour.');
    } catch (e) {
      setMessagePrix(e instanceof ErreurDiscogs ? e.message : 'Une erreur est survenue.');
    }
  }
```

Le `useState` doit être déclaré **avant** les deux `return` conditionnels de chargement,
sinon React lève une erreur d'ordre des hooks. Déplacer les gardes `if (disque === undefined)`
et `if (disque === null)` juste après cette déclaration.

- [ ] **Step 2: Afficher le bouton, seulement pour un disque issu de Discogs**

Juste avant le bloc des boutons Supprimer/Modifier :

```tsx
      {disque.discogsReleaseId !== null && (
        <div className="mt-6">
          <button
            type="button"
            onClick={rafraichirPrix}
            className="w-full rounded-lg bg-stone-800 p-4 text-base"
          >
            Rafraîchir la valeur depuis Discogs
          </button>
          {messagePrix !== null && (
            <p className="mt-2 text-center text-sm text-stone-400">{messagePrix}</p>
          )}
        </div>
      )}
```

- [ ] **Step 3: Afficher la date de la dernière mise à jour du prix**

Dans le tableau `lignes`, remplacer la ligne de la valeur estimée par :

```tsx
    ['Valeur estimée', disque.valeurEstimee === null
      ? '—'
      : formaterCAD(disque.valeurEstimee)
        + (disque.valeurMaj === null
          ? ''
          : ` (${disque.valeurSource === 'discogs' ? 'Discogs' : 'saisie'}, `
            + `${disque.valeurMaj.toLocaleDateString('fr-CA')})`)],
```

- [ ] **Step 4: Vérifier la compilation et le comportement**

Run: `npm run build && npm test`
Expected: build propre, `63 passed`

Puis, avec `npm run dev`, sur un disque ajouté depuis Discogs : le bouton apparaît, le
rafraîchissement met à jour la valeur et la date. Sur un disque saisi à la main, le bouton
est absent.

- [ ] **Step 5: Commit**

```bash
git add src/ecrans/FicheEcran.tsx
git commit -m "feat: rafraichir la valeur d'un disque depuis Discogs"
```

---

## Task 10: Vérification de bout en bout et mise en ligne

**Files:**
- Modify: `scripts/verifier-app.py`

- [ ] **Step 1: Étendre le script de vérification**

Ajouter à `scripts/verifier-app.py`, juste avant le bloc `verifier(11, …)` sur les erreurs
de console. Ce parcours appelle la vraie API Discogs, donc il est plus lent et dépend du
réseau.

```python
    # 12. Parcours Discogs complet
    page.goto(BASE + "/")
    page.wait_for_selector("h1:has-text('Ma collection')")
    page.click("a[aria-label='Ajouter un disque']")
    page.wait_for_selector("h1:has-text('Ajouter un disque')")
    page.click("text=Chercher sur Discogs")
    page.wait_for_selector("h1:has-text('Chercher un disque')")
    page.fill("input[type=search]", "Harmonium Heptade")
    page.click("button[type=submit]")
    page.wait_for_selector("li button", timeout=20000)

    catalogues = page.locator("li button span.font-mono").all_inner_texts()
    verifier(12, "La recherche Discogs retourne plusieurs pressages distincts",
             len(catalogues) >= 2 and len(set(catalogues)) >= 2,
             f"(n° de catalogue : {catalogues[:4]})")
    page.screenshot(path=f"{SORTIE}/08-pressages.png", full_page=True)

    page.locator("li button").first.click()
    page.wait_for_selector("h1:has-text('Nouveau disque')", timeout=20000)
    page.wait_for_selector("text=Rempli depuis Discogs")

    def valeur_champ(etiquette):
        return page.locator(f"label:has-text('{etiquette}') input").first.input_value()

    rempli = {e: valeur_champ(e) for e in
              ["Artiste", "Album", "N° de catalogue", "Pays", "Année"]}
    verifier(13, "Le formulaire est prérempli depuis Discogs",
             all(v.strip() != "" for v in rempli.values()), f"({rempli})")
    page.screenshot(path=f"{SORTIE}/09-preremplissage.png", full_page=True)
```

- [ ] **Step 2: Lancer la vérification complète**

```bash
npm run dev
python scripts/verifier-app.py
```

Expected: `14/14 verifications reussies`

- [ ] **Step 3: Commit et mise en ligne**

Le push sur `main` déclenche automatiquement le déploiement en production.

```bash
git add scripts/verifier-app.py
git commit -m "test: couvrir le parcours de recherche Discogs"
git push origin main
```

- [ ] **Step 4: Vérifier la production**

```bash
BASE_URL=https://catalogue-disques.vercel.app python scripts/verifier-app.py
```

Expected: `14/14 verifications reussies`

---

## Ce qui suit

| Plan | Contenu |
|---|---|
| Phase 2B | Rafraîchissement des prix en lot, avec file d'attente throttlée (1 req/2,5 s sans jeton, 1/1,1 s avec), barre de progression et annulation |
| Phase 3 | Sauvegarde et restauration JSON, export CSV, texte d'annonce, bandeau de rappel |
| Phase 4 | Scan de code-barres avec zxing-wasm — l'accès caméra a été validé en phase 0 |

## Hors scope de ce plan

- Le rafraîchissement en lot des 200 disques (phase 2B) — ce plan ne rafraîchit qu'un
  disque à la fois, à la demande.
- `/marketplace/price_suggestions/`, qui donnerait un prix par état de conservation.
  Il exige que le compte Discogs ait rempli ses réglages vendeur. À reconsidérer si ça
  devient le cas.
- Toute mise en cache des réponses Discogs.
