# Catalogue de disques — Plan d'implémentation, phase 4 (scan de codes-barres)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pointer la caméra sur le code-barres d'une pochette et arriver directement à l'écran de sélection du pressage, sans rien taper.

**Architecture :** Le décodage tourne dans `src/scan/`, isolé : `lecteur.ts` encapsule zxing-wasm et la boucle caméra, `code-barres.ts` contient la seule logique pure (les variantes de format) et est testée. L'écran de scan n'orchestre que l'ouverture de la caméra et la navigation.

**Tech Stack :** ajout de **zxing-wasm 3.1.3**, servi depuis notre propre origine.

**Spec :** [design](../specs/2026-08-18-catalogue-disques-design.md) · **Plans précédents :** [0-1](2026-08-18-catalogue-disques-phases-0-1.md), [2](2026-08-18-catalogue-disques-phase-2.md), [2B](2026-08-18-catalogue-disques-phase-2b.md), [3](2026-08-18-catalogue-disques-phase-3.md) — toutes livrées et en production.

---

## Attentes à garder basses

**La majorité de ses disques ne se scanneront pas.** Les vinyles pressés avant ~1980 ne
portent pas de code-barres. Sur une collection héritée d'un père, c'est probablement la
plus grosse part. Le scan est un raccourci pour les rééditions et les pressages récents ;
la recherche texte reste le mode principal, et l'écran doit le dire clairement plutôt que
de laisser croire à une panne.

## Mesures qui dictent la conception

Vérifiées le 2026-08-18. Ne pas les re-supposer autrement sans les remesurer.

1. **L'accès caméra fonctionne** dans la web app installée sur l'iPhone cible
   (diagnostic de la phase 0, test 3).
2. **zxing-wasm charge son binaire depuis le CDN jsDelivr par défaut.** Inacceptable :
   ça casserait le scan hors-ligne et ajouterait une dépendance tierce à l'exécution.
   Vérifié qu'un import Vite `?url` + `locateFile` sert le fichier **depuis notre
   origine**, sans aucune requête CDN.
3. **Le décodage marche** : un EAN-13 fabriqué puis relu redonne bien son contenu.
4. **Le format du code compte pour Discogs.** Mesuré sur un même produit :

   | Envoyé à Discogs | Résultats |
   |---|---|
   | `6025373511698` (13 chiffres bruts) | **0** |
   | `602537351169` (12 chiffres, UPC-A) | 3 |
   | `0602537351169` (13 chiffres, zéro initial) | 3 |

   Un produit nord-américain porte un UPC-A à 12 chiffres, que les lecteurs rapportent
   tantôt tel quel, tantôt en EAN-13 avec un zéro devant. Chercher la seule forme brute
   échouerait une fois sur deux. **Il faut essayer les variantes.**
5. **Ne pas filtrer sur `format=Vinyl` lors d'une recherche par code-barres.** Un code-barres
   est déjà un identifiant précis ; sur-filtrer risque de renvoyer zéro résultat quand
   Discogs a mal étiqueté le format. Le filtre reste pour la recherche texte.
6. **Le `.wasm` pèse 1 Mo**, sous la limite Workbox de 2 Mo : il peut être précaché pour
   fonctionner hors-ligne.

## Structure de fichiers

| Fichier | Responsabilité |
|---|---|
| `src/scan/code-barres.ts` | Variantes d'un code scanné. Pur, testé. |
| `src/scan/lecteur.ts` | Caméra et boucle de décodage. Aucun test automatisé possible. |
| `src/ecrans/ScanEcran.tsx` | Aperçu vidéo, erreurs, navigation vers les résultats. |
| `src/discogs/api.ts` | *(modifié)* Recherche par code-barres essayant les variantes. |
| `src/ecrans/RechercheEcran.tsx` | *(modifié)* Accepte des pressages fournis par le scan. |
| `src/ecrans/ChoixAjoutEcran.tsx` | *(modifié)* Troisième choix : scanner. |
| `vite.config.ts` | *(modifié)* Précacher le `.wasm`. |

