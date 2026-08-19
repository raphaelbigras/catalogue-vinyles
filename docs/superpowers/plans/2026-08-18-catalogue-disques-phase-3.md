# Catalogue de disques — Plan d'implémentation, phase 3 (sauvegarde et exports)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre la collection récupérable et exploitable : une sauvegarde en un geste vers Fichiers/iCloud, une restauration fidèle, un export CSV lisible dans Excel en français, et un texte d'annonce prêt à coller.

**Architecture :** Toute la sérialisation est **pure** dans `src/lib/` et testée par aller-retour ; la seule partie impure est le déclenchement de la feuille de partage iOS, isolée dans `src/lib/partage.ts`. Un compteur de modifications non sauvegardées vit dans `localStorage` et alimente un bandeau sur l'écran Liste.

**Tech Stack :** inchangé. Aucune dépendance nouvelle.

**Spec :** [design](../specs/2026-08-18-catalogue-disques-design.md) · **Plans précédents :** [phases 0-1](2026-08-18-catalogue-disques-phases-0-1.md), [phase 2](2026-08-18-catalogue-disques-phase-2.md), [phase 2B](2026-08-18-catalogue-disques-phase-2b.md) — toutes livrées et en production.

---

## Pourquoi cette phase compte plus que les autres

La collection vit **uniquement** dans le navigateur de son iPhone. Supprimer l'app de
l'écran d'accueil efface tout, et rien ne le récupère. Deux cents saisies représentent
plusieurs soirées de travail. C'est le risque assumé du choix « local et gratuit », et
cette phase en est la seule mitigation.

Le test le plus important du plan est donc l'**aller-retour** : exporter puis réimporter
doit redonner exactement la même collection. Un export qui ne se relit pas n'est pas une
sauvegarde.

## Contraintes mesurées

- **`navigator.share()` avec fichier fonctionne** sur l'iPhone cible : vérifié en phase 0,
  la feuille de partage s'ouvre et permet « Enregistrer dans Fichiers ».
- **iOS Safari n'a pas la File System Access API.** Aucune sauvegarde silencieuse n'est
  possible : l'enregistrement part forcément d'un geste de l'utilisatrice. D'où le bandeau
  de rappel plutôt qu'une sauvegarde automatique.
- **Excel en français** attend un séparateur `;` et un BOM UTF-8. Sans le BOM, les accents
  sont illisibles ; sans le `;`, tout atterrit dans une seule colonne.

## Structure de fichiers

| Fichier | Responsabilité |
|---|---|
| `src/lib/sauvegarde.ts` | Sérialiser et désérialiser la collection en JSON. Pur. |
| `src/lib/csv.ts` | Produire le CSV et le texte d'annonce. Pur. |
| `src/lib/partage.ts` | Déclencher la feuille de partage iOS, avec repli sur un téléchargement. |
| `src/lib/suivi-sauvegarde.ts` | Compter les modifications depuis la dernière sauvegarde. |
| `src/ecrans/SauvegardeEcran.tsx` | Sauvegarder, restaurer, exporter. |
| `src/ecrans/ListeEcran.tsx` | *(modifié)* Bandeau de rappel. |
| `src/db/disques.ts` | *(modifié)* Incrémenter le compteur à chaque écriture. |

---

## Task 1: Sérialisation de la collection

Le format porte une version : dans un an, un fichier de sauvegarde devra encore pouvoir
être relu par une app qui aura changé.

**Files:** Create `src/lib/sauvegarde.ts`, Create `src/lib/sauvegarde.test.ts`

- [ ] **Step 1: Écrire les tests qui échouent**

Create `src/lib/sauvegarde.test.ts` :

