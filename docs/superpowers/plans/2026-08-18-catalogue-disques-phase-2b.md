# Catalogue de disques — Plan d'implémentation, phase 2B (rafraîchir les prix en lot)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remettre à jour d'un seul geste la valeur marchande de toute la collection, sans se faire couper par Discogs, en pouvant suivre l'avancement et l'annuler.

**Architecture :** Une file d'attente cadencée générique et **pure** dans `src/lib/file-attente.ts`, qui ne connaît ni Discogs ni la base. Un orchestrateur `src/discogs/rafraichir.ts` qui reçoit ses dépendances en paramètre, donc testable sans réseau ni base. L'écran Réglages ne fait que brancher les deux et afficher la progression.

**Tech Stack :** inchangé. Aucune dépendance nouvelle.

**Spec :** [design](../specs/2026-08-18-catalogue-disques-design.md) · **Plans précédents :** [phases 0-1](2026-08-18-catalogue-disques-phases-0-1.md), [phase 2](2026-08-18-catalogue-disques-phase-2.md) — livrées et en production.

---

## Contraintes mesurées

- **Cadence Discogs : 25 requêtes/minute sans jeton, 60 avec** (en-tête `x-discogs-ratelimit`,
  les deux valeurs observées le 2026-08-18). Un dépassement renvoie `429`. D'où
  **2 500 ms** entre deux appels sans jeton et **1 100 ms** avec — une marge volontaire
  sous la limite théorique de 2 400 / 1 000 ms.
- Sur 200 disques : environ **8 minutes** sans jeton, **3 minutes 40** avec. L'écran doit
  donc afficher une progression et permettre d'annuler ; l'utilisatrice ne va pas
  regarder son téléphone huit minutes sans savoir où ça en est.
- Le prix vient de `/marketplace/stats/{id}?curr_abbr=CAD`, et `prixCAD` refuse déjà
  toute valeur qui ne serait pas en dollars canadiens.

## Deux règles métier

1. **Ne jamais écraser une valeur saisie à la main.** Un disque dont `valeurSource` vaut
   `'manuelle'` est exclu du lot. C'est la raison d'être de ce champ.
2. **Ne pas effacer une valeur connue quand Discogs n'en a plus.** Si plus aucun
   exemplaire n'est en vente, `prixCAD` renvoie `null` : on laisse alors la valeur
   précédente en place et on compte le disque comme « sans prix », plutôt que de vider
   une estimation qui reste la meilleure information disponible.

## Structure de fichiers

| Fichier | Responsabilité |
|---|---|
| `src/lib/file-attente.ts` | Cadencer un traitement sur une liste. Pur, générique, sans notion de Discogs. |
| `src/discogs/rafraichir.ts` | Choisir les disques éligibles, l'intervalle, et orchestrer. Dépendances injectées. |
| `src/ecrans/ReglagesEcran.tsx` | *(modifié)* Bouton, barre de progression, annulation. |

---

## Task 1: File d'attente cadencée

**Files:** Create `src/lib/file-attente.ts`, Create `src/lib/file-attente.test.ts`

- [ ] **Step 1: Écrire les tests qui échouent**

L'attente est **injectée** plutôt que d'utiliser `setTimeout` : les tests deviennent
instantanés et déterministes, sans faux timers ni course.

Create `src/lib/file-attente.test.ts` :

