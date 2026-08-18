import { describe, expect, test } from 'vitest';
import { formaterCAD, valeurTotale } from './valeur';
import { DISQUE_VIDE, type Disque } from '../db/schema';

/** Fabrique un Disque complet à partir de quelques champs, pour alléger les tests. */
function disque(champs: Partial<Disque>): Disque {
  return {
    ...DISQUE_VIDE,
    id: 1,
    dateAjout: new Date(),
    dateModif: new Date(),
    ...champs,
  };
}

/** Intl insère des espaces insécables variables selon la version d'ICU ; on les normalise. */
function espacesNormalises(texte: string): string {
  return texte.replace(/\u00A0|\u202F/g, ' ');
}

describe('valeurTotale', () => {
  test('vaut 0 pour une collection vide', () => {
    expect(valeurTotale([])).toBe(0);
  });

  test('multiplie la valeur par la quantité', () => {
    expect(valeurTotale([disque({ valeurEstimee: 12.5, quantite: 2 })])).toBe(25);
  });

  test('ignore les disques sans valeur estimée', () => {
    const collection = [
      disque({ valeurEstimee: 10, quantite: 1 }),
      disque({ valeurEstimee: null, quantite: 3 }),
    ];
    expect(valeurTotale(collection)).toBe(10);
  });

  test('arrondit au cent près malgré les erreurs de virgule flottante', () => {
    const collection = [
      disque({ valeurEstimee: 0.1, quantite: 1 }),
      disque({ valeurEstimee: 0.2, quantite: 1 }),
    ];
    expect(valeurTotale(collection)).toBe(0.3);
  });
});

describe('formaterCAD', () => {
  test('formate en dollars canadiens à la française', () => {
    expect(espacesNormalises(formaterCAD(1234.5))).toBe('1 234,50 $');
  });

  test('formate zéro', () => {
    expect(espacesNormalises(formaterCAD(0))).toBe('0,00 $');
  });
});
