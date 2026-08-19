import { describe, expect, test } from 'vitest';
import { disquesRafraichissables, intervalleRecommande } from './rafraichir';
import { DISQUE_VIDE, type Disque } from '../db/schema';

function disque(champs: Partial<Disque>): Disque {
  return { ...DISQUE_VIDE, id: 1, dateAjout: new Date(), dateModif: new Date(), ...champs };
}

describe('intervalleRecommande', () => {
  test('espace davantage sans jeton, la cadence anonyme étant plus basse', () => {
    expect(intervalleRecommande(false)).toBe(2500);
  });

  test('accélère avec un jeton', () => {
    expect(intervalleRecommande(true)).toBe(1100);
  });

  test('reste sous la cadence autorisée dans les deux cas', () => {
    // 25 req/min sans jeton, 60 avec : l'intervalle doit dépasser 60000/limite.
    expect(intervalleRecommande(false)).toBeGreaterThan(60000 / 25);
    expect(intervalleRecommande(true)).toBeGreaterThan(60000 / 60);
  });
});

describe('disquesRafraichissables', () => {
  test('retient un disque venu de Discogs', () => {
    const collection = [disque({ id: 1, discogsReleaseId: 123, valeurSource: 'discogs' })];
    expect(disquesRafraichissables(collection).map((d) => d.id)).toEqual([1]);
  });

  test('écarte un disque saisi à la main, faute d\'identifiant Discogs', () => {
    const collection = [disque({ id: 2, discogsReleaseId: null, valeurSource: 'manuelle' })];
    expect(disquesRafraichissables(collection)).toEqual([]);
  });

  test('PRÉSERVE une valeur saisie à la main, même sur un disque venu de Discogs', () => {
    const collection = [disque({ id: 3, discogsReleaseId: 123, valeurSource: 'manuelle' })];
    expect(disquesRafraichissables(collection)).toEqual([]);
  });

  test('ne retient que les éligibles dans une collection mêlée', () => {
    const collection = [
      disque({ id: 1, discogsReleaseId: 111, valeurSource: 'discogs' }),
      disque({ id: 2, discogsReleaseId: null, valeurSource: 'manuelle' }),
      disque({ id: 3, discogsReleaseId: 333, valeurSource: 'manuelle' }),
      disque({ id: 4, discogsReleaseId: 444, valeurSource: 'discogs' }),
    ];
    expect(disquesRafraichissables(collection).map((d) => d.id)).toEqual([1, 4]);
  });
});
