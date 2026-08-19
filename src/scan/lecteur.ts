import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader';
// L'import `?url` fait servir le binaire depuis notre propre origine. Sans cela,
// zxing-wasm le télécharge sur le CDN jsDelivr : le scan ne fonctionnerait plus
// hors-ligne et dépendrait d'un tiers à l'exécution.
import urlWasm from 'zxing-wasm/reader/zxing_reader.wasm?url';

prepareZXingModule({ overrides: { locateFile: () => urlWasm } });

/** Formats portés par les disques : EAN-13 en Europe, UPC-A en Amérique du Nord. */
const FORMATS = ['EAN-13', 'UPC-A', 'EAN-8', 'UPC-E'] as const;

/** Intervalle entre deux analyses. Plus court épuise la batterie sans gagner en réussite. */
const INTERVALLE_MS = 400;

export interface SessionScan {
  arreter: () => void;
}

export class ErreurCamera extends Error {}

/**
 * Ouvre la caméra arrière et analyse l'image jusqu'à trouver un code-barres.
 * Appelle `surCode` une seule fois, puis s'arrête d'elle-même.
 */
export async function demarrerScan(
  video: HTMLVideoElement,
  surCode: (code: string) => void,
): Promise<SessionScan> {
  let flux: MediaStream;
  try {
    flux = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
    });
  } catch (e) {
    const nom = e instanceof Error ? e.name : '';
    throw new ErreurCamera(
      nom === 'NotAllowedError'
        ? 'L\'accès à la caméra a été refusé. Autorisez-le dans Réglages > Safari, '
          + 'ou cherchez le disque par son titre.'
        : 'La caméra n\'a pas pu être ouverte. Cherchez le disque par son titre.',
    );
  }

  video.srcObject = flux;
  await video.play();

  const canevas = document.createElement('canvas');
  const contexte = canevas.getContext('2d', { willReadFrequently: true });
  let actif = true;

  function arreter() {
    actif = false;
    for (const piste of flux.getTracks()) piste.stop();
    video.srcObject = null;
  }

  async function analyser() {
    if (!actif || contexte === null) return;

    if (video.videoWidth > 0) {
      canevas.width = video.videoWidth;
      canevas.height = video.videoHeight;
      contexte.drawImage(video, 0, 0);

      try {
        const resultats = await readBarcodes(
          contexte.getImageData(0, 0, canevas.width, canevas.height),
          { formats: [...FORMATS] },
        );
        const trouve = resultats.find((r) => r.text !== '');
        if (trouve !== undefined) {
          arreter();
          surCode(trouve.text);
          return;
        }
      } catch {
        // Une image illisible n'est pas une erreur : on retentera à la suivante.
      }
    }

    if (actif) setTimeout(() => { void analyser(); }, INTERVALLE_MS);
  }

  void analyser();
  return { arreter };
}
