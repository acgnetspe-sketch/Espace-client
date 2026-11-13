import { describe, expect, it } from 'vitest';
import { composer, echapper, formaterDate, traiter, type EmailEnAttente } from './index';

const email = (type: EmailEnAttente['type'], donnees: Record<string, unknown>): EmailEnAttente => ({
  id: '1',
  type,
  destinataire: 'client@example.com',
  nom_destinataire: 'Camille Démo',
  donnees,
});

describe('e-mails automatiques', () => {
  it('neutralise tout code HTML saisi par un utilisateur', () => {
    expect(echapper('<script>alert("x")</script> & co')).toBe('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; co');
    const { html } = composer(
      email('nouvelle_demande', {
        type_demande: 'probleme',
        message: '<img src=x onerror=alert(1)>\nDeuxième ligne',
        organisation_nom: 'Démo <b>A</b>',
        auteur_nom: 'Camille',
      }),
      'https://espace.example.com',
    );
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<b>A</b>');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;<br>Deuxième ligne');
  });

  it('rapport publié : lien vers l’intervention, dates françaises, anomalie signalée', () => {
    const { sujet, html } = composer(
      email('rapport_publie', {
        intervention_id: 'abc',
        site_nom: 'Centrale Démo',
        type: 'nettoyage',
        debut_reel: '2026-10-23',
        fin_reelle: '2026-10-24',
        panneaux_casses: 3,
      }),
      'https://espace.example.com/',
    );
    expect(sujet).toBe('Rapport disponible – Centrale Démo');
    expect(html).toContain('https://espace.example.com/interventions/abc');
    expect(html).toContain('du 23/10/2026 au 24/10/2026');
    expect(html).toContain('3 panneaux cassés');
    expect(html).toContain('Bonjour Camille Démo');
  });

  it('rappel, réponse et nouvelle demande ont un sujet explicite', () => {
    expect(composer(email('rappel_passage', { site_nom: 'S', type: 'old', debut_prevu: '2026-12-01', fin_prevue: '2026-12-01' }), 'https://x').sujet).toBe(
      'Rappel : passage prévu le 01/12/2026 – S',
    );
    expect(composer(email('reponse_demande', { type_demande: 'devis', statut: 'traitee', reponse: 'OK', message: 'm' }), 'https://x').sujet).toBe(
      'Réponse à votre demande – Demande de devis',
    );
    expect(composer(email('nouvelle_demande', { type_demande: 'devis', organisation_nom: 'Démo A', message: 'm' }), 'https://x').sujet).toBe(
      'Nouvelle demande – Démo A',
    );
    expect(formaterDate('2026-01-05')).toBe('05/01/2026');
  });

  it('refuse un appel sans la bonne clé d’envoi', async () => {
    const env = { SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '', BREVO_API_KEY: 'k', CLE_ENVOI: 'bonne-cle', EMAIL_EXPEDITEUR: 'a@b.c', SITE_URL: 'https://x' };
    const appel = (cle?: string) =>
      traiter(new Request('http://x', { method: 'POST', headers: cle ? { 'x-cle-envoi': cle } : {} }), env, () => {
        throw new Error('ne doit pas être appelé');
      });
    expect((await appel()).status).toBe(401);
    expect((await appel('mauvaise-cle')).status).toBe(401);
  });
});
