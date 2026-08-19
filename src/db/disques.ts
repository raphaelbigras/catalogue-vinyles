import { db } from './db';
import type { Disque, NouveauDisque } from './schema';
import { marquerModification } from '../lib/suivi-sauvegarde';

export async function ajouterDisque(nouveau: NouveauDisque): Promise<number> {
  const maintenant = new Date();
  const id = await db.disques.add({
    ...nouveau,
    dateAjout: maintenant,
    dateModif: maintenant,
  });
  marquerModification();
  return id;
}

export async function modifierDisque(id: number, champs: Partial<NouveauDisque>): Promise<void> {
  await db.disques.update(id, { ...champs, dateModif: new Date() });
  marquerModification();
}

export async function supprimerDisque(id: number): Promise<void> {
  await db.disques.delete(id);
  marquerModification();
}

export async function obtenirDisque(id: number): Promise<Disque | undefined> {
  return await db.disques.get(id);
}

export async function listerDisques(): Promise<Disque[]> {
  return await db.disques.toArray();
}
