import type { Disque, NouveauDisque } from '../db/schema';
import { normaliser } from './recherche';

/**
 * Un disque de la collection que le nouveau ferait doublon.
 *
 * `memePressage` distingue deux situations que l'utilisatrice ne doit pas
 * confondre : le meme pressage Discogs est presque surement le meme disque saisi
 * deux fois, tandis qu'un simple homonyme peut parfaitement etre une reedition
 * legitime, de valeur differente.
 */
export interface Doublon {
  disque: Disque;
  memePressage: boolean;
}

/**
 * Ramene un libelle a une forme comparable : sans accents, sans casse, et avec
 * les espaces reduits a un seul. Un double espace de frappe ne doit pas suffire
 * a faire passer un disque pour un autre.
 */
function cle(texte: string): string {
  return normaliser(texte).trim().replace(/\s+/g, ' ');
}

/**
 * Cherche si un disque equivalent figure deja dans la collection.
 *
 * Deux criteres, du plus sur au plus large. Le second sert aux disques saisis a
 * la main, qui n'ont aucun identifiant Discogs a comparer.
 */
export function trouverDoublon(
  collection: readonly Disque[],
  nouveau: NouveauDisque,
): Doublon | null {
  if (nouveau.discogsReleaseId !== null) {
    const memePressage = collection.find(
      (d) => d.discogsReleaseId === nouveau.discogsReleaseId,
    );
    if (memePressage !== undefined) return { disque: memePressage, memePressage: true };
  }

  const artiste = cle(nouveau.artiste);
  const album = cle(nouveau.album);
  // Un formulaire encore vide ressemblerait a tous les autres formulaires vides.
  if (artiste === '' || album === '') return null;

  const homonyme = collection.find(
    (d) => cle(d.artiste) === artiste && cle(d.album) === album,
  );
  return homonyme === undefined ? null : { disque: homonyme, memePressage: false };
}

/** Texte de la demande de confirmation, redige pour l'utilisatrice. */
export function messageDoublon({ disque, memePressage }: Doublon): string {
  const identification = `« ${disque.album} » de ${disque.artiste} est déjà dans votre `
    + `collection, sous le n° ${disque.id}`;

  const precision = memePressage
    ? `, avec exactement le même pressage.\n\nSi vous possédez deux exemplaires du même `
      + `disque, annulez et augmentez plutôt la quantité du n° ${disque.id}.`
    : '.\n\nIl peut s\'agir d\'un autre pressage, qui a sa propre valeur.';

  return `${identification}${precision}\n\nL'ajouter quand même ?`;
}