---

## Task 1: Variantes d'un code-barres

**Files:** Create `src/scan/code-barres.ts`, Create `src/scan/code-barres.test.ts`

- [ ] **Step 1: Écrire les tests qui échouent**

Create `src/scan/code-barres.test.ts` :

```ts
import { describe, expect, test } from 'vitest';
import { variantesCodeBarres } from './code-barres';

describe('variantesCodeBarres', () => {
  test('propose d\'abord le code tel qu\'il a été scanné', () => {
    expect(variantesCodeBarres('602537351169')[0]).toBe('602537351169');
  });

  test('ajoute la forme sans zéro initial pour un EAN-13 issu d\'un UPC-A', () => {
    // Mesuré : Discogs ne trouve rien sur 0602537351169 mais trouve sur 602537351169.
    expect(variantesCodeBarres('0602537351169')).toEqual(['0602537351169', '602537351169']);
  });

  test('ajoute la forme avec zéro initial pour un UPC-A à 12 chiffres', () => {
    expect(variantesCodeBarres('602537351169')).toEqual(['602537351169', '0602537351169']);
  });

  test('ne propose qu\'une variante pour un EAN-13 ne commençant pas par zéro', () => {
    expect(variantesCodeBarres('4006381333931')).toEqual(['4006381333931']);
  });

  test('retire les espaces et les tirets, fréquents sur les codes recopiés', () => {
    expect(variantesCodeBarres(' 602-537 351169 ')[0]).toBe('602537351169');
  });

  test('ne propose rien pour une saisie vide', () => {
    expect(variantesCodeBarres('   ')).toEqual([]);
  });

  test('ne propose rien pour un code contenant autre chose que des chiffres', () => {
    expect(variantesCodeBarres('PGF 90348')).toEqual([]);
  });

  test('ne duplique jamais une variante', () => {
    const v = variantesCodeBarres('0602537351169');
    expect(new Set(v).size).toBe(v.length);
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npm test`
Expected: FAIL, impossible de résoudre `./code-barres`

- [ ] **Step 3: Écrire `src/scan/code-barres.ts`**

```ts
/**
 * Formes sous lesquelles chercher un code-barres sur Discogs, la plus probable d'abord.
 *
 * Un produit nord-américain porte un UPC-A à 12 chiffres. Les lecteurs le rapportent
 * tantôt tel quel, tantôt converti en EAN-13 avec un zéro initial. Discogs, lui, ne
 * connaît souvent qu'une seule des deux formes : mesuré le 2026-08-18, le même disque
 * se trouve sous `602537351169` mais pas sous `6025373511698`.
 */
export function variantesCodeBarres(code: string): string[] {
  const propre = code.replace(/[\s-]/g, '');
  if (propre === '' || !/^\d+$/.test(propre)) return [];

  const variantes = [propre];

  if (propre.length === 13 && propre.startsWith('0')) {
    variantes.push(propre.slice(1));
  } else if (propre.length === 12) {
    variantes.push(`0${propre}`);
  }

  return variantes;
}
```

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `npm test`
Expected: PASS, `118 passed`

- [ ] **Step 5: Commit**

```bash
git add src/scan/code-barres.ts src/scan/code-barres.test.ts
git commit -m "feat: derouler les variantes d'un code-barres scanne"
```

---

## Task 2: Recherche Discogs par code-barres

**Files:** Modify `src/discogs/api.ts`, Modify `src/discogs/api.test.ts`

- [ ] **Step 1: Ajouter les tests qui échouent**

Ajouter à `src/discogs/api.test.ts`, en fusionnant les imports en tête de fichier :

