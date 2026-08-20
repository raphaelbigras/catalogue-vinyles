import { describe, expect, test } from 'vitest';
import { dedupliquerPressages, prixCAD, versChampsDisque, versPressage } from './mapping';
import type { ReleaseDiscogs, ResultatRecherche, StatsMarche } from './types';

/** Réponse réelle observée le 2026-08-18 pour le pressage canadien de 1976. */
const HEPTADE_1976: ResultatRecherche = {
  id: 1887068,
  title: "Harmonium - L'Heptade",
  year: 1976,
  country: 'Canada',
  catno: 'PGF 90348',
  label: ['CBS', 'CBS Inc.', 'Columbia Records Pressing Plant, Don Mills, ON', 'Customatrix'],
  formats: [{ name: 'Vinyl', qty: '2', descriptions: ['LP', 'Album', 'Stereo'] }],
  thumb: '',
  cover_image: '',
};

describe('versPressage', () => {
  test('reprend l\'identifiant, le titre, l\'année, le pays et le n° de catalogue', () => {
    const p = versPressage(HEPTADE_1976);
    expect(p.releaseId).toBe(1887068);
    expect(p.titre).toBe("Harmonium - L'Heptade");
    expect(p.annee).toBe(1976);
    expect(p.pays).toBe('Canada');
    expect(p.noCatalogue).toBe('PGF 90348');
  });

  test('ne garde que le premier label, les suivants étant des usines de pressage', () => {
    expect(versPressage(HEPTADE_1976).label).toBe('CBS');
  });

  test('note la quantité pour un double album', () => {
    expect(versPressage(HEPTADE_1976).format).toBe('2xLP');
  });

  test('omet la quantité pour un disque simple', () => {
    const simple = { ...HEPTADE_1976, formats: [{ name: 'Vinyl', qty: '1', descriptions: ['LP', 'Album'] }] };
    expect(versPressage(simple).format).toBe('LP');
  });

  test('reconnaît un 45 tours', () => {
    const quaranteCinq = { ...HEPTADE_1976, formats: [{ name: 'Vinyl', qty: '1', descriptions: ['7"', 'Single', '45 RPM'] }] };
    expect(versPressage(quaranteCinq).format).toBe('7"');
  });

  test('retombe sur le nom du format quand aucune description n\'est reconnue', () => {
    const inconnu = { ...HEPTADE_1976, formats: [{ name: 'Vinyl', qty: '1', descriptions: ['Misprint'] }] };
    expect(versPressage(inconnu).format).toBe('Vinyl');
  });

  test("convertit les chaines vides de Discogs en null", () => {
    const p = versPressage(HEPTADE_1976);
    expect(p.pochettePetite).toBeNull();
    expect(p.pochetteGrande).toBeNull();
  });

  test("GARDE LES DEUX TAILLES separement, la petite pesant 30 fois moins", () => {
    // Mesure le 2026-08-19 : thumb 2,3 Ko, cover_image 69 Ko. Sur 200 lignes de
    // liste, tout afficher en grand couterait 14 Mo au lieu de 460 Ko.
    const avecDeux = {
      ...HEPTADE_1976,
      thumb: "https://i.discogs.com/h:150/w:150/petite.jpg",
      cover_image: "https://i.discogs.com/h:600/w:600/grande.jpg",
    };
    const p = versPressage(avecDeux);
    expect(p.pochettePetite).toBe("https://i.discogs.com/h:150/w:150/petite.jpg");
    expect(p.pochetteGrande).toBe("https://i.discogs.com/h:600/w:600/grande.jpg");
  });

  test("NE FAIT PAS passer la petite pochette pour la grande quand celle-ci manque", () => {
    // Sinon la fiche afficherait une image 150 px dans un cadre prevu pour 600.
    const sansGrande = { ...HEPTADE_1976, thumb: "https://i.discogs.com/petite.jpg", cover_image: "" };
    const p = versPressage(sansGrande);
    expect(p.pochettePetite).toBe("https://i.discogs.com/petite.jpg");
    expect(p.pochetteGrande).toBeNull();
  });

  test('survit à un résultat dépouillé de tous ses champs optionnels', () => {
    const minimal: ResultatRecherche = { id: 42, title: 'Inconnu' };
    const p = versPressage(minimal);
    expect(p).toEqual({
      releaseId: 42,
      titre: 'Inconnu',
      annee: null,
      pays: '',
      noCatalogue: '',
      label: '',
      format: '',
      pochettePetite: null,
      pochetteGrande: null,
    });
  });
});

/** Fiche réelle observée le 2026-08-18. */
const RELEASE_1976: ReleaseDiscogs = {
  id: 1887068,
  title: "L'Heptade",
  artists: [{ name: 'Harmonium' }],
  year: 1976,
  country: 'Canada',
  labels: [{ name: 'CBS', catno: 'PGF 90348' }],
  formats: [{ name: 'Vinyl', qty: '2', descriptions: ['LP', 'Album', 'Stereo'] }],
};

