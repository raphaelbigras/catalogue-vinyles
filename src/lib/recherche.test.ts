import { describe, expect, test } from 'vitest';
import { filtrerDisques, normaliser, trierDisques } from './recherche';
import { DISQUE_VIDE, type Disque } from '../db/schema';

function disque(champs: Partial<Disque>): Disque {
  return { ...DISQUE_VIDE, id: 1, dateAjout: new Date(), dateModif: new Date(), ...champs };
}

const CATALOGUE = [
  disque({ id: 1, artiste: 'Harmonium', album: 'L\'heptade', annee: 1976, valeurEstimee: 45 }),
  disque({ id: 2, artiste: 'Beau Dommage', album: 'Beau Dommage', annee: 1974, valeurEstimee: 12 }),
  disque({ id: 3, artiste: 'Félix Leclerc', album: 'Le tour de l\'île', annee: 1975, valeurEstimee: null }),
];

describe('normaliser', () => {
  test('retire les accents et met en minuscules', () => {
    expect(normaliser('Félix Leclerc')).toBe('felix leclerc');
  });

  test('gère la cédille', () => {
    expect(normaliser('Garçon')).toBe('garcon');
  });
});

describe('filtrerDisques', () => {
  test('retourne tout quand la requête est vide ou blanche', () => {
    expect(filtrerDisques(CATALOGUE, '')).toHaveLength(3);
    expect(filtrerDisques(CATALOGUE, '   ')).toHaveLength(3);
  });

  test('trouve un disque même si l\'utilisatrice tape sans accents', () => {
    expect(filtrerDisques(CATALOGUE, 'felix').map((d) => d.id)).toEqual([3]);
  });

  test('ignore la casse', () => {
    expect(filtrerDisques(CATALOGUE, 'HARMONIUM').map((d) => d.id)).toEqual([1]);
  });

  test('exige que tous les mots correspondent, dans n\'importe quel ordre', () => {
    expect(filtrerDisques(CATALOGUE, 'heptade harmonium').map((d) => d.id)).toEqual([1]);
    expect(filtrerDisques(CATALOGUE, 'harmonium dommage')).toHaveLength(0);
  });

  test('cherche aussi dans le numéro de catalogue', () => {
    const avecCatno = [disque({ id: 9, noCatalogue: 'CEL 6922' })];
    expect(filtrerDisques(avecCatno, 'cel 6922').map((d) => d.id)).toEqual([9]);
  });
});

describe('trierDisques', () => {
  test('trie par artiste sans tenir compte des accents', () => {
    expect(trierDisques(CATALOGUE, 'artiste').map((d) => d.id)).toEqual([2, 3, 1]);
  });

  test('trie par année, la plus récente en premier', () => {
    expect(trierDisques(CATALOGUE, 'annee').map((d) => d.id)).toEqual([1, 3, 2]);
  });

  test('trie par valeur décroissante en reléguant les valeurs absentes à la fin', () => {
    expect(trierDisques(CATALOGUE, 'valeur').map((d) => d.id)).toEqual([1, 2, 3]);
  });

  test('ne modifie pas le tableau reçu', () => {
    const original = [...CATALOGUE];
    trierDisques(CATALOGUE, 'valeur');
    expect(CATALOGUE).toEqual(original);
  });
});
