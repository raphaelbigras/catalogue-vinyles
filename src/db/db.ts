import Dexie, { type EntityTable } from 'dexie';
import type { Disque } from './schema';

export const db = new Dexie('catalogue-disques') as Dexie & {
  disques: EntityTable<Disque, 'id'>;
};

db.version(1).stores({
  disques: '++id, artiste, album, annee, noCatalogue, etatDisque',
});
