import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import ChampEtat from '../composants/ChampEtat';
import { ajouterDisque, modifierDisque, obtenirDisque } from '../db/disques';
import { DISQUE_VIDE, type NouveauDisque } from '../db/schema';

/** Champs texte simples, déclarés en données pour ne pas répéter 6 fois le même JSX. */
const CHAMPS_TEXTE = [
  { cle: 'artiste', etiquette: 'Artiste' },
  { cle: 'album', etiquette: 'Album' },
  { cle: 'label', etiquette: 'Label' },
  { cle: 'noCatalogue', etiquette: 'N° de catalogue' },
  { cle: 'pays', etiquette: 'Pays' },
  { cle: 'format', etiquette: 'Format (LP, 45t, 2xLP…)' },
] as const;

export default function FormulaireEcran() {
  const { id } = useParams();
  const navigate = useNavigate();
  const modeEdition = id !== undefined;
  const location = useLocation();

  /**
   * L'écran de recherche transmet les champs Discogs par l'état de navigation plutôt que
   * par l'URL : ils sont trop nombreux et contiennent des apostrophes et des accents.
   */
  const preremplissage = (location.state ?? null) as Partial<NouveauDisque> | null;

  const [disque, setDisque] = useState<NouveauDisque>(
    preremplissage === null
      ? DISQUE_VIDE
      : { ...DISQUE_VIDE, ...preremplissage, valeurSource: 'discogs', valeurMaj: new Date() },
  );
  const [charge, setCharge] = useState(!modeEdition);

  useEffect(() => {
    if (!modeEdition) return;
    obtenirDisque(Number(id)).then((existant) => {
      if (existant) setDisque(existant);
      setCharge(true);
    });
  }, [id, modeEdition]);

  function majChamp<C extends keyof NouveauDisque>(cle: C, valeur: NouveauDisque[C]) {
    setDisque((precedent) => ({ ...precedent, [cle]: valeur }));
  }

  async function enregistrer(evenement: React.FormEvent) {
    evenement.preventDefault();
    if (modeEdition) {
      await modifierDisque(Number(id), disque);
      navigate(`/disque/${id}`);
    } else {
      const nouvelId = await ajouterDisque(disque);
      navigate(`/disque/${nouvelId}`);
    }
  }

  if (!charge) return <p className="p-8 text-stone-500">Chargement…</p>;

  return (
    <form onSubmit={enregistrer} className="space-y-4 p-4 pt-[calc(1rem+env(safe-area-inset-top))]">
      <h1 className="text-xl font-semibold">
        {modeEdition ? 'Modifier le disque' : 'Nouveau disque'}
      </h1>

      {preremplissage !== null && (
        <p className="rounded-lg bg-stone-800 p-3 text-sm text-stone-400">
          Rempli depuis Discogs. Vérifiez, puis indiquez l'état du disque et de la pochette.
        </p>
      )}

      {CHAMPS_TEXTE.map(({ cle, etiquette }) => (
        <label key={cle} className="block">
          <span className="text-sm text-stone-400">{etiquette}</span>
          <input
            type="text"
            value={disque[cle]}
            onChange={(e) => majChamp(cle, e.target.value)}
            required={cle === 'artiste' || cle === 'album'}
            className="mt-1 w-full rounded-lg bg-stone-800 p-3 text-base"
          />
        </label>
      ))}

      <label className="block">
        <span className="text-sm text-stone-400">Année</span>
        <input
          type="number"
          inputMode="numeric"
          value={disque.annee ?? ''}
          onChange={(e) => majChamp('annee', e.target.value === '' ? null : Number(e.target.value))}
          className="mt-1 w-full rounded-lg bg-stone-800 p-3 text-base"
        />
      </label>

      <ChampEtat
        etiquette="État du disque"
        valeur={disque.etatDisque}
        onChange={(etat) => majChamp('etatDisque', etat)}
      />

      <ChampEtat
        etiquette="État de la pochette"
        valeur={disque.etatPochette}
        onChange={(etat) => majChamp('etatPochette', etat)}
      />

      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={disque.pochetteGenerique}
          onChange={(e) => majChamp('pochetteGenerique', e.target.checked)}
          className="h-5 w-5"
        />
        <span className="text-sm">Pochette générique ou absente</span>
      </label>

      <label className="block">
        <span className="text-sm text-stone-400">Quantité</span>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          value={disque.quantite}
          onChange={(e) => majChamp('quantite', Math.max(1, Number(e.target.value)))}
          className="mt-1 w-full rounded-lg bg-stone-800 p-3 text-base"
        />
      </label>

      <label className="block">
        <span className="text-sm text-stone-400">Valeur estimée (CAD)</span>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min={0}
          value={disque.valeurEstimee ?? ''}
          onChange={(e) => {
            const brut = e.target.value;
            majChamp('valeurEstimee', brut === '' ? null : Number(brut));
            majChamp('valeurSource', 'manuelle');
            majChamp('valeurMaj', brut === '' ? null : new Date());
          }}
          className="mt-1 w-full rounded-lg bg-stone-800 p-3 text-base"
        />
      </label>

      <label className="block">
        <span className="text-sm text-stone-400">Notes</span>
        <textarea
          value={disque.notes}
          onChange={(e) => majChamp('notes', e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg bg-stone-800 p-3 text-base"
        />
      </label>

      <div className="flex gap-3 pb-8">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex-1 rounded-lg bg-stone-800 p-4 text-base"
        >
          Annuler
        </button>
        <button
          type="submit"
          className="flex-1 rounded-lg bg-amber-500 p-4 text-base font-semibold text-stone-900"
        >
          Enregistrer
        </button>
      </div>
    </form>
  );
}
