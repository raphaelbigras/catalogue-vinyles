import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ErreurDiscogs, appelerDiscogs } from './client';
import { enregistrerJeton } from '../reglages';

function reponse(corps: unknown, statut = 200) {
  return new Response(JSON.stringify(corps), { status: statut });
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('appelerDiscogs', () => {
  test('appelle l\'API sur le bon chemin et retourne le JSON', async () => {
    const fetchDoublure = vi.fn().mockResolvedValue(reponse({ ok: true }));
    vi.stubGlobal('fetch', fetchDoublure);

    const resultat = await appelerDiscogs('/releases/1');

    expect(resultat).toEqual({ ok: true });
    expect(fetchDoublure.mock.calls[0][0]).toBe('https://api.discogs.com/releases/1');
  });

  test('explique qu\'un jeton refusé est un jeton à corriger', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponse({}, 401)));

    await expect(appelerDiscogs('/releases/1')).rejects.toThrow(/jeton/i);
  });

  test('n\'envoie pas d\'en-tête Authorization sans jeton', async () => {
    const fetchDoublure = vi.fn().mockResolvedValue(reponse({}));
    vi.stubGlobal('fetch', fetchDoublure);

    await appelerDiscogs('/releases/1');

    const entetes = fetchDoublure.mock.calls[0][1].headers as Record<string, string>;
    expect(entetes.Authorization).toBeUndefined();
  });

  test('envoie le jeton quand il y en a un', async () => {
    enregistrerJeton('mon-jeton');
    const fetchDoublure = vi.fn().mockResolvedValue(reponse({}));
    vi.stubGlobal('fetch', fetchDoublure);

    await appelerDiscogs('/releases/1');

    const entetes = fetchDoublure.mock.calls[0][1].headers as Record<string, string>;
    expect(entetes.Authorization).toBe('Discogs token=mon-jeton');
  });

  test('traduit un dépassement de cadence en message compréhensible', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponse({}, 429)));

    await expect(appelerDiscogs('/releases/1')).rejects.toThrow(ErreurDiscogs);
    await expect(appelerDiscogs('/releases/1')).rejects.toThrow(/trop de recherches/i);
  });

  test('traduit une panne réseau en message compréhensible', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(appelerDiscogs('/releases/1')).rejects.toThrow(/connexion/i);
  });

  test('signale les autres erreurs HTTP avec leur code', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponse({}, 500)));

    await expect(appelerDiscogs('/releases/1')).rejects.toThrow(/500/);
  });
});
