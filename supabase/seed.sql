-- =============================================================================
-- Espace client ACG NET SPE — Données de DÉMONSTRATION (entièrement fictives)
-- -----------------------------------------------------------------------------
-- Cahier des charges §8. Aucune vraie donnée client ne doit figurer ici.
-- Les dates sont calculées par rapport au jour où le script est lancé, pour
-- que la démonstration reste « à jour » (passages à venir, alerte OLD, etc.).
-- Les comptes utilisent des adresses @example.com (domaine réservé aux
-- exemples : aucun e-mail ne peut y être envoyé). Ils servent aux tests.
-- Le script peut être relancé sans créer de doublons.
--
-- Identifiants faciles à reconnaître :
--   a… = Exploitant Démo A, b… = Exploitant Démo B, ad… = administrateur
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Comptes de connexion (auth.users)
-- ---------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, '',
  now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
  '', '', '', ''
from (values
  ('ad000000-0000-4000-8000-000000000001'::uuid, 'admin.demo@example.com'),
  ('a1000000-0000-4000-8000-000000000001'::uuid, 'client.demo.a@example.com'),
  ('a1000000-0000-4000-8000-000000000002'::uuid, 'client.demo.a.limite@example.com'),
  ('b1000000-0000-4000-8000-000000000001'::uuid, 'client.demo.b@example.com')
) as u (id, email)
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select
  gen_random_uuid(), u.id, u.id::text, 'email',
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  now(), now(), now()
from auth.users u
where u.id in (
  'ad000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000002',
  'b1000000-0000-4000-8000-000000000001'
)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Organisations
-- ---------------------------------------------------------------------------
insert into public.organisations (id, nom, adresse) values
  ('a0000000-0000-4000-8000-000000000001', 'Exploitant Démo A', '1 avenue de la Démonstration, 13000 Marseille'),
  ('b0000000-0000-4000-8000-000000000001', 'Exploitant Démo B', '2 rue de l''Exemple, 06000 Nice')
on conflict (id) do nothing;

insert into public.organisations_internes (organisation_id, notes) values
  ('a0000000-0000-4000-8000-000000000001', 'Note interne de démonstration : client pilote, contrat cadre annuel.')
on conflict (organisation_id) do nothing;

-- ---------------------------------------------------------------------------
-- Profils
-- ---------------------------------------------------------------------------
insert into public.profils (id, organisation_id, nom, fonction, telephone, email, role) values
  ('ad000000-0000-4000-8000-000000000001', null,
   'Administrateur Démo', 'Responsable planning ACG NET SPE', null, 'admin.demo@example.com', 'admin'),
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'Camille Démo', 'Responsable maintenance', '04 00 00 00 01', 'client.demo.a@example.com', 'client'),
  ('a1000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
   'Dominique Démo', 'Technicien de site (accès limité)', null, 'client.demo.a.limite@example.com', 'client'),
  ('b1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
   'Alex Démo', 'Asset manager', '04 00 00 00 02', 'client.demo.b@example.com', 'client')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Sites
-- ---------------------------------------------------------------------------
insert into public.sites (
  id, organisation_id, nom, code_interne, commune, departement, type_installation,
  surface_modules_m2, surface_vegetation_ha, soumis_old, date_limite_old, latitude, longitude
) values
  ('a2000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'Centrale Démo Les Garrigues', 'DEMO-A-SOL', 'Saint-Martin-de-Crau', '13', 'sol',
   52763, 12.5, true, public.aujourdhui() + 45, 43.640000, 4.810000),
  ('a2000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
   'Centrale Démo Le Mistral', 'DEMO-A-TRK', 'Bollène', '84', 'trackers',
   38420, 8.2, false, null, 44.280000, 4.750000),
  ('a2000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001',
   'Toiture Démo Entrepôt Logistique', 'DEMO-A-TOI', 'Nîmes', '30', 'toiture',
   9850, null, false, null, 43.830000, 4.360000),
  ('a2000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001',
   'Ombrière Démo Parking Sud', 'DEMO-A-OMB', 'Montpellier', '34', 'ombriere',
   4200, null, false, null, 43.580000, 3.880000),
  ('b2000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
   'Toiture Démo Atelier B', 'DEMO-B-TOI', 'Carros', '06', 'toiture',
   6100, null, false, null, 43.790000, 7.180000)
on conflict (id) do nothing;

-- Le contact « accès limité » de A ne voit que la Centrale Démo Le Mistral.
insert into public.acces_sites (profil_id, site_id) values
  ('a1000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000002')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Interventions de A : 10 passées publiées, 3 planifiées
