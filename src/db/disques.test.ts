import { beforeEach, describe, expect, test } from 'vitest';
import { db } from './db';
import { ajouterDisque, listerDisques, modifierDisque, obtenirDisque, supprimerDisque } from './disques';
import { DISQUE_VIDE } from './schema';

const HARMONIUM = { ...DISQUE_VIDE, artiste: 'Harmonium', album: 'L\'heptade' };
const BEAU_DOMMAGE = { ...DISQUE_VIDE, artiste: 'Beau Dommage', album: 'Beau Dommage' };

beforeEach(async () => {
  await db.disques.clear();
});

describe('ajouterDisque', () => {
  test('attribue un numéro d\'inventaire croissant', async () => {
    const premier = await ajouterDisque(HARMONIUM);
    const second = await ajouterDisque(BEAU_DOMMAGE);
    expect(second).toBeGreaterThan(premier);
  });

  test('horodate la création et la modification', async () => {
    const id = await ajouterDisque(HARMONIUM);
    const disque = await obtenirDisque(id);
    expect(disque?.dateAjout).toBeInstanceOf(Date);
    expect(disque?.dateModif).toBeInstanceOf(Date);
  });
});

describe('modifierDisque', () => {
  test('applique les champs fournis sans toucher aux autres', async () => {
    const id = await ajouterDisque(HARMONIUM);
    await modifierDisque(id, { etatDisque: 'NM' });
    const disque = await obtenirDisque(id);
    expect(disque?.etatDisque).toBe('NM');
    expect(disque?.artiste).toBe('Harmonium');
  });

  test('met à jour dateModif mais pas dateAjout', async () => {
    const id = await ajouterDisque(HARMONIUM);
    const avant = await obtenirDisque(id);
    await new Promise((r) => setTimeout(r, 5));
    await modifierDisque(id, { quantite: 2 });
    const apres = await obtenirDisque(id);
    expect(apres!.dateModif.getTime()).toBeGreaterThan(avant!.dateModif.getTime());
    expect(apres!.dateAjout.getTime()).toBe(avant!.dateAjout.getTime());
  });
});

describe('supprimerDisque', () => {
  test('retire le disque de la liste', async () => {
    const id = await ajouterDisque(HARMONIUM);
    await supprimerDisque(id);
    expect(await obtenirDisque(id)).toBeUndefined();
    expect(await listerDisques()).toHaveLength(0);
  });
});

describe('listerDisques', () => {
  test('retourne tous les disques enregistrés', async () => {
    await ajouterDisque(HARMONIUM);
    await ajouterDisque(BEAU_DOMMAGE);
    expect(await listerDisques()).toHaveLength(2);
  });
});

describe('flux d’édition du formulaire', () => {
  // FormulaireEcran charge un Disque complet dans son état puis le renvoie tel quel à
  // modifierDisque : l’objet transmis contient donc id, dateAjout et dateModif en plus
  // des champs éditables. Ce test verrouille le fait qu’ils sont inoffensifs.
  test('accepte un objet complet sans écraser dateAjout ni l’identifiant', async () => {
    const id = await ajouterDisque(HARMONIUM);
    const charge = await obtenirDisque(id);
    const ajoutOriginal = charge!.dateAjout.getTime();

    await new Promise((r) => setTimeout(r, 5));
    await modifierDisque(id, { ...charge!, etatDisque: 'NM' } as never);

    const apres = await obtenirDisque(id);
    expect(apres!.etatDisque).toBe('NM');
    expect(apres!.id).toBe(id);
    expect(apres!.dateAjout.getTime()).toBe(ajoutOriginal);
    expect(apres!.dateModif.getTime()).toBeGreaterThan(ajoutOriginal);
  });
});
