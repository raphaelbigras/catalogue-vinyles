const CLE_COMPTEUR = 'modifications-en-attente';
const CLE_DATE = 'derniere-sauvegarde';

export function modificationsEnAttente(): number {
  return Number(localStorage.getItem(CLE_COMPTEUR) ?? '0');
}

/** Appelé à chaque écriture en base, pour alimenter le bandeau de rappel. */
export function marquerModification(): void {
  localStorage.setItem(CLE_COMPTEUR, String(modificationsEnAttente() + 1));
}

export function marquerSauvegarde(): void {
  localStorage.setItem(CLE_COMPTEUR, '0');
  localStorage.setItem(CLE_DATE, new Date().toISOString());
}

export function derniereSauvegarde(): Date | null {
  const valeur = localStorage.getItem(CLE_DATE);
  return valeur === null ? null : new Date(valeur);
}