```ts
import { describe, expect, test } from 'vitest';
import { deserialiser, serialiser, ErreurSauvegarde } from './sauvegarde';
import { DISQUE_VIDE, type Disque } from '../db/schema';

function disque(champs: Partial<Disque>): Disque {
  return {
    ...DISQUE_VIDE,
    id: 1,
    dateAjout: new Date('2026-01-15T10:00:00Z'),
    dateModif: new Date('2026-02-20T14:30:00Z'),
    ...champs,
  };
}

const COLLECTION: Disque[] = [
  disque({
    id: 1, artiste: 'Harmonium', album: "L'Heptade", annee: 1976, label: 'CBS',
    noCatalogue: 'PGF 90348', pays: 'Canada', format: '2xLP', etatDisque: 'VG+',
    etatPochette: 'VG', valeurEstimee: 45.5, valeurSource: 'discogs',
    valeurMaj: new Date('2026-08-18T12:00:00Z'), discogsReleaseId: 1887068,
    notes: 'Pochette légèrement cornée',
  }),
  disque({ id: 2, artiste: 'Félix Leclerc', album: "Le tour de l'île", valeurEstimee: null }),
];

describe('aller-retour', () => {
  test('une collection sérialisée puis relue est identique', () => {
    expect(deserialiser(serialiser(COLLECTION))).toEqual(COLLECTION);
  });

  test('les dates redeviennent de vraies dates, pas des chaînes', () => {
    const relu = deserialiser(serialiser(COLLECTION));
    expect(relu[0].dateAjout).toBeInstanceOf(Date);
    expect(relu[0].valeurMaj).toBeInstanceOf(Date);
    expect(relu[0].dateAjout.getTime()).toBe(COLLECTION[0].dateAjout.getTime());
  });

  test('une valeur nulle reste nulle et ne devient pas une date', () => {
    expect(deserialiser(serialiser(COLLECTION))[1].valeurMaj).toBeNull();
  });

  test('une collection vide survit à l\'aller-retour', () => {
    expect(deserialiser(serialiser([]))).toEqual([]);
  });

  test('les accents et les apostrophes sont préservés', () => {
    const relu = deserialiser(serialiser(COLLECTION));
    expect(relu[1].artiste).toBe('Félix Leclerc');
    expect(relu[0].notes).toBe('Pochette légèrement cornée');
  });
});

describe('format du fichier', () => {
  test('porte une version et un horodatage', () => {
    const contenu = JSON.parse(serialiser(COLLECTION));
    expect(contenu.version).toBe(1);
    expect(typeof contenu.exporteLe).toBe('string');
    expect(contenu.disques).toHaveLength(2);
  });
});

describe('refus des fichiers invalides', () => {
  test('rejette un fichier qui n\'est pas du JSON', () => {
    expect(() => deserialiser('ceci nest pas du json')).toThrow(ErreurSauvegarde);
  });

  test('rejette un JSON sans liste de disques', () => {
    expect(() => deserialiser('{"version":1}')).toThrow(/sauvegarde/i);
  });

  test('rejette une version future qu\'on ne sait pas relire', () => {
    expect(() => deserialiser('{"version":99,"disques":[]}')).toThrow(/version/i);
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npm test`
Expected: FAIL, impossible de résoudre `./sauvegarde`

- [ ] **Step 3: Écrire `src/lib/sauvegarde.ts`**

```ts
import type { Disque } from '../db/schema';

const VERSION = 1;

/** Champs à reconvertir en `Date` : JSON ne connaît que les chaînes. */
const CHAMPS_DATE = ['dateAjout', 'dateModif', 'valeurMaj'] as const;

export class ErreurSauvegarde extends Error {}

interface Fichier {
  version: number;
  exporteLe: string;
  disques: unknown[];
}

export function serialiser(disques: readonly Disque[]): string {
  const fichier: Fichier = {
    version: VERSION,
    exporteLe: new Date().toISOString(),
    disques: [...disques],
  };
  return JSON.stringify(fichier, null, 2);
}

export function deserialiser(texte: string): Disque[] {
  let brut: unknown;
  try {
    brut = JSON.parse(texte);
  } catch {
    throw new ErreurSauvegarde(
      'Ce fichier n\'est pas une sauvegarde valide. Choisissez le fichier .json '
      + 'produit par l\'application.',
    );
  }

  const fichier = brut as Partial<Fichier>;

  if (!Array.isArray(fichier.disques)) {
    throw new ErreurSauvegarde(
      'Ce fichier ne contient aucune collection. Ce n\'est pas une sauvegarde de '
      + 'l\'application.',
    );
  }

  if (typeof fichier.version === 'number' && fichier.version > VERSION) {
    throw new ErreurSauvegarde(
      'Cette sauvegarde vient d\'une version plus récente de l\'application. '
      + 'Mettez l\'application à jour avant de la restaurer.',
    );
  }

  return fichier.disques.map((d) => {
    const disque = { ...(d as Record<string, unknown>) };
    for (const champ of CHAMPS_DATE) {
      const valeur = disque[champ];
      disque[champ] = typeof valeur === 'string' ? new Date(valeur) : null;
    }
    return disque as unknown as Disque;
  });
}
```

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `npm test`
Expected: PASS, `90 passed`