```ts
import { describe, expect, test, vi } from 'vitest';
import { traiterEnFile } from './file-attente';

/** Remplace l'attente réelle : ne dort pas, note simplement les durées demandées. */
function attenteFactice() {
  const durees: number[] = [];
  return {
    durees,
    attendre: async (ms: number) => { durees.push(ms); },
  };
}

describe('traiterEnFile', () => {
  test('ne fait rien sur une liste vide', async () => {
    const faux = attenteFactice();
    const traiter = vi.fn();

    const p = await traiterEnFile([], traiter, { intervalleMs: 100, attendre: faux.attendre });

    expect(traiter).not.toHaveBeenCalled();
    expect(p).toEqual({ total: 0, traites: 0, echecs: 0 });
  });

  test('traite chaque élément, dans l\'ordre', async () => {
    const vus: number[] = [];
    const faux = attenteFactice();

    await traiterEnFile([1, 2, 3], async (n) => { vus.push(n); },
      { intervalleMs: 100, attendre: faux.attendre });

    expect(vus).toEqual([1, 2, 3]);
  });

  test('attend entre les éléments, mais jamais avant le premier', async () => {
    const faux = attenteFactice();

    await traiterEnFile([1, 2, 3], async () => {},
      { intervalleMs: 2500, attendre: faux.attendre });

    // 3 éléments -> 2 attentes seulement
    expect(faux.durees).toEqual([2500, 2500]);
  });

  test('poursuit malgré un échec et le compte', async () => {
    const faux = attenteFactice();

    const p = await traiterEnFile([1, 2, 3], async (n) => {
      if (n === 2) throw new Error('boum');
    }, { intervalleMs: 100, attendre: faux.attendre });

    expect(p).toEqual({ total: 3, traites: 2, echecs: 1 });
  });

  test('rapporte la progression après chaque élément', async () => {
    const faux = attenteFactice();
    const etapes: number[] = [];

    await traiterEnFile([1, 2, 3], async () => {}, {
      intervalleMs: 100,
      attendre: faux.attendre,
      surProgression: (p) => etapes.push(p.traites),
    });

    expect(etapes).toEqual([1, 2, 3]);
  });

  test('s\'arrête dès que l\'annulation est demandée', async () => {
    const faux = attenteFactice();
    const controleur = new AbortController();
    const vus: number[] = [];

    const p = await traiterEnFile([1, 2, 3, 4], async (n) => {
      vus.push(n);
      if (n === 2) controleur.abort();
    }, { intervalleMs: 100, attendre: faux.attendre, signal: controleur.signal });

    expect(vus).toEqual([1, 2]);
    expect(p.traites).toBe(2);
    expect(p.total).toBe(4);
  });

  test('n\'appelle rien si l\'annulation précède le démarrage', async () => {
    const controleur = new AbortController();
    controleur.abort();
    const traiter = vi.fn();

    await traiterEnFile([1, 2], traiter,
      { intervalleMs: 100, attendre: attenteFactice().attendre, signal: controleur.signal });

    expect(traiter).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npm test`
Expected: FAIL, impossible de résoudre `./file-attente`

- [ ] **Step 3: Écrire `src/lib/file-attente.ts`**

```ts
export interface Progression {
  total: number;
  traites: number;
  echecs: number;
}

export interface OptionsFile {
  /** Délai entre deux traitements, pour rester sous la cadence autorisée. */
  intervalleMs: number;
  signal?: AbortSignal;
  surProgression?: (progression: Progression) => void;
  /** Injectable : les tests passent une attente instantanée. */
  attendre?: (ms: number) => Promise<void>;
}

const attenteReelle = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Applique `traiter` à chaque élément en espaçant les appels.
 *
 * Un échec sur un élément n'interrompt pas le lot : sur 200 disques, un seul disparu
 * de Discogs ne doit pas priver les 199 autres de leur mise à jour.
 */
export async function traiterEnFile<T>(
  elements: readonly T[],
  traiter: (element: T) => Promise<void>,
  options: OptionsFile,
): Promise<Progression> {
  const attendre = options.attendre ?? attenteReelle;
  const progression: Progression = { total: elements.length, traites: 0, echecs: 0 };

  for (let i = 0; i < elements.length; i += 1) {
    if (options.signal?.aborted === true) break;

    // Pas d'attente avant le premier : le lot doit démarrer immédiatement.
    if (i > 0) await attendre(options.intervalleMs);

    try {
      await traiter(elements[i]);
      progression.traites += 1;
    } catch {
      progression.echecs += 1;
    }

    options.surProgression?.({ ...progression });
  }

  return progression;
}
```

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `npm test`
Expected: PASS, `70 passed`

- [ ] **Step 5: Commit**

```bash
git add src/lib/file-attente.ts src/lib/file-attente.test.ts
git commit -m "feat: ajouter une file d'attente cadencee"
```

---

## Task 2: Éligibilité et cadence

**Files:** Create `src/discogs/rafraichir.ts`, Create `src/discogs/rafraichir.test.ts`

- [ ] **Step 1: Écrire les tests qui échouent**

