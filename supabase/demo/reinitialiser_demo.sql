-- =============================================================================
-- PROJET DE DÉMONSTRATION UNIQUEMENT — remettre la démonstration à neuf
-- -----------------------------------------------------------------------------
-- À lancer avant un salon ou un rendez-vous : efface tout ce qui a été créé ou
-- modifié pendant les démonstrations (clients, sites, interventions, demandes,
-- e-mails, contacts invités), puis il faut RELANCER supabase/seed.sql (et
-- supabase/demo/preparer_demo.sql pour les mots de passe).
-- Les dates de démonstration sont recalculées par rapport au jour même.
--
-- Sécurité : refuse de tourner si le projet contient un administrateur qui
-- n'est pas un compte @example.com ET une organisation non fictive, signe
-- qu'il s'agit du projet de production.
-- =============================================================================

do $$
begin
  if exists (
    select 1 from public.organisations o
    where o.id not in ('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001')
      and exists (select 1 from public.profils p where p.organisation_id = o.id and p.email not like '%@example.com')
  ) then
    raise exception 'Des contacts réels sont rattachés à une organisation : ce n''est pas le projet de démonstration. Rien n''a été effacé.';
  end if;

  delete from public.emails;
  delete from public.demandes;
  delete from public.fichiers;
  delete from public.interventions_internes;
  delete from public.interventions;
  delete from public.acces_sites;
  delete from public.sites;
  delete from public.organisations_internes;
  -- Comptes clients créés pendant les démonstrations (les comptes fictifs seront recréés par seed.sql).
  delete from auth.users where id in (select id from public.profils where role = 'client');
  delete from public.organisations;
end;
$$;

select 'Démonstration effacée : relancez maintenant supabase/seed.sql puis supabase/demo/preparer_demo.sql.' as etape_suivante;
