// =============================================================================
// Edge Function « admin-contacts » — Espace client ACG NET SPE
// -----------------------------------------------------------------------------
// Invite, réinvite ou supprime un contact. Ces opérations créent ou suppriment
// des comptes de connexion : elles exigent la clé secrète de Supabase, qui ne
// doit jamais se trouver dans le navigateur. Elle reste ici, côté serveur
// (Supabase la fournit automatiquement à la fonction).
//
// Sécurité : chaque appel vérifie que la personne connectée est un
// administrateur ACG (fonction SQL est_admin()). Sinon : refus.
//
// Actions (corps JSON de la requête POST) :
//   { action: "inviter", email, nom, fonction?, telephone?, role: "client"|"admin",
//     organisation_id? (obligatoire pour un client), sites?: [id…], redirect_to }
//   { action: "renvoyer", profil_id, redirect_to }
//   { action: "supprimer", profil_id }
//
// Déploiement : voir docs/GUIDE_ETAPE_3.md (copier-coller dans le tableau de
// bord Supabase, menu Edge Functions). Un seul fichier, aucune dépendance locale.
// =============================================================================

// deno-lint-ignore-file no-explicit-any
type ClientSupabase = any;
type FabriqueClient = (url: string, cle: string, options?: Record<string, unknown>) => ClientSupabase;

export interface Environnement {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

const ENTETES_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function reponse(statut: number, corps: Record<string, unknown>): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { ...ENTETES_CORS, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

const refus = (statut: number, message: string) => reponse(statut, { erreur: message });

const EMAIL_VALIDE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_VALIDE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function texte(valeur: unknown, longueurMax = 200): string | null {
  if (typeof valeur !== 'string') return null;
  const t = valeur.trim();
  return t.length === 0 ? null : t.slice(0, longueurMax);
}

/** Traite une requête. Exporté pour pouvoir être testé hors de Supabase. */
export async function traiter(requete: Request, env: Environnement, creerClient: FabriqueClient): Promise<Response> {
  if (requete.method === 'OPTIONS') return new Response('ok', { headers: ENTETES_CORS });
  if (requete.method !== 'POST') return refus(405, 'Méthode non autorisée.');

  // 1. Qui appelle ? Il faut un administrateur ACG connecté.
  const autorisation = requete.headers.get('Authorization') ?? '';
  if (!autorisation.startsWith('Bearer ')) return refus(401, 'Connexion requise.');
  const appelant = creerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: autorisation } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: utilisateur, error: erreurUtilisateur } = await appelant.auth.getUser(autorisation.slice(7));
  if (erreurUtilisateur || !utilisateur?.user) return refus(401, 'Session expirée : reconnectez-vous.');
  const { data: admin, error: erreurAdmin } = await appelant.rpc('est_admin');
  if (erreurAdmin || admin !== true) return refus(403, 'Action réservée aux administrateurs ACG NET SPE.');
  const idAppelant: string = utilisateur.user.id;

  // 2. Client « administrateur » (clé secrète), utilisé seulement après la vérification.
  const service = creerClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let corps: Record<string, unknown>;
  try {
    corps = await requete.json();
  } catch {
    return refus(400, 'Requête illisible.');
  }

  switch (corps.action) {
    case 'inviter':
      return inviter(service, corps);
    case 'renvoyer':
      return renvoyer(service, corps);
    case 'supprimer':
      return supprimer(service, corps, idAppelant);
    default:
      return refus(400, 'Action inconnue.');
  }
}

