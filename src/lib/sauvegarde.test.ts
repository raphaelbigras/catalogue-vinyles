import { describe, expect, test } from 'vitest';
import { deserialiser, serialiser, ErreurSauvegarde } from './sauvegarde';
import { DISQUE_VIDE, type Disque } from '../db/schema';

function disque(champs: Partial<Disque>): Disque {
  return {
    ...DISQUE_VIDE,
    id: 1,
    dateAjout: new Date('2026-01-15T10:00:00Z'),
    dateModif: new Date('2026-02-20T14:30:00Z'),
    ...champs,
  };
}

const COLLECTION: Disque[] = [
  disque({
    id: 1, artiste: 'Harmonium', album: "L'Heptade", annee: 1976, label: 'CBS',
    noCatalogue: 'PGF 90348', pays: 'Canada', format: '2xLP', etatDisque: 'VG+',
    etatPochette: 'VG', valeurEstimee: 45.5, valeurSource: 'discogs',
    valeurMaj: new Date('2026-08-18T12:00:00Z'), discogsReleaseId: 1887068,
    notes: 'Pochette légèrement cornée',
  }),
  disque({ id: 2, artiste: 'Félix Leclerc', album: "Le tour de l'île", valeurEstimee: null }),
];

describe('aller-retour', () => {
  test('une collection sérialisée puis relue est identique', () => {
    expect(deserialiser(serialiser(COLLECTION))).toEqual(COLLECTION);
  });

  test('les dates redeviennent de vraies dates, pas des chaînes', () => {
    const relu = deserialiser(serialiser(COLLECTION));
    expect(relu[0].dateAjout).toBeInstanceOf(Date);
    expect(relu[0].valeurMaj).toBeInstanceOf(Date);
    expect(relu[0].dateAjout.getTime()).toBe(COLLECTION[0].dateAjout.getTime());
  });

  test('une valeur nulle reste nulle et ne devient pas une date', () => {
    expect(deserialiser(serialiser(COLLECTION))[1].valeurMaj).toBeNull();
  });

  test('une collection vide survit à l\'aller-retour', () => {
    expect(deserialiser(serialiser([]))).toEqual([]);
  });

  test('les accents et les apostrophes sont préservés', () => {
    const relu = deserialiser(serialiser(COLLECTION));
    expect(relu[1].artiste).toBe('Félix Leclerc');
    expect(relu[0].notes).toBe('Pochette légèrement cornée');
  });
});

describe('format du fichier', () => {
  test('porte une version et un horodatage', () => {
    const contenu = JSON.parse(serialiser(COLLECTION));
    expect(contenu.version).toBe(1);
    expect(typeof contenu.exporteLe).toBe('string');
    expect(contenu.disques).toHaveLength(2);
  });
});

describe('refus des fichiers invalides', () => {
  test('rejette un fichier qui n\'est pas du JSON', () => {
    expect(() => deserialiser('ceci nest pas du json')).toThrow(ErreurSauvegarde);
  });

  test('rejette un JSON sans liste de disques', () => {
    expect(() => deserialiser('{"version":1}')).toThrow(/sauvegarde/i);
  });

  test('rejette une version future qu\'on ne sait pas relire', () => {
    expect(() => deserialiser('{"version":99,"disques":[]}')).toThrow(/version/i);
  });
});

describe('compatibilité des anciennes sauvegardes', () => {
  /** Une sauvegarde produite avant l'ajout des pochettes : les champs manquent. */
  const ANCIENNE = JSON.stringify({
    version: 1,
    exporteLe: '2026-08-18T12:00:00.000Z',
    disques: [{
      id: 1, artiste: 'Harmonium', album: "L'Heptade", annee: 1976, label: 'CBS',
      noCatalogue: 'PGF 90348', pays: 'Canada', format: '2xLP',
      etatDisque: 'VG+', etatPochette: 'VG', pochetteGenerique: false, quantite: 1,
      valeurEstimee: 45.5, valeurSource: 'discogs', valeurMaj: '2026-08-18T12:00:00.000Z',
      discogsReleaseId: 1887068, discogsNumForSale: 35, notes: '',
      dateAjout: '2026-08-18T12:00:00.000Z', dateModif: '2026-08-18T12:00:00.000Z',
    }],
  });

  test('se restaure sans erreur malgré les champs de pochette absents', () => {
    expect(deserialiser(ANCIENNE)).toHaveLength(1);
  });

  test('DONNE null AUX POCHETTES ABSENTES plutôt que de laisser undefined', () => {
    // `undefined` traverserait Dexie puis atteindrait le composant Pochette, dont
    // la comparaison `url === null` serait fausse : il tenterait alors d'afficher
    // une image sans adresse.
    const [disque] = deserialiser(ANCIENNE);
    expect(disque.pochettePetite).toBeNull();
    expect(disque.pochetteGrande).toBeNull();
  });

  test('ne touche pas aux pochettes présentes', () => {
    const avec = JSON.parse(ANCIENNE);
    avec.disques[0].pochettePetite = 'https://i.discogs.com/petite.jpg';
    const [disque] = deserialiser(JSON.stringify(avec));
    expect(disque.pochettePetite).toBe('https://i.discogs.com/petite.jpg');
  });
});
