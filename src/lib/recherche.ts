import type { Disque } from '../db/schema';

export type Tri = 'artiste' | 'annee' | 'valeur';

export const TRIS_LIBELLES: Record<Tri, string> = {
  artiste: 'Artiste',
  annee: 'Année',
  valeur: 'Valeur',
};

/**
 * NFD sépare chaque lettre accentuée en lettre + diacritique,
 * ce qui permet de supprimer les diacritiques par une regex Unicode.
 */
export function normaliser(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

export function filtrerDisques(disques: Disque[], requete: string): Disque[] {
  const mots = normaliser(requete.trim()).split(/\s+/).filter(Boolean);
  if (mots.length === 0) return disques;

  return disques.filter((d) => {
    const champs = normaliser(
      [d.artiste, d.album, d.label, d.noCatalogue, d.pays, d.notes].join(' '),
    );
    return mots.every((mot) => champs.includes(mot));
  });
}

/** Trie en décroissant, en plaçant toujours les valeurs absentes à la fin. */
function comparerDecroissant(a: number | null, b: number | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

export function trierDisques(disques: Disque[], tri: Tri): Disque[] {
  const copie = [...disques];

  switch (tri) {
    case 'artiste':
      return copie.sort(
        (a, b) =>
          normaliser(a.artiste).localeCompare(normaliser(b.artiste)) ||
          normaliser(a.album).localeCompare(normaliser(b.album)),
      );
    case 'annee':
      return copie.sort((a, b) => comparerDecroissant(a.annee, b.annee));
    case 'valeur':
      return copie.sort((a, b) => comparerDecroissant(a.valeurEstimee, b.valeurEstimee));
  }
}
