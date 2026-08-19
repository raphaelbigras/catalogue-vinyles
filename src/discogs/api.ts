import { appelerDiscogs } from './client';
import { prixCAD, versChampsDisque, versPressage, type ChampsDiscogs } from './mapping';
import type { Pressage, ReleaseDiscogs, ResultatRecherche, StatsMarche } from './types';

interface ReponseRecherche {
  results?: ResultatRecherche[];
}

/**
 * Cherche des pressages vinyle. `parCodeBarres` bascule sur la recherche par code-barres,
 * qui ne donne rien sur les disques pressés avant ~1980 — ils n'en portent pas.
 */
export async function chercher(
  requete: string,
  options: { parCodeBarres?: boolean } = {},
): Promise<Pressage[]> {
  const champ = options.parCodeBarres === true ? 'barcode' : 'q';
  const chemin =
    `/database/search?${champ}=${encodeURIComponent(requete)}` +
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
