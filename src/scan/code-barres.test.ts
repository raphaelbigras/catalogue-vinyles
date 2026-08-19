import { describe, expect, test } from 'vitest';
import { variantesCodeBarres } from './code-barres';

describe('variantesCodeBarres', () => {
  test('propose d\'abord le code tel qu\'il a été scanné', () => {
    expect(variantesCodeBarres('602537351169')[0]).toBe('602537351169');
  });

  test('ajoute la forme sans zéro initial pour un EAN-13 issu d\'un UPC-A', () => {
    // Mesuré : Discogs ne trouve rien sur 0602537351169 mais trouve sur 602537351169.
    expect(variantesCodeBarres('0602537351169')).toEqual(['0602537351169', '602537351169']);
  });

  test('ajoute la forme avec zéro initial pour un UPC-A à 12 chiffres', () => {
    expect(variantesCodeBarres('602537351169')).toEqual(['602537351169', '0602537351169']);
  });

  test('ne propose qu\'une variante pour un EAN-13 ne commençant pas par zéro', () => {
    expect(variantesCodeBarres('4006381333931')).toEqual(['4006381333931']);
  });

  test('retire les espaces et les tirets, fréquents sur les codes recopiés', () => {
    expect(variantesCodeBarres(' 602-537 351169 ')[0]).toBe('602537351169');
  });

  test('ne propose rien pour une saisie vide', () => {
    expect(variantesCodeBarres('   ')).toEqual([]);
  });

  test('ne propose rien pour un code contenant autre chose que des chiffres', () => {
    expect(variantesCodeBarres('PGF 90348')).toEqual([]);
  });

  test('ne duplique jamais une variante', () => {
    const v = variantesCodeBarres('0602537351169');
    expect(new Set(v).size).toBe(v.length);
  });
});
