import type { Disque } from '../db/schema';

const VERSION = 1;

/** Champs à reconvertir en `Date` : JSON ne connaît que les chaînes. */
const CHAMPS_DATE = ['dateAjout', 'dateModif', 'valeurMaj'] as const;

/**
 * Champs texte ajoutés après coup : une sauvegarde plus ancienne ne les contient
 * pas, et un champ absent vaut `undefined`, ce que le reste du code ne connaît
 * pas — il attend `null`.
 */
const CHAMPS_TEXTE_OPTIONNELS = ['pochettePetite', 'pochetteGrande'] as const;

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
    for (const champ of CHAMPS_TEXTE_OPTIONNELS) {
      disque[champ] = typeof disque[champ] === 'string' ? disque[champ] : null;
    }
    return disque as unknown as Disque;
  });
}
