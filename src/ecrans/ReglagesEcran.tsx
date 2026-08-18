import { useState } from 'react';
import { Link } from 'react-router';
import { effacerJeton, enregistrerJeton, lireJeton } from '../reglages';

export default function ReglagesEcran() {
  const [jeton, setJeton] = useState(lireJeton() ?? '');
  const [enregistre, setEnregistre] = useState(false);

  function soumettre(evenement: React.FormEvent) {
    evenement.preventDefault();
    if (jeton.trim() === '') effacerJeton();
    else enregistrerJeton(jeton);
    setEnregistre(true);
  }

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
            <li>des recherches plus rapides quand vous en enchaînez beaucoup</li>
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
    </div>
  );
}
