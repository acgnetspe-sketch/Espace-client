-- =============================================================================
-- Espace client ACG NET SPE — Migration 6 : demandes (V2) et e-mails automatiques
-- -----------------------------------------------------------------------------
-- 1. Demandes : rattachement possible à un passage (« Demander un changement
--    de date ») et date souhaitée.
-- 2. Préférence e-mail par contact (recoit_emails).
-- 3. Boîte d'envoi « emails » : chaque événement y dépose un e-mail ; l'Edge
--    Function « envoyer-emails » les envoie. Les destinataires sont calculés
--    ICI, en base, avec les mêmes règles que l'écran : un contact ne reçoit
--    jamais d'e-mail sur un site qu'il ne peut pas voir.
--    Événements : rapport publié, réponse à une demande, nouvelle demande
--    (pour l'équipe ACG), rappel 7 jours avant un passage confirmé.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Demandes
-- ---------------------------------------------------------------------------
alter table public.demandes
  add column intervention_id uuid references public.interventions (id) on delete set null,
  add column date_souhaitee date;

create index demandes_intervention_idx on public.demandes (intervention_id);

-- Le site d'une demande liée à un passage est celui du passage ; il doit
-- appartenir à l'organisation de la demande.
-- « security definer » : un client ne peut pas lire la table interventions
-- (elle lui est fermée) ; la règle RLS ci-dessous vérifie, elle, que le
-- passage lui est bien visible.
create or replace function public.verifier_site_demande()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.intervention_id is not null then
    select i.site_id into new.site_id from public.interventions i where i.id = new.intervention_id;
  end if;
  if new.site_id is not null and not exists (
    select 1 from public.sites s
    where s.id = new.site_id and s.organisation_id = new.organisation_id
  ) then
    raise exception 'Le site % n''appartient pas à l''organisation de la demande.', new.site_id;
  end if;
  return new;
end;
$$;

revoke execute on function public.verifier_site_demande() from public, anon, authenticated;

drop policy demandes_creation_client on public.demandes;
create policy demandes_creation_client on public.demandes
  for insert to authenticated
  with check (
    organisation_id = (select public.mon_organisation())
    and (site_id is null or public.peut_voir_site(site_id))
    and (
      intervention_id is null
      or exists (select 1 from public.interventions_visibles v where v.id = intervention_id)
    )
    and auteur_id = (select auth.uid())
    and statut = 'envoyee'
    and reponse is null
  );

-- ---------------------------------------------------------------------------
-- 2. Préférence e-mail
-- ---------------------------------------------------------------------------
alter table public.profils
  add column recoit_emails boolean not null default true;

comment on column public.profils.recoit_emails is
  'Faux : le contact ne reçoit aucun e-mail automatique (rapport publié, rappel, réponse).';

-- ---------------------------------------------------------------------------
-- 3. Boîte d'envoi
-- ---------------------------------------------------------------------------
create table public.emails (
  id                uuid primary key default gen_random_uuid(),
  type              text not null check (type in ('rapport_publie', 'rappel_passage', 'reponse_demande', 'nouvelle_demande')),
  profil_id         uuid references public.profils (id) on delete set null,
  destinataire      text not null,
  nom_destinataire  text,
  donnees           jsonb not null default '{}'::jsonb,
  cle_unique        text not null unique,  -- évite d'envoyer deux fois le même e-mail
  cree_le           timestamptz not null default now(),
  reserve_le        timestamptz,           -- pris en charge par un envoi en cours
  envoye_le         timestamptz,
  tentatives        integer not null default 0,
  derniere_erreur   text
);

create index emails_a_envoyer_idx on public.emails (cree_le) where envoye_le is null;

comment on table public.emails is
  'Boîte d''envoi des e-mails automatiques. Lisible par les administrateurs uniquement.';

alter table public.emails enable row level security;
revoke all on public.emails from anon, authenticated;
grant select on public.emails to authenticated;

create policy emails_lecture_admin on public.emails
  for select to authenticated
  using ((select public.est_admin()));

-- Contacts d'un site qui acceptent les e-mails (mêmes règles que peut_voir_site).
create function public.destinataires_site(p_site_id uuid)
returns table (profil_id uuid, email text, nom text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.email, p.nom
  from public.sites s
  join public.profils p on p.organisation_id = s.organisation_id and p.role = 'client'
  where s.id = p_site_id
    and p.recoit_emails
    and (
      not exists (select 1 from public.acces_sites a where a.profil_id = p.id)
      or exists (select 1 from public.acces_sites a where a.profil_id = p.id and a.site_id = s.id)
    );
$$;

revoke execute on function public.destinataires_site(uuid) from public, anon, authenticated;

-- Informations communes sur une intervention pour les e-mails.
create function public.donnees_email_intervention(p_intervention_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'intervention_id', i.id,
    'site_id', s.id,
    'site_nom', s.nom,
    'organisation_nom', o.nom,
    'type', i.type,
    'statut', i.statut,
    'debut_prevu', i.debut_prevu,
    'fin_prevue', i.fin_prevue,
    'debut_reel', i.debut_reel,
    'fin_reelle', i.fin_reelle,
    'panneaux_casses', i.panneaux_casses
  )
  from public.interventions i
  join public.sites s on s.id = i.site_id
  join public.organisations o on o.id = s.organisation_id
  where i.id = p_intervention_id;
$$;

revoke execute on function public.donnees_email_intervention(uuid) from public, anon, authenticated;

-- Événement : rapport publié → contacts du site.
create function public.email_rapport_publie()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.publiee and not old.publiee then
    insert into public.emails (type, profil_id, destinataire, nom_destinataire, donnees, cle_unique)
    select 'rapport_publie', d.profil_id, d.email, d.nom,
           public.donnees_email_intervention(new.id),
           'rapport_publie:' || new.id || ':' || d.profil_id
    from public.destinataires_site(new.site_id) d
    on conflict (cle_unique) do nothing;  -- dépublier puis republier ne renvoie pas l'e-mail
  end if;
  return new;
end;
$$;

create trigger interventions_email_publication
  after update of publiee on public.interventions
  for each row execute function public.email_rapport_publie();

-- Événement : nouvelle demande → équipe ACG.
create function public.email_nouvelle_demande()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.emails (type, profil_id, destinataire, nom_destinataire, donnees, cle_unique)
  select 'nouvelle_demande', a.id, a.email, a.nom,
         jsonb_build_object(
           'demande_id', new.id,
           'type_demande', new.type,
           'message', left(new.message, 2000),
           'date_souhaitee', new.date_souhaitee,
           'organisation_nom', (select o.nom from public.organisations o where o.id = new.organisation_id),
           'site_nom', (select s.nom from public.sites s where s.id = new.site_id),
           'auteur_nom', (select p.nom from public.profils p where p.id = new.auteur_id)
         ),
         'nouvelle_demande:' || new.id || ':' || a.id
  from public.profils a
  where a.role = 'admin' and a.recoit_emails
  on conflict (cle_unique) do nothing;
  return new;
end;
$$;

create trigger demandes_email_nouvelle
  after insert on public.demandes
  for each row execute function public.email_nouvelle_demande();

-- Événement : réponse (nouvelle ou modifiée) à une demande → son auteur.
create function public.email_reponse_demande()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.reponse is not null and new.reponse is distinct from old.reponse then
    insert into public.emails (type, profil_id, destinataire, nom_destinataire, donnees, cle_unique)
    select 'reponse_demande', p.id, p.email, p.nom,
           jsonb_build_object(
             'demande_id', new.id,
             'type_demande', new.type,
             'statut', new.statut,
             'message', left(new.message, 2000),
             'reponse', left(new.reponse, 4000),
             'site_nom', (select s.nom from public.sites s where s.id = new.site_id)
           ),
           'reponse_demande:' || new.id || ':' || md5(new.reponse)
    from public.profils p
    where p.id = new.auteur_id and p.recoit_emails
    on conflict (cle_unique) do nothing;
  end if;
  return new;
end;
$$;

create trigger demandes_email_reponse
  after update of reponse on public.demandes
  for each row execute function public.email_reponse_demande();

-- Événement : rappel 7 jours avant un passage CONFIRMÉ.
-- Appelée chaque matin par une tâche planifiée (voir supabase/taches_planifiees.sql).
-- Rattrape aussi un rappel manqué (passage dans 1 à 7 jours, jamais rappelé).
create function public.planifier_rappels()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  nombre integer;
begin
  insert into public.emails (type, profil_id, destinataire, nom_destinataire, donnees, cle_unique)
  select 'rappel_passage', d.profil_id, d.email, d.nom,
         public.donnees_email_intervention(i.id),
         'rappel_passage:' || i.id || ':' || i.debut_prevu || ':' || d.profil_id
  from public.interventions i
  cross join lateral public.destinataires_site(i.site_id) d
  where i.statut = 'confirmee'
    and i.debut_prevu between public.aujourdhui() + 1 and public.aujourdhui() + 7
  on conflict (cle_unique) do nothing;
  get diagnostics nombre = row_count;
  return nombre;
end;
$$;

-- Réservation d'un lot d'e-mails à envoyer (appelée par l'Edge Function, avec
-- la clé de service). « skip locked » : deux envois simultanés ne prennent
-- jamais le même e-mail. Un e-mail réservé depuis plus de 10 minutes sans
-- être envoyé (envoi interrompu) redevient disponible.
create function public.reserver_emails(p_nombre integer default 50)
returns setof public.emails
language sql
security definer
set search_path = ''
as $$
  update public.emails e
  set reserve_le = now(), tentatives = e.tentatives + 1
  where e.id in (
    select id from public.emails
    where envoye_le is null
      and tentatives < 5
      and (reserve_le is null or reserve_le < now() - interval '10 minutes')
    order by cree_le
    limit p_nombre
    for update skip locked
  )
  returning e.*;
$$;

revoke execute on function public.email_rapport_publie() from public, anon, authenticated;
revoke execute on function public.email_nouvelle_demande() from public, anon, authenticated;
revoke execute on function public.email_reponse_demande() from public, anon, authenticated;
revoke execute on function public.planifier_rappels() from public, anon, authenticated;
revoke execute on function public.reserver_emails(integer) from public, anon, authenticated;
grant execute on function public.reserver_emails(integer) to service_role;
grant select, update on public.emails to service_role;
