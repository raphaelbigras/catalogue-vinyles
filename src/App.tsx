import { Route, Routes } from 'react-router';
import ListeEcran from './ecrans/ListeEcran';
import FicheEcran from './ecrans/FicheEcran';
import FormulaireEcran from './ecrans/FormulaireEcran';
import ReglagesEcran from './ecrans/ReglagesEcran';

export default function App() {
  return (
    <div className="min-h-dvh bg-stone-900 text-stone-100 pb-[env(safe-area-inset-bottom)]">
      <Routes>
        <Route path="/" element={<ListeEcran />} />
        <Route path="/disque/:id" element={<FicheEcran />} />
        <Route path="/ajouter" element={<FormulaireEcran />} />
        <Route path="/disque/:id/modifier" element={<FormulaireEcran />} />
        <Route path="/reglages" element={<ReglagesEcran />} />
      </Routes>
    </div>
  );
}