- [ ] **Step 5: Commit**

```bash
git add src/lib/sauvegarde.ts src/lib/sauvegarde.test.ts
git commit -m "feat: serialiser et relire une sauvegarde de la collection"
```

---

## Task 2: Export CSV et texte d'annonce

**Files:** Create `src/lib/csv.ts`, Create `src/lib/csv.test.ts`

- [ ] **Step 1: Écrire les tests qui échouent**

Create `src/lib/csv.test.ts` :

```ts
import { describe, expect, test } from 'vitest';
import { BOM_UTF8, versCSV, versTexteAnnonce } from './csv';
import { DISQUE_VIDE, type Disque } from '../db/schema';

function disque(champs: Partial<Disque>): Disque {
  return { ...DISQUE_VIDE, id: 1, dateAjout: new Date(), dateModif: new Date(), ...champs };
}

const HEPTADE = disque({
  id: 1, artiste: 'Harmonium', album: "L'Heptade", annee: 1976, label: 'CBS',
  noCatalogue: 'PGF 90348', pays: 'Canada', format: '2xLP', etatDisque: 'VG+',
  etatPochette: 'VG', quantite: 1, valeurEstimee: 45.5,
});

describe('versCSV', () => {
  test('commence par un BOM UTF-8, sans quoi Excel casse les accents', () => {
    expect(versCSV([HEPTADE]).startsWith(BOM_UTF8)).toBe(true);
  });

  test('sépare par des points-virgules, comme l\'attend Excel en français', () => {
    const lignes = versCSV([HEPTADE]).replace(BOM_UTF8, '').split('\r\n');
    expect(lignes[0].split(';')[0]).toBe('N° inventaire');
    expect(lignes[1].split(';')[1]).toBe('Harmonium');
  });

  test('écrit une ligne d\'en-tête puis une ligne par disque', () => {
    const lignes = versCSV([HEPTADE, disque({ id: 2 })]).replace(BOM_UTF8, '').trimEnd().split('\r\n');
    expect(lignes).toHaveLength(3);
  });

  test('protège un champ contenant un point-virgule', () => {
    const piege = disque({ artiste: 'Crosby; Stills' });
    expect(versCSV([piege])).toContain('"Crosby; Stills"');
  });

  test('double les guillemets internes, selon la convention CSV', () => {
    const piege = disque({ album: 'Le "meilleur" album' });
    expect(versCSV([piege])).toContain('"Le ""meilleur"" album"');
  });

  test('protège un champ contenant un saut de ligne', () => {
    const piege = disque({ notes: 'Ligne un\nLigne deux' });
    expect(versCSV([piege])).toContain('"Ligne un\nLigne deux"');
  });

  test('écrit la virgule décimale, comme Excel en français', () => {
    expect(versCSV([HEPTADE])).toContain('45,50');
  });

  test('laisse la valeur vide plutôt que d\'écrire zéro quand elle est inconnue', () => {
    const lignes = versCSV([disque({ valeurEstimee: null })]).replace(BOM_UTF8, '').split('\r\n');
    expect(lignes[1].split(';').at(-2)).toBe('');
  });

  test('produit seulement l\'en-tête pour une collection vide', () => {
    expect(versCSV([]).replace(BOM_UTF8, '').trimEnd().split('\r\n')).toHaveLength(1);
  });
});

describe('versTexteAnnonce', () => {
  test('décrit le disque en une ligne lisible', () => {
    expect(versTexteAnnonce([HEPTADE])).toBe(
      "Harmonium — L'Heptade (1976, Canada, CBS PGF 90348, 2xLP) — disque VG+, pochette VG — 45,50 $",
    );
  });

  test('omet la valeur quand elle est inconnue', () => {
    const texte = versTexteAnnonce([disque({ artiste: 'A', album: 'B', valeurEstimee: null })]);
    expect(texte).not.toContain('$');
  });

  test('signale une pochette générique, qui change beaucoup la valeur', () => {
    const texte = versTexteAnnonce([disque({ artiste: 'A', album: 'B', pochetteGenerique: true })]);
    expect(texte).toContain('pochette générique');
  });

  test('note la quantité au-delà d\'un exemplaire', () => {
    expect(versTexteAnnonce([disque({ artiste: 'A', album: 'B', quantite: 3 })])).toContain('×3');
  });

  test('sépare les disques par des sauts de ligne', () => {
    const texte = versTexteAnnonce([disque({ artiste: 'A', album: 'B' }), disque({ artiste: 'C', album: 'D' })]);
    expect(texte.split('\n')).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npm test`
