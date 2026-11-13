-- =============================================================================
-- Espace client ACG NET SPE — Migration 1/4 : schéma (types, tables, index)
-- -----------------------------------------------------------------------------
-- Les noms de tables et de colonnes sont sans accents (contrainte technique) ;
-- les libellés affichés à l'écran, eux, auront leurs accents.
-- À appliquer dans l'ordre : 1 schéma, 2 sécurité, 3 stockage, 4 règles métier.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Listes de valeurs autorisées
-- ---------------------------------------------------------------------------
create type public.role_utilisateur as enum ('admin', 'client');

create type public.type_installation as enum ('sol', 'trackers', 'toiture', 'ombriere');

create type public.type_intervention as enum (
  'nettoyage',
  'debroussaillage_interieur',
  'old',
  'elagage',
  'autre'
);

create type public.statut_intervention as enum ('proposee', 'confirmee', 'realisee', 'annulee');

create type public.type_fichier as enum ('rapport', 'photo_avant', 'photo_apres', 'document');

create type public.type_demande as enum (
  'nouvelle_intervention',
  'devis',
  'probleme',
  'changement_date'
);

create type public.statut_demande as enum ('envoyee', 'prise_en_compte', 'traitee');

-- ---------------------------------------------------------------------------
-- Mise à jour automatique de la colonne « modifie_le »
-- ---------------------------------------------------------------------------
create function public.maj_modifie_le()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.modifie_le := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Organisations clientes
-- ---------------------------------------------------------------------------
create table public.organisations (
  id          uuid primary key default gen_random_uuid(),
  nom         text not null check (length(trim(nom)) > 0),
  adresse     text,
  cree_le     timestamptz not null default now(),
  modifie_le  timestamptz not null default now()
);

comment on table public.organisations is 'Organisations clientes (exploitants, asset managers).';

-- Notes sur une organisation : réservées à ACG, donc dans une table séparée
-- (une règle de sécurité porte sur des lignes, pas sur des colonnes).
create table public.organisations_internes (
  organisation_id  uuid primary key references public.organisations (id) on delete cascade,
  notes            text,
  modifie_le       timestamptz not null default now()
);

comment on table public.organisations_internes is 'Notes internes ACG sur une organisation. Administrateurs uniquement.';

-- ---------------------------------------------------------------------------
-- Profils : un par compte de connexion (auth.users)
-- ---------------------------------------------------------------------------
create table public.profils (
  id               uuid primary key references auth.users (id) on delete cascade,
  organisation_id  uuid references public.organisations (id) on delete restrict,
  nom              text not null check (length(trim(nom)) > 0),
  fonction         text,
  telephone        text,
  email            text not null,
  role             public.role_utilisateur not null default 'client',
  cree_le          timestamptz not null default now(),
  modifie_le       timestamptz not null default now(),
  -- Un client appartient toujours à une organisation ; un administrateur ACG à aucune.
  constraint profils_role_organisation check (
    (role = 'client' and organisation_id is not null)
    or (role = 'admin' and organisation_id is null)
  )
);

create index profils_organisation_idx on public.profils (organisation_id);

comment on table public.profils is 'Contacts clients et administrateurs ACG. Données personnelles limitées (RGPD).';

-- ---------------------------------------------------------------------------
-- Sites (centrales photovoltaïques)
-- ---------------------------------------------------------------------------
create table public.sites (
  id                     uuid primary key default gen_random_uuid(),
  organisation_id        uuid not null references public.organisations (id) on delete restrict,
  nom                    text not null check (length(trim(nom)) > 0),
  code_interne           text,
  commune                text,
  departement            text check (departement ~ '^(0[1-9]|[1-8][0-9]|9[0-5]|2A|2B|97[1-6])$'),
  type_installation      public.type_installation not null,
  surface_modules_m2     numeric(12, 2) check (surface_modules_m2 >= 0),
  surface_vegetation_ha  numeric(10, 2) check (surface_vegetation_ha >= 0),
  soumis_old             boolean not null default false,
  date_limite_old        date,
  latitude               numeric(9, 6) check (latitude between -90 and 90),
  longitude              numeric(9, 6) check (longitude between -180 and 180),
  cree_le                timestamptz not null default now(),
  modifie_le             timestamptz not null default now()
);

create index sites_organisation_idx on public.sites (organisation_id);

comment on table public.sites is 'Centrales photovoltaïques des clients.';
comment on column public.sites.soumis_old is 'Site soumis aux obligations légales de débroussaillement (OLD).';

-- ---------------------------------------------------------------------------
-- Accès limités : si un contact a au moins une ligne ici, il ne voit QUE ces
-- sites ; sans aucune ligne, il voit tous les sites de son organisation.
-- ---------------------------------------------------------------------------
create table public.acces_sites (
  profil_id  uuid not null references public.profils (id) on delete cascade,
  site_id    uuid not null references public.sites (id) on delete cascade,
  primary key (profil_id, site_id)
);

create index acces_sites_site_idx on public.acces_sites (site_id);

-- Garde-fou : on ne peut pas donner accès à un site d'une autre organisation.
create function public.verifier_acces_site()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.profils p
    join public.sites s on s.organisation_id = p.organisation_id
    where p.id = new.profil_id
      and s.id = new.site_id
  ) then
    raise exception 'Le site % n''appartient pas à l''organisation du contact %.', new.site_id, new.profil_id;
  end if;
  return new;
end;
$$;

create trigger acces_sites_verifier
  before insert or update on public.acces_sites
  for each row execute function public.verifier_acces_site();

