/** Un résultat de `GET /database/search`. */
export interface ResultatRecherche {
  id: number;
  /** Sous la forme « Artiste - Album ». Discogs ne les sépare pas ici. */
  title: string;
  year?: number;
  country?: string;
  catno?: string;
  /** Pollué par les usines de pressage et les sociétés de gestion. */
  label?: string[];
  formats?: FormatDiscogs[];
  /** Vignette 150x150 en qualite 40. Vide sans jeton d'authentification. */
  thumb?: string;
  /** Pochette 600x600 en qualite 90. Vide sans jeton d'authentification. */
  cover_image?: string;
}

export interface FormatDiscogs {
  name: string;
  qty?: string;
  descriptions?: string[];
}

/** Une fiche `GET /releases/{id}`. */
export interface ReleaseDiscogs {
  id: number;
  title: string;
  artists?: { name: string }[];
  year?: number;
  country?: string;
  labels?: { name: string; catno?: string }[];
  formats?: FormatDiscogs[];
}

/** `GET /marketplace/stats/{id}`. `lowest_price` est null si rien n'est en vente. */
export interface StatsMarche {
  num_for_sale?: number;
  lowest_price: { value: number; currency: string } | null;
}

/** Ce qu'on montre à l'utilisatrice pour qu'elle choisisse son pressage. */
export interface Pressage {
  releaseId: number;
  titre: string;
  annee: number | null;
  pays: string;
  noCatalogue: string;
  label: string;
  format: string;
  /** 150x150 : assez pour une ligne de liste, 2,3 Ko. */
  pochettePetite: string | null;
  /** 600x600 : pour un affichage en grand, 69 Ko. */
  pochetteGrande: string | null;
}
