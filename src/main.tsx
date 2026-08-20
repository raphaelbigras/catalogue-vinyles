import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import App from './App';
import { demanderPersistance } from './lib/persistance';
import './index.css';

// Demande a iOS de ne pas effacer la collection pour recuperer de l'espace disque.
// Sans reponse a attendre : le rendu ne doit pas dependre du verdict.
void demanderPersistance();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
