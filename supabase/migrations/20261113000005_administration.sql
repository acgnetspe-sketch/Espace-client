-- =============================================================================
-- Espace client ACG NET SPE — Migration 5 : outils d'administration
-- -----------------------------------------------------------------------------
-- * etat_comptes() : état de connexion des contacts (invitation envoyée,
--   compte activé, dernière connexion). Ces informations sont dans la partie
--   « auth » de Supabase, inaccessible depuis le navigateur : cette fonction
--   les expose AUX SEULS ADMINISTRATEURS.
-- * Adresses e-mail des profils en minuscules (évite les doublons « Jean@ »
--   et « jean@ »).
-- =============================================================================

create function public.etat_comptes()
returns table (
  profil_id           uuid,
  invite_le           timestamptz,
  active_le           timestamptz,
  derniere_connexion  timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.invited_at, u.email_confirmed_at, u.last_sign_in_at
  from auth.users u
  join public.profils p on p.id = u.id
  where public.est_admin();  -- un client obtient une liste vide
$$;

revoke execute on function public.etat_comptes() from public, anon;
grant execute on function public.etat_comptes() to authenticated;

comment on function public.etat_comptes() is
  'État des comptes (invitation, activation, dernière connexion). Résultat vide pour un non-administrateur.';

-- Adresses e-mail toujours en minuscules.
create function public.normaliser_email_profil()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.email := lower(trim(new.email));
  return new;
end;
$$;

revoke execute on function public.normaliser_email_profil() from public, anon, authenticated;

create trigger profils_normaliser_email
  before insert or update of email on public.profils
  for each row execute function public.normaliser_email_profil();

create unique index profils_email_unique on public.profils (email);
