export const ETATS = ['M', 'NM', 'VG+', 'VG', 'G+', 'G', 'F', 'P'] as const;

export type Etat = (typeof ETATS)[number];

export const ETATS_LIBELLES: Record<Etat, string> = {
  'M': 'Mint — neuf, jamais joué',
  'NM': 'Near Mint — quasi neuf',
  'VG+': 'Very Good Plus — légères marques, inaudibles',
  'VG': 'Very Good — marques audibles en fond',
  'G+': 'Good Plus — usé mais jouable en entier',
  'G': 'Good — très usé, bruit constant',
  'F': 'Fair — dommages importants, sauts possibles',
  'P': 'Poor — à peine jouable',
};

export interface Disque {
  id: number;
  artiste: string;
  album: string;
  annee: number | null;
  label: string;
  noCatalogue: string;
  pays: string;
  format: string;
  etatDisque: Etat;
  etatPochette: Etat;
  pochetteGenerique: boolean;
  quantite: number;
  valeurEstimee: number | null;
  valeurSource: 'discogs' | 'manuelle';
  valeurMaj: Date | null;
  discogsReleaseId: number | null;
  discogsNumForSale: number | null;
  /**
   * Adresses des pochettes chez Discogs, pas les images elles-memes : i.discogs.com
   * ne renvoie aucun en-tete CORS, donc le navigateur peut les afficher mais jamais
   * les telecharger pour les stocker. Elles restent donc soumises au reseau — mais
   * elles sont servies avec un cache d'un an, et l'URL ne contient aucune date
   * d'expiration.
   */
  pochettePetite: string | null;
  pochetteGrande: string | null;
  notes: string;
  dateAjout: Date;
  dateModif: Date;
}

/** Ce que fournit un formulaire : les 3 champs gérés par la couche données sont exclus. */
export type NouveauDisque = Omit<Disque, 'id' | 'dateAjout' | 'dateModif'>;

/** Valeurs par défaut d'un formulaire de création. */
export const DISQUE_VIDE: NouveauDisque = {
  artiste: '',
  album: '',
  annee: null,
  label: '',
  noCatalogue: '',
  pays: '',
  format: 'LP',
  etatDisque: 'VG+',
  etatPochette: 'VG+',
  pochetteGenerique: false,
  quantite: 1,
  valeurEstimee: null,
  valeurSource: 'manuelle',
  valeurMaj: null,
  discogsReleaseId: null,
  discogsNumForSale: null,
  pochettePetite: null,
  pochetteGrande: null,
  notes: '',
};