Create `src/discogs/rafraichir.test.ts` :

```ts
import { describe, expect, test } from 'vitest';
import { disquesRafraichissables, intervalleRecommande } from './rafraichir';
import { DISQUE_VIDE, type Disque } from '../db/schema';

function disque(champs: Partial<Disque>): Disque {
  return { ...DISQUE_VIDE, id: 1, dateAjout: new Date(), dateModif: new Date(), ...champs };
}

describe('intervalleRecommande', () => {
  test('espace davantage sans jeton, la cadence anonyme étant plus basse', () => {
    expect(intervalleRecommande(false)).toBe(2500);
  });

  test('accélère avec un jeton', () => {
    expect(intervalleRecommande(true)).toBe(1100);
  });

  test('reste sous la cadence autorisée dans les deux cas', () => {
    // 25 req/min sans jeton, 60 avec : l'intervalle doit dépasser 60000/limite.
    expect(intervalleRecommande(false)).toBeGreaterThan(60000 / 25);
    expect(intervalleRecommande(true)).toBeGreaterThan(60000 / 60);
  });
});

describe('disquesRafraichissables', () => {
  test('retient un disque venu de Discogs', () => {
    const collection = [disque({ id: 1, discogsReleaseId: 123, valeurSource: 'discogs' })];
    expect(disquesRafraichissables(collection).map((d) => d.id)).toEqual([1]);
  });

  test('écarte un disque saisi à la main, faute d\'identifiant Discogs', () => {
    const collection = [disque({ id: 2, discogsReleaseId: null, valeurSource: 'manuelle' })];
    expect(disquesRafraichissables(collection)).toEqual([]);
  });

  test('PRÉSERVE une valeur saisie à la main, même sur un disque venu de Discogs', () => {
    const collection = [disque({ id: 3, discogsReleaseId: 123, valeurSource: 'manuelle' })];
    expect(disquesRafraichissables(collection)).toEqual([]);
  });

  test('ne retient que les éligibles dans une collection mêlée', () => {
    const collection = [
      disque({ id: 1, discogsReleaseId: 111, valeurSource: 'discogs' }),
      disque({ id: 2, discogsReleaseId: null, valeurSource: 'manuelle' }),
      disque({ id: 3, discogsReleaseId: 333, valeurSource: 'manuelle' }),
      disque({ id: 4, discogsReleaseId: 444, valeurSource: 'discogs' }),
    ];
    expect(disquesRafraichissables(collection).map((d) => d.id)).toEqual([1, 4]);
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npm test`
Expected: FAIL, impossible de résoudre `./rafraichir`

- [ ] **Step 3: Écrire `src/discogs/rafraichir.ts`**

```ts
import type { Disque } from '../db/schema';

/**
 * Cadence mesurée sur l'API : 25 requêtes/minute en anonyme, 60 avec un jeton.
 * On garde une marge sous la limite théorique (2 400 / 1 000 ms) pour absorber
 * les variations de latence sans déclencher de 429.
 */
export function intervalleRecommande(aUnJeton: boolean): number {
  return aUnJeton ? 1100 : 2500;
}

/**
 * Un disque est rafraîchissable s'il vient de Discogs ET si sa valeur n'a pas été
 * saisie à la main. La seconde condition est la raison d'être de `valeurSource` :
 * une estimation corrigée manuellement ne doit jamais être écrasée par un lot.
 */
export function disquesRafraichissables(disques: readonly Disque[]): Disque[] {
  return disques.filter(
    (d) => d.discogsReleaseId !== null && d.valeurSource !== 'manuelle',
  );
}
```

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `npm test`
Expected: PASS, `77 passed`

- [ ] **Step 5: Commit**

```bash
git add src/discogs/rafraichir.ts src/discogs/rafraichir.test.ts
git commit -m "feat: choisir les disques rafraichissables et la cadence"
```

---

## Task 3: Orchestrateur du rafraîchissement

**Files:** Modify `src/discogs/rafraichir.ts`, Modify `src/discogs/rafraichir.test.ts`

- [ ] **Step 1: Ajouter les tests qui échouent**

