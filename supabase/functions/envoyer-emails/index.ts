// =============================================================================
// Edge Function « envoyer-emails » — Espace client ACG NET SPE
// -----------------------------------------------------------------------------
// Envoie les e-mails déposés dans la boîte d'envoi (table « emails ») :
// rapport publié, rappel J-7, réponse à une demande, nouvelle demande.
// Appelée toutes les 5 minutes par une tâche planifiée de la base
// (voir supabase/taches_planifiees.sql), avec une clé partagée.
//
// Service d'envoi : Brevo (société française, données dans l'UE).
//
// Réglages (Supabase › Edge Functions › Secrets) :
//   BREVO_API_KEY     clé d'API Brevo (secrète)
//   CLE_ENVOI         longue chaîne aléatoire, identique à celle de la tâche planifiée
//   EMAIL_EXPEDITEUR  adresse d'envoi validée chez Brevo (ex. espace-client@acgnetspe.fr)
//   SITE_URL          adresse de l'espace client (ex. https://espace-client.acgnetspe.fr)
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement.
//
// Déploiement : voir docs/GUIDE_ETAPE_4.md. Désactiver « Verify JWT » pour
// cette fonction : elle est protégée par CLE_ENVOI.
// =============================================================================

// deno-lint-ignore-file no-explicit-any
type ClientSupabase = any;
type FabriqueClient = (url: string, cle: string, options?: Record<string, unknown>) => ClientSupabase;

export interface Environnement {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  BREVO_API_KEY: string;
  CLE_ENVOI: string;
  EMAIL_EXPEDITEUR: string;
  SITE_URL: string;
  BREVO_API_URL?: string; // pour les tests uniquement
}

export interface EmailEnAttente {
  id: string;
  type: 'rapport_publie' | 'rappel_passage' | 'reponse_demande' | 'nouvelle_demande';
  destinataire: string;
  nom_destinataire: string | null;
  donnees: Record<string, any>;
}

// ---------------------------------------------------------------------------
// Mise en forme
// ---------------------------------------------------------------------------
const PRESTATIONS: Record<string, string> = {
  nettoyage: 'Nettoyage des modules',
  debroussaillage_interieur: 'Débroussaillage intérieur',
  old: 'Débroussaillement OLD',
  elagage: 'Élagage',
  autre: 'Autre prestation',
};
const DEMANDES: Record<string, string> = {
  nouvelle_intervention: 'Demande d’intervention',
  devis: 'Demande de devis',
  probleme: 'Signalement d’un problème',
  changement_date: 'Demande de changement de date',
};
const STATUTS_DEMANDE: Record<string, string> = {
  envoyee: 'Envoyée',
  prise_en_compte: 'Prise en compte',
  traitee: 'Traitée',
};

