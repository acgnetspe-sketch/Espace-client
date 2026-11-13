-- =============================================================================
-- Espace client ACG NET SPE — Migration 4/4 : règles de fonctionnement
-- -----------------------------------------------------------------------------
-- Vues calculées utilisées par les tableaux de bord (cahier des charges §7).
-- Elles s'exécutent avec les droits de la personne qui les consulte
-- (« security_invoker ») et s'appuient sur « interventions_visibles » : elles
-- ne peuvent donc jamais montrer plus que ce que la personne a le droit de voir.
-- =============================================================================

-- Date du jour à l'heure de Paris (le serveur, lui, compte en heure universelle).
create function public.aujourdhui()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Europe/Paris')::date;
$$;

-- ---------------------------------------------------------------------------
-- Règle 1 — Prochain passage de chaque site
-- La première intervention proposée ou confirmée qui n'est pas terminée
-- (début aujourd'hui ou plus tard, ou période en cours). Si aucune ligne :
-- l'écran affiche « À planifier ».
-- ---------------------------------------------------------------------------
create view public.sites_prochain_passage
with (security_invoker = true)
as
select
  s.id               as site_id,
  s.organisation_id,
  p.id               as intervention_id,
  p.type,
  p.statut,
  p.debut_prevu,
  p.fin_prevue
from public.sites s
left join lateral (
  select i.id, i.type, i.statut, i.debut_prevu, i.fin_prevue
  from public.interventions_visibles i
  where i.site_id = s.id
    and i.statut in ('proposee', 'confirmee')
    and coalesce(i.fin_prevue, i.debut_prevu) >= public.aujourdhui()
  order by i.debut_prevu, i.fin_prevue nulls last
  limit 1
) p on true;

comment on view public.sites_prochain_passage is
  'Prochain passage par site (cahier des charges §7.1). intervention_id vide = « À planifier ».';

-- ---------------------------------------------------------------------------
-- Règles 2 et 3 — Alertes
--   * anomalie : intervention publiée avec des panneaux cassés, tant qu'un
--     administrateur ne l'a pas marquée « traitée » ;
--   * old : site soumis aux OLD dont la date limite est dans moins de 60 jours
--     (ou déjà dépassée), sans intervention OLD réalisée depuis la date limite
--     précédente (date limite moins un an).
-- ---------------------------------------------------------------------------
create view public.alertes
with (security_invoker = true)
as
select
  'anomalie'::text                          as type_alerte,
  s.organisation_id,
  s.id                                      as site_id,
  s.nom                                     as site_nom,
  i.id                                      as intervention_id,
  coalesce(i.fin_reelle, i.debut_reel)      as date_reference,
  null::integer                             as jours_restants,
  i.panneaux_casses,
  i.anomalies
from public.interventions_visibles i
join public.sites s on s.id = i.site_id
where i.publiee
  and i.panneaux_casses > 0
  and not i.anomalie_traitee

union all

select
  'old'::text,
  s.organisation_id,
  s.id,
  s.nom,
  null::uuid,
  s.date_limite_old,
  (s.date_limite_old - public.aujourdhui())::integer,
  null::integer,
  null::text
from public.sites s
where s.soumis_old
  and s.date_limite_old is not null
  and s.date_limite_old <= public.aujourdhui() + 60
  and not exists (
    select 1
    from public.interventions_visibles i
    where i.site_id = s.id
      and i.type = 'old'
      and i.statut = 'realisee'
      and coalesce(i.fin_reelle, i.debut_reel) > (s.date_limite_old - interval '1 year')::date
  );

comment on view public.alertes is
  'Alertes anomalies (panneaux cassés non traités) et échéances OLD à moins de 60 jours (cahier des charges §7.2 et §7.3).';

-- ---------------------------------------------------------------------------
-- Règle 4 — Chiffres de l'année civile en cours, par organisation
-- Somme des interventions réalisées ET publiées dont la date réelle
-- (fin, à défaut début) tombe dans l'année en cours.
-- ---------------------------------------------------------------------------
create view public.chiffres_annee
with (security_invoker = true)
as
select
  s.organisation_id,
  extract(year from public.aujourdhui())::integer  as annee,
  coalesce(sum(i.surface_m2), 0)                    as surface_nettoyee_m2,
  coalesce(sum(i.surface_ha), 0)                    as surface_debroussaillee_ha,
  count(*)::integer                                 as nombre_interventions
from public.interventions_visibles i
join public.sites s on s.id = i.site_id
where i.publiee
  and i.statut = 'realisee'
  and extract(year from coalesce(i.fin_reelle, i.debut_reel)) = extract(year from public.aujourdhui())
group by s.organisation_id;

comment on view public.chiffres_annee is
  'Surfaces et nombre d''interventions de l''année civile (cahier des charges §7.4). Aucune ligne = zéro.';

-- ---------------------------------------------------------------------------
-- Droits : connectés uniquement.
-- ---------------------------------------------------------------------------
revoke all on public.sites_prochain_passage, public.alertes, public.chiffres_annee
  from public, anon, authenticated;
grant select on public.sites_prochain_passage, public.alertes, public.chiffres_annee
  to authenticated;

revoke execute on function public.aujourdhui() from public, anon;
grant execute on function public.aujourdhui() to authenticated;
