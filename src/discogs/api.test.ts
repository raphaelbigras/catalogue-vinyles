import { afterEach, expect, describe, test, vi } from 'vitest';
import { chercher, obtenirFiche, obtenirPrix } from './api';

function doublureFetch(corpsParUrl: Record<string, unknown>) {
  return vi.fn((url: string) => {
    const cle = Object.keys(corpsParUrl).find((c) => url.includes(c));
    if (cle === undefined) throw new Error(`URL inattendue : ${url}`);
    return Promise.resolve(new Response(JSON.stringify(corpsParUrl[cle])));
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('chercher', () => {
  test('restreint la recherche aux vinyles et retourne des pressages', async () => {
    const f = doublureFetch({
      '/database/search': { results: [{ id: 1, title: 'A - B', catno: 'X1' }] },
    });
    vi.stubGlobal('fetch', f);

    const pressages = await chercher('harmonium heptade');

    expect(pressages).toHaveLength(1);
    expect(pressages[0].noCatalogue).toBe('X1');
    const url = f.mock.calls[0][0] as string;
    expect(url).toContain('format=Vinyl');
    expect(url).toContain('type=release');
  });

  test('encode la requête pour ne pas casser l\'URL', async () => {
    const f = doublureFetch({ '/database/search': { results: [] } });
    vi.stubGlobal('fetch', f);

    await chercher("L'Heptade & Cie");

    const url = f.mock.calls[0][0] as string;
    expect(url).toContain(encodeURIComponent("L'Heptade & Cie"));
  });

  test('cherche par code-barres quand on le lui demande', async () => {
    const f = doublureFetch({ '/database/search': { results: [] } });
    vi.stubGlobal('fetch', f);

    await chercher('602537351169', { parCodeBarres: true });

    expect(f.mock.calls[0][0] as string).toContain('barcode=602537351169');
  });

  test('retourne une liste vide quand Discogs ne renvoie pas de résultats', async () => {
    vi.stubGlobal('fetch', doublureFetch({ '/database/search': {} }));
    expect(await chercher('zzzz')).toEqual([]);
  });
});

describe('obtenirPrix', () => {
  test('demande explicitement des dollars canadiens', async () => {
    const f = doublureFetch({
      '/marketplace/stats': { num_for_sale: 3, lowest_price: { value: 12, currency: 'CAD' } },
    });
    vi.stubGlobal('fetch', f);

    const prix = await obtenirPrix(1887068);

    expect(prix.valeur).toBe(12);
    expect(f.mock.calls[0][0] as string).toContain('curr_abbr=CAD');
  });

  test('rejette silencieusement une réponse dans une autre devise', async () => {
    vi.stubGlobal('fetch', doublureFetch({
      '/marketplace/stats': { num_for_sale: 3, lowest_price: { value: 12, currency: 'USD' } },
    }));

    expect((await obtenirPrix(1)).valeur).toBeNull();
  });
});

describe('obtenirFiche', () => {
  test('retourne les champs remplissables d\'un disque', async () => {
    vi.stubGlobal('fetch', doublureFetch({
      '/releases/': { id: 5, title: 'Album', artists: [{ name: 'Artiste' }] },
    }));

    const champs = await obtenirFiche(5);

    expect(champs.artiste).toBe('Artiste');
    expect(champs.album).toBe('Album');
    expect(champs.discogsReleaseId).toBe(5);
  });
});
