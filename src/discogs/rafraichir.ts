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
