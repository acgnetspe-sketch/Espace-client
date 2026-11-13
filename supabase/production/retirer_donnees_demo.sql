-- =============================================================================
-- PROJET DE PRODUCTION — retirer les données de démonstration, avant le
-- premier vrai client
-- -----------------------------------------------------------------------------
-- 1. Supprime les organisations « Exploitant Démo A » et « Exploitant Démo B »,
--    leurs sites, interventions, fichiers (références), demandes, e-mails, et
--    les 4 comptes fictifs @example.com.
-- 2. Supprime tout mot de passe : en production, on se connecte UNIQUEMENT par
--    lien magique (un mot de passe oublié ou deviné ne peut donc pas servir).
--
-- Les fichiers eux-mêmes (PDF, photos) restent dans le stockage : les effacer
-- ensuite dans Supabase › Storage › documents, en supprimant les dossiers
-- a0000000-… et b0000000-… (voir docs/GUIDE_ETAPE_5.md).
-- Sans danger pour les vraies données : seuls les identifiants de démonstration
-- (fixes, connus) sont visés.
-- =============================================================================

do $$
declare
  orgs_demo uuid[] := array['a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001']::uuid[];
begin
  delete from public.emails
  where profil_id in (select id from public.profils where organisation_id = any (orgs_demo))
     or destinataire like '%@example.com';
  delete from public.demandes where organisation_id = any (orgs_demo);
  delete from public.interventions
  where site_id in (select id from public.sites where organisation_id = any (orgs_demo));  -- fichiers et notes suivent
  delete from public.fichiers where site_id in (select id from public.sites where organisation_id = any (orgs_demo));
  delete from auth.users
  where id in (select id from public.profils where organisation_id = any (orgs_demo))
     or id = 'ad000000-0000-4000-8000-000000000001'
     or email like '%@example.com';
  delete from public.sites where organisation_id = any (orgs_demo);
  delete from public.organisations where id = any (orgs_demo);

  -- Connexion par lien magique uniquement.
  update auth.users set encrypted_password = '' where coalesce(encrypted_password, '') <> '';
end;
$$;

select
  (select count(*) from public.organisations where nom like 'Exploitant Démo%') as organisations_demo_restantes,
  (select count(*) from auth.users where email like '%@example.com') as comptes_fictifs_restants,
  (select count(*) from auth.users where coalesce(encrypted_password, '') <> '') as comptes_avec_mot_de_passe;
