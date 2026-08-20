import { describe, expect, test } from 'vitest';
import { messageDoublon, trouverDoublon } from './doublon';
import { DISQUE_VIDE, type Disque } from '../db/schema';

function disque(champs: Partial<Disque>): Disque {
  return { ...DISQUE_VIDE, id: 1, dateAjout: new Date(), dateModif: new Date(), ...champs };
}

const HEPTADE = disque({
  id: 3, artiste: 'Harmonium', album: "L'Heptade", discogsReleaseId: 1887068,
});

describe('trouverDoublon', () => {
  test('ne signale rien dans une collection vide', () => {
    expect(trouverDoublon([], { ...DISQUE_VIDE, artiste: 'Harmonium', album: "L'Heptade" }))
      .toBeNull();
  });

  test('reconnait le meme pressage Discogs', () => {
    const trouve = trouverDoublon([HEPTADE], {
      ...DISQUE_VIDE, artiste: 'Autre graphie', album: 'Autre titre', discogsReleaseId: 1887068,
    });
    expect(trouve?.disque.id).toBe(3);
    expect(trouve?.memePressage).toBe(true);
  });

  test('DISTINGUE un autre pressage du meme album, qui a sa propre valeur', () => {
    const trouve = trouverDoublon([HEPTADE], {
      ...DISQUE_VIDE, artiste: 'Harmonium', album: "L'Heptade", discogsReleaseId: 9999999,
    });
    expect(trouve?.memePressage).toBe(false);
  });

  test('reconnait un homonyme saisi a la main, sans identifiant Discogs', () => {
    const trouve = trouverDoublon([HEPTADE], {
      ...DISQUE_VIDE, artiste: 'Harmonium', album: "L'Heptade",
    });
    expect(trouve?.disque.id).toBe(3);
    expect(trouve?.memePressage).toBe(false);
  });

  test('IGNORE LA CASSE, LES ACCENTS ET LES ESPACES en trop', () => {
    const accentue = disque({ id: 7, artiste: 'Félix Leclerc', album: 'Le Tour de l\'Île' });
    const trouve = trouverDoublon([accentue], {
      ...DISQUE_VIDE, artiste: '  felix leclerc ', album: "LE TOUR DE L'ILE",
    });
    expect(trouve?.disque.id).toBe(7);
  });

  test('RESISTE A UN DOUBLE ESPACE de frappe', () => {
    const trouve = trouverDoublon([disque({ id: 5, artiste: 'Beau Dommage', album: 'Beau Dommage' })],
      { ...DISQUE_VIDE, artiste: 'Beau  Dommage', album: 'BEAU DOMMAGE' });
    expect(trouve?.disque.id).toBe(5);
  });

  test('laisse passer un album different du meme artiste', () => {
    expect(trouverDoublon([HEPTADE], {
      ...DISQUE_VIDE, artiste: 'Harmonium', album: 'Si on avait besoin d\'une cinquième saison',
    })).toBeNull();
  });

  test('NE SIGNALE RIEN sur un formulaire encore vide', () => {
    // Sinon le premier disque saisi a la main declencherait l'alerte contre
    // n'importe quel autre disque incomplet.
    const vide = disque({ id: 9, artiste: '', album: '' });
    expect(trouverDoublon([vide], { ...DISQUE_VIDE, artiste: '', album: '' })).toBeNull();
  });

  test('rend le premier trouve, celui dont on cite le numero', () => {
    const second = disque({ id: 12, artiste: 'Harmonium', album: "L'Heptade" });
    const trouve = trouverDoublon([HEPTADE, second], {
      ...DISQUE_VIDE, artiste: 'Harmonium', album: "L'Heptade",
    });
    expect(trouve?.disque.id).toBe(3);
  });
});

describe('messageDoublon', () => {
  test('cite le numero d\'inventaire, seul repere pour retrouver le disque', () => {
    expect(messageDoublon({ disque: HEPTADE, memePressage: false })).toContain('n° 3');
  });

  test('CONSEILLE LA QUANTITE quand c\'est exactement le meme pressage', () => {
    expect(messageDoublon({ disque: HEPTADE, memePressage: true })).toContain('quantité');
  });

  test('n\'evoque pas la quantite pour un pressage different, qui merite sa fiche', () => {
    expect(messageDoublon({ disque: HEPTADE, memePressage: false })).not.toContain('quantité');
  });
});