/** Protège le texte saisi par les utilisateurs (aucun code HTML ne passe). */
export function echapper(texte: unknown): string {
  return String(texte ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const paragraphes = (texte: unknown) => echapper(texte).replace(/\r?\n/g, '<br>');

export function formaterDate(date: unknown): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(date ?? ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

function periode(debut: unknown, fin: unknown): string {
  if (!debut) return 'date à définir';
  if (!fin || fin === debut) return `le ${formaterDate(debut)}`;
  return `du ${formaterDate(debut)} au ${formaterDate(fin)}`;
}

function gabarit(titre: string, corps: string, bouton: { texte: string; lien: string } | null): string {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:#F6F5F1;font-family:Arial,Helvetica,sans-serif;color:#2A3A47;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F5F1;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid #E2E0D8;border-radius:8px;">
        <tr><td style="background:#0B1E2D;padding:18px 24px;border-radius:8px 8px 0 0;">
          <span style="display:inline-block;width:14px;height:14px;background:#FFC629;vertical-align:middle;"></span>
          <span style="color:#FFFFFF;font-weight:bold;font-size:17px;letter-spacing:0.5px;vertical-align:middle;margin-left:8px;">ACG NET SPE</span>
        </td></tr>
        <tr><td style="padding:24px;">
          <h1 style="font-size:20px;color:#0B1E2D;margin:0 0 16px;">${echapper(titre)}</h1>
          ${corps}
          ${
            bouton
              ? `<p style="margin:24px 0 8px;"><a href="${echapper(bouton.lien)}" style="display:inline-block;background:#0B1E2D;color:#FFFFFF;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">${echapper(bouton.texte)}</a></p>`
              : ''
          }
        </td></tr>
        <tr><td style="padding:16px 24px;border-top:1px solid #E2E0D8;font-size:12px;color:#5B6B78;">
          Cet e-mail automatique vous est envoyé par ACG NET SPE dans le cadre de votre espace client.
          Pour ne plus recevoir ces e-mails, répondez simplement à votre interlocuteur ACG NET SPE.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

const p = (html: string) => `<p style="margin:0 0 12px;line-height:1.5;">${html}</p>`;
const citation = (html: string) =>
  `<div style="margin:0 0 12px;padding:12px 14px;background:#F6F5F1;border-left:4px solid #FFC629;line-height:1.5;">${html}</div>`;

/** Sujet et contenu HTML d'un e-mail. */
export function composer(email: EmailEnAttente, siteUrl: string): { sujet: string; html: string } {
  const d = email.donnees;
  const base = siteUrl.replace(/\/+$/, '');
  const bonjour = p(`Bonjour${email.nom_destinataire ? ' ' + echapper(email.nom_destinataire) : ''},`);
  const prestation = PRESTATIONS[d.type] ?? 'Intervention';

  switch (email.type) {
    case 'rapport_publie': {
      const sujet = `Rapport disponible – ${d.site_nom}`;
      const anomalie =
        Number(d.panneaux_casses) > 0
          ? p(
              Number(d.panneaux_casses) > 1
                ? `<strong>À noter :</strong> ${Number(d.panneaux_casses)} panneaux cassés ont été signalés ; le détail figure dans le compte rendu.`
                : '<strong>À noter :</strong> un panneau cassé a été signalé ; le détail figure dans le compte rendu.',
            )
          : '';
      return {
        sujet,
        html: gabarit(
          'Votre rapport d’intervention est disponible',
          bonjour +
            p(
              `Le compte rendu de l’intervention <strong>${echapper(prestation)}</strong> réalisée ${periode(d.debut_reel, d.fin_reelle)} sur le site <strong>${echapper(d.site_nom)}</strong> est disponible dans votre espace client.`,
            ) +
            anomalie,
          { texte: 'Voir le compte rendu', lien: `${base}/interventions/${d.intervention_id}` },
        ),
      };
    }
    case 'rappel_passage':
      return {
        sujet: `Rappel : passage prévu ${periode(d.debut_prevu, d.fin_prevue)} – ${d.site_nom}`,
        html: gabarit(
          'Rappel de notre prochain passage',
          bonjour +
            p(
              `Nous vous rappelons que notre équipe interviendra sur le site <strong>${echapper(d.site_nom)}</strong> ${periode(d.debut_prevu, d.fin_prevue)} pour : <strong>${echapper(prestation)}</strong>.`,
            ) +
            p('Merci de nous signaler toute contrainte d’accès au site.'),
          { texte: 'Voir le planning', lien: `${base}/planning` },
        ),
      };
    case 'reponse_demande':
      return {
        sujet: `Réponse à votre demande – ${DEMANDES[d.type_demande] ?? 'Demande'}`,
        html: gabarit(
          'Réponse à votre demande',
          bonjour +
            p(
              `ACG NET SPE a répondu à votre demande « ${echapper(DEMANDES[d.type_demande] ?? 'Demande')} »${d.site_nom ? ` concernant le site <strong>${echapper(d.site_nom)}</strong>` : ''}. Statut : <strong>${echapper(STATUTS_DEMANDE[d.statut] ?? d.statut)}</strong>.`,
            ) +
            citation(paragraphes(d.reponse)) +
            p(`<span style="color:#5B6B78;font-size:13px;">Votre message : ${paragraphes(d.message)}</span>`),
          { texte: 'Voir mes demandes', lien: `${base}/demandes` },
        ),
      };
    case 'nouvelle_demande':
      return {
        sujet: `Nouvelle demande – ${d.organisation_nom}`,
        html: gabarit(
          `${DEMANDES[d.type_demande] ?? 'Nouvelle demande'}`,
          bonjour +
            p(
              `<strong>${echapper(d.auteur_nom ?? 'Un contact')}</strong> (${echapper(d.organisation_nom)}) a envoyé une demande${d.site_nom ? ` concernant le site <strong>${echapper(d.site_nom)}</strong>` : ''}${d.date_souhaitee ? `, date souhaitée : <strong>${formaterDate(d.date_souhaitee)}</strong>` : ''}.`,
            ) +
            citation(paragraphes(d.message)),
          { texte: 'Traiter la demande', lien: `${base}/admin/demandes` },
        ),
      };
  }
}

// ---------------------------------------------------------------------------
// Envoi
// ---------------------------------------------------------------------------
function egalTempsConstant(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

const json = (statut: number, corps: Record<string, unknown>) =>
  new Response(JSON.stringify(corps), { status: statut, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

export async function traiter(requete: Request, env: Environnement, creerClient: FabriqueClient): Promise<Response> {
  if (requete.method !== 'POST') return json(405, { erreur: 'Méthode non autorisée.' });
  if (!egalTempsConstant(requete.headers.get('x-cle-envoi') ?? '', env.CLE_ENVOI ?? '')) {
    return json(401, { erreur: 'Clé d’envoi invalide.' });
  }
  if (!env.BREVO_API_KEY || !env.EMAIL_EXPEDITEUR || !env.SITE_URL) {
    return json(500, { erreur: 'Réglages manquants : BREVO_API_KEY, EMAIL_EXPEDITEUR et SITE_URL sont obligatoires.' });
  }

  const service = creerClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: lot, error } = await service.rpc('reserver_emails', { p_nombre: 50 });
  if (error) {
    console.error('réservation', error);
    return json(500, { erreur: 'Lecture de la boîte d’envoi impossible.' });
  }

  let envoyes = 0;
  let echecs = 0;
  for (const email of (lot ?? []) as EmailEnAttente[]) {
    const { sujet, html } = composer(email, env.SITE_URL);
    try {
      const reponse = await fetch(env.BREVO_API_URL ?? 'https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          sender: { name: 'ACG NET SPE', email: env.EMAIL_EXPEDITEUR },
          to: [{ email: email.destinataire, ...(email.nom_destinataire ? { name: email.nom_destinataire } : {}) }],
          subject: sujet,
          htmlContent: html,
        }),
      });
      if (!reponse.ok) throw new Error(`Brevo ${reponse.status} : ${(await reponse.text()).slice(0, 300)}`);
      await service.from('emails').update({ envoye_le: new Date().toISOString(), derniere_erreur: null }).eq('id', email.id);
      envoyes++;
    } catch (e) {
      // L'e-mail reste dans la boîte : nouvel essai au prochain passage (5 au maximum).
      await service
        .from('emails')
        .update({ reserve_le: null, derniere_erreur: String(e).slice(0, 500) })
        .eq('id', email.id);
      echecs++;
    }
  }
  return json(200, { envoyes, echecs });
}

// Démarrage dans Supabase (Deno). Ignoré quand le fichier est importé pour les tests.
const deno = (globalThis as any).Deno;

if (deno) {
  const { createClient } = await import('jsr:@supabase/supabase-js@2');
  const lire = (nom: string) => deno.env.get(nom) ?? '';
  const env: Environnement = {
    SUPABASE_URL: lire('SUPABASE_URL'),
    SUPABASE_SERVICE_ROLE_KEY: lire('SUPABASE_SERVICE_ROLE_KEY'),
    BREVO_API_KEY: lire('BREVO_API_KEY'),
    CLE_ENVOI: lire('CLE_ENVOI'),
    EMAIL_EXPEDITEUR: lire('EMAIL_EXPEDITEUR'),
    SITE_URL: lire('SITE_URL'),
  };
  deno.serve((requete: Request) => traiter(requete, env, createClient as FabriqueClient));
}
