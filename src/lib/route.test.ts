import { describe, expect, test } from 'vitest';
import { numeroDisque } from './route';

describe('numeroDisque', () => {
  test('accepte un identifiant normal', () => {
    expect(numeroDisque('42')).toBe(42);
  });

  test('REFUSE du texte, qui ferait planter Dexie avec une cle NaN', () => {
    expect(numeroDisque('abc')).toBeNull();
  });

  test('refuse un parametre absent', () => {
    expect(numeroDisque(undefined)).toBeNull();
  });

  test('refuse un nombre decimal ou negatif, qui ne peut pas etre une cle', () => {
    expect(numeroDisque('1.5')).toBeNull();
    expect(numeroDisque('-3')).toBeNull();
  });

  test('refuse zero : Dexie numerote les disques a partir de 1', () => {
    expect(numeroDisque('0')).toBeNull();
  });

  test('refuse un entier trop grand pour etre represente exactement', () => {
    expect(numeroDisque('99999999999999999999')).toBeNull();
  });
});