-- ---------------------------------------------------------------------------
-- Interventions (passages planifiés et comptes rendus)
-- Date précise : debut = fin. Période : debut < fin.
-- ---------------------------------------------------------------------------
create table public.interventions (
  id                uuid primary key default gen_random_uuid(),
  site_id           uuid not null references public.sites (id) on delete restrict,
  type              public.type_intervention not null,
  statut            public.statut_intervention not null default 'proposee',
  debut_prevu       date,
  fin_prevue        date,
  debut_reel        date,
  fin_reelle        date,
  surface_m2        numeric(12, 2) check (surface_m2 >= 0),
  surface_ha        numeric(10, 2) check (surface_ha >= 0),
  encrassement      smallint check (encrassement between 1 and 10),
  panneaux_casses   integer not null default 0 check (panneaux_casses >= 0),
  anomalies         text,
  anomalie_traitee  boolean not null default false,
  bon_commande      text,
  publiee           boolean not null default false,
  publiee_le        timestamptz,
  cree_le           timestamptz not null default now(),
  modifie_le        timestamptz not null default now(),
  constraint interventions_periode_prevue check (fin_prevue is null or debut_prevu is null or fin_prevue >= debut_prevu),
  constraint interventions_periode_reelle check (fin_reelle is null or debut_reel is null or fin_reelle >= debut_reel),
  -- On ne publie qu'un compte rendu d'intervention réalisée.
  constraint interventions_publiee_si_realisee check (not publiee or statut = 'realisee')
);

create index interventions_site_idx on public.interventions (site_id);
create index interventions_debut_prevu_idx on public.interventions (debut_prevu);

comment on table public.interventions is 'Interventions : visibles du client planifiées (proposée/confirmée) ou après publication.';

-- Date de publication renseignée automatiquement.
create function public.maj_publiee_le()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.publiee and (tg_op = 'INSERT' or not old.publiee) then
    new.publiee_le := coalesce(new.publiee_le, now());
  elsif not new.publiee then
    new.publiee_le := null;
  end if;
  return new;
end;
$$;

create trigger interventions_publiee_le
  before insert or update of publiee on public.interventions
  for each row execute function public.maj_publiee_le();

-- Notes internes : table séparée, réservée aux administrateurs.
create table public.interventions_internes (
  intervention_id  uuid primary key references public.interventions (id) on delete cascade,
  notes_internes   text,
  modifie_le       timestamptz not null default now()
);

comment on table public.interventions_internes is 'Notes internes ACG sur une intervention. Jamais lisibles par un client.';

-- ---------------------------------------------------------------------------
-- Fichiers (rapports, photos, documents) rangés dans le stockage privé
-- Chemin : <organisation_id>/<site_id>/<intervention_id ou "documents">/<fichier>
-- ---------------------------------------------------------------------------
create table public.fichiers (
  id               uuid primary key default gen_random_uuid(),
  intervention_id  uuid references public.interventions (id) on delete cascade,
  site_id          uuid references public.sites (id) on delete cascade,
  type             public.type_fichier not null,
  chemin           text not null unique,
  nom              text not null,
  taille_octets    bigint check (taille_octets >= 0),
  ajoute_le        timestamptz not null default now(),
  -- Rattaché soit à une intervention, soit à un site, jamais aux deux.
  constraint fichiers_un_seul_rattachement check (num_nonnulls(intervention_id, site_id) = 1)
);

create index fichiers_intervention_idx on public.fichiers (intervention_id);
create index fichiers_site_idx on public.fichiers (site_id);

-- ---------------------------------------------------------------------------
-- Demandes des clients (écrans en V2, table créée dès maintenant)
-- ---------------------------------------------------------------------------
create table public.demandes (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references public.organisations (id) on delete cascade,
  site_id          uuid references public.sites (id) on delete set null,
  auteur_id        uuid references public.profils (id) on delete set null default auth.uid(),
  type             public.type_demande not null,
  message          text not null check (length(trim(message)) > 0),
  statut           public.statut_demande not null default 'envoyee',
  reponse          text,
  creee_le         timestamptz not null default now(),
  modifie_le       timestamptz not null default now()
);

create index demandes_organisation_idx on public.demandes (organisation_id);

-- Garde-fou : le site d'une demande appartient à l'organisation de la demande.
create function public.verifier_site_demande()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.site_id is not null and not exists (
    select 1 from public.sites s
    where s.id = new.site_id and s.organisation_id = new.organisation_id
  ) then
    raise exception 'Le site % n''appartient pas à l''organisation de la demande.', new.site_id;
  end if;
  return new;
end;
$$;

create trigger demandes_verifier_site
  before insert or update on public.demandes
  for each row execute function public.verifier_site_demande();

-- ---------------------------------------------------------------------------
-- Colonnes « modifie_le »
-- ---------------------------------------------------------------------------
create trigger organisations_modifie_le before update on public.organisations
  for each row execute function public.maj_modifie_le();
create trigger organisations_internes_modifie_le before update on public.organisations_internes
  for each row execute function public.maj_modifie_le();
create trigger profils_modifie_le before update on public.profils
  for each row execute function public.maj_modifie_le();
create trigger sites_modifie_le before update on public.sites
  for each row execute function public.maj_modifie_le();
create trigger interventions_modifie_le before update on public.interventions
  for each row execute function public.maj_modifie_le();
create trigger interventions_internes_modifie_le before update on public.interventions_internes
  for each row execute function public.maj_modifie_le();
create trigger demandes_modifie_le before update on public.demandes
  for each row execute function public.maj_modifie_le();
