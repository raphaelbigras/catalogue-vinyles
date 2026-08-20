import Pochette from './Pochette';
import type { Pressage } from '../discogs/types';

interface Props {
  pressage: Pressage;
  onChoisir: (pressage: Pressage) => void;
}

export default function CartePressage({ pressage, onChoisir }: Props) {
  return (
    <button
      type="button"
      onClick={() => onChoisir(pressage)}
      className="flex w-full items-center gap-3 border-b border-stone-800 p-4 text-left active:bg-stone-800"
    >
      {/* Ici la grande : quelques resultats seulement, et c'est sur cette image
          que se joue la reconnaissance du bon pressage. */}
      <Pochette url={pressage.pochetteGrande ?? pressage.pochettePetite} taille="h-18 w-18" />

      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{pressage.titre}</span>
        <span className="block text-sm text-stone-400">
          {[pressage.annee, pressage.pays, pressage.label, pressage.format]
            .filter((x) => x !== null && x !== '')
            .join(' · ')}
        </span>
        {pressage.noCatalogue !== '' && (
          <span className="mt-1 block font-mono text-sm text-amber-500">
            {pressage.noCatalogue}
          </span>
        )}
      </span>
    </button>
  );
}