```ts
import { chercherParCodeBarres } from './api';

describe('chercherParCodeBarres', () => {
  test('ne filtre PAS sur le format : un code-barres est déjà précis', async () => {
    const f = doublureFetch({ '/database/search': { results: [{ id: 1, title: 'A - B' }] } });
    vi.stubGlobal('fetch', f);

    await chercherParCodeBarres('4006381333931');

    const url = f.mock.calls[0][0] as string;
    expect(url).toContain('barcode=4006381333931');
    expect(url).not.toContain('format=Vinyl');
  });

  test('s\'arrête à la première variante qui donne un résultat', async () => {
    const f = doublureFetch({ '/database/search': { results: [{ id: 1, title: 'A - B' }] } });
    vi.stubGlobal('fetch', f);

    const pressages = await chercherParCodeBarres('602537351169');

    expect(pressages).toHaveLength(1);
    expect(f).toHaveBeenCalledTimes(1);
  });

  test('essaie la variante suivante quand la première ne donne rien', async () => {
    let appels = 0;
    vi.stubGlobal('fetch', vi.fn(() => {
      appels += 1;
      const results = appels === 1 ? [] : [{ id: 7, title: 'Trouve - Enfin' }];
      return Promise.resolve(new Response(JSON.stringify({ results })));
    }));

    const pressages = await chercherParCodeBarres('0602537351169');

    expect(appels).toBe(2);
    expect(pressages[0].releaseId).toBe(7);
  });

  test('retourne une liste vide quand aucune variante ne donne rien', async () => {
    vi.stubGlobal('fetch', doublureFetch({ '/database/search': { results: [] } }));

    expect(await chercherParCodeBarres('602537351169')).toEqual([]);
  });

  test('n\'appelle pas Discogs pour un code invalide', async () => {
    const f = doublureFetch({ '/database/search': { results: [] } });
    vi.stubGlobal('fetch', f);

    expect(await chercherParCodeBarres('PGF 90348')).toEqual([]);
    expect(f).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npm test`
Expected: FAIL, `chercherParCodeBarres` n'est pas exporté

- [ ] **Step 3: Modifier `src/discogs/api.ts`**

Ajouter l'import en tête :

```ts
import { variantesCodeBarres } from '../scan/code-barres';
```

Puis ajouter la fonction à la fin du fichier :

```ts
/**
 * Cherche un disque par son code-barres, en essayant les formes équivalentes du code.
 *
 * Pas de filtre `format=Vinyl` ici, contrairement à la recherche texte : un code-barres
 * identifie déjà un produit précis, et sur-filtrer ferait rater les disques dont Discogs
 * a mal renseigné le format.
 */
export async function chercherParCodeBarres(code: string): Promise<Pressage[]> {
  for (const variante of variantesCodeBarres(code)) {
    const chemin = `/database/search?barcode=${encodeURIComponent(variante)}`
      + '&type=release&per_page=25';
    const reponse = await appelerDiscogs<ReponseRecherche>(chemin);
    const pressages = (reponse.results ?? []).map(versPressage);
    if (pressages.length > 0) return pressages;
  }
  return [];
}
```

⚠️ L'option `parCodeBarres` de `chercher` devient redondante. La retirer : supprimer le
paramètre `options`, la variable `champ`, et remplacer par `q=` en dur. Supprimer aussi
le test `cherche par code-barres quand on le lui demande` de `api.test.ts`, devenu
sans objet. Les appels existants à `chercher(requete)` ne changent pas.

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `npm test`
Expected: PASS, `122 passed` (118 + 5 nouveaux − 1 supprimé)

- [ ] **Step 5: Commit**

```bash
git add src/discogs/api.ts src/discogs/api.test.ts
git commit -m "feat: chercher sur Discogs par code-barres en essayant les variantes"
```

---

## Task 3: Lecteur de codes-barres

Pas de test automatisé : cette couche ne fait qu'orchestrer la caméra et zxing-wasm.
Son comportement est vérifié à la main sur l'appareil, à la tâche 6.

**Files:** Create `src/scan/lecteur.ts`, Modify `vite.config.ts`

- [ ] **Step 1: Créer `src/scan/lecteur.ts`**

