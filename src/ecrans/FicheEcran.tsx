import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import Pochette from '../composants/Pochette';
import { modifierDisque, obtenirDisque, supprimerDisque } from '../db/disques';
import { ETATS_LIBELLES } from '../db/schema';
import { obtenirPrix } from '../discogs/api';
import { ErreurDiscogs } from '../discogs/client';
import { versTexteAnnonce } from '../lib/csv';
import { copierTexte } from '../lib/partage';
import { formaterCAD } from '../lib/valeur';

export default function FicheEcran() {
  const { id } = useParams();
  const navigate = useNavigate();
  const disque = useLiveQuery(async () => (await obtenirDisque(Number(id))) ?? null, [id]);
  const [messagePrix, setMessagePrix] = useState<string | null>(null);
  const [copie, setCopie] = useState(false);

  async function rafraichirPrix() {
    setMessagePrix('Consultation de Discogs…');
    try {
      const prix = await obtenirPrix(disque!.discogsReleaseId!);
      if (prix.valeur === null) {
        setMessagePrix('Aucun exemplaire en vente en ce moment — valeur inchangée.');
        return;
      }
      await modifierDisque(Number(id), {
        valeurEstimee: prix.valeur,
        valeurSource: 'discogs',
        valeurMaj: new Date(),
        discogsNumForSale: prix.nombreEnVente,
      });
      setMessagePrix('Valeur mise à jour.');
    } catch (e) {
      setMessagePrix(e instanceof ErreurDiscogs ? e.message : 'Une erreur est survenue.');
    }
  }

  if (disque === undefined) return <p className="p-8 text-stone-500">Chargement…</p>;
  if (disque === null) return <p className="p-8 text-stone-500">Disque introuvable.</p>;

  async function effacer() {
    if (!confirm(`Supprimer définitivement « ${disque!.album} » ?`)) return;
    await supprimerDisque(Number(id));
    navigate('/');
  }

  const lignes: [string, string][] = [
    ['Artiste', disque.artiste],
    ['Album', disque.album],
    ['Année', disque.annee?.toString() ?? '—'],
    ['Label', disque.label || '—'],
    ['N° de catalogue', disque.noCatalogue || '—'],
    ['Pays', disque.pays || '—'],
    ['Format', disque.format || '—'],
    ['État du disque', `${disque.etatDisque} — ${ETATS_LIBELLES[disque.etatDisque]}`],
    ['État de la pochette', `${disque.etatPochette} — ${ETATS_LIBELLES[disque.etatPochette]}`],
    ['Pochette générique', disque.pochetteGenerique ? 'Oui' : 'Non'],
    ['Quantité', disque.quantite.toString()],
    ['Valeur estimée', disque.valeurEstimee === null
      ? '—'
      : formaterCAD(disque.valeurEstimee)
        + (disque.valeurMaj === null
          ? ''
          : ` (${disque.valeurSource === 'discogs' ? 'Discogs' : 'saisie'}, `
            + `${disque.valeurMaj.toLocaleDateString('fr-CA')})`)],
    ['Notes', disque.notes || '—'],
  ];

  // versTexteAnnonce travaille sur une liste ; ici on ne lui passe que ce disque.
  const annonce = versTexteAnnonce([disque]);

  return (
    <div className="p-4 pt-[calc(1rem+env(safe-area-inset-top))]">
      <Link to="/" className="text-sm text-amber-500">← Retour à la collection</Link>

      <div className="mt-3 flex items-start gap-4">
        <Pochette url={disque.pochetteGrande ?? disque.pochettePetite} taille="h-28 w-28" />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold">{disque.album}</h1>
          <p className="text-stone-400">{disque.artiste}</p>
          <p className="mt-1 text-sm text-stone-500">Inventaire n° {disque.id}</p>
        </div>
      </div>

      <dl className="mt-6 divide-y divide-stone-800">
        {lignes.map(([etiquette, valeur]) => (
          <div key={etiquette} className="flex gap-4 py-3">
            <dt className="w-40 shrink-0 text-sm text-stone-400">{etiquette}</dt>
            <dd className="min-w-0 flex-1 text-sm">{valeur}</dd>
          </div>
        ))}
      </dl>

      {disque.discogsReleaseId !== null && (
        <div className="mt-6">
          <button
            type="button"
            onClick={rafraichirPrix}
            className="w-full rounded-lg bg-stone-800 p-4 text-base"
          >
            Rafraîchir la valeur depuis Discogs
          </button>
          {messagePrix !== null && (
            <p className="mt-2 text-center text-sm text-stone-400">{messagePrix}</p>
          )}
        </div>
      )}

      <h2 className="mt-8 text-lg font-semibold">Annonce</h2>
      <p className="mt-1 text-sm text-stone-400">
        À coller dans Marketplace, Kijiji ou une petite annonce.
      </p>
      <p className="mt-3 rounded-lg bg-stone-800 p-3 text-sm">{annonce}</p>
      <button
        type="button"
        onClick={async () => {
          setCopie(await copierTexte(annonce));
        }}
        className="mt-3 w-full rounded-lg border border-amber-600 p-4 text-base text-amber-500"
      >
        {copie ? 'Copié ✓' : "Copier l'annonce"}
      </button>

      <div className="mt-6 flex gap-3 pb-8">
        <button
          type="button"
          onClick={effacer}
          className="flex-1 rounded-lg border border-red-900 p-4 text-base text-red-400"
        >
          Supprimer
        </button>
        <Link
          to={`/disque/${disque.id}/modifier`}
          className="flex-1 rounded-lg bg-amber-500 p-4 text-center text-base font-semibold text-stone-900"
        >
          Modifier
        </Link>
      </div>
    </div>
  );
}