Expected: FAIL, impossible de résoudre `./csv`

- [ ] **Step 3: Écrire `src/lib/csv.ts`**

```ts
import type { Disque } from '../db/schema';

/** Sans cette marque en tête de fichier, Excel lit les accents comme du charabia. */
export const BOM_UTF8 = '﻿';

const SEPARATEUR = ';';

const COLONNES = [
  'N° inventaire', 'Artiste', 'Album', 'Année', 'Label', 'N° catalogue', 'Pays',
  'Format', 'État disque', 'État pochette', 'Pochette générique', 'Quantité',
  'Valeur estimée (CAD)', 'Notes',
] as const;

/** Met un champ entre guillemets s'il contient un séparateur, un guillemet ou un saut de ligne. */
function echapper(valeur: string): string {
  if (!/[;"\r\n]/.test(valeur)) return valeur;
  return `"${valeur.replace(/"/g, '""')}"`;
}

/** Excel en français attend la virgule décimale. */
function montant(valeur: number | null): string {
  return valeur === null ? '' : valeur.toFixed(2).replace('.', ',');
}

export function versCSV(disques: readonly Disque[]): string {
  const lignes = [COLONNES.join(SEPARATEUR)];

  for (const d of disques) {
    lignes.push([
      String(d.id), d.artiste, d.album, d.annee === null ? '' : String(d.annee),
      d.label, d.noCatalogue, d.pays, d.format, d.etatDisque, d.etatPochette,
      d.pochetteGenerique ? 'Oui' : 'Non', String(d.quantite),
      montant(d.valeurEstimee), d.notes,
    ].map(echapper).join(SEPARATEUR));
  }

  // CRLF : c'est ce qu'attend Excel sous Windows.
  return BOM_UTF8 + lignes.join('\r\n') + '\r\n';
}

/** Une ligne par disque, prête à coller dans une annonce Marketplace ou Kijiji. */
export function versTexteAnnonce(disques: readonly Disque[]): string {
  return disques.map((d) => {
    const pressage = [
      d.annee === null ? null : String(d.annee),
      d.pays === '' ? null : d.pays,
      [d.label, d.noCatalogue].filter((x) => x !== '').join(' ') || null,
      d.format === '' ? null : d.format,
    ].filter((x) => x !== null).join(', ');

    const etat = `disque ${d.etatDisque}, pochette ${d.etatPochette}`
      + (d.pochetteGenerique ? ' (pochette générique)' : '');

    // Le pressage se colle au titre entre parentheses ; le reste est separe par des tirets.
    const titre = `${d.artiste} — ${d.album}`
      + (pressage === '' ? '' : ` (${pressage})`);

    return [
      titre,
      etat,
      d.quantite > 1 ? `×${d.quantite}` : null,
      d.valeurEstimee === null ? null : `${montant(d.valeurEstimee)} $`,
    ].filter((x) => x !== null).join(' — ');
  }).join('\n');
}
```

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `npm test`
Expected: PASS, `104 passed`

- [ ] **Step 5: Commit**

```bash
git add src/lib/csv.ts src/lib/csv.test.ts
git commit -m "feat: exporter la collection en CSV et en texte d'annonce"
```

---

## Task 3: Compteur de modifications non sauvegardées

**Files:** Create `src/lib/suivi-sauvegarde.ts`, Create `src/lib/suivi-sauvegarde.test.ts`

- [ ] **Step 1: Écrire les tests qui échouent**

Create `src/lib/suivi-sauvegarde.test.ts` :

```ts
import { beforeEach, describe, expect, test } from 'vitest';
import {
  derniereSauvegarde, marquerModification, marquerSauvegarde, modificationsEnAttente,
} from './suivi-sauvegarde';

beforeEach(() => localStorage.clear());