```ts
import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader';
// L'import `?url` fait servir le binaire depuis notre propre origine. Sans cela,
// zxing-wasm le télécharge sur le CDN jsDelivr : le scan ne fonctionnerait plus
// hors-ligne et dépendrait d'un tiers à l'exécution.
import urlWasm from 'zxing-wasm/reader/zxing_reader.wasm?url';

prepareZXingModule({ overrides: { locateFile: () => urlWasm } });

/** Formats portés par les disques : EAN-13 en Europe, UPC-A en Amérique du Nord. */
const FORMATS = ['EAN-13', 'UPC-A', 'EAN-8', 'UPC-E'] as const;

/** Intervalle entre deux analyses. Plus court épuise la batterie sans gagner en réussite. */
const INTERVALLE_MS = 400;

export interface SessionScan {
  arreter: () => void;
}

export class ErreurCamera extends Error {}

/**
 * Ouvre la caméra arrière et analyse l'image jusqu'à trouver un code-barres.
 * Appelle `surCode` une seule fois, puis s'arrête d'elle-même.
 */
export async function demarrerScan(
  video: HTMLVideoElement,
  surCode: (code: string) => void,
): Promise<SessionScan> {
  let flux: MediaStream;
  try {
    flux = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
    });
  } catch (e) {
    const nom = e instanceof Error ? e.name : '';
    throw new ErreurCamera(
      nom === 'NotAllowedError'
        ? 'L\'accès à la caméra a été refusé. Autorisez-le dans Réglages > Safari, '
          + 'ou cherchez le disque par son titre.'
        : 'La caméra n\'a pas pu être ouverte. Cherchez le disque par son titre.',
    );
  }

  video.srcObject = flux;
  await video.play();

  const canevas = document.createElement('canvas');
  const contexte = canevas.getContext('2d', { willReadFrequently: true });
  let actif = true;

  function arreter() {
    actif = false;
    for (const piste of flux.getTracks()) piste.stop();
    video.srcObject = null;
  }

  async function analyser() {
    if (!actif || contexte === null) return;

    if (video.videoWidth > 0) {
      canevas.width = video.videoWidth;
      canevas.height = video.videoHeight;
      contexte.drawImage(video, 0, 0);

      try {
        const resultats = await readBarcodes(
          contexte.getImageData(0, 0, canevas.width, canevas.height),
          { formats: [...FORMATS] },
        );
        const trouve = resultats.find((r) => r.text !== '');
        if (trouve !== undefined) {
          arreter();
          surCode(trouve.text);
          return;
        }
      } catch {
        // Une image illisible n'est pas une erreur : on retentera à la suivante.
      }
    }

    if (actif) setTimeout(() => { void analyser(); }, INTERVALLE_MS);
  }

  void analyser();
  return { arreter };
}
```

- [ ] **Step 2: Précacher le `.wasm` pour le hors-ligne**

Dans `vite.config.ts`, ajouter une section `workbox` à l'intérieur de l'appel `VitePWA`,
à côté de `manifest` :

```ts
      workbox: {
        // Par défaut Workbox ignore les .wasm : sans cela le scan cesserait de
        // fonctionner hors-ligne. Le fichier pèse 1 Mo, sous la limite de 2 Mo.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,wasm}'],
      },
```

- [ ] **Step 3: Vérifier que le `.wasm` est bien précaché**

```bash
npm run build
grep -c "wasm" dist/sw.js
```

Expected: au moins 1. Vérifier aussi que la sortie de `npm run build` mentionne un
`precache` d'au moins 11 entrées.

- [ ] **Step 4: Commit**

```bash
git add src/scan/lecteur.ts vite.config.ts package.json package-lock.json
git commit -m "feat: lire un code-barres avec zxing-wasm servi localement"
```

---

## Task 4: Écran de scan

**Files:** Create `src/ecrans/ScanEcran.tsx`, Modify `src/App.tsx`, Modify `src/ecrans/ChoixAjoutEcran.tsx`