async function inviter(service: ClientSupabase, corps: Record<string, unknown>): Promise<Response> {
  const email = texte(corps.email, 254)?.toLowerCase() ?? '';
  const nom = texte(corps.nom);
  const role = corps.role === 'admin' ? 'admin' : 'client';
  const organisationId = role === 'client' ? texte(corps.organisation_id, 36) : null;
  const sites = Array.isArray(corps.sites) ? corps.sites.filter((s): s is string => typeof s === 'string') : [];
  const redirection = texte(corps.redirect_to, 500) ?? undefined;

  if (!EMAIL_VALIDE.test(email)) return refus(400, 'Adresse e-mail invalide.');
  if (!nom) return refus(400, 'Le nom est obligatoire.');
  if (role === 'client' && (!organisationId || !UUID_VALIDE.test(organisationId))) {
    return refus(400, 'Choisissez l’organisation du contact.');
  }
  if (sites.some((s) => !UUID_VALIDE.test(s))) return refus(400, 'Liste de sites invalide.');

  // Les sites autorisés doivent appartenir à l'organisation.
  if (sites.length > 0) {
    const { data: trouves, error } = await service
      .from('sites')
      .select('id')
      .eq('organisation_id', organisationId)
      .in('id', sites);
    if (error || (trouves ?? []).length !== sites.length) {
      return refus(400, 'Certains sites choisis n’appartiennent pas à cette organisation.');
    }
  }

  const { data: existant } = await service.from('profils').select('id').eq('email', email).maybeSingle();
  if (existant) return refus(409, 'Un contact existe déjà avec cette adresse e-mail.');

  // Création du compte + e-mail d'invitation.
  const { data: invitation, error: erreurInvitation } = await service.auth.admin.inviteUserByEmail(email, {
    redirectTo: redirection,
    data: { nom },
  });
  if (erreurInvitation || !invitation?.user) {
    const code = erreurInvitation?.code ?? '';
    if (code === 'email_exists' || /already been registered/i.test(erreurInvitation?.message ?? '')) {
      return refus(409, 'Un compte de connexion existe déjà avec cette adresse, sans fiche contact. Contactez le support technique.');
    }
    if (erreurInvitation?.status === 429 || code.includes('rate_limit')) {
      return refus(429, 'Trop d’e-mails envoyés récemment. Réessayez dans quelques minutes.');
    }
    console.error('invitation', erreurInvitation);
    return refus(502, 'L’invitation n’a pas pu être envoyée. Vérifiez la configuration des e-mails dans Supabase.');
  }
  const idUtilisateur: string = invitation.user.id;

  const { error: erreurProfil } = await service.from('profils').insert({
    id: idUtilisateur,
    organisation_id: organisationId,
    nom,
    fonction: texte(corps.fonction),
    telephone: texte(corps.telephone, 40),
    email,
    role,
  });
  if (erreurProfil) {
    console.error('profil', erreurProfil);
    await service.auth.admin.deleteUser(idUtilisateur); // on ne laisse pas de compte orphelin
    return refus(500, 'La fiche du contact n’a pas pu être créée. Aucune invitation n’a été conservée.');
  }

  if (sites.length > 0) {
    const { error } = await service
      .from('acces_sites')
      .insert(sites.map((site_id) => ({ profil_id: idUtilisateur, site_id })));
    if (error) {
      console.error('acces', error);
      await service.auth.admin.deleteUser(idUtilisateur);
      return refus(500, 'Les accès aux sites n’ont pas pu être enregistrés. Aucune invitation n’a été conservée.');
    }
  }

  return reponse(200, { profil_id: idUtilisateur, message: `Invitation envoyée à ${email}.` });
}

async function renvoyer(service: ClientSupabase, corps: Record<string, unknown>): Promise<Response> {
  const profilId = texte(corps.profil_id, 36);
  if (!profilId || !UUID_VALIDE.test(profilId)) return refus(400, 'Contact inconnu.');
  const { data: profil } = await service.from('profils').select('email').eq('id', profilId).maybeSingle();
  if (!profil) return refus(404, 'Contact introuvable.');

  const { data: compte } = await service.auth.admin.getUserById(profilId);
  if (compte?.user?.email_confirmed_at) {
    return refus(409, 'Ce contact a déjà activé son compte : il se connecte directement avec son adresse e-mail.');
  }
  const { error } = await service.auth.admin.inviteUserByEmail(profil.email, {
    redirectTo: texte(corps.redirect_to, 500) ?? undefined,
  });
  if (error) {
    if (error.status === 429 || (error.code ?? '').includes('rate_limit')) {
      return refus(429, 'Trop d’e-mails envoyés récemment. Réessayez dans quelques minutes.');
    }
    console.error('renvoi', error);
    return refus(502, 'L’invitation n’a pas pu être renvoyée.');
  }
  return reponse(200, { message: `Invitation renvoyée à ${profil.email}.` });
}

async function supprimer(service: ClientSupabase, corps: Record<string, unknown>, idAppelant: string): Promise<Response> {
  const profilId = texte(corps.profil_id, 36);
  if (!profilId || !UUID_VALIDE.test(profilId)) return refus(400, 'Contact inconnu.');
  if (profilId === idAppelant) return refus(400, 'Vous ne pouvez pas supprimer votre propre compte.');
  // Supprimer le compte de connexion supprime aussi la fiche contact et ses accès (cascade).
  const { error } = await service.auth.admin.deleteUser(profilId);
  if (error) {
    console.error('suppression', error);
    return refus(502, 'Le compte n’a pas pu être supprimé.');
  }
  return reponse(200, { message: 'Contact et compte de connexion supprimés.' });
}

// -----------------------------------------------------------------------------
// Démarrage dans Supabase (Deno). Ignoré quand le fichier est importé pour les tests.
// -----------------------------------------------------------------------------
const deno = (globalThis as any).Deno;

if (deno) {
  const { createClient } = await import('jsr:@supabase/supabase-js@2');
  const env: Environnement = {
    SUPABASE_URL: deno.env.get('SUPABASE_URL') ?? '',
    SUPABASE_ANON_KEY: deno.env.get('SUPABASE_ANON_KEY') ?? '',
    SUPABASE_SERVICE_ROLE_KEY: deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  };
  deno.serve((requete: Request) => traiter(requete, env, createClient as FabriqueClient));
}
