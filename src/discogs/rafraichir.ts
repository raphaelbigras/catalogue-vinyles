import type { Disque } from '../db/schema';
import { traiterEnFile, type OptionsFile, type Progression } from '../lib/file-attente';

/**
 * Cadence mesurée sur l'API : 25 requêtes/minute en anonyme, 60 avec un jeton.
 * On garde une marge sous la limite théorique (2 400 / 1 000 ms) pour absorber
 * les variations de latence sans déclencher de 429.
 */
export function intervalleRecommande(aUnJeton: boolean): number {
  return aUnJeton ? 1100 : 2500;
}

/** Un disque rafraîchissable a forcément un identifiant Discogs. */
export type DisqueRafraichissable = Disque & { discogsReleaseId: number };

/**
 * Un disque est rafraîchissable s'il vient de Discogs ET si sa valeur n'a pas été
 * saisie à la main. La seconde condition est la raison d'être de `valeurSource` :
 * une estimation corrigée manuellement ne doit jamais être écrasée par un lot.
 *
 * Le prédicat de type évite tout `as number` en aval sur `discogsReleaseId`.
 */
export function disquesRafraichissables(disques: readonly Disque[]): DisqueRafraichissable[] {
  return disques.filter(
    (d): d is DisqueRafraichissable => d.discogsReleaseId !== null && d.valeurSource !== 'manuelle',
  );
}

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
    const prix = await deps.obtenirPrix(d.discogsReleaseId);

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
