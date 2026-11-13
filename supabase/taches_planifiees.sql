-- =============================================================================
-- Espace client ACG NET SPE — Tâches planifiées des e-mails automatiques
-- -----------------------------------------------------------------------------
-- À coller UNE FOIS dans l'éditeur SQL de Supabase, APRÈS avoir déployé
-- l'Edge Function « envoyer-emails » (docs/GUIDE_ETAPE_4.md).
-- Peut être relancé sans risque (par exemple pour changer d'adresse de projet).
--
-- AVANT DE LANCER : remplacer ADRESSE_DU_PROJET ci-dessous par l'adresse du
-- projet (Project URL), par exemple https://abcdefghijkl.supabase.co
--
-- Ce script :
--   1. active les extensions de planification (pg_cron) et d'appel web (pg_net) ;
--   2. crée une clé d'envoi secrète et la range dans le coffre-fort de Supabase
--      (Vault) — elle n'apparaît donc jamais dans le dépôt GitHub ;
--   3. planifie la préparation des rappels J-7 chaque matin ;
--   4. planifie l'envoi des e-mails toutes les 5 minutes ;
--   5. AFFICHE la clé d'envoi : la copier dans les secrets de l'Edge Function
--      (nom CLE_ENVOI).
-- =============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Adresse de la fonction d'envoi et clé secrète, rangées dans le coffre-fort.
do $$
declare
  adresse text := 'ADRESSE_DU_PROJET';  -- <<< À REMPLACER
  url text;
begin
  if adresse = 'ADRESSE' || '_DU_PROJET' or adresse !~ '^https?://' then
    raise exception 'Remplacez ADRESSE_DU_PROJET par l''adresse du projet (Project URL), par exemple https://abcdefghijkl.supabase.co';
  end if;
  url := rtrim(adresse, '/') || '/functions/v1/envoyer-emails';

  if exists (select 1 from vault.secrets where name = 'url_envoi_emails') then
    perform vault.update_secret((select id from vault.secrets where name = 'url_envoi_emails'), url);
  else
    perform vault.create_secret(url, 'url_envoi_emails', 'Adresse de l''Edge Function envoyer-emails');
  end if;

  -- La clé n'est créée qu'une fois : relancer le script ne la change pas.
  if not exists (select 1 from vault.secrets where name = 'cle_envoi_emails') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'cle_envoi_emails',
                                'Clé partagée avec l''Edge Function envoyer-emails (secret CLE_ENVOI)');
  end if;
end;
$$;

-- Chaque matin vers 6 h 15 (heure de Paris en hiver ; 7 h 15 en été) : rappels J-7.
select cron.schedule('rappels-passages', '15 5 * * *', $$ select public.planifier_rappels(); $$);

-- Toutes les 5 minutes : envoi des e-mails en attente.
select cron.schedule(
  'envoi-emails',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'url_envoi_emails'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cle-envoi', (select decrypted_secret from vault.decrypted_secrets where name = 'cle_envoi_emails')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

-- Résultat affiché : la clé à copier dans le secret CLE_ENVOI de l'Edge Function.
select
  decrypted_secret as cle_a_copier_dans_CLE_ENVOI,
  (select string_agg(jobname || ' (' || schedule || ')', ', ') from cron.job
    where jobname in ('rappels-passages', 'envoi-emails')) as taches_planifiees
from vault.decrypted_secrets
where name = 'cle_envoi_emails';
