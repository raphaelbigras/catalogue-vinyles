/**
 * Formes sous lesquelles chercher un code-barres sur Discogs, la plus probable d'abord.
 *
 * Un produit nord-américain porte un UPC-A à 12 chiffres. Les lecteurs le rapportent
 * tantôt tel quel, tantôt converti en EAN-13 avec un zéro initial. Discogs, lui, ne
 * connaît souvent qu'une seule des deux formes : mesuré le 2026-08-18, le même disque
 * se trouve sous `602537351169` mais pas sous `6025373511698`.
 */
export function variantesCodeBarres(code: string): string[] {
  const propre = code.replace(/[\s-]/g, '');
  if (propre === '' || !/^\d+$/.test(propre)) return [];

  const variantes = [propre];

  if (propre.length === 13 && propre.startsWith('0')) {
    variantes.push(propre.slice(1));
  } else if (propre.length === 12) {
    variantes.push(`0${propre}`);
  }

  return variantes;
}
