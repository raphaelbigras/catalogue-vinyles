import { appelerDiscogs } from './client';
import { prixCAD, versChampsDisque, versPressage, type ChampsDiscogs } from './mapping';
import type { Pressage, ReleaseDiscogs, ResultatRecherche, StatsMarche } from './types';
import { variantesCodeBarres } from '../scan/code-barres';

interface ReponseRecherche {
  results?: ResultatRecherche[];
}

/** Cherche des pressages vinyle par titre. */
export async function chercher(requete: string): Promise<Pressage[]> {
  const chemin =
    `/database/search?q=${encodeURIComponent(requete)}` +
    '&type=release&format=Vinyl&per_page=25';

  const reponse = await appelerDiscogs<ReponseRecherche>(chemin);
  return (reponse.results ?? []).map(versPressage);
}

/** Récupère artiste et album séparés, et un label non pollué. */
export async function obtenirFiche(releaseId: number): Promise<ChampsDiscogs> {
  return versChampsDisque(await appelerDiscogs<ReleaseDiscogs>(`/releases/${releaseId}`));
}

/** Seul endpoint qui respecte réellement la devise demandée. */
export async function obtenirPrix(
  releaseId: number,
): Promise<{ valeur: number | null; nombreEnVente: number | null }> {
  return prixCAD(
    await appelerDiscogs<StatsMarche>(`/marketplace/stats/${releaseId}?curr_abbr=CAD`),
  );
}

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
