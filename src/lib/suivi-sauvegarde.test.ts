import { beforeEach, describe, expect, test } from 'vitest';
import {
  derniereSauvegarde, marquerModification, marquerSauvegarde, modificationsEnAttente,
} from './suivi-sauvegarde';

beforeEach(() => localStorage.clear());

describe('modificationsEnAttente', () => {
  test('vaut zéro au départ', () => {
    expect(modificationsEnAttente()).toBe(0);
  });

  test('augmente à chaque modification', () => {
    marquerModification();
    marquerModification();
    expect(modificationsEnAttente()).toBe(2);
  });

  test('retombe à zéro après une sauvegarde', () => {
    marquerModification();
    marquerSauvegarde();
    expect(modificationsEnAttente()).toBe(0);
  });

  test('recompte après la sauvegarde', () => {
    marquerModification();
    marquerSauvegarde();
    marquerModification();
    expect(modificationsEnAttente()).toBe(1);
  });
});

describe('derniereSauvegarde', () => {
  test('vaut null tant que rien n\'a été sauvegardé', () => {
    expect(derniereSauvegarde()).toBeNull();
  });

  test('retourne une vraie date après une sauvegarde', () => {
    marquerSauvegarde();
    const date = derniereSauvegarde();
    expect(date).toBeInstanceOf(Date);
    expect(Date.now() - (date as Date).getTime()).toBeLessThan(5000);
  });
});
