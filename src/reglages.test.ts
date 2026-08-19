import { beforeEach, describe, expect, test } from 'vitest';
import { lireJeton, effacerJeton, enregistrerJeton } from './reglages';

beforeEach(() => localStorage.clear());

describe('jeton Discogs', () => {
  test('vaut null quand rien n\'a été enregistré', () => {
    expect(lireJeton()).toBeNull();
  });

  test('se relit après enregistrement', () => {
    enregistrerJeton('abcdef123456');
    expect(lireJeton()).toBe('abcdef123456');
  });

  test('retire les espaces autour — un copier-coller en traîne toujours', () => {
    enregistrerJeton('  abcdef123456 \n');
    expect(lireJeton()).toBe('abcdef123456');
  });

  test('enregistrer une chaîne vide revient à effacer', () => {
    enregistrerJeton('abcdef123456');
    enregistrerJeton('   ');
    expect(lireJeton()).toBeNull();
  });

  test('effacerJeton supprime la valeur', () => {
    enregistrerJeton('abcdef123456');
    effacerJeton();
    expect(lireJeton()).toBeNull();
  });
});