-- (d = date de réalisation en jours avant aujourd'hui)
-- ---------------------------------------------------------------------------
insert into public.interventions (
  id, site_id, type, statut,
  debut_prevu, fin_prevue, debut_reel, fin_reelle,
  surface_m2, surface_ha, encrassement, panneaux_casses, anomalies, anomalie_traitee,
  bon_commande, publiee, publiee_le
)
select
  v.id::uuid, v.site_id::uuid, v.type::public.type_intervention, 'realisee',
  public.aujourdhui() - v.debut, public.aujourdhui() - v.fin,
  public.aujourdhui() - v.debut, public.aujourdhui() - v.fin,
  v.m2, v.ha, v.enc, v.casses, v.anomalies, v.traitee,
  v.bc, true, (public.aujourdhui() - v.fin + 3)::timestamptz
from (values
  -- id, site, type, début (j), fin (j), m², ha, encrassement, panneaux cassés, anomalies, traitée, bon de commande
  ('a3000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'nettoyage',                 21,  20, 52763::numeric, null::numeric, 6::smallint,    3, 'Trois modules fissurés, rangée 12, table 4 (côté est).', false, 'BC-DEMO-2026-031'),
  ('a3000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000002', 'nettoyage',                 36,  35, 38420,          null,          5::smallint,    0, null,                                                     false, 'BC-DEMO-2026-028'),
  ('a3000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000001', 'debroussaillage_interieur', 62,  60, null,           12.5,          null::smallint, 0, null,                                                     false, 'BC-DEMO-2026-022'),
  ('a3000000-0000-4000-8000-000000000004', 'a2000000-0000-4000-8000-000000000003', 'nettoyage',                 90,  90, 9850,           null,          7::smallint,    1, 'Un module cassé en bordure de toiture, rangée 3.',        true,  'BC-DEMO-2026-017'),
  ('a3000000-0000-4000-8000-000000000005', 'a2000000-0000-4000-8000-000000000004', 'nettoyage',                130, 130, 4200,           null,          4::smallint,    0, null,                                                     false, 'BC-DEMO-2026-012'),
  ('a3000000-0000-4000-8000-000000000006', 'a2000000-0000-4000-8000-000000000002', 'debroussaillage_interieur',162, 160, null,           8.2,           null::smallint, 0, null,                                                     false, 'BC-DEMO-2026-009'),
  ('a3000000-0000-4000-8000-000000000007', 'a2000000-0000-4000-8000-000000000001', 'elagage',                  200, 200, null,           1.2,           null::smallint, 0, null,                                                     false, 'BC-DEMO-2026-006'),
  ('a3000000-0000-4000-8000-000000000008', 'a2000000-0000-4000-8000-000000000001', 'nettoyage',                251, 250, 52763,          null,          5::smallint,    0, null,                                                     false, 'BC-DEMO-2026-004'),
  ('a3000000-0000-4000-8000-000000000009', 'a2000000-0000-4000-8000-000000000003', 'nettoyage',                330, 330, 9850,           null,          6::smallint,    0, null,                                                     false, 'BC-DEMO-2025-041'),
  ('a3000000-0000-4000-8000-000000000010', 'a2000000-0000-4000-8000-000000000001', 'old',                      404, 400, null,           4.0,           null::smallint, 0, null,                                                     false, 'BC-DEMO-2025-030')
) as v (id, site_id, type, debut, fin, m2, ha, enc, casses, anomalies, traitee, bc)
on conflict (id) do nothing;

insert into public.interventions (id, site_id, type, statut, debut_prevu, fin_prevue) values
  ('a3000000-0000-4000-8000-000000000011', 'a2000000-0000-4000-8000-000000000001', 'nettoyage', 'confirmee',
   public.aujourdhui() + 12, public.aujourdhui() + 12),
  ('a3000000-0000-4000-8000-000000000012', 'a2000000-0000-4000-8000-000000000001', 'old', 'proposee',
   public.aujourdhui() + 30, public.aujourdhui() + 34),
  ('a3000000-0000-4000-8000-000000000013', 'a2000000-0000-4000-8000-000000000002', 'nettoyage', 'proposee',
   public.aujourdhui() + 75, public.aujourdhui() + 77)
on conflict (id) do nothing;

insert into public.interventions_internes (intervention_id, notes_internes) values
  ('a3000000-0000-4000-8000-000000000001',
   'Note interne de démonstration : client prévenu par téléphone, devis de remplacement à envoyer.')
on conflict (intervention_id) do nothing;

-- ---------------------------------------------------------------------------
-- Interventions de B : 1 passée publiée, 1 planifiée
-- ---------------------------------------------------------------------------
insert into public.interventions (
  id, site_id, type, statut, debut_prevu, fin_prevue, debut_reel, fin_reelle,
  surface_m2, encrassement, bon_commande, publiee, publiee_le
) values
  ('b3000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'nettoyage', 'realisee',
   public.aujourdhui() - 50, public.aujourdhui() - 50, public.aujourdhui() - 50, public.aujourdhui() - 50,
   6100, 5, 'BC-DEMO-B-007', true, (public.aujourdhui() - 47)::timestamptz)
on conflict (id) do nothing;

insert into public.interventions (id, site_id, type, statut, debut_prevu, fin_prevue) values
  ('b3000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000001', 'nettoyage', 'confirmee',
   public.aujourdhui() + 20, public.aujourdhui() + 20)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Rapports PDF factices (lignes de la table « fichiers »)
-- Les PDF eux-mêmes sont dans supabase/demo/rapports/ : les téléverser dans
-- le stockage « documents » à EXACTEMENT ces chemins (voir docs/GUIDE_SUPABASE.md).
-- ---------------------------------------------------------------------------
insert into public.fichiers (id, intervention_id, type, chemin, nom, taille_octets) values
  ('a4000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 'rapport',
   'a0000000-0000-4000-8000-000000000001/a2000000-0000-4000-8000-000000000001/a3000000-0000-4000-8000-000000000001/rapport-demo-garrigues.pdf',
   'Rapport de nettoyage – Centrale Démo Les Garrigues.pdf', null),
  ('a4000000-0000-4000-8000-000000000002', 'a3000000-0000-4000-8000-000000000002', 'rapport',
   'a0000000-0000-4000-8000-000000000001/a2000000-0000-4000-8000-000000000002/a3000000-0000-4000-8000-000000000002/rapport-demo-mistral.pdf',
   'Rapport de nettoyage – Centrale Démo Le Mistral.pdf', null),
  ('b4000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000001', 'rapport',
   'b0000000-0000-4000-8000-000000000001/b2000000-0000-4000-8000-000000000001/b3000000-0000-4000-8000-000000000001/rapport-demo-atelier-b.pdf',
   'Rapport de nettoyage – Toiture Démo Atelier B.pdf', null)
on conflict (id) do nothing;
