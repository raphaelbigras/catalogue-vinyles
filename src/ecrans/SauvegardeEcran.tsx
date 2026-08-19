import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { db } from '../db/db';
import { listerDisques } from '../db/disques';
import { versCSV, versTexteAnnonce } from '../lib/csv';
import { nomHorodate, proposerFichier } from '../lib/partage';
import { deserialiser, ErreurSauvegarde, serialiser } from '../lib/sauvegarde';
import {
  derniereSauvegarde, marquerSauvegarde, modificationsEnAttente,
} from '../lib/suivi-sauvegarde';

export default function SauvegardeEcran() {
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  // Force un rendu apres une sauvegarde, le compteur vivant hors de l'etat React.
  const [rafraichissement, setRafraichissement] = useState(0);
  const champFichier = useRef<HTMLInputElement>(null);

  const enAttente = modificationsEnAttente();
  const derniere = derniereSauvegarde();
  void rafraichissement;

  async function sauvegarder() {
    setErreur(null);
    const disques = await listerDisques();
    const enregistre = await proposerFichier(
      nomHorodate('collection-disques', 'json'),
      serialiser(disques),
      'application/json',
    );
    if (enregistre) {
      marquerSauvegarde();
      setRafraichissement((n) => n + 1);
      setMessage(`${disques.length} disque${disques.length > 1 ? 's' : ''} sauvegardé${disques.length > 1 ? 's' : ''}.`);
    }
  }

  async function exporterCSV() {
    setErreur(null);
    await proposerFichier(
      nomHorodate('collection-disques', 'csv'),
      versCSV(await listerDisques()),
      'text/csv',
    );
  }

  async function exporterAnnonce() {
    setErreur(null);
    await proposerFichier(
      nomHorodate('annonce-disques', 'txt'),
      versTexteAnnonce(await listerDisques()),
      'text/plain',
    );
  }

  async function restaurer(evenement: React.ChangeEvent<HTMLInputElement>) {
    const fichier = evenement.target.files?.[0];
    if (fichier === undefined) return;
    setErreur(null);
    setMessage(null);

    try {
      const disques = deserialiser(await fichier.text());

      const confirme = confirm(
        `Remplacer votre collection actuelle par les ${disques.length} disques de ce `
        + 'fichier ? Ce qui est actuellement dans l\'application sera effacé.',
      );
      if (!confirme) return;

      await db.disques.clear();
      await db.disques.bulkAdd(disques);
      marquerSauvegarde();
      setRafraichissement((n) => n + 1);
      setMessage(`${disques.length} disque${disques.length > 1 ? 's' : ''} restauré${disques.length > 1 ? 's' : ''}.`);
    } catch (e) {
      setErreur(e instanceof ErreurSauvegarde ? e.message : 'Ce fichier n\'a pas pu être lu.');
    } finally {
      // Permet de resélectionner le même fichier après une erreur.
      evenement.target.value = '';
    }
  }

  return (
    <div className="p-4 pt-[calc(1rem+env(safe-area-inset-top))]">
      <Link to="/" className="text-sm text-amber-500">← Retour à la collection</Link>
      <h1 className="mt-3 text-xl font-semibold">Sauvegarde et exports</h1>

      <p className="mt-4 rounded-lg bg-stone-800 p-3 text-sm text-stone-400">
        Votre collection est enregistrée uniquement sur cet appareil. Si vous supprimez
        l'application de votre écran d'accueil, elle est perdue. Sauvegardez de temps en
        temps dans Fichiers.
      </p>

      <p className="mt-4 text-sm text-stone-400">
        {derniere === null
          ? 'Aucune sauvegarde effectuée pour l\'instant.'
          : `Dernière sauvegarde : ${derniere.toLocaleDateString('fr-CA')}.`}
        {enAttente > 0 && ` ${enAttente} modification${enAttente > 1 ? 's' : ''} depuis.`}
      </p>

      <button
        type="button"
        onClick={sauvegarder}
        className="mt-4 w-full rounded-lg bg-amber-500 p-4 text-base font-semibold text-stone-900"
      >
        Sauvegarder maintenant
      </button>

      <h2 className="mt-8 text-lg font-semibold">Exporter</h2>
      <div className="mt-3 space-y-3">
        <button
          type="button"
          onClick={exporterCSV}
          className="w-full rounded-lg bg-stone-800 p-4 text-base"
        >
          Tableur (CSV pour Excel)
        </button>
        <button
          type="button"
          onClick={exporterAnnonce}
          className="w-full rounded-lg bg-stone-800 p-4 text-base"
        >
          Texte pour une annonce
        </button>
      </div>

      <h2 className="mt-8 text-lg font-semibold">Restaurer</h2>
      <p className="mt-2 text-sm text-stone-400">
        Remplace la collection actuelle par le contenu d'un fichier de sauvegarde.
      </p>
      <input
        ref={champFichier}
        type="file"
        accept="application/json,.json"
        onChange={restaurer}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => champFichier.current?.click()}
        className="mt-3 w-full rounded-lg border border-stone-700 p-4 text-base"
      >
        Choisir un fichier de sauvegarde
      </button>

      {message !== null && (
        <p className="mt-4 rounded-lg bg-stone-800 p-3 text-center text-sm text-green-400">
          {message}
        </p>
      )}
      {erreur !== null && (
        <p className="mt-4 rounded-lg border border-red-900 p-3 text-sm text-red-400">{erreur}</p>
      )}
    </div>
  );
}
