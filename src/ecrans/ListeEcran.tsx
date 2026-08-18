import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import CarteDisque from '../composants/CarteDisque';
import { listerDisques } from '../db/disques';
import { filtrerDisques, trierDisques, TRIS_LIBELLES, type Tri } from '../lib/recherche';
import { formaterCAD, valeurTotale } from '../lib/valeur';

export default function ListeEcran() {
  const [requete, setRequete] = useState('');
  const [tri, setTri] = useState<Tri>('artiste');

  // Le 3e argument est la valeur affichée pendant le premier chargement.
  const disques = useLiveQuery(() => listerDisques(), [], []);

  const affiches = useMemo(
    () => trierDisques(filtrerDisques(disques, requete), tri),
    [disques, requete, tri],
  );

  return (
    <div>
      <header className="sticky top-0 z-10 bg-stone-900 pt-[env(safe-area-inset-top)]">
        <div className="flex items-baseline justify-between px-4 pt-4">
          <h1 className="text-xl font-semibold">Ma collection</h1>
          <span className="flex items-baseline gap-3">
            <span className="text-sm text-stone-400">
              {disques.length} {disques.length > 1 ? 'disques' : 'disque'}
            </span>
            <Link to="/reglages" aria-label="Réglages" className="text-sm text-amber-500">
              Réglages
            </Link>
          </span>
        </div>

        <p className="px-4 text-2xl font-semibold text-amber-500">
          {formaterCAD(valeurTotale(disques))}
        </p>

        <div className="flex gap-2 p-4">
          <input
            type="search"
            value={requete}
            onChange={(e) => setRequete(e.target.value)}
            placeholder="Artiste, album, n° de catalogue…"
            className="min-w-0 flex-1 rounded-lg bg-stone-800 p-3 text-base"
          />
          <select
            value={tri}
            onChange={(e) => setTri(e.target.value as Tri)}
            className="rounded-lg bg-stone-800 p-3 text-base"
          >
            {Object.entries(TRIS_LIBELLES).map(([cle, libelle]) => (
              <option key={cle} value={cle}>{libelle}</option>
            ))}
          </select>
        </div>
      </header>

      {affiches.length === 0 && (
        <p className="p-8 text-center text-stone-500">
          {disques.length === 0
            ? 'Aucun disque. Touchez + pour ajouter le premier.'
            : 'Aucun résultat pour cette recherche.'}
        </p>
      )}

      <ul className="pb-24">
        {affiches.map((disque) => (
          <li key={disque.id}>
            <CarteDisque disque={disque} />
          </li>
        ))}
      </ul>

      <Link
        to="/ajouter-choix"
        aria-label="Ajouter un disque"
        className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] right-6 flex h-16 w-16
                   items-center justify-center rounded-full bg-amber-500 text-3xl
                   font-light text-stone-900 shadow-lg"
      >
        +
      </Link>
    </div>
  );
}
