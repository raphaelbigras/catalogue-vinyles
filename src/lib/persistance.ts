/**
 * Protection du stockage contre l'effacement automatique par iOS.
 *
 * Par defaut, le navigateur considere les donnees d'un site comme jetables : il
 * peut les supprimer quand l'appareil manque d'espace, sans prevenir. Un stockage
 * « persistant » sort de cette categorie et n'est plus efface que par un geste
 * explicite de l'utilisatrice.
 *
 * Safari implemente `persist()` depuis la version 15.2 (iOS compris) et decide
 * seul, sans poser de question : on ne peut donc que demander, pas exiger. La
 * sauvegarde manuelle reste la seule vraie garantie — ceci ne fait que retirer
 * la cause de perte la plus sournoise, celle qu'aucun geste ne declenche.
 */

/** Le sous-ensemble de `StorageManager` dont on depend, pour pouvoir le simuler. */
export type GestionnaireStockage = Pick<StorageManager, 'persist' | 'persisted'>;

/** `true` protege, `false` refuse, `null` si le navigateur ne sait pas repondre. */
export async function demanderPersistance(
  stockage: GestionnaireStockage | undefined = globalThis.navigator?.storage,
): Promise<boolean | null> {
  if (stockage?.persist === undefined) return null;
  try {
    // Redemander alors que c'est deja accorde ferait un aller-retour inutile a
    // chaque lancement de l'app.
    if (await stockage.persisted()) return true;
    return await stockage.persist();
  } catch {
    // Un navigateur qui expose la methode mais la rejette ne doit pas empecher
    // l'app de demarrer : la collection reste consultable, simplement exposee.
    return null;
  }
}
