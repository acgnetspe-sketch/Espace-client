-- =============================================================================
-- Imitation MINIMALE de Supabase, pour lancer les tests sur un PostgreSQL
-- ordinaire (sur un ordinateur ou dans GitHub Actions).
-- NE PAS appliquer sur le vrai projet Supabase : il possède déjà tout cela.
-- Reproduit : les rôles anon / authenticated / service_role, auth.users,
-- auth.identities, auth.uid(), storage.buckets et storage.objects.
-- =============================================================================

create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

grant usage on schema public to anon, authenticated, service_role;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  instance_id             uuid,
  id                      uuid primary key,
  aud                     varchar(255),
  role                    varchar(255),
  email                   varchar(255),
  encrypted_password      varchar(255),
  email_confirmed_at      timestamptz,
  raw_app_meta_data       jsonb,
  raw_user_meta_data      jsonb,
  created_at              timestamptz,
  updated_at              timestamptz,
  confirmation_token      varchar(255),
  recovery_token          varchar(255),
  email_change            varchar(255),
  email_change_token_new  varchar(255)
);

create table auth.identities (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  provider_id      text not null,
  provider         text not null,
  identity_data    jsonb not null,
  last_sign_in_at  timestamptz,
  created_at       timestamptz,
  updated_at       timestamptz,
  unique (provider_id, provider)
);

-- Identique à Supabase : l'identifiant de la personne vient du jeton de connexion.
create function auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid;
$$;

create schema storage;
grant usage on schema storage to anon, authenticated, service_role;

create table storage.buckets (
  id                  text primary key,
  name                text not null,
  public              boolean default false,
  file_size_limit     bigint,
  allowed_mime_types  text[],
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create table storage.objects (
  id          uuid primary key default gen_random_uuid(),
  bucket_id   text references storage.buckets (id),
  name        text,
  owner       uuid,
  metadata    jsonb,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique (bucket_id, name)
);

alter table storage.objects enable row level security;
alter table storage.buckets enable row level security;
grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;
grant select on storage.buckets to anon, authenticated, service_role;

-- Comme sur Supabase : les nouvelles tables de « public » sont ouvertes par
-- défaut à anon et authenticated (c'est la RLS qui protège).
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