describe('modificationsEnAttente', () => {
  test('vaut zéro au départ', () => {
    expect(modificationsEnAttente()).toBe(0);
  });

  test('augmente à chaque modification', () => {
    marquerModification();
    marquerModification();
    expect(modificationsEnAttente()).toBe(2);
  });

  test('retombe à zéro après une sauvegarde', () => {
    marquerModification();
    marquerSauvegarde();
    expect(modificationsEnAttente()).toBe(0);
  });

  test('recompte après la sauvegarde', () => {
    marquerModification();
    marquerSauvegarde();
    marquerModification();
    expect(modificationsEnAttente()).toBe(1);
  });
});

describe('derniereSauvegarde', () => {
  test('vaut null tant que rien n\'a été sauvegardé', () => {
    expect(derniereSauvegarde()).toBeNull();
  });

  test('retourne une vraie date après une sauvegarde', () => {
    marquerSauvegarde();
    const date = derniereSauvegarde();
    expect(date).toBeInstanceOf(Date);
    expect(Date.now() - (date as Date).getTime()).toBeLessThan(5000);
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npm test`
Expected: FAIL, impossible de résoudre `./suivi-sauvegarde`

- [ ] **Step 3: Écrire `src/lib/suivi-sauvegarde.ts`**

```ts
const CLE_COMPTEUR = 'modifications-en-attente';
const CLE_DATE = 'derniere-sauvegarde';

export function modificationsEnAttente(): number {
  return Number(localStorage.getItem(CLE_COMPTEUR) ?? '0');
}

/** Appelé à chaque écriture en base, pour alimenter le bandeau de rappel. */
export function marquerModification(): void {
  localStorage.setItem(CLE_COMPTEUR, String(modificationsEnAttente() + 1));
}

export function marquerSauvegarde(): void {
  localStorage.setItem(CLE_COMPTEUR, '0');
  localStorage.setItem(CLE_DATE, new Date().toISOString());
}

export function derniereSauvegarde(): Date | null {
  const valeur = localStorage.getItem(CLE_DATE);
  return valeur === null ? null : new Date(valeur);
}
```

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `npm test`
Expected: PASS, `110 passed`

- [ ] **Step 5: Brancher le compteur sur les écritures**

Dans `src/db/disques.ts`, ajouter l'import puis un appel dans les trois fonctions
d'écriture :

```ts
import { marquerModification } from '../lib/suivi-sauvegarde';
```

Ajouter `marquerModification();` comme dernière instruction de `ajouterDisque` (avant le
`return` de l'identifiant — capturer l'identifiant dans une variable), de `modifierDisque`
et de `supprimerDisque`. `ajouterDisque` devient :

```ts
export async function ajouterDisque(nouveau: NouveauDisque): Promise<number> {
  const maintenant = new Date();
  const id = await db.disques.add({
    ...nouveau,
    dateAjout: maintenant,
    dateModif: maintenant,
  });
  marquerModification();
  return id;
}
```

- [ ] **Step 6: Vérifier que rien n'est cassé**

Run: `npm test && npm run build`
Expected: `110 passed`, build propre. Les tests de `disques.test.ts` doivent continuer de
passer : `localStorage` est disponible en test depuis la phase 2.

- [ ] **Step 7: Commit**

```bash
git add src/lib/suivi-sauvegarde.ts src/lib/suivi-sauvegarde.test.ts src/db/disques.ts
git commit -m "feat: compter les modifications depuis la derniere sauvegarde"
```

---

## Task 4: Partage de fichier

**Files:** Create `src/lib/partage.ts`

Pas de test automatisé ici : cette fonction ne fait que déclencher des API du navigateur,
et son seul comportement intéressant — l'ouverture de la feuille de partage iOS — a été
vérifié à la main en phase 0.

- [ ] **Step 1: Créer `src/lib/partage.ts`**

```ts
/**
 * Propose un fichier à l'utilisatrice.
 *
 * Sur iPhone, `navigator.share` ouvre la feuille de partage, d'où « Enregistrer dans
 * Fichiers » vers iCloud Drive — vérifié sur l'appareil cible en phase 0. Ailleurs, on
 * retombe sur un téléchargement classique.
 *
 * Retourne `false` si l'utilisatrice a annulé, pour ne pas marquer une sauvegarde
 * qui n'a pas eu lieu.
 */
export async function proposerFichier(
  nom: string,
  contenu: string,
  typeMime: string,
): Promise<boolean> {
  const fichier = new File([contenu], nom, { type: typeMime });

  if (navigator.canShare?.({ files: [fichier] }) === true) {
    try {
      await navigator.share({ files: [fichier] });
      return true;
    } catch (e) {
      // L'utilisatrice a fermé la feuille de partage : ce n'est pas une erreur.
      if (e instanceof Error && e.name === 'AbortError') return false;
      // Tout autre échec bascule sur le téléchargement plutôt que d'abandonner.
    }
  }

  telecharger(nom, fichier);
  return true;
}

function telecharger(nom: string, fichier: File): void {
  const url = URL.createObjectURL(fichier);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nom;
  lien.click();
  URL.revokeObjectURL(url);
}

/** Nom horodaté, pour que plusieurs sauvegardes cohabitent dans Fichiers. */
export function nomHorodate(prefixe: string, extension: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `${prefixe}-${date}.${extension}`;
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `npm run build`
Expected: build propre

- [ ] **Step 3: Commit**

```bash
git add src/lib/partage.ts
git commit -m "feat: proposer un fichier via la feuille de partage iOS"
```

---

## Task 5: Écran Sauvegarde

**Files:** Create `src/ecrans/SauvegardeEcran.tsx`, Modify `src/App.tsx`, Modify `src/ecrans/ReglagesEcran.tsx`

- [ ] **Step 1: Créer `src/ecrans/SauvegardeEcran.tsx`**

```tsx
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { db } from '../db/db';
import { listerDisques } from '../db/disques';
import { versCSV, versTexteAnnonce } from '../lib/csv';
import { nomHorodate, proposerFichier } from '../lib/partage';
import { deserialiser, ErreurSauvegarde, serialiser } from '../lib/sauvegarde';
import { derniereSauvegarde, marquerSauvegarde, modificationsEnAttente } from '../lib/suivi-sauvegarde';

export default function SauvegardeEcran() {
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const champFichier = useRef<HTMLInputElement>(null);

  const enAttente = modificationsEnAttente();
  const derniere = derniereSauvegarde();

  async function sauvegarder() {
    setErreur(null);
    const disques = await listerDisques();
    const enregistre = await proposerFichier(
      nomHorodate('collection-disques', 'json'),
      serialiser(disques),
      'application/json',
    );
    if (enregistre) {
      marquerSauvegarde();
      setMessage(`${disques.length} disques sauvegardés.`);
    }
  }

  async function exporterCSV() {
    setErreur(null);
    await proposerFichier(
      nomHorodate('collection-disques', 'csv'),
      versCSV(await listerDisques()),
      'text/csv',
    );
  }

  async function exporterAnnonce() {
    setErreur(null);
    await proposerFichier(
      nomHorodate('annonce-disques', 'txt'),
      versTexteAnnonce(await listerDisques()),
      'text/plain',
    );
  }

  async function restaurer(evenement: React.ChangeEvent<HTMLInputElement>) {
    const fichier = evenement.target.files?.[0];
    if (fichier === undefined) return;
    setErreur(null);
    setMessage(null);

    try {
      const disques = deserialiser(await fichier.text());

      const confirme = confirm(
        `Remplacer votre collection actuelle par les ${disques.length} disques de ce `
        + 'fichier ? Ce qui est actuellement dans l\'application sera effacé.',
      );
      if (!confirme) return;

      await db.disques.clear();
      await db.disques.bulkAdd(disques);
      marquerSauvegarde();
      setMessage(`${disques.length} disques restaurés.`);
    } catch (e) {
      setErreur(e instanceof ErreurSauvegarde ? e.message : 'Ce fichier n\'a pas pu être lu.');
    } finally {
      // Permet de resélectionner le même fichier après une erreur.
      evenement.target.value = '';
    }
  }

  return (
    <div className="p-4 pt-[calc(1rem+env(safe-area-inset-top))]">
      <Link to="/" className="text-sm text-amber-500">← Retour à la collection</Link>
      <h1 className="mt-3 text-xl font-semibold">Sauvegarde et exports</h1>

      <p className="mt-4 rounded-lg bg-stone-800 p-3 text-sm text-stone-400">
        Votre collection est enregistrée uniquement sur cet appareil. Si vous supprimez
        l'application de votre écran d'accueil, elle est perdue. Sauvegardez de temps en
        temps dans Fichiers.
      </p>

      <p className="mt-4 text-sm text-stone-400">
        {derniere === null
          ? 'Aucune sauvegarde effectuée pour l\'instant.'
          : `Dernière sauvegarde : ${derniere.toLocaleDateString('fr-CA')}.`}
        {enAttente > 0 && ` ${enAttente} modification${enAttente > 1 ? 's' : ''} depuis.`}
      </p>

      <button
        type="button"
        onClick={sauvegarder}
        className="mt-4 w-full rounded-lg bg-amber-500 p-4 text-base font-semibold text-stone-900"
      >
        Sauvegarder maintenant
      </button>

      <h2 className="mt-8 text-lg font-semibold">Exporter</h2>
      <div className="mt-3 space-y-3">
        <button type="button" onClick={exporterCSV} className="w-full rounded-lg bg-stone-800 p-4 text-base">
          Tableur (CSV pour Excel)
        </button>
        <button type="button" onClick={exporterAnnonce} className="w-full rounded-lg bg-stone-800 p-4 text-base">
          Texte pour une annonce
        </button>
      </div>

      <h2 className="mt-8 text-lg font-semibold">Restaurer</h2>
      <p className="mt-2 text-sm text-stone-400">
        Remplace la collection actuelle par le contenu d'un fichier de sauvegarde.
      </p>
      <input
        ref={champFichier}
        type="file"
        accept="application/json,.json"
        onChange={restaurer}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => champFichier.current?.click()}
        className="mt-3 w-full rounded-lg border border-stone-700 p-4 text-base"
      >
        Choisir un fichier de sauvegarde
      </button>

      {message !== null && (
        <p className="mt-4 rounded-lg bg-stone-800 p-3 text-center text-sm text-green-400">{message}</p>
      )}
      {erreur !== null && (
        <p className="mt-4 rounded-lg border border-red-900 p-3 text-sm text-red-400">{erreur}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Ajouter la route dans `src/App.tsx`**

```tsx
import SauvegardeEcran from './ecrans/SauvegardeEcran';
```
```tsx
        <Route path="/sauvegarde" element={<SauvegardeEcran />} />
```

- [ ] **Step 3: Renvoyer vers la sauvegarde depuis les Réglages**

Dans `src/ecrans/ReglagesEcran.tsx`, juste avant la balise fermante `</div>` finale :

```tsx
      <hr className="my-8 border-stone-800" />
      <Link
        to="/sauvegarde"
        className="block rounded-lg bg-stone-800 p-4 text-center text-base"
      >
        Sauvegarde et exports
      </Link>
```

- [ ] **Step 4: Vérifier**

Run: `npm run build && npm test`
Expected: build propre, `110 passed`

- [ ] **Step 5: Commit**

```bash
git add src/ecrans/SauvegardeEcran.tsx src/App.tsx src/ecrans/ReglagesEcran.tsx
git commit -m "feat: ajouter l'ecran de sauvegarde, restauration et exports"
```

---

## Task 6: Bandeau de rappel sur la liste

**Files:** Modify `src/ecrans/ListeEcran.tsx`

- [ ] **Step 1: Afficher le bandeau**

Ajouter l'import :

```tsx
import { modificationsEnAttente } from '../lib/suivi-sauvegarde';
```

Puis, à l'intérieur du `<header>`, juste après le bloc affichant la valeur totale :

```tsx
        {modificationsEnAttente() >= 10 && (
          <Link
            to="/sauvegarde"
            className="mx-4 mb-2 block rounded-lg bg-amber-500/15 p-3 text-sm text-amber-500"
          >
            {modificationsEnAttente()} modifications depuis votre dernière sauvegarde.
            Touchez ici pour sauvegarder.
          </Link>
        )}
```

Le seuil de 10 est délibéré : un bandeau qui apparaît dès la première saisie serait
ignoré au bout d'une journée. À dix disques, l'avertissement correspond à un vrai travail
à protéger.

- [ ] **Step 2: Vérifier**

Run: `npm run build && npm test`
Expected: build propre, `110 passed`

- [ ] **Step 3: Vérification manuelle**

```bash
npm run dev
```

1. Ajouter dix disques à la main — le bandeau orange apparaît sur la liste au dixième
2. Toucher le bandeau mène à l'écran de sauvegarde
3. Sauvegarder : le fichier se télécharge, le bandeau disparaît au retour sur la liste
4. Exporter le CSV et l'ouvrir dans un tableur : les accents sont corrects et chaque
   champ est dans sa colonne
5. Supprimer tous les disques, puis restaurer le fichier JSON : la collection revient
   à l'identique, numéros d'inventaire compris

- [ ] **Step 4: Commit**

```bash
git add src/ecrans/ListeEcran.tsx
git commit -m "feat: rappeler de sauvegarder au-dela de dix modifications"
```

---

## Task 7: Vérification de bout en bout et mise en ligne

**Files:** Modify `scripts/verifier-app.py`

- [ ] **Step 1: Ajouter la vérification de l'aller-retour**

Ajouter dans `scripts/verifier-app.py`, juste avant le bloc `verifier(11, …)`. Le
téléchargement est intercepté par Playwright, ce qui permet de relire le fichier produit.

```python
    # 16-17. Aller-retour sauvegarde -> restauration.
    # On ne supprime PAS la base IndexedDB : Dexie y tient une connexion ouverte, et
    # deleteDatabase resterait bloque indefiniment. On efface un disque par l'interface,
    # ce qui est de toute facon le scenario reel qu'on veut couvrir.
    page.goto(BASE + "/")
    page.wait_for_selector("li")
    avant = sorted(page.locator("li span.truncate.font-medium").all_inner_texts())

    page.goto(BASE + "/sauvegarde")
    page.wait_for_selector("h1:has-text('Sauvegarde')")
    with page.expect_download() as telechargement:
        page.click("text=Sauvegarder maintenant")
    chemin = telechargement.value.path()
    contenu = Path(chemin).read_text(encoding="utf-8")
    verifier(16, "La sauvegarde produit un fichier lisible",
             '"version": 1' in contenu and '"disques"' in contenu,
             f"({len(contenu)} octets, {len(avant)} disques)")

    # Effacer un disque, verifier qu'il a bien disparu, puis restaurer.
    page.goto(BASE + "/")
    page.wait_for_selector("li")
    page.locator("li a").first.click()
    page.wait_for_selector("text=Inventaire n°")
    page.on("dialog", lambda d: d.accept())
    page.click("text=Supprimer")
    page.wait_for_selector("h1:has-text('Ma collection')")
    ampute = sorted(page.locator("li span.truncate.font-medium").all_inner_texts())
    assert len(ampute) == len(avant) - 1, "la suppression n a pas eu lieu"

    page.goto(BASE + "/sauvegarde")
    page.wait_for_selector("h1:has-text('Sauvegarde')")
    page.set_input_files("input[type=file]", chemin)
    page.wait_for_selector("text=restaur", timeout=15000)

    page.goto(BASE + "/")
    page.wait_for_selector("li")
    apres = sorted(page.locator("li span.truncate.font-medium").all_inner_texts())
    verifier(17, "La restauration redonne exactement la meme collection",
             apres == avant, f"(avant={avant} ampute={ampute} apres={apres})")
```

Ajouter `from pathlib import Path` en tête de fichier si absent.

- [ ] **Step 2: Lancer la vérification complète**

```bash
npm run dev
python scripts/verifier-app.py
```

Expected: `18/18 verifications reussies`

- [ ] **Step 3: Fusionner et mettre en ligne**

```bash
git add scripts/verifier-app.py
git commit -m "test: couvrir l'aller-retour sauvegarde et restauration"
git checkout main
git merge --no-ff phase-3
git push origin main
```

- [ ] **Step 4: Vérifier la production**

```bash
BASE_URL=https://catalogue-disques.vercel.app python scripts/verifier-app.py
```

Expected: `18/18 verifications reussies`

---

## Hors scope

- Sauvegarde automatique : impossible sur iOS Safari, faute de File System Access API.
- Fusion d'une sauvegarde avec la collection actuelle : la restauration remplace, elle
  ne fusionne pas. Fusionner demanderait de résoudre les conflits, ce que personne n'a
  demandé.
- Historique des sauvegardes dans l'application : les fichiers horodatés dans iCloud
  Drive jouent ce rôle.