- [ ] **Step 1: Créer `src/ecrans/ScanEcran.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { chercherParCodeBarres } from '../discogs/api';
import { ErreurDiscogs } from '../discogs/client';
import { demarrerScan, ErreurCamera, type SessionScan } from '../scan/lecteur';

export default function ScanEcran() {
  const navigate = useNavigate();
  const video = useRef<HTMLVideoElement>(null);
  const session = useRef<SessionScan | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [codeTrouve, setCodeTrouve] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;

    async function traiterCode(code: string) {
      if (annule) return;
      setCodeTrouve(code);
      try {
        const pressages = await chercherParCodeBarres(code);
        if (annule) return;
        if (pressages.length === 0) {
          setErreur(`Code-barres ${code} lu, mais introuvable sur Discogs. `
            + 'Cherchez le disque par son titre.');
          return;
        }
        // L'écran de recherche sait déjà présenter des pressages et gérer le choix.
        navigate('/chercher', { state: { pressages, code } });
      } catch (e) {
        if (!annule) setErreur(e instanceof ErreurDiscogs ? e.message : 'Une erreur est survenue.');
      }
    }

    if (video.current !== null) {
      demarrerScan(video.current, (code) => { void traiterCode(code); })
        .then((s) => {
          if (annule) s.arreter();
          else session.current = s;
        })
        .catch((e) => {
          if (!annule) setErreur(e instanceof ErreurCamera ? e.message : 'Une erreur est survenue.');
        });
    }

    return () => {
      annule = true;
      session.current?.arreter();
    };
  }, [navigate]);

  return (
    <div className="p-4 pt-[calc(1rem+env(safe-area-inset-top))]">
      <Link to="/ajouter-choix" className="text-sm text-amber-500">← Retour</Link>
      <h1 className="mt-3 text-xl font-semibold">Scanner un code-barres</h1>

      <p className="mt-2 text-sm text-stone-400">
        Cadrez le code-barres au dos de la pochette. Beaucoup de disques anciens n'en ont
        pas : dans ce cas, cherchez-le par son titre.
      </p>

      <video
        ref={video}
        playsInline
        muted
        className="mt-4 w-full rounded-lg bg-black"
        style={{ aspectRatio: '4 / 3', objectFit: 'cover' }}
      />

      {codeTrouve !== null && erreur === null && (
        <p className="mt-4 text-center text-sm text-stone-400">
          Code lu : <span className="font-mono text-amber-500">{codeTrouve}</span> — recherche…
        </p>
      )}

      {erreur !== null && (
        <div className="mt-4 rounded-lg border border-red-900 p-4">
          <p className="text-sm text-red-400">{erreur}</p>
          <Link to="/chercher" className="mt-3 block text-center text-sm text-amber-500">
            Chercher par titre
          </Link>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Ajouter la route dans `src/App.tsx`**

```tsx
import ScanEcran from './ecrans/ScanEcran';
```
```tsx
        <Route path="/scanner" element={<ScanEcran />} />
```

- [ ] **Step 3: Ajouter le choix dans `src/ecrans/ChoixAjoutEcran.tsx`**

Insérer **avant** le lien « Chercher sur Discogs » :

```tsx
        <Link
          to="/scanner"
          className="block rounded-lg bg-amber-500 p-5 text-center text-stone-900"
        >
          <span className="block text-lg font-semibold">Scanner le code-barres</span>
          <span className="mt-1 block text-sm">
            Le plus rapide, quand le disque en a un
          </span>
        </Link>
```

Et changer le lien « Chercher sur Discogs » pour qu'il ne soit plus le bouton principal :
remplacer sa classe `bg-amber-500 p-5 text-center text-stone-900` par
`bg-stone-800 p-5 text-center`, et retirer `text-stone-900` de ses deux `<span>` internes
en ajoutant `text-stone-400` au second.

- [ ] **Step 4: Vérifier la compilation**

Run: `npm run build && npm test`
Expected: build propre, `122 passed`

- [ ] **Step 5: Commit**

```bash
git add src/ecrans/ScanEcran.tsx src/App.tsx src/ecrans/ChoixAjoutEcran.tsx
git commit -m "feat: ajouter l'ecran de scan de code-barres"
```

---

## Task 5: L'écran de recherche accepte les résultats du scan

**Files:** Modify `src/ecrans/RechercheEcran.tsx`

- [ ] **Step 1: Lire les pressages transmis par le scan**

Ajouter `useLocation` à l'import de `react-router`, puis, juste après la déclaration de
`navigate` :

```tsx
  const location = useLocation();
  const depuisScan = (location.state ?? null) as { pressages?: Pressage[]; code?: string } | null;
