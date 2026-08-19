import { describe, expect, test } from 'vitest';
import { BOM_UTF8, versCSV, versTexteAnnonce } from './csv';
import { DISQUE_VIDE, type Disque } from '../db/schema';

function disque(champs: Partial<Disque>): Disque {
  return { ...DISQUE_VIDE, id: 1, dateAjout: new Date(), dateModif: new Date(), ...champs };
}

const HEPTADE = disque({
  id: 1, artiste: 'Harmonium', album: "L'Heptade", annee: 1976, label: 'CBS',
  noCatalogue: 'PGF 90348', pays: 'Canada', format: '2xLP', etatDisque: 'VG+',
  etatPochette: 'VG', quantite: 1, valeurEstimee: 45.5,
});

describe('versCSV', () => {
  test('commence par un BOM UTF-8, sans quoi Excel casse les accents', () => {
    expect(versCSV([HEPTADE]).startsWith(BOM_UTF8)).toBe(true);
  });

  test('sépare par des points-virgules, comme l\'attend Excel en français', () => {
    const lignes = versCSV([HEPTADE]).replace(BOM_UTF8, '').split('\r\n');
    expect(lignes[0].split(';')[0]).toBe('N° inventaire');
    expect(lignes[1].split(';')[1]).toBe('Harmonium');
  });

  test('écrit une ligne d\'en-tête puis une ligne par disque', () => {
    const lignes = versCSV([HEPTADE, disque({ id: 2 })]).replace(BOM_UTF8, '').trimEnd().split('\r\n');
    expect(lignes).toHaveLength(3);
  });

  test('protège un champ contenant un point-virgule', () => {
    const piege = disque({ artiste: 'Crosby; Stills' });
    expect(versCSV([piege])).toContain('"Crosby; Stills"');
  });

  test('double les guillemets internes, selon la convention CSV', () => {
    const piege = disque({ album: 'Le "meilleur" album' });
    expect(versCSV([piege])).toContain('"Le ""meilleur"" album"');
  });

  test('protège un champ contenant un saut de ligne', () => {
    const piege = disque({ notes: 'Ligne un\nLigne deux' });
    expect(versCSV([piege])).toContain('"Ligne un\nLigne deux"');
  });

  test('écrit la virgule décimale, comme Excel en français', () => {
    expect(versCSV([HEPTADE])).toContain('45,50');
  });

  test('laisse la valeur vide plutôt que d\'écrire zéro quand elle est inconnue', () => {
    const lignes = versCSV([disque({ valeurEstimee: null })]).replace(BOM_UTF8, '').split('\r\n');
    expect(lignes[1].split(';').at(-2)).toBe('');
  });

  test('produit seulement l\'en-tête pour une collection vide', () => {
    expect(versCSV([]).replace(BOM_UTF8, '').trimEnd().split('\r\n')).toHaveLength(1);
  });
});

describe('versTexteAnnonce', () => {
  test('décrit le disque en une ligne lisible', () => {
    expect(versTexteAnnonce([HEPTADE])).toBe(
      "Harmonium — L'Heptade (1976, Canada, CBS PGF 90348, 2xLP) — disque VG+, pochette VG — 45,50 $",
    );
  });

  test('omet la valeur quand elle est inconnue', () => {
    const texte = versTexteAnnonce([disque({ artiste: 'A', album: 'B', valeurEstimee: null })]);
    expect(texte).not.toContain('$');
  });

  test('signale une pochette générique, qui change beaucoup la valeur', () => {
    const texte = versTexteAnnonce([disque({ artiste: 'A', album: 'B', pochetteGenerique: true })]);
    expect(texte).toContain('pochette générique');
  });

  test('note la quantité au-delà d\'un exemplaire', () => {
    expect(versTexteAnnonce([disque({ artiste: 'A', album: 'B', quantite: 3 })])).toContain('×3');
  });

  test('sépare les disques par des sauts de ligne', () => {
    const texte = versTexteAnnonce([disque({ artiste: 'A', album: 'B' }), disque({ artiste: 'C', album: 'D' })]);
    expect(texte.split('\n')).toHaveLength(2);
  });
});
