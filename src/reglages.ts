const CLE_JETON = 'discogs-token';

/** Retourne le jeton, ou null s'il n'y en a pas. Jamais une chaîne vide. */
export function lireJeton(): string | null {
  const valeur = localStorage.getItem(CLE_JETON);
  return valeur === null || valeur === '' ? null : valeur;
}

export function enregistrerJeton(jeton: string): void {
  const propre = jeton.trim();
  if (propre === '') {
    effacerJeton();
    return;
  }
  localStorage.setItem(CLE_JETON, propre);
}

export function effacerJeton(): void {
  localStorage.removeItem(CLE_JETON);
}
