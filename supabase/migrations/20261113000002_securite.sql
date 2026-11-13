-- =============================================================================
-- Espace client ACG NET SPE — Migration 2/4 : sécurité (Row Level Security)
-- -----------------------------------------------------------------------------
-- Principe :
--   * Row Level Security activée sur TOUTES les tables, sans exception.
--   * Un administrateur ACG peut tout lire et tout modifier.
--   * Un client ne peut que LIRE les données de son organisation (et, en V2,
--     créer des demandes). Il ne peut ni créer, ni modifier, ni supprimer.
--   * Les visiteurs non connectés (rôle « anon ») n'ont accès à rien.
--   * Les interventions sont lues par les clients à travers la vue
--     « interventions_visibles », qui masque le compte rendu tant que
--     l'intervention n'est pas publiée. La table elle-même leur est fermée.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Fonctions de contrôle
-- « security definer » : elles lisent la table profils sans être bloquées par
-- ses propres règles (sinon les règles se citeraient en boucle).
-- « search_path = '' » : protège contre le détournement de noms d'objets.
-- ---------------------------------------------------------------------------

-- La personne connectée est-elle un administrateur ACG ?
create function public.est_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profils
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Organisation de la personne connectée (null pour un administrateur ou un inconnu).
create function public.mon_organisation()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select organisation_id from public.profils
  where id = auth.uid() and role = 'client';
$$;

-- Le client connecté peut-il voir ce site ?
-- Oui si le site est dans son organisation ET (aucune limitation d'accès
-- OU le site fait partie de ses sites autorisés).
create function public.peut_voir_site(p_site_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.sites s
    join public.profils p
      on p.organisation_id = s.organisation_id
     and p.id = auth.uid()
     and p.role = 'client'
    where s.id = p_site_id
      and (
        not exists (select 1 from public.acces_sites a where a.profil_id = p.id)
        or exists (select 1 from public.acces_sites a where a.profil_id = p.id and a.site_id = s.id)
      )
  );
$$;

-- Le client connecté peut-il voir le compte rendu de cette intervention ?
-- Oui si elle est publiée et que son site lui est visible.
create function public.peut_voir_intervention_publiee(p_intervention_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.interventions i
    where i.id = p_intervention_id
      and i.publiee
      and public.peut_voir_site(i.site_id)
  );
$$;

-- Droits d'exécution : uniquement les utilisateurs connectés.
revoke execute on function public.est_admin() from public, anon;
revoke execute on function public.mon_organisation() from public, anon;
revoke execute on function public.peut_voir_site(uuid) from public, anon;
revoke execute on function public.peut_voir_intervention_publiee(uuid) from public, anon;
grant execute on function public.est_admin() to authenticated;
grant execute on function public.mon_organisation() to authenticated;
grant execute on function public.peut_voir_site(uuid) to authenticated;
grant execute on function public.peut_voir_intervention_publiee(uuid) to authenticated;

