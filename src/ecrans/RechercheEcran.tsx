import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import CartePressage from '../composants/CartePressage';
import { chercher, obtenirFiche, obtenirPrix } from '../discogs/api';
import { ErreurDiscogs } from '../discogs/client';
import type { Pressage } from '../discogs/types';

export default function RechercheEcran() {
  const navigate = useNavigate();
  const location = useLocation();
  // Le scan transmet directement ses pressages : inutile de refaire la recherche.
  const depuisScan = (location.state ?? null) as { pressages?: Pressage[]; code?: string } | null;

  const [requete, setRequete] = useState('');
  const [pressages, setPressages] = useState<Pressage[] | null>(depuisScan?.pressages ?? null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function lancerRecherche(evenement: React.FormEvent) {
    evenement.preventDefault();
    if (requete.trim() === '') return;
    setEnCours(true);
    setErreur(null);
    try {
      setPressages(await chercher(requete));
    } catch (e) {
      setErreur(e instanceof ErreurDiscogs ? e.message : 'Une erreur est survenue.');
      setPressages(null);
    } finally {
      setEnCours(false);
    }
  }

  /**
   * Deux requêtes : la fiche donne artiste et album séparés et un label propre,
   * le prix vient de l'endpoint marché, seul à respecter la devise.
   */
  async function choisir(pressage: Pressage) {
    setEnCours(true);
    setErreur(null);
    try {
      const champs = await obtenirFiche(pressage.releaseId);
      const prix = await obtenirPrix(pressage.releaseId);
      navigate('/ajouter', {
        state: {
          ...champs,
          valeurEstimee: prix.valeur,
          discogsNumForSale: prix.nombreEnVente,
          // La fiche `/releases/` ne porte pas d'image exploitable : les URL viennent
          // du resultat de recherche, deja affiche a l'ecran.
          pochettePetite: pressage.pochettePetite,
          pochetteGrande: pressage.pochetteGrande,
        },
      });
    } catch (e) {
      setErreur(e instanceof ErreurDiscogs ? e.message : 'Une erreur est survenue.');
      setEnCours(false);
    }
  }

  return (
    <div className="p-4 pt-[calc(1rem+env(safe-area-inset-top))]">
      <Link to="/ajouter-choix" className="text-sm text-amber-500">← Retour</Link>
      <h1 className="mt-3 text-xl font-semibold">Chercher un disque</h1>

      <form onSubmit={lancerRecherche} className="mt-4 flex gap-2">
        <input
          type="search"
          value={requete}
          onChange={(e) => setRequete(e.target.value)}
          placeholder="Ex. : Harmonium Heptade"
          className="min-w-0 flex-1 rounded-lg bg-stone-800 p-3 text-base"
        />
        <button
          type="submit"
          className="rounded-lg bg-amber-500 px-5 text-base font-semibold text-stone-900"
        >
          Chercher
        </button>
      </form>

      {enCours && <p className="mt-8 text-center text-stone-500">Recherche en cours…</p>}

      {erreur !== null && (
        <p className="mt-6 rounded-lg border border-red-900 p-4 text-sm text-red-400">{erreur}</p>
      )}

      {!enCours && pressages !== null && pressages.length === 0 && (
        <div className="mt-8 text-center text-stone-500">
          <p>Aucun disque trouvé.</p>
          <p className="mt-2 text-sm">
            Essayez avec moins de mots, ou{' '}
            <Link to="/ajouter" className="text-amber-500">saisissez-le à la main</Link>.
          </p>
        </div>
      )}

      {depuisScan?.code !== undefined && (
        <p className="mt-4 rounded-lg bg-stone-800 p-3 text-sm text-stone-400">
          Résultats pour le code-barres{' '}
          <span className="font-mono text-amber-500">{depuisScan.code}</span>.
        </p>
      )}

      {!enCours && pressages !== null && pressages.length > 0 && (
        <>
          <p className="mt-6 text-sm text-stone-400">
            Plusieurs pressages du même album peuvent avoir des valeurs très différentes.
            Comparez le numéro en orange avec celui imprimé sur votre disque ou sa pochette.
          </p>
          <ul className="mt-2 pb-8">
            {pressages.map((pressage) => (
              <li key={pressage.releaseId}>
                <CartePressage pressage={pressage} onChoisir={choisir} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
