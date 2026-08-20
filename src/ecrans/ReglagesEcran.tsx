import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { listerDisques, modifierDisque } from '../db/disques';
import { obtenirPrix } from '../discogs/api';
import {
  disquesRafraichissables,
  intervalleRecommande,
  rafraichirValeurs,
  type ProgressionRafraichissement,
} from '../discogs/rafraichir';
import { demanderPersistance } from '../lib/persistance';
import { effacerJeton, enregistrerJeton, lireJeton } from '../reglages';

export default function ReglagesEcran() {
  const [jeton, setJeton] = useState(lireJeton() ?? '');
  const [enregistre, setEnregistre] = useState(false);

  const [progression, setProgression] = useState<ProgressionRafraichissement | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [bilan, setBilan] = useState<string | null>(null);
  const controleur = useRef<AbortController | null>(null);

  // iOS decide seul s'il protege le stockage de l'app contre l'effacement
  // automatique, et le verdict differe entre Safari et l'app installee : on
  // l'affiche ici plutot que de le supposer. `null` = reponse pas encore connue.
  const [protege, setProtege] = useState<boolean | null>(null);
  useEffect(() => { void demanderPersistance().then(setProtege); }, []);


  function soumettre(evenement: React.FormEvent) {
    evenement.preventDefault();
    if (jeton.trim() === '') effacerJeton();
    else enregistrerJeton(jeton);
    setEnregistre(true);
  }

  async function lancerRafraichissement() {
    const disques = await listerDisques();
    const eligibles = disquesRafraichissables(disques);

    if (eligibles.length === 0) {
      setBilan('Aucun disque à rafraîchir : ils ont tous une valeur saisie à la main, '
        + 'ou n\'ont pas été trouvés sur Discogs.');
      return;
    }

    controleur.current = new AbortController();
    setEnCours(true);
    setBilan(null);
    setProgression({ total: eligibles.length, traites: 0, echecs: 0, sansPrix: 0 });

    const resultat = await rafraichirValeurs(
      disques,
      { obtenirPrix, modifierDisque },
      {
        intervalleMs: intervalleRecommande(lireJeton() !== null),
        signal: controleur.current.signal,
        surProgression: (p) => setProgression((avant) => ({ ...p, sansPrix: avant?.sansPrix ?? 0 })),
      },
    );

    setEnCours(false);
    setProgression(null);
    const pluriel = resultat.traites > 1 ? 's' : '';
    setBilan(
      `${resultat.traites} disque${pluriel} sur ${resultat.total} consulté${pluriel}.`
      + (resultat.sansPrix > 0 ? ` ${resultat.sansPrix} sans exemplaire en vente.` : '')
      + (resultat.echecs > 0 ? ` ${resultat.echecs} en erreur.` : ''),
    );
  }

  /** Estimation en minutes du temps restant, arrondie au supérieur. */
  const minutesRestantes = (nombre: number) =>
    Math.ceil((nombre * intervalleRecommande(lireJeton() !== null)) / 60000);

  return (
    <div className="p-4 pt-[calc(1rem+env(safe-area-inset-top))]">
      <Link to="/" className="text-sm text-amber-500">← Retour à la collection</Link>
      <h1 className="mt-3 text-xl font-semibold">Réglages</h1>

      <form onSubmit={soumettre} className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm text-stone-400">Jeton Discogs (facultatif)</span>
          <input
            type="text"
            value={jeton}
            onChange={(e) => { setJeton(e.target.value); setEnregistre(false); }}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="mt-1 w-full rounded-lg bg-stone-800 p-3 font-mono text-sm"
          />
        </label>

        <div className="rounded-lg bg-stone-800 p-4 text-sm text-stone-400">
          <p className="text-stone-300">L'application fonctionne très bien sans jeton.</p>
          <p className="mt-2">Avec un jeton, vous obtenez en plus :</p>
          <ul className="mt-1 list-disc pl-5">
            <li>les images des pochettes dans les résultats de recherche</li>
            <li>une mise à jour des valeurs deux fois plus rapide</li>
          </ul>
          <p className="mt-2">
            Les valeurs en dollars canadiens sont exactes dans les deux cas.
          </p>
          <p className="mt-2">
            Pour en créer un : <span className="text-stone-300">discogs.com/settings/developers</span>,
            bouton « Générer un jeton ».
          </p>
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-amber-500 p-4 text-base font-semibold text-stone-900"
        >
          Enregistrer
        </button>

        {enregistre && <p className="text-center text-sm text-green-400">Enregistré.</p>}
      </form>

      <hr className="my-8 border-stone-800" />

      <h2 className="text-lg font-semibold">Mettre à jour les valeurs</h2>
      <p className="mt-2 text-sm text-stone-400">
        Consulte Discogs pour chaque disque et met à jour sa valeur estimée. Les valeurs
        que vous avez saisies vous-même ne sont pas touchées.
      </p>

      {!enCours && (
        <button
          type="button"
          onClick={lancerRafraichissement}
          className="mt-4 w-full rounded-lg bg-stone-800 p-4 text-base"
        >
          Rafraîchir toutes les valeurs
        </button>
      )}

      {enCours && progression !== null && (
        <div className="mt-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-stone-800">
            <div
              className="h-full bg-amber-500 transition-all"
              style={{ width: `${(progression.traites / progression.total) * 100}%` }}
            />
          </div>
          <p className="mt-2 text-center text-sm text-stone-400">
            {progression.traites} sur {progression.total} — environ{' '}
            {minutesRestantes(progression.total - progression.traites)} min restantes
          </p>
          <button
            type="button"
            onClick={() => controleur.current?.abort()}
            className="mt-3 w-full rounded-lg border border-stone-700 p-3 text-sm"
          >
            Arrêter
          </button>
        </div>
      )}

      {bilan !== null && (
        <p className="mt-4 rounded-lg bg-stone-800 p-3 text-sm text-stone-400">{bilan}</p>
      )}

      <hr className="my-8 border-stone-800" />
      <p className="text-sm text-stone-400">
        Stockage protégé contre l'effacement automatique :{' '}
        {protege === null ? 'vérification…' : protege ? 'oui' : 'non'}
      </p>

      <Link
        to="/sauvegarde"
        className="mt-4 block rounded-lg bg-stone-800 p-4 text-center text-base"
      >
        Sauvegarde et exports
      </Link>
    </div>
  );
}
