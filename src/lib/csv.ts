import type { Disque } from '../db/schema';

/** Sans cette marque en tête de fichier, Excel lit les accents comme du charabia. */
export const BOM_UTF8 = '﻿';

const SEPARATEUR = ';';

const COLONNES = [
  'N° inventaire', 'Artiste', 'Album', 'Année', 'Label', 'N° catalogue', 'Pays',
  'Format', 'État disque', 'État pochette', 'Pochette générique', 'Quantité',
  'Valeur estimée (CAD)', 'Notes',
] as const;

/** Met un champ entre guillemets s'il contient un séparateur, un guillemet ou un saut de ligne. */
function echapper(valeur: string): string {
  if (!/[;"\r\n]/.test(valeur)) return valeur;
  return `"${valeur.replace(/"/g, '""')}"`;
}

/** Excel en français attend la virgule décimale. */
function montant(valeur: number | null): string {
  return valeur === null ? '' : valeur.toFixed(2).replace('.', ',');
}

export function versCSV(disques: readonly Disque[]): string {
  const lignes = [COLONNES.join(SEPARATEUR)];

  for (const d of disques) {
    lignes.push([
      String(d.id), d.artiste, d.album, d.annee === null ? '' : String(d.annee),
      d.label, d.noCatalogue, d.pays, d.format, d.etatDisque, d.etatPochette,
      d.pochetteGenerique ? 'Oui' : 'Non', String(d.quantite),
      montant(d.valeurEstimee), d.notes,
    ].map(echapper).join(SEPARATEUR));
  }

  // CRLF : c'est ce qu'attend Excel sous Windows.
  return BOM_UTF8 + lignes.join('\r\n') + '\r\n';
}

/** Une ligne par disque, prête à coller dans une annonce Marketplace ou Kijiji. */
export function versTexteAnnonce(disques: readonly Disque[]): string {
  return disques.map((d) => {
    const pressage = [
      d.annee === null ? null : String(d.annee),
      d.pays === '' ? null : d.pays,
      [d.label, d.noCatalogue].filter((x) => x !== '').join(' ') || null,
      d.format === '' ? null : d.format,
    ].filter((x) => x !== null).join(', ');

    const etat = `disque ${d.etatDisque}, pochette ${d.etatPochette}`
      + (d.pochetteGenerique ? ' (pochette générique)' : '');

    // Le pressage se colle au titre entre parentheses ; le reste est separe par des tirets.
    const titre = `${d.artiste} — ${d.album}`
      + (pressage === '' ? '' : ` (${pressage})`);

    return [
      titre,
      etat,
      d.quantite > 1 ? `×${d.quantite}` : null,
      d.valeurEstimee === null ? null : `${montant(d.valeurEstimee)} $`,
    ].filter((x) => x !== null).join(' — ');
  }).join('\n');
}
