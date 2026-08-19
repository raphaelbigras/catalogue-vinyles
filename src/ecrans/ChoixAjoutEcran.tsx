import { Link } from 'react-router';

export default function ChoixAjoutEcran() {
  return (
    <div className="p-4 pt-[calc(1rem+env(safe-area-inset-top))]">
      <Link to="/" className="text-sm text-amber-500">← Retour à la collection</Link>
      <h1 className="mt-3 text-xl font-semibold">Ajouter un disque</h1>

      <div className="mt-8 space-y-4">
        <Link
          to="/scanner"
          className="block rounded-lg bg-amber-500 p-5 text-center text-stone-900"
        >
          <span className="block text-lg font-semibold">Scanner le code-barres</span>
          <span className="mt-1 block text-sm">
            Le plus rapide, quand le disque en a un
          </span>
        </Link>

        <Link to="/chercher" className="block rounded-lg bg-stone-800 p-5 text-center">
          <span className="block text-lg font-semibold">Chercher sur Discogs</span>
          <span className="mt-1 block text-sm text-stone-400">
            Remplit le label, le pays, l'année et la valeur à votre place
          </span>
        </Link>

        <Link to="/ajouter" className="block rounded-lg bg-stone-800 p-5 text-center">
          <span className="block text-lg font-semibold">Saisir à la main</span>
          <span className="mt-1 block text-sm text-stone-400">
            Pour un disque introuvable sur Discogs
          </span>
        </Link>
      </div>
    </div>
  );
}
