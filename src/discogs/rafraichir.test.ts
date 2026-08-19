import { describe, expect, test } from 'vitest';
import { disquesRafraichissables, intervalleRecommande, rafraichirValeurs } from './rafraichir';
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

/** Dépendances factices : mémorisent ce qui aurait été écrit en base. */
function dependancesFactices(prixParRelease: Record<number, number | null>) {
  const ecritures: { id: number; valeur: number | null }[] = [];
  return {
    ecritures,
    deps: {
      obtenirPrix: async (releaseId: number) => ({
        valeur: prixParRelease[releaseId] ?? null,
        nombreEnVente: 1,
      }),
      modifierDisque: async (id: number, champs: { valeurEstimee?: number | null }) => {
        ecritures.push({ id, valeur: champs.valeurEstimee ?? null });
      },
    },
  };
}

const SANS_ATTENTE = { intervalleMs: 0, attendre: async () => {} };

describe('rafraichirValeurs', () => {
  test('écrit la nouvelle valeur de chaque disque éligible', async () => {
    const collection = [
      disque({ id: 1, discogsReleaseId: 111, valeurSource: 'discogs' }),
      disque({ id: 2, discogsReleaseId: 222, valeurSource: 'discogs' }),
    ];
    const f = dependancesFactices({ 111: 10, 222: 25.5 });

    const p = await rafraichirValeurs(collection, f.deps, SANS_ATTENTE);

    expect(f.ecritures).toEqual([{ id: 1, valeur: 10 }, { id: 2, valeur: 25.5 }]);
    expect(p.traites).toBe(2);
  });

  test('ignore les disques non éligibles sans même les compter', async () => {
    const collection = [
      disque({ id: 1, discogsReleaseId: 111, valeurSource: 'discogs' }),
      disque({ id: 2, discogsReleaseId: null, valeurSource: 'manuelle' }),
    ];
    const f = dependancesFactices({ 111: 10 });

    const p = await rafraichirValeurs(collection, f.deps, SANS_ATTENTE);

    expect(p.total).toBe(1);
    expect(f.ecritures).toHaveLength(1);
  });

  test('N\'EFFACE PAS une valeur connue quand Discogs n\'a plus de prix', async () => {
    const collection = [
      disque({ id: 1, discogsReleaseId: 111, valeurSource: 'discogs', valeurEstimee: 40 }),
    ];
    const f = dependancesFactices({ 111: null });

    const p = await rafraichirValeurs(collection, f.deps, SANS_ATTENTE);

    expect(f.ecritures).toEqual([]);
    expect(p.sansPrix).toBe(1);
    expect(p.traites).toBe(1);
  });

  test('compte un échec réseau sans interrompre le lot', async () => {
    const collection = [
      disque({ id: 1, discogsReleaseId: 111, valeurSource: 'discogs' }),
      disque({ id: 2, discogsReleaseId: 222, valeurSource: 'discogs' }),
    ];
    const deps = {
      obtenirPrix: async (releaseId: number) => {
        if (releaseId === 111) throw new Error('reseau');
        return { valeur: 5, nombreEnVente: 1 };
      },
      modifierDisque: async () => {},
    };

    const p = await rafraichirValeurs(collection, deps, SANS_ATTENTE);

    expect(p.echecs).toBe(1);
    expect(p.traites).toBe(1);
  });
});