Les dépendances sont injectées : le test n'a besoin ni de réseau ni de base. Ajouter à
`src/discogs/rafraichir.test.ts`, en fusionnant les imports avec ceux déjà en tête de
fichier plutôt qu'en ajoutant des `import` au milieu :

```ts
import { rafraichirValeurs } from './rafraichir';

/** Dépendances factices : mémorisent ce qui aurait été écrit en base. */
function dependancesFactices(prixParRelease: Record<number, number | null>) {
  const ecritures: { id: number; valeur: number | null }[] = [];
  return {
    ecritures,
    deps: {
      obtenirPrix: async (releaseId: number) => ({
        valeur: prixParRelease[releaseId] ?? null,
        nombreEnVente: 1,
      }),
      modifierDisque: async (id: number, champs: { valeurEstimee?: number | null }) => {
        ecritures.push({ id, valeur: champs.valeurEstimee ?? null });
      },
    },
  };
}

const SANS_ATTENTE = { intervalleMs: 0, attendre: async () => {} };

describe('rafraichirValeurs', () => {
  test('écrit la nouvelle valeur de chaque disque éligible', async () => {
    const collection = [
      disque({ id: 1, discogsReleaseId: 111, valeurSource: 'discogs' }),
      disque({ id: 2, discogsReleaseId: 222, valeurSource: 'discogs' }),
    ];
    const f = dependancesFactices({ 111: 10, 222: 25.5 });

    const p = await rafraichirValeurs(collection, f.deps, SANS_ATTENTE);

    expect(f.ecritures).toEqual([{ id: 1, valeur: 10 }, { id: 2, valeur: 25.5 }]);
    expect(p.traites).toBe(2);
  });

  test('ignore les disques non éligibles sans même les compter', async () => {
    const collection = [
      disque({ id: 1, discogsReleaseId: 111, valeurSource: 'discogs' }),
      disque({ id: 2, discogsReleaseId: null, valeurSource: 'manuelle' }),
    ];
    const f = dependancesFactices({ 111: 10 });

    const p = await rafraichirValeurs(collection, f.deps, SANS_ATTENTE);

    expect(p.total).toBe(1);
    expect(f.ecritures).toHaveLength(1);
  });

  test('N\'EFFACE PAS une valeur connue quand Discogs n\'a plus de prix', async () => {
    const collection = [
      disque({ id: 1, discogsReleaseId: 111, valeurSource: 'discogs', valeurEstimee: 40 }),
    ];
    const f = dependancesFactices({ 111: null });

    const p = await rafraichirValeurs(collection, f.deps, SANS_ATTENTE);

    expect(f.ecritures).toEqual([]);
    expect(p.sansPrix).toBe(1);
    expect(p.traites).toBe(1);
  });

  test('compte un échec réseau sans interrompre le lot', async () => {
    const collection = [
      disque({ id: 1, discogsReleaseId: 111, valeurSource: 'discogs' }),
      disque({ id: 2, discogsReleaseId: 222, valeurSource: 'discogs' }),
    ];
    const deps = {
      obtenirPrix: async (releaseId: number) => {
        if (releaseId === 111) throw new Error('reseau');
        return { valeur: 5, nombreEnVente: 1 };
      },
      modifierDisque: async () => {},
    };

    const p = await rafraichirValeurs(collection, deps, SANS_ATTENTE);

    expect(p.echecs).toBe(1);
    expect(p.traites).toBe(1);
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npm test`
Expected: FAIL, `rafraichirValeurs` n'est pas exporté

- [ ] **Step 3: Compléter `src/discogs/rafraichir.ts`**

Ajouter à la fin, en fusionnant les imports en tête de fichier :

