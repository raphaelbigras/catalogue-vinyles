# Catalogue de disques vinyles — design

**Date :** 2026-08-18
**Statut :** approuvé

## Contexte

Inventorier une collection d'environ 200 disques vinyles héritée, en vue d'une revente
éventuelle. L'utilisatrice finale est une non-technicienne qui travaille depuis son
iPhone. Le développeur travaille sous Windows et n'a **ni Mac ni Xcode**.

Objectif : une app installée sur l'écran d'accueil de son iPhone, qui minimise la saisie
manuelle et produit une liste exploitable pour vendre.

## Contraintes non négociables

1. **Aucun frais récurrent.** Le Apple Developer Program (99 USD/an) est exclu.
2. **Installation permanente et sans entretien.** Rien qui expire, rien à rebrancher.
3. **Développement depuis Windows.**

## Décision d'architecture : PWA

La combinaison des trois contraintes ne laisse qu'une option viable.

### Alternatives évaluées et rejetées

| Option | Rejetée parce que |
|---|---|
| Swift / SwiftUI | macOS + Xcode obligatoires |
| Flutter + Codemagic | Build cloud possible, mais **aucun hot-reload sur iPhone physique depuis Windows** : boucle de 10-20 min par itération d'interface |
| React Native + Expo + EAS Build | Techniquement excellent (Expo Go donne une boucle instantanée depuis Windows), mais l'installation permanente exige les 99 USD/an — contrainte 1 |
| Sideload Apple ID gratuit (Sideloadly / AltStore) | **Expiration à 7 jours** imposée par Apple. Exigerait de rebrancher l'iPhone au laptop chaque semaine — contrainte 2 |

**Retenu : PWA installée sur l'écran d'accueil.** Gratuite, permanente, installée par
un simple lien, mises à jour automatiques au lancement. Les web apps installées s'ouvrent
en plein écran sans barre d'adresse ni onglets : la différence avec une app native est
invisible pour cet usage.

Ce que l'on abandonne : la sauvegarde iCloud automatique des données (un sandbox natif
est inclus dans la sauvegarde de l'iPhone, pas le stockage d'une web app). Mitigation en
section « Sauvegarde ».

## Stack

| Rôle | Choix | Version (vérifiée 2026-08-18) |
|---|---|---|
| Build | Vite | 8.2.1 |
| UI | React | 19.2.8 |
| Langage | TypeScript | 7.0.2 |
| Routage | React Router | 8.3.0 |
| Stockage | Dexie (IndexedDB) | 4.4.5 |
| PWA / hors-ligne | vite-plugin-pwa (Workbox) | 1.3.0 |
| Scan code-barres | zxing-wasm | 3.1.3 |
| Styles | Tailwind CSS | 4.3.3 |
| Tests | Vitest | 4.1.11 |
| Hébergement | Vercel (statique, HTTPS, gratuit) | — |

Aucun backend, aucune base serveur, aucun compte utilisateur. Déploiement par `git push`.

Le développeur est expérimenté mais **pas en JS/React** : le code commente les
spécificités React, les hooks et les patterns du service worker, sans expliquer les bases
de la programmation.

**Interface entièrement en français**, pensée pour une utilisatrice non technicienne :
grandes zones tactiles, aucun jargon, aucune notion à configurer avant de pouvoir ajouter
un premier disque. Le token Discogs et les exports vivent dans les Réglages, jamais sur le
chemin principal.

## Modèle de données

```ts
type Etat = 'M' | 'NM' | 'VG+' | 'VG' | 'G+' | 'G' | 'F' | 'P';

interface Disque {
  id: number;                    // n° d'inventaire, auto-incrémenté par Dexie
  artiste: string;
  album: string;
  annee: number | null;
  label: string;
  noCatalogue: string;           // champ `catno` de Discogs
  pays: string;
  format: string;                // LP, 45t, EP, 2xLP...
  etatDisque: Etat;
  etatPochette: Etat;
  pochetteGenerique: boolean;    // pochette absente ou de remplacement
  quantite: number;
  valeurEstimee: number | null;  // CAD
  valeurSource: 'discogs' | 'manuelle';
  valeurMaj: Date | null;
  discogsReleaseId: number | null;
  discogsNumForSale: number | null;
  notes: string;
  dateAjout: Date;
  dateModif: Date;
}
```

### Justification des champs non évidents

- **`noCatalogue`** est le champ le plus important après artiste/album. Deux pressages
  visuellement identiques peuvent avoir des valeurs très différentes ; le n° de catalogue
  est ce qui les distingue.
- **Échelle à 8 grades.** L'échelle Discogs complète inclut F (Fair) et P (Poor) sous G.
  Une collection héritée en contient toujours ; une échelle à 6 grades forcerait à
  surévaluer les disques les plus usés. L'alignement sur Discogs est voulu : c'est le
  marché où la revente aura lieu.
- **`pochetteGenerique`** est distinct de `etatPochette`. Une pochette absente n'est pas
  « une pochette en mauvais état » : c'est une catégorie à part qui écrase la valeur.
- **`discogsReleaseId`** permet de rafraîchir le prix plus tard sans refaire la recherche.
- **`valeurSource` et `valeurMaj`** évitent qu'un rafraîchissement automatique écrase une
  valeur saisie à la main, et indiquent quand un prix devient périmé.

## Intégration Discogs

L'API a été testée en direct le 2026-08-18. Résultats confirmés :

- `access-control-allow-origin: *` sur les réponses **et sur le preflight OPTIONS**
  (en-tête `authorization` autorisé). Une PWA statique appelle donc l'API directement :
  **aucun proxy ni fonction serverless nécessaire**.