```

Remplacer l'initialisation de l'état des pressages par :

```tsx
  const [pressages, setPressages] = useState<Pressage[] | null>(depuisScan?.pressages ?? null);
```

- [ ] **Step 2: Signaler l'origine des résultats**

Juste au-dessus du bloc `{!enCours && pressages !== null && pressages.length > 0 && (` :

```tsx
      {depuisScan?.code !== undefined && (
        <p className="mt-4 rounded-lg bg-stone-800 p-3 text-sm text-stone-400">
          Résultats pour le code-barres{' '}
          <span className="font-mono text-amber-500">{depuisScan.code}</span>.
        </p>
      )}
```

- [ ] **Step 3: Vérifier**

Run: `npm run build && npm test`
Expected: build propre, `122 passed`

- [ ] **Step 4: Commit**

```bash
git add src/ecrans/RechercheEcran.tsx
git commit -m "feat: afficher les pressages trouves par le scan"
```

---

## Task 6: Vérification et mise en ligne

**Files:** Modify `scripts/verifier-app.py`

- [ ] **Step 1: Vérifier que le scan se charge sans erreur**

Playwright n'a pas de vraie caméra ; on vérifie donc ce qui est vérifiable
automatiquement : que l'écran se charge, qu'il demande la caméra, et qu'il échoue
proprement plutôt que de planter. Ajouter avant le bloc `verifier(11, …)` :

```python
    # 18. L'ecran de scan degrade proprement sans camera
    page.goto(BASE + "/scanner")
    page.wait_for_selector("h1:has-text('Scanner un code-barres')")
    page.wait_for_timeout(2500)
    corps = page.content()
    verifier(18, "L'ecran de scan se charge et propose un repli sans camera",
             "cherchez-le par son titre" in corps or "Chercher par titre" in corps)
    page.screenshot(path=f"{SORTIE}/11-scan.png", full_page=True)
```

- [ ] **Step 2: Lancer la vérification complète**

```bash
npm run dev
python scripts/verifier-app.py
```

Expected: `19/19 verifications reussies`

- [ ] **Step 3: Fusionner et mettre en ligne**

```bash
git add scripts/verifier-app.py
git commit -m "test: couvrir le chargement de l'ecran de scan"
git checkout main
git merge --no-ff phase-4
git push origin main
```

- [ ] **Step 4: 🔴 Vérification manuelle sur l'iPhone — indispensable**

Playwright ne peut pas valider un vrai scan. Sur l'iPhone, dans l'application installée :

1. Ouvrir « + » puis « Scanner le code-barres »
2. Autoriser la caméra si iOS le demande
3. Cadrer le code-barres d'un disque récent : les pressages doivent apparaître en
   quelques secondes
4. Cadrer un vinyle des années 70 sans code-barres : rien ne se passe, ce qui est normal,
   et le texte de l'écran doit l'avoir annoncé
5. Refuser la caméra volontairement : le message d'erreur doit proposer la recherche par titre
6. Passer en mode avion et rouvrir l'écran de scan : la caméra doit s'ouvrir quand même,
   preuve que le `.wasm` est bien précaché. La recherche Discogs échouera, avec le message
   de connexion — c'est attendu.

---

## Hors scope

- Scan en rafale de plusieurs disques d'affilée : personne ne l'a demandé, et le flux
  passe de toute façon par un choix de pressage à chaque fois.
- Saisie manuelle d'un code-barres au clavier : la recherche par titre couvre déjà ce cas.
- Lecture des codes matriciels gravés dans le vinyle : ce ne sont pas des codes-barres.