-- Les fonctions des déclencheurs n'ont pas à être appelées directement.
revoke execute on function public.maj_modifie_le() from public, anon, authenticated;
revoke execute on function public.maj_publiee_le() from public, anon, authenticated;
revoke execute on function public.verifier_acces_site() from public, anon, authenticated;
revoke execute on function public.verifier_site_demande() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Droits de base sur les tables
-- Les visiteurs non connectés : rien. Les connectés : droits SQL ouverts,
-- mais chaque ligne est filtrée par les règles RLS ci-dessous (sans règle
-- correspondante, l'accès est refusé).
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;

grant select, insert, update, delete on
  public.organisations,
  public.organisations_internes,
  public.profils,
  public.acces_sites,
  public.sites,
  public.interventions,
  public.interventions_internes,
  public.fichiers,
  public.demandes
to authenticated;

-- ---------------------------------------------------------------------------
-- Activation de la Row Level Security sur toutes les tables
-- ---------------------------------------------------------------------------
alter table public.organisations          enable row level security;
alter table public.organisations_internes enable row level security;
alter table public.profils                enable row level security;
alter table public.acces_sites            enable row level security;
alter table public.sites                  enable row level security;
alter table public.interventions          enable row level security;
alter table public.interventions_internes enable row level security;
alter table public.fichiers               enable row level security;
alter table public.demandes               enable row level security;

-- ---------------------------------------------------------------------------
-- Règles. « (select fonction()) » permet à PostgreSQL de ne calculer la
-- fonction qu'une fois par requête (meilleures performances).
-- ---------------------------------------------------------------------------

-- organisations : le client lit la sienne ; l'administrateur gère tout.
create policy organisations_lecture on public.organisations
  for select to authenticated
  using ((select public.est_admin()) or id = (select public.mon_organisation()));

create policy organisations_admin on public.organisations
  for all to authenticated
  using ((select public.est_admin()))
  with check ((select public.est_admin()));

-- organisations_internes : administrateurs uniquement.
create policy organisations_internes_admin on public.organisations_internes
  for all to authenticated
  using ((select public.est_admin()))
  with check ((select public.est_admin()));

-- profils : chacun lit son profil et ceux de son organisation ;
-- seul un administrateur crée ou modifie un profil (donc aucun client ne
-- peut se donner le rôle « admin » ni changer d'organisation).
create policy profils_lecture on public.profils
  for select to authenticated
  using (
    (select public.est_admin())
    or id = (select auth.uid())
    or organisation_id = (select public.mon_organisation())
  );

create policy profils_admin on public.profils
  for all to authenticated
  using ((select public.est_admin()))
  with check ((select public.est_admin()));

-- acces_sites : chacun lit ses propres limitations ; l'administrateur gère.
create policy acces_sites_lecture on public.acces_sites
  for select to authenticated
  using ((select public.est_admin()) or profil_id = (select auth.uid()));

create policy acces_sites_admin on public.acces_sites
  for all to authenticated
  using ((select public.est_admin()))
  with check ((select public.est_admin()));

-- sites : le client lit les sites qu'il peut voir ; l'administrateur gère.
create policy sites_lecture on public.sites
  for select to authenticated
  using ((select public.est_admin()) or public.peut_voir_site(id));

create policy sites_admin on public.sites
  for all to authenticated
  using ((select public.est_admin()))
  with check ((select public.est_admin()));

-- interventions : table réservée aux administrateurs.
-- Les clients passent par la vue « interventions_visibles » (plus bas).
create policy interventions_admin on public.interventions
  for all to authenticated
  using ((select public.est_admin()))
  with check ((select public.est_admin()));

-- interventions_internes : administrateurs uniquement.
create policy interventions_internes_admin on public.interventions_internes
  for all to authenticated
  using ((select public.est_admin()))
  with check ((select public.est_admin()));

-- fichiers : le client voit les fichiers d'une intervention PUBLIÉE de ses
-- sites, et les documents rattachés directement à ses sites.
create policy fichiers_lecture on public.fichiers
  for select to authenticated
  using (
    (select public.est_admin())
    or (intervention_id is not null and public.peut_voir_intervention_publiee(intervention_id))
    or (site_id is not null and public.peut_voir_site(site_id))
  );

create policy fichiers_admin on public.fichiers
  for all to authenticated
  using ((select public.est_admin()))
  with check ((select public.est_admin()));

-- demandes (V2) : le client lit les demandes de son organisation et peut en
-- créer une, uniquement pour son organisation, pour un site visible, en son
-- nom, au statut « envoyée » et sans réponse. Il ne peut ni modifier ni supprimer.
create policy demandes_lecture on public.demandes
  for select to authenticated
  using ((select public.est_admin()) or organisation_id = (select public.mon_organisation()));

create policy demandes_creation_client on public.demandes
  for insert to authenticated
  with check (
    organisation_id = (select public.mon_organisation())
    and (site_id is null or public.peut_voir_site(site_id))
    and auteur_id = (select auth.uid())
    and statut = 'envoyee'
    and reponse is null
  );

create policy demandes_admin on public.demandes
  for all to authenticated
  using ((select public.est_admin()))
  with check ((select public.est_admin()));

-- ---------------------------------------------------------------------------
-- Vue « interventions_visibles »
-- -----------------------------------------------------------------------------
-- C'est la SEULE porte d'entrée des clients vers les interventions.
--   * Administrateur : toutes les interventions, tous les champs.
--   * Client : les interventions de ses sites visibles qui sont soit
--     planifiées (proposée/confirmée), soit publiées. Tant qu'elle n'est pas
--     publiée, le compte rendu est masqué (valeurs vides). Une intervention
--     réalisée ou annulée mais non publiée est invisible.
-- La vue s'exécute avec les droits de son propriétaire (elle lit la table
-- fermée aux clients) et applique elle-même le filtre ci-dessus.
-- « security_barrier » empêche de contourner le filtre par une astuce de requête.
-- ---------------------------------------------------------------------------
create view public.interventions_visibles
with (security_barrier = true)
as
select
  i.id,
  i.site_id,
  i.type,
  i.statut,
  i.debut_prevu,
  i.fin_prevue,
  case when i.publiee or a.admin then i.debut_reel end        as debut_reel,
  case when i.publiee or a.admin then i.fin_reelle end        as fin_reelle,
  case when i.publiee or a.admin then i.surface_m2 end        as surface_m2,
  case when i.publiee or a.admin then i.surface_ha end        as surface_ha,
  case when i.publiee or a.admin then i.encrassement end      as encrassement,
  case when i.publiee or a.admin then i.panneaux_casses end   as panneaux_casses,
  case when i.publiee or a.admin then i.anomalies end         as anomalies,
  case when i.publiee or a.admin then i.anomalie_traitee end  as anomalie_traitee,
  case when i.publiee or a.admin then i.bon_commande end      as bon_commande,
  i.publiee,
  i.publiee_le
from public.interventions i
cross join lateral (select public.est_admin() as admin) a
where a.admin
   or (
     (i.publiee or i.statut in ('proposee', 'confirmee'))
     and public.peut_voir_site(i.site_id)
   );

comment on view public.interventions_visibles is
  'Interventions telles qu''un utilisateur a le droit de les voir. Seul accès des clients aux interventions.';

revoke all on public.interventions_visibles from public, anon, authenticated;
grant select on public.interventions_visibles to authenticated;
