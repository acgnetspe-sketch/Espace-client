import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import '@fontsource-variable/inter';
import './styles.css';

import { configurationPresente } from './lib/supabase';
import { FournisseurConnexion, useConnexion } from './lib/auth';
import { MiseEnPage } from './composants/MiseEnPage';
import { Chargement, PageIntrouvable } from './composants/Communs';
import { Connexion } from './pages/Connexion';
import { TableauDeBord } from './pages/TableauDeBord';
import { Sites } from './pages/Sites';
import { FicheSite } from './pages/FicheSite';
import { FicheIntervention } from './pages/FicheIntervention';
import { Planning } from './pages/Planning';
import { MonCompte } from './pages/MonCompte';
import { MentionsLegales } from './pages/MentionsLegales';
import { CompteNonActive } from './pages/CompteNonActive';
import { AdminAccueil } from './pages/admin/AdminAccueil';
import { AdminClients } from './pages/admin/AdminClients';
import { AdminClient } from './pages/admin/AdminClient';
import { AdminSites } from './pages/admin/AdminSites';
import { AdminSite } from './pages/admin/AdminSite';
import { AdminImportSites } from './pages/admin/AdminImportSites';
import { AdminInterventions } from './pages/admin/AdminInterventions';
import { AdminIntervention } from './pages/admin/AdminIntervention';

/** Réservé aux personnes connectées ET dont le compte a un profil. */
function AccesProtege({ children }: { children: ReactNode }) {
  const { chargement, session, profil } = useConnexion();
  const emplacement = useLocation();
  if (chargement) return <Chargement texte="Connexion en cours…" />;
  if (!session) return <Navigate to="/connexion" replace state={{ depuis: emplacement.pathname }} />;
  if (!profil) return <CompteNonActive />;
  return <>{children}</>;
}

/**
 * Écrans réservés aux administrateurs. La vraie protection est dans la base
 * (règles RLS) : un client qui forcerait l'accès ne verrait ni ne modifierait rien.
 */
function AccesAdmin({ children }: { children: ReactNode }) {
  const { profil } = useConnexion();
  if (profil?.role !== 'admin') return <PageIntrouvable />;
  return <>{children}</>;
}

/** Accueil : tableau de bord client, ou administration pour l'équipe ACG. */
function Accueil() {
  const { profil } = useConnexion();
  if (profil?.role === 'admin') return <Navigate to="/admin" replace />;
  return <TableauDeBord />;
}

function ConfigurationManquante() {
  return (
    <main className="boite-connexion">
      <div className="carte">
        <h1>Configuration incomplète</h1>
        <p>
          L’application ne connaît pas l’adresse de la base de données. Renseignez <code>VITE_SUPABASE_URL</code> et{' '}
          <code>VITE_SUPABASE_ANON_KEY</code> (fichier <code>.env</code> en local, ou réglages du site sur Netlify), puis
          relancez.
        </p>
      </div>
    </main>
  );
}

function Application() {
  if (!configurationPresente) return <ConfigurationManquante />;
  return (
    <FournisseurConnexion>
      <BrowserRouter>
        <Routes>
          <Route path="/connexion" element={<Connexion />} />
          <Route
            element={
              <AccesProtege>
                <MiseEnPage />
              </AccesProtege>
            }
          >
            <Route index element={<Accueil />} />
            <Route path="vue-client" element={<TableauDeBord />} />
            <Route path="sites" element={<Sites />} />
            <Route path="sites/:id" element={<FicheSite />} />
            <Route path="interventions/:id" element={<FicheIntervention />} />
            <Route path="planning" element={<Planning />} />
            <Route path="compte" element={<MonCompte />} />
            <Route path="admin" element={<AccesAdmin><AdminAccueil /></AccesAdmin>} />
            <Route path="admin/clients" element={<AccesAdmin><AdminClients /></AccesAdmin>} />
            <Route path="admin/clients/:id" element={<AccesAdmin><AdminClient /></AccesAdmin>} />
            <Route path="admin/sites" element={<AccesAdmin><AdminSites /></AccesAdmin>} />
            <Route path="admin/sites/import" element={<AccesAdmin><AdminImportSites /></AccesAdmin>} />
            <Route path="admin/sites/:id" element={<AccesAdmin><AdminSite /></AccesAdmin>} />
            <Route path="admin/interventions" element={<AccesAdmin><AdminInterventions /></AccesAdmin>} />
            <Route path="admin/interventions/:id" element={<AccesAdmin><AdminIntervention /></AccesAdmin>} />
            <Route path="*" element={<PageIntrouvable />} />
          </Route>
          <Route path="/mentions-legales" element={<MentionsLegales />} />
        </Routes>
      </BrowserRouter>
    </FournisseurConnexion>
  );
}

createRoot(document.getElementById('racine')!).render(
  <StrictMode>
    <Application />
  </StrictMode>,
);
