import { describe, expect, test } from 'vitest';
import { versPressage } from './mapping';
import type { ResultatRecherche } from './types';

/** Réponse réelle observée le 2026-08-18 pour le pressage canadien de 1976. */
const HEPTADE_1976: ResultatRecherche = {
  id: 1887068,
  title: "Harmonium - L'Heptade",
  year: 1976,
  country: 'Canada',
  catno: 'PGF 90348',
  label: ['CBS', 'CBS Inc.', 'Columbia Records Pressing Plant, Don Mills, ON', 'Customatrix'],
  formats: [{ name: 'Vinyl', qty: '2', descriptions: ['LP', 'Album', 'Stereo'] }],
  thumb: '',
};

describe('versPressage', () => {
  test('reprend l\'identifiant, le titre, l\'année, le pays et le n° de catalogue', () => {
    const p = versPressage(HEPTADE_1976);
    expect(p.releaseId).toBe(1887068);
    expect(p.titre).toBe("Harmonium - L'Heptade");
    expect(p.annee).toBe(1976);
    expect(p.pays).toBe('Canada');
    expect(p.noCatalogue).toBe('PGF 90348');
  });

  test('ne garde que le premier label, les suivants étant des usines de pressage', () => {
    expect(versPressage(HEPTADE_1976).label).toBe('CBS');
  });

  test('note la quantité pour un double album', () => {
    expect(versPressage(HEPTADE_1976).format).toBe('2xLP');
  });

  test('omet la quantité pour un disque simple', () => {
    const simple = { ...HEPTADE_1976, formats: [{ name: 'Vinyl', qty: '1', descriptions: ['LP', 'Album'] }] };
    expect(versPressage(simple).format).toBe('LP');
  });

  test('reconnaît un 45 tours', () => {
    const quaranteCinq = { ...HEPTADE_1976, formats: [{ name: 'Vinyl', qty: '1', descriptions: ['7"', 'Single', '45 RPM'] }] };
    expect(versPressage(quaranteCinq).format).toBe('7"');
  });

  test('retombe sur le nom du format quand aucune description n\'est reconnue', () => {
    const inconnu = { ...HEPTADE_1976, formats: [{ name: 'Vinyl', qty: '1', descriptions: ['Misprint'] }] };
    expect(versPressage(inconnu).format).toBe('Vinyl');
  });

  test('convertit une vignette vide en null plutôt qu\'en chaîne vide', () => {
    expect(versPressage(HEPTADE_1976).vignette).toBeNull();
  });

  test('conserve une vignette présente', () => {
    const avecImage = { ...HEPTADE_1976, thumb: 'https://i.discogs.com/abc.jpg' };
    expect(versPressage(avecImage).vignette).toBe('https://i.discogs.com/abc.jpg');
  });

  test('survit à un résultat dépouillé de tous ses champs optionnels', () => {
    const minimal: ResultatRecherche = { id: 42, title: 'Inconnu' };
    const p = versPressage(minimal);
    expect(p).toEqual({
      releaseId: 42,
      titre: 'Inconnu',
      annee: null,
      pays: '',
      noCatalogue: '',
      label: '',
      format: '',
      vignette: null,
    });
  });
});
