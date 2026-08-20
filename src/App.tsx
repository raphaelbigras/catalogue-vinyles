import { Navigate, Route, Routes } from 'react-router';
import ListeEcran from './ecrans/ListeEcran';
import SauvegardeEcran from './ecrans/SauvegardeEcran';
import ScanEcran from './ecrans/ScanEcran';
import FicheEcran from './ecrans/FicheEcran';
import FormulaireEcran from './ecrans/FormulaireEcran';
import ReglagesEcran from './ecrans/ReglagesEcran';
import ChoixAjoutEcran from './ecrans/ChoixAjoutEcran';
import RechercheEcran from './ecrans/RechercheEcran';

export default function App() {
  return (
    <div className="min-h-dvh bg-stone-900 text-stone-100 pb-[env(safe-area-inset-bottom)]">
      <Routes>
        <Route path="/" element={<ListeEcran />} />
        <Route path="/disque/:id" element={<FicheEcran />} />
        <Route path="/ajouter" element={<FormulaireEcran />} />
        <Route path="/disque/:id/modifier" element={<FormulaireEcran />} />
        <Route path="/reglages" element={<ReglagesEcran />} />
        <Route path="/sauvegarde" element={<SauvegardeEcran />} />
        <Route path="/ajouter-choix" element={<ChoixAjoutEcran />} />
        <Route path="/chercher" element={<RechercheEcran />} />
        <Route path="/scanner" element={<ScanEcran />} />
        {/* Une adresse inconnue affichait une page blanche : sans barre d'adresse
            ni bouton retour, l'application etait alors sans issue. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
