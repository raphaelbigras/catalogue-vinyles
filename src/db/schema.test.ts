import { describe, expect, test } from 'vitest';
import { ETATS, ETATS_LIBELLES } from './schema';

describe('échelle de grades', () => {
  test('contient les 8 grades Discogs du meilleur au pire', () => {
    expect(ETATS).toEqual(['M', 'NM', 'VG+', 'VG', 'G+', 'G', 'F', 'P']);
  });

  test('chaque grade a un libellé en français', () => {
    for (const etat of ETATS) {
      expect(ETATS_LIBELLES[etat]).toBeTruthy();
    }
  });
});
