/**
 * Propose un fichier à l'utilisatrice.
 *
 * Sur iPhone, `navigator.share` ouvre la feuille de partage, d'où « Enregistrer dans
 * Fichiers » vers iCloud Drive — vérifié sur l'appareil cible en phase 0. Ailleurs, on
 * retombe sur un téléchargement classique.
 *
 * Retourne `false` si l'utilisatrice a annulé, pour ne pas marquer une sauvegarde
 * qui n'a pas eu lieu.
 */
export async function proposerFichier(
  nom: string,
  contenu: string,
  typeMime: string,
): Promise<boolean> {
  const fichier = new File([contenu], nom, { type: typeMime });

  if (navigator.canShare?.({ files: [fichier] }) === true) {
    try {
      await navigator.share({ files: [fichier] });
      return true;
    } catch (e) {
      // L'utilisatrice a fermé la feuille de partage : ce n'est pas une erreur.
      if (e instanceof Error && e.name === 'AbortError') return false;
      // Tout autre échec bascule sur le téléchargement plutôt que d'abandonner.
    }
  }

  telecharger(nom, fichier);
  return true;
}

function telecharger(nom: string, fichier: File): void {
  const url = URL.createObjectURL(fichier);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nom;
  lien.click();
  URL.revokeObjectURL(url);
}

/** Nom horodaté, pour que plusieurs sauvegardes cohabitent dans Fichiers. */
export function nomHorodate(prefixe: string, extension: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `${prefixe}-${date}.${extension}`;
}
