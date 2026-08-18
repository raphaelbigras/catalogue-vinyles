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