describe('versChampsDisque', () => {
  test('sépare correctement artiste et album, contrairement à la recherche', () => {
    const champs = versChampsDisque(RELEASE_1976);
    expect(champs.artiste).toBe('Harmonium');
    expect(champs.album).toBe("L'Heptade");
  });

  test('reprend année, pays, label, n° de catalogue et format', () => {
    const champs = versChampsDisque(RELEASE_1976);
    expect(champs.annee).toBe(1976);
    expect(champs.pays).toBe('Canada');
    expect(champs.label).toBe('CBS');
    expect(champs.noCatalogue).toBe('PGF 90348');
    expect(champs.format).toBe('2xLP');
  });

  test('joint les artistes multiples', () => {
    const duo = { ...RELEASE_1976, artists: [{ name: 'Sonny' }, { name: 'Cher' }] };
    expect(versChampsDisque(duo).artiste).toBe('Sonny, Cher');
  });

  test('conserve l\'identifiant Discogs pour pouvoir rafraîchir le prix plus tard', () => {
    expect(versChampsDisque(RELEASE_1976).discogsReleaseId).toBe(1887068);
  });

  test('survit à une fiche sans artiste, sans label et sans année', () => {
    const champs = versChampsDisque({ id: 7, title: 'Inconnu' });
    expect(champs.artiste).toBe('');
    expect(champs.label).toBe('');
    expect(champs.noCatalogue).toBe('');
    expect(champs.annee).toBeNull();
  });
});

describe('prixCAD', () => {
  test('accepte une valeur dont la devise est bien CAD', () => {
    const stats: StatsMarche = { num_for_sale: 35, lowest_price: { value: 5, currency: 'CAD' } };
    expect(prixCAD(stats)).toEqual({ valeur: 5, nombreEnVente: 35 });
  });

  test('REFUSE une valeur dans une autre devise plutôt que de la faire passer pour du CAD', () => {
    const stats: StatsMarche = { num_for_sale: 35, lowest_price: { value: 3.6, currency: 'USD' } };
    expect(prixCAD(stats)).toEqual({ valeur: null, nombreEnVente: 35 });
  });

  test('retourne null quand aucun exemplaire n\'est en vente', () => {
    const stats: StatsMarche = { num_for_sale: 0, lowest_price: null };
    expect(prixCAD(stats)).toEqual({ valeur: null, nombreEnVente: 0 });
  });

  test('retourne null si le nombre en vente est absent', () => {
    expect(prixCAD({ lowest_price: null })).toEqual({ valeur: null, nombreEnVente: null });
  });
});

describe('dedupliquerPressages', () => {
  const base = versPressage(HEPTADE_1976);

  test('laisse passer des pressages differents', () => {
    const deux = [base, { ...base, releaseId: 2, noCatalogue: 'CBS 88234', pays: 'Europe' }];
    expect(dedupliquerPressages(deux)).toHaveLength(2);
  });

  test("fusionne deux lignes qui s'afficheraient a l'identique", () => {
    // Cas reel : Discogs liste separement l'original et son repressage, avec les
    // memes annee, pays, label, n° de catalogue et format. A l'ecran, rien ne les
    // distingue : en montrer deux ne cree que du doute.
    const jumeau = { ...base, releaseId: 999 };
    expect(dedupliquerPressages([base, jumeau])).toHaveLength(1);
  });

  test("garde le premier, dont on utilisera l'identifiant", () => {
    const jumeau = { ...base, releaseId: 999 };
    expect(dedupliquerPressages([base, jumeau])[0].releaseId).toBe(base.releaseId);
  });

  test("distingue deux pressages qui ne different que par l'annee", () => {
    const sansAnnee = { ...base, releaseId: 2, annee: null };
    expect(dedupliquerPressages([base, sansAnnee])).toHaveLength(2);
  });

  test('distingue deux pressages qui ne different que par le pays', () => {
    const ailleurs = { ...base, releaseId: 2, pays: 'Argentina' };
    expect(dedupliquerPressages([base, ailleurs])).toHaveLength(2);
  });

  test('fusionne deux lignes ne differant que par la casse du titre', () => {
    // Cas reel observe : Discogs ecrit « Harmonium - L'Heptade » et
    // « Harmonium - L'heptade » pour deux entrees par ailleurs identiques.
    const autreCasse = { ...base, releaseId: 2, titre: "Harmonium - L'heptade" };
    expect(dedupliquerPressages([base, autreCasse])).toHaveLength(1);
  });

  test("ignore les pochettes, qui ne servent pas a identifier un pressage", () => {
    const memeAvecAutreImage = { ...base, releaseId: 2, pochetteGrande: "https://autre.jpg" };
    expect(dedupliquerPressages([base, memeAvecAutreImage])).toHaveLength(1);
  });

  test("preserve l'ordre et ne touche pas une liste vide", () => {
    expect(dedupliquerPressages([])).toEqual([]);
  });
});
