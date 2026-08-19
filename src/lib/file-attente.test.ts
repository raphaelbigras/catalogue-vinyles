import { describe, expect, test, vi } from 'vitest';
import { traiterEnFile } from './file-attente';

/** Remplace l'attente réelle : ne dort pas, note simplement les durées demandées. */
function attenteFactice() {
  const durees: number[] = [];
  return {
    durees,
    attendre: async (ms: number) => { durees.push(ms); },
  };
}

describe('traiterEnFile', () => {
  test('ne fait rien sur une liste vide', async () => {
    const faux = attenteFactice();
    const traiter = vi.fn();

    const p = await traiterEnFile([], traiter, { intervalleMs: 100, attendre: faux.attendre });

    expect(traiter).not.toHaveBeenCalled();
    expect(p).toEqual({ total: 0, traites: 0, echecs: 0 });
  });

  test('traite chaque élément, dans l\'ordre', async () => {
    const vus: number[] = [];
    const faux = attenteFactice();

    await traiterEnFile([1, 2, 3], async (n) => { vus.push(n); },
      { intervalleMs: 100, attendre: faux.attendre });

    expect(vus).toEqual([1, 2, 3]);
  });

  test('attend entre les éléments, mais jamais avant le premier', async () => {
    const faux = attenteFactice();

    await traiterEnFile([1, 2, 3], async () => {},
      { intervalleMs: 2500, attendre: faux.attendre });

    // 3 éléments -> 2 attentes seulement
    expect(faux.durees).toEqual([2500, 2500]);
  });

  test('poursuit malgré un échec et le compte', async () => {
    const faux = attenteFactice();

    const p = await traiterEnFile([1, 2, 3], async (n) => {
      if (n === 2) throw new Error('boum');
    }, { intervalleMs: 100, attendre: faux.attendre });

    expect(p).toEqual({ total: 3, traites: 2, echecs: 1 });
  });

  test('rapporte la progression après chaque élément', async () => {
    const faux = attenteFactice();
    const etapes: number[] = [];

    await traiterEnFile([1, 2, 3], async () => {}, {
      intervalleMs: 100,
      attendre: faux.attendre,
      surProgression: (p) => etapes.push(p.traites),
    });

    expect(etapes).toEqual([1, 2, 3]);
  });

  test('s\'arrête dès que l\'annulation est demandée', async () => {
    const faux = attenteFactice();
    const controleur = new AbortController();
    const vus: number[] = [];

    const p = await traiterEnFile([1, 2, 3, 4], async (n) => {
      vus.push(n);
      if (n === 2) controleur.abort();
    }, { intervalleMs: 100, attendre: faux.attendre, signal: controleur.signal });

    expect(vus).toEqual([1, 2]);
    expect(p.traites).toBe(2);
    expect(p.total).toBe(4);
  });

  test('n\'appelle rien si l\'annulation précède le démarrage', async () => {
    const controleur = new AbortController();
    controleur.abort();
    const traiter = vi.fn();

    await traiterEnFile([1, 2], traiter,
      { intervalleMs: 100, attendre: attenteFactice().attendre, signal: controleur.signal });

    expect(traiter).not.toHaveBeenCalled();
  });
});
