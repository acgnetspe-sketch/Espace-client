-- =============================================================================
-- Espace client ACG NET SPE — Migration 3/4 : stockage privé des fichiers
-- -----------------------------------------------------------------------------
-- * Un seul espace de stockage, « documents », PRIVÉ (aucune adresse publique).
-- * Le téléchargement se fait par lien signé valable 1 heure, créé par
--   l'application. Supabase ne crée ce lien que si la personne a le droit de
--   lire le fichier selon les règles ci-dessous.
-- * Règle de lecture : un fichier du stockage n'est lisible que s'il est
--   référencé dans la table « fichiers » ET que cette ligne est visible par
--   la personne (règles de la migration 2). Un client qui devine le chemin
--   d'un fichier d'une autre organisation n'obtient donc rien.
-- * Seuls les administrateurs déposent, remplacent ou suppriment des fichiers.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  52428800, -- 50 Mo par fichier
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Lecture (et donc création de liens signés).
create policy "documents : lecture selon la table fichiers"
  on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (
      (select public.est_admin())
      -- La sous-requête est elle-même filtrée par la règle « fichiers_lecture ».
      or exists (select 1 from public.fichiers f where f.chemin = objects.name)
    )
  );

-- Dépôt, remplacement, suppression : administrateurs uniquement.
create policy "documents : dépôt par un administrateur"
  on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documents' and (select public.est_admin()));

create policy "documents : modification par un administrateur"
  on storage.objects
  for update to authenticated
  using (bucket_id = 'documents' and (select public.est_admin()))
  with check (bucket_id = 'documents' and (select public.est_admin()));

create policy "documents : suppression par un administrateur"
  on storage.objects
  for delete to authenticated
  using (bucket_id = 'documents' and (select public.est_admin()));
