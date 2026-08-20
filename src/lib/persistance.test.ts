import { describe, expect, test, vi } from 'vitest';
import { demanderPersistance, type GestionnaireStockage } from './persistance';

function stockage(persisted: boolean, persist: boolean): GestionnaireStockage {
  return { persisted: vi.fn().mockResolvedValue(persisted), persist: vi.fn().mockResolvedValue(persist) };
}

describe('demanderPersistance', () => {
  test('demande la protection quand elle n\'est pas encore accordee', async () => {
    const s = stockage(false, true);
    expect(await demanderPersistance(s)).toBe(true);
    expect(s.persist).toHaveBeenCalled();
  });

  test('NE REDEMANDE PAS quand la protection est deja accordee', async () => {
    const s = stockage(true, true);
    expect(await demanderPersistance(s)).toBe(true);
    expect(s.persist).not.toHaveBeenCalled();
  });

  test('rapporte un refus sans le maquiller en succes', async () => {
    expect(await demanderPersistance(stockage(false, false))).toBe(false);
  });

  test('retourne null quand le navigateur ignore l\'API', async () => {
    expect(await demanderPersistance(undefined)).toBeNull();
  });

  test('retourne null plutot que de propager une erreur qui bloquerait le demarrage', async () => {
    const s: GestionnaireStockage = {
      persisted: vi.fn().mockRejectedValue(new Error('refus')),
      persist: vi.fn(),
    };
    expect(await demanderPersistance(s)).toBeNull();
  });
});
