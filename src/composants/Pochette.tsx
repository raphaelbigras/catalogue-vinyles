import { useState } from 'react';

interface Props {
  /**
   * `undefined` et pas seulement `null` : les disques saisis avant l'ajout des
   * pochettes n'ont pas ces champs en base du tout, et Dexie les rend tels quels.
   */
  url: string | null | undefined;
  /** Classes Tailwind de dimension, ex. « h-14 w-14 ». */
  taille: string;
}

/**
 * Pochette d'un disque, avec un remplacant quand il n'y en a pas.
 *
 * Une pochette manque dans trois cas courants : disque saisi a la main, disque
 * absent de Discogs, ou jeton Discogs non configure (l'API renvoie alors des
 * images vides). Et meme presente, elle vient du reseau : hors-ligne ou apres
 * une eventuelle disparition chez Discogs, le chargement echoue. Dans tous ces
 * cas la ligne doit garder exactement la meme taille, sinon la liste sursaute
 * pendant le defilement.
 */
export default function Pochette({ url, taille }: Props) {
  const [echec, setEchec] = useState(false);

  if (url === null || url === undefined || echec) {
    return (
      <span
        aria-hidden="true"
        className={`${taille} grid shrink-0 place-items-center rounded bg-stone-800 text-stone-600`}
      >
        ♪
      </span>
    );
  }

  return (
    <img
      src={url}
      alt=""
      // Sans cela, ouvrir la collection declencherait 200 telechargements d'un coup.
      loading="lazy"
      onError={() => setEchec(true)}
      className={`${taille} shrink-0 rounded bg-stone-800 object-cover`}
    />
  );
}
