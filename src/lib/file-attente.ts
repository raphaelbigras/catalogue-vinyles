export interface Progression {
  total: number;
  traites: number;
  echecs: number;
}

export interface OptionsFile {
  /** Délai entre deux traitements, pour rester sous la cadence autorisée. */
  intervalleMs: number;
  signal?: AbortSignal;
  surProgression?: (progression: Progression) => void;
  /** Injectable : les tests passent une attente instantanée. */
  attendre?: (ms: number) => Promise<void>;
}

const attenteReelle = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Applique `traiter` à chaque élément en espaçant les appels.
 *
 * Un échec sur un élément n'interrompt pas le lot : sur 200 disques, un seul disparu
 * de Discogs ne doit pas priver les 199 autres de leur mise à jour.
 */
export async function traiterEnFile<T>(
  elements: readonly T[],
  traiter: (element: T) => Promise<void>,
  options: OptionsFile,
): Promise<Progression> {
  const attendre = options.attendre ?? attenteReelle;
  const progression: Progression = { total: elements.length, traites: 0, echecs: 0 };

  for (let i = 0; i < elements.length; i += 1) {
    if (options.signal?.aborted === true) break;

    // Pas d'attente avant le premier : le lot doit démarrer immédiatement.
    if (i > 0) await attendre(options.intervalleMs);

    try {
      await traiter(elements[i]);
      progression.traites += 1;
    } catch {
      progression.echecs += 1;
    }

    options.surProgression?.({ ...progression });
  }

  return progression;
}