```ts
import { traiterEnFile, type OptionsFile, type Progression } from '../lib/file-attente';

/** Ce que l'orchestrateur a besoin de savoir faire, injecté pour rester testable. */
export interface DependancesRafraichissement {
  obtenirPrix: (releaseId: number) => Promise<{ valeur: number | null; nombreEnVente: number | null }>;
  modifierDisque: (
    id: number,
    champs: { valeurEstimee: number | null; valeurSource: 'discogs'; valeurMaj: Date; discogsNumForSale: number | null },
  ) => Promise<void>;
}

export interface ProgressionRafraichissement extends Progression {
  /** Disques consultés avec succès mais dont plus aucun exemplaire n'est en vente. */
  sansPrix: number;
}

export async function rafraichirValeurs(
  disques: readonly Disque[],
  deps: DependancesRafraichissement,
  options: OptionsFile,
): Promise<ProgressionRafraichissement> {
  const eligibles = disquesRafraichissables(disques);
  let sansPrix = 0;

  const progression = await traiterEnFile(eligibles, async (d) => {
    const prix = await deps.obtenirPrix(d.discogsReleaseId as number);

    // Discogs ne connaît plus de prix : on garde l'ancienne estimation, qui reste
    // la meilleure information disponible, plutôt que de la remplacer par du vide.
    if (prix.valeur === null) {
      sansPrix += 1;
      return;
    }

    await deps.modifierDisque(d.id, {
      valeurEstimee: prix.valeur,
      valeurSource: 'discogs',
      valeurMaj: new Date(),
      discogsNumForSale: prix.nombreEnVente,
    });
  }, options);

  return { ...progression, sansPrix };
}
```

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `npm test`
Expected: PASS, `81 passed`

- [ ] **Step 5: Commit**

```bash
git add src/discogs/rafraichir.ts src/discogs/rafraichir.test.ts
git commit -m "feat: orchestrer le rafraichissement des valeurs en lot"
```

---

## Task 4: Le rafraîchissement dans l'écran Réglages

**Files:** Modify `src/ecrans/ReglagesEcran.tsx`

- [ ] **Step 1: Brancher le rafraîchissement**

Remplacer le contenu de `src/ecrans/ReglagesEcran.tsx` par :

