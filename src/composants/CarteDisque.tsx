import { Link } from 'react-router';
import Pochette from './Pochette';
import type { Disque } from '../db/schema';
import { formaterCAD } from '../lib/valeur';

export default function CarteDisque({ disque }: { disque: Disque }) {
  return (
    <Link
      to={`/disque/${disque.id}`}
      className="flex items-center gap-3 border-b border-stone-800 p-4 active:bg-stone-800"
    >
      <span className="w-8 shrink-0 text-sm text-stone-400">#{disque.id}</span>
      {/* La petite : 2,3 Ko contre 69 Ko, sur potentiellement 200 lignes. */}
      <Pochette url={disque.pochettePetite} taille="h-14 w-14" />

      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{disque.album}</span>
        <span className="block truncate text-sm text-stone-400">{disque.artiste}</span>
        <span className="block text-sm text-stone-400">
          {[disque.annee, disque.noCatalogue, `${disque.etatDisque}/${disque.etatPochette}`]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </span>

      <span className="shrink-0 text-right text-sm">
        {/* Un tiret presque invisible cacherait justement les disques qu'il reste a estimer. */}
        {disque.valeurEstimee === null
          ? <span className="text-stone-400">—</span>
          : formaterCAD(disque.valeurEstimee)}
        {disque.quantite > 1 && (
          <span className="block text-sm text-stone-400">× {disque.quantite}</span>
        )}
      </span>
    </Link>
  );
}
