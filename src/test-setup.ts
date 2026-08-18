import 'fake-indexeddb/auto';

// Node n'a pas localStorage ; une implémentation minimale en mémoire suffit ici.
class StockageMemoire implements Storage {
  private donnees = new Map<string, string>();
  get length() { return this.donnees.size; }
  clear() { this.donnees.clear(); }
  getItem(cle: string) { return this.donnees.get(cle) ?? null; }
  key(index: number) { return [...this.donnees.keys()][index] ?? null; }
  removeItem(cle: string) { this.donnees.delete(cle); }
  setItem(cle: string, valeur: string) { this.donnees.set(cle, valeur); }
}

globalThis.localStorage = new StockageMemoire();
