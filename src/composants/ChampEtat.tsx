import { ETATS, ETATS_LIBELLES, type Etat } from '../db/schema';

interface Props {
  etiquette: string;
  valeur: Etat;
  onChange: (etat: Etat) => void;
}

export default function ChampEtat({ etiquette, valeur, onChange }: Props) {
  return (
    <label className="block">
      <span className="text-sm text-stone-400">{etiquette}</span>
      <select
        className="mt-1 w-full rounded-lg bg-stone-800 p-3 text-base"
        value={valeur}
        onChange={(e) => onChange(e.target.value as Etat)}
      >
        {ETATS.map((etat) => (
          <option key={etat} value={etat}>{etat}</option>
        ))}
      </select>
      <span className="mt-1 block text-xs text-stone-500">{ETATS_LIBELLES[valeur]}</span>
    </label>
  );
}
