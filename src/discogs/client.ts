import { lireJeton } from '../reglages';

const BASE = 'https://api.discogs.com';

/** Erreur portant un message déjà rédigé pour l'utilisatrice. */
export class ErreurDiscogs extends Error {}

/**
 * On n'envoie volontairement pas de `User-Agent` : c'est un en-tête interdit dans
 * `fetch`, que le navigateur supprime. Il fournit le sien, que Discogs accepte —
 * vérifié depuis Chromium le 2026-08-18.
 */
export async function appelerDiscogs<T>(chemin: string): Promise<T> {
  const entetes: Record<string, string> = {};

  const jeton = lireJeton();
  if (jeton !== null) entetes.Authorization = `Discogs token=${jeton}`;

  let reponse: Response;
  try {
    reponse = await fetch(BASE + chemin, { headers: entetes });
  } catch {
    throw new ErreurDiscogs(
      'Pas de connexion à Discogs. Vérifiez votre connexion Internet et réessayez.',
    );
  }

  if (reponse.status === 401) {
    throw new ErreurDiscogs(
      'Votre jeton Discogs est refusé. Vérifiez-le dans les Réglages, ou effacez-le : '
      + 'l\'application fonctionne sans.',
    );
  }
  if (reponse.status === 429) {
    throw new ErreurDiscogs(
      'Trop de recherches d\'un coup. Attendez une minute avant de réessayer.',
    );
  }
  if (!reponse.ok) {
    throw new ErreurDiscogs(`Discogs a répondu une erreur ${reponse.status}.`);
  }

  return (await reponse.json()) as T;
}