- `GET /database/search?barcode=…` fonctionne **sans token** (testé, 200 avec résultats).
- `GET /releases/{id}?curr_abbr=CAD` retourne `artists[].name`, `title`, `year`,
  `country`, `labels[].name`, `labels[].catno`, `formats[].name`, `lowest_price`,
  `num_for_sale`.
- **Rate limit mesuré : 25 req/min sans token** (en-tête `x-discogs-ratelimit`),
  60 avec token.

### Conséquences de conception

- Un en-tête `User-Agent` identifiant l'app est requis par Discogs sur chaque appel.
- Le rafraîchissement des prix en lot passe par une **file d'attente throttlée**
  (~1 requête / 2,5 s) avec barre de progression et annulation. Sans throttle, Discogs
  coupe autour du 26e disque.
- Le **token est optionnel**, saisi dans les Réglages, stocké localement, jamais dans le
  repo. L'app fonctionne sans, mais le champ existe comme assurance si Discogs durcit
  l'accès anonyme.
- La devise est forcée à **CAD** via `curr_abbr`.

## Écrans

1. **Liste** — recherche instantanée, tri (artiste / année / valeur), filtres par état,
   et **valeur totale de la collection** en en-tête.
2. **Fiche disque** — consultation, édition, bouton « rafraîchir le prix ».
3. **Ajout** — trois modes : *Scanner*, *Rechercher*, *Manuel*.
4. **Réglages** — token Discogs, sauvegarde, restauration, exports.

### L'écran de sélection du pressage

C'est l'écran central de l'app. Une recherche Discogs retourne plusieurs pressages du même
album. La liste de choix affiche pour chacun : **pays, année, n° de catalogue, label et
vignette de pochette**, le n° de catalogue mis en évidence, parce que c'est la valeur
imprimée sur le disque physique qui permet de confirmer le bon pressage.

Une fois le pressage choisi, tout se remplit automatiquement. Il ne reste à saisir que
**les deux états et la quantité** — les seules informations qu'aucune API ne peut deviner.

## Sauvegarde et exports

- **Sauvegarde** : bouton un tap → `navigator.share()` avec le fichier JSON →
  « Enregistrer dans Fichiers » → iCloud Drive. iOS Safari n'expose pas la File System
  Access API : une sauvegarde silencieuse et automatique est impossible, l'action doit
  partir d'un geste utilisateur.
- **Rappel** : bandeau permanent dès qu'il y a des modifications non sauvegardées
  (« 12 disques ajoutés depuis votre dernière sauvegarde »).
- **Restauration** : import du JSON, avec écran de confirmation avant écrasement.
- **CSV** : séparateur `;` + BOM UTF-8, pour qu'Excel en français ouvre le fichier sans
  casser les accents.
- **Texte d'annonce** : bloc formaté prêt à coller dans Marketplace / Kijiji.

## Tests

Vitest, ciblé sur la logique qui peut corrompre les données silencieusement :

- mapping réponse Discogs → `Disque`, y compris les cas dégradés (pas de label, pas
  d'année, plusieurs labels, artiste multiple)
- génération CSV : échappement des `;`, guillemets et sauts de ligne dans les titres
- **aller-retour export → import identique**, propriété la plus importante de la suite
- calcul de la valeur totale avec quantités et valeurs nulles
- throttle de la file d'attente : respect de l'intervalle, annulation propre

Pas de test d'interface : disproportionné pour ce projet.

## Phases

| # | Contenu | Résultat |
|---|---|---|
| 0 | Page de test : caméra, plein écran, persistance, déployée sur Vercel | valide le risque technique avant d'investir |
| 1 | Squelette PWA + Dexie + CRUD manuel + écran liste | app déjà utilisable |
| 2 | Recherche Discogs + sélection du pressage + autofill + valeur CAD | le gain de temps de saisie arrive |
| 3 | Sauvegarde / restauration / export CSV / texte d'annonce | données sécurisées et exploitables |
| 4 | Scan de code-barres (zxing-wasm) | bonus |
| 5 | Polish, déploiement, installation sur son iPhone | livré |

La phase 0 existe parce que l'accès `getUserMedia` dans une web app iOS installée est le
seul risque technique non vérifié du projet. Une page de test de 30 lignes le tranche en
une heure. Si la caméra ne passe pas, la phase 4 devient optionnelle sans rien remettre en
cause : la recherche texte reste le mode de saisie principal.

## Risques assumés

- **Le scan de code-barres servira peu.** Les vinyles pressés avant ~1980 n'en ont pas.
  Sur une collection héritée, une part importante ne se scannera pas. C'est pourquoi le
  scan est en phase 4 et non en phase 1.
- **Supprimer l'app de l'écran d'accueil efface les données.** C'est le prix du choix
  « local et gratuit ». Le bandeau de sauvegarde est la mitigation ; la synchro cloud
  reste une évolution possible si la fragilité devient inconfortable.
- **Un mauvais pressage choisi fausse la valeur estimée.** Mitigé par l'écran de sélection
  qui met le n° de catalogue en évidence.
- **L'accès anonyme à l'API Discogs pourrait être restreint un jour.** Mitigé par le champ
  token optionnel.

## Hors scope (YAGNI)

Explicitement exclus de cette version :

- photos des pochettes et des disques
- suivi de vente (statut vendu, prix obtenu, acheteur)
- synchronisation cloud et multi-appareils
- comptes utilisateurs, multi-utilisateur
- publication sur l'App Store
- intégration de vente directe sur Discogs ou eBay
