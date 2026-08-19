import { afterEach, expect, describe, test, vi } from 'vitest';
import { chercher, chercherParCodeBarres, obtenirFiche, obtenirPrix } from './api';

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

describe('chercherParCodeBarres', () => {
  test('ne filtre PAS sur le format : un code-barres est déjà précis', async () => {
    const f = doublureFetch({ '/database/search': { results: [{ id: 1, title: 'A - B' }] } });
    vi.stubGlobal('fetch', f);

    await chercherParCodeBarres('4006381333931');

    const url = f.mock.calls[0][0] as string;
    expect(url).toContain('barcode=4006381333931');
    expect(url).not.toContain('format=Vinyl');
  });

  test('s\'arrête à la première variante qui donne un résultat', async () => {
    const f = doublureFetch({ '/database/search': { results: [{ id: 1, title: 'A - B' }] } });
    vi.stubGlobal('fetch', f);

    const pressages = await chercherParCodeBarres('602537351169');

    expect(pressages).toHaveLength(1);
    expect(f).toHaveBeenCalledTimes(1);
  });

  test('essaie la variante suivante quand la première ne donne rien', async () => {
    let appels = 0;
    vi.stubGlobal('fetch', vi.fn(() => {
      appels += 1;
      const results = appels === 1 ? [] : [{ id: 7, title: 'Trouve - Enfin' }];
      return Promise.resolve(new Response(JSON.stringify({ results })));
    }));

    const pressages = await chercherParCodeBarres('0602537351169');

    expect(appels).toBe(2);
    expect(pressages[0].releaseId).toBe(7);
  });

  test('retourne une liste vide quand aucune variante ne donne rien', async () => {
    vi.stubGlobal('fetch', doublureFetch({ '/database/search': { results: [] } }));

    expect(await chercherParCodeBarres('602537351169')).toEqual([]);
  });

  test('n\'appelle pas Discogs pour un code invalide', async () => {
    const f = doublureFetch({ '/database/search': { results: [] } });
    vi.stubGlobal('fetch', f);

    expect(await chercherParCodeBarres('PGF 90348')).toEqual([]);
    expect(f).not.toHaveBeenCalled();
  });
});
