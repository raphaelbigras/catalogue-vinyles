import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { chercherParCodeBarres } from '../discogs/api';
import { ErreurDiscogs } from '../discogs/client';
import { demarrerScan, ErreurCamera, type SessionScan } from '../scan/lecteur';

export default function ScanEcran() {
  const navigate = useNavigate();
  const video = useRef<HTMLVideoElement>(null);
  const session = useRef<SessionScan | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [codeTrouve, setCodeTrouve] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;

    async function traiterCode(code: string) {
      if (annule) return;
      setCodeTrouve(code);
      try {
        const pressages = await chercherParCodeBarres(code);
        if (annule) return;
        if (pressages.length === 0) {
          setErreur(`Code-barres ${code} lu, mais introuvable sur Discogs. `
            + 'Cherchez le disque par son titre.');
          return;
        }
        // L'écran de recherche sait déjà présenter des pressages et gérer le choix.
        navigate('/chercher', { state: { pressages, code } });
      } catch (e) {
        if (!annule) {
          setErreur(e instanceof ErreurDiscogs ? e.message : 'Une erreur est survenue.');
        }
      }
    }

    if (video.current !== null) {
      demarrerScan(video.current, (code) => { void traiterCode(code); })
        .then((s) => {
          if (annule) s.arreter();
          else session.current = s;
        })
        .catch((e) => {
          if (!annule) {
            setErreur(e instanceof ErreurCamera ? e.message : 'Une erreur est survenue.');
          }
        });
    }

    return () => {
      annule = true;
      session.current?.arreter();
    };
  }, [navigate]);

  return (
    <div className="p-4 pt-[calc(1rem+env(safe-area-inset-top))]">
      <Link to="/ajouter-choix" className="text-sm text-amber-500">← Retour</Link>
      <h1 className="mt-3 text-xl font-semibold">Scanner un code-barres</h1>

      <p className="mt-2 text-sm text-stone-400">
        Cadrez le code-barres au dos de la pochette. Beaucoup de disques anciens n'en ont
        pas : dans ce cas, cherchez-le par son titre.
      </p>

      <video
        ref={video}
        playsInline
        muted
        className="mt-4 w-full rounded-lg bg-black"
        style={{ aspectRatio: '4 / 3', objectFit: 'cover' }}
      />

      {codeTrouve !== null && erreur === null && (
        <p className="mt-4 text-center text-sm text-stone-400">
          Code lu : <span className="font-mono text-amber-500">{codeTrouve}</span> — recherche…
        </p>
      )}

      {erreur !== null && (
        <div className="mt-4 rounded-lg border border-red-900 p-4">
          <p className="text-sm text-red-400">{erreur}</p>
          <Link to="/chercher" className="mt-3 block text-center text-sm text-amber-500">
            Chercher par titre
          </Link>
        </div>
      )}
    </div>
  );
}
