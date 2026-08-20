/**
 * Lit l'identifiant de disque present dans une URL.
 *
 * Les parametres d'URL sont des chaines quelconques : rien n'empeche d'arriver sur
 * `/disque/abc`. `Number('abc')` vaut alors NaN, que Dexie refuse comme cle et qui
 * faisait planter l'ecran — page blanche, sans aucun moyen de repartir puisqu'une
 * application ajoutee a l'ecran d'accueil n'a ni barre d'adresse ni bouton retour.
 */
export function numeroDisque(parametre: string | undefined): number | null {
  if (parametre === undefined || !/^\d+$/.test(parametre)) return null;
  const numero = Number(parametre);
  // Au-dela, l'entier n'est plus representable exactement et ne peut etre une cle.
  return Number.isSafeInteger(numero) && numero > 0 ? numero : null;
}