```tsx
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { listerDisques, modifierDisque } from '../db/disques';
import { obtenirPrix } from '../discogs/api';
import {
  disquesRafraichissables,
  intervalleRecommande,
  rafraichirValeurs,
  type ProgressionRafraichissement,
} from '../discogs/rafraichir';
import { effacerJeton, enregistrerJeton, lireJeton } from '../reglages';

export default function ReglagesEcran() {
  const [jeton, setJeton] = useState(lireJeton() ?? '');
  const [enregistre, setEnregistre] = useState(false);

  const [progression, setProgression] = useState<ProgressionRafraichissement | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [bilan, setBilan] = useState<string | null>(null);
  const controleur = useRef<AbortController | null>(null);

  function soumettre(evenement: React.FormEvent) {
    evenement.preventDefault();
    if (jeton.trim() === '') effacerJeton();
    else enregistrerJeton(jeton);
    setEnregistre(true);
  }

  async function lancerRafraichissement() {
    const disques = await listerDisques();
    const eligibles = disquesRafraichissables(disques);

    if (eligibles.length === 0) {
      setBilan('Aucun disque à rafraîchir : ils ont tous une valeur saisie à la main, '
        + 'ou n\'ont pas été trouvés sur Discogs.');
      return;
    }

    controleur.current = new AbortController();
    setEnCours(true);
    setBilan(null);
    setProgression({ total: eligibles.length, traites: 0, echecs: 0, sansPrix: 0 });

    const resultat = await rafraichirValeurs(
      disques,
      { obtenirPrix, modifierDisque },
      {
        intervalleMs: intervalleRecommande(lireJeton() !== null),
        signal: controleur.current.signal,
        surProgression: (p) => setProgression((avant) =>
          ({ ...p, sansPrix: avant?.sansPrix ?? 0 })),
      },
    );

    setEnCours(false);
    setProgression(null);
    setBilan(
      `${resultat.traites} disque${resultat.traites > 1 ? 's' : ''} sur ${resultat.total} consulté`
      + `${resultat.traites > 1 ? 's' : ''}.`
      + (resultat.sansPrix > 0 ? ` ${resultat.sansPrix} sans exemplaire en vente.` : '')
      + (resultat.echecs > 0 ? ` ${resultat.echecs} en erreur.` : ''),
    );
  }

  const dureeEstimee = (nombre: number) =>
    Math.ceil((nombre * intervalleRecommande(lireJeton() !== null)) / 60000);

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
            <li>une mise à jour des valeurs deux fois plus rapide</li>
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

      <hr className="my-8 border-stone-800" />

      <h2 className="text-lg font-semibold">Mettre à jour les valeurs</h2>
      <p className="mt-2 text-sm text-stone-400">
        Consulte Discogs pour chaque disque et met à jour sa valeur estimée. Les valeurs
        que vous avez saisies vous-même ne sont pas touchées.
      </p>

      {!enCours && (
        <button
          type="button"
          onClick={lancerRafraichissement}
          className="mt-4 w-full rounded-lg bg-stone-800 p-4 text-base"
        >
          Rafraîchir toutes les valeurs
        </button>
      )}

      {enCours && progression !== null && (
        <div className="mt-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-stone-800">
            <div
              className="h-full bg-amber-500 transition-all"
              style={{ width: `${(progression.traites / progression.total) * 100}%` }}
            />
          </div>
          <p className="mt-2 text-center text-sm text-stone-400">
            {progression.traites} sur {progression.total} — environ{' '}
            {dureeEstimee(progression.total - progression.traites)} min restantes
          </p>
          <button
            type="button"
            onClick={() => controleur.current?.abort()}
            className="mt-3 w-full rounded-lg border border-stone-700 p-3 text-sm"
          >
            Arrêter
          </button>
        </div>
      )}

      {bilan !== null && (
        <p className="mt-4 rounded-lg bg-stone-800 p-3 text-sm text-stone-400">{bilan}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `npm run build && npm test`
Expected: build propre, `81 passed`

- [ ] **Step 3: Vérification manuelle**

```bash
npm run dev
```

1. Ajouter deux disques depuis Discogs, un troisième à la main avec une valeur inventée
2. Aller dans Réglages, toucher « Rafraîchir toutes les valeurs »
3. La barre progresse, le compteur indique `1 sur 2` puis `2 sur 2` — **le disque saisi
   à la main n'est pas compté**
4. Revenir à la collection : les deux valeurs Discogs ont une date de mise à jour du jour,
   celle saisie à la main est **inchangée**
5. Relancer et toucher « Arrêter » au milieu : le lot s'interrompt, le bilan indique
   moins de disques traités que le total

- [ ] **Step 4: Commit**

```bash
git add src/ecrans/ReglagesEcran.tsx
git commit -m "feat: rafraichir toutes les valeurs depuis les Reglages"
```

---

## Task 5: Vérification de bout en bout et mise en ligne

**Files:** Modify `scripts/verifier-app.py`

- [ ] **Step 1: Ajouter la vérification**

Ajouter dans `scripts/verifier-app.py`, juste avant le bloc `verifier(11, …)` :

```python
    # 14. Le rafraichissement en lot.
    # Le formulaire prerempli de l'etape 13 est encore ouvert et NON enregistre :
    # il faut le sauver, sinon aucun disque issu de Discogs n'existe et le lot est vide.
    page.click("button[type=submit]")
    page.wait_for_selector("text=Inventaire n°")

    page.goto(BASE + "/reglages")
    page.wait_for_selector("h1:has-text('Réglages')")
    page.click("text=Rafraîchir toutes les valeurs")
    page.wait_for_selector("text=consulté", timeout=60000)
    bilan = page.locator("p.bg-stone-800").last.inner_text()
    verifier(14, "Le rafraîchissement en lot rapporte un bilan",
             "consulté" in bilan, f"({bilan!r})")
```

- [ ] **Step 2: Lancer la vérification complète**

```bash
npm run dev
python scripts/verifier-app.py
```

Expected: `15/15 verifications reussies`

- [ ] **Step 3: Fusionner et mettre en ligne**

```bash
git add scripts/verifier-app.py
git commit -m "test: couvrir le rafraichissement en lot"
git checkout main
git merge --no-ff phase-2b
git push origin main
```

- [ ] **Step 4: Vérifier la production**

```bash
BASE_URL=https://catalogue-disques.vercel.app python scripts/verifier-app.py
```

Expected: `15/15 verifications reussies`

---

## Hors scope

- Reprendre automatiquement un lot interrompu. L'utilisatrice relance, les disques déjà
  à jour sont simplement reconsultés.
- Rafraîchir en arrière-plan quand l'app est fermée : impossible dans une PWA iOS.
- Mettre en cache les réponses Discogs.
