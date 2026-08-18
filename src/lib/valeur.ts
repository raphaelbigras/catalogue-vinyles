import type { Disque } from '../db/schema';

export function valeurTotale(disques: Disque[]): number {
  const total = disques.reduce(
    (somme, d) => somme + (d.valeurEstimee ?? 0) * d.quantite,
    0,
  );
  return Math.round(total * 100) / 100;
}

const FORMAT_CAD = new Intl.NumberFormat('fr-CA', {
  style: 'currency',
  currency: 'CAD',
});

export function formaterCAD(montant: number): string {
  return FORMAT_CAD.format(montant);
}
