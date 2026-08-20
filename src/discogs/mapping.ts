import type { NouveauDisque } from '../db/schema';
import { normaliser } from '../lib/recherche';
import type { FormatDiscogs, Pressage, ReleaseDiscogs, ResultatRecherche, StatsMarche } from './types';

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

/** Retourne la premiere chaine reellement remplie, ou null. */
function premiereNonVide(valeurs: (string | undefined)[]): string | null {
  return valeurs.find((v) => v !== undefined && v !== '') ?? null;
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
    // On prefere `cover_image` (600x600, qualite 90) a `thumb` (150x150, qualite 40) :
    // l'utilisatrice voit mal de pres, et 150 px sont deja insuffisants sur un ecran
    // Retina meme a la petite taille d'origine.
    vignette: premiereNonVide([resultat.cover_image, resultat.thumb]),
  };
}

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

/**
 * Fusionne les pressages qui s'afficheraient exactement pareil.
 *
 * Discogs liste souvent separement un original et ses repressages sans qu'aucun
 * champ visible ne les distingue : une recherche « Harmonium Heptade » renvoie
 * onze resultats pour environ cinq pressages reels, dont quatre portant le meme
 * `PGF 90348`. Montrer des lignes indiscernables n'aide pas a choisir, ça fait
 * douter. On ne fusionne donc que ce qui est vraiment identique a l'ecran : des
 * qu'une annee, un pays, un label, un n° de catalogue ou un format differe, les
 * deux lignes restent, car cette difference peut valoir cher.
 */
export function dedupliquerPressages(pressages: readonly Pressage[]): Pressage[] {
  const vus = new Set<string>();
  return pressages.filter((p) => {
    // Le titre est normalise : Discogs ecrit tantot « L'Heptade », tantot
    // « L'heptade » pour le meme pressage, et cette casse ne distingue rien.
    const empreinte = [
      normaliser(p.titre), p.annee, p.pays, normaliser(p.label), p.noCatalogue, p.format,
    ].join('|');
    if (vus.has(empreinte)) return false;
    vus.add(empreinte);
    return true;
  });
}
