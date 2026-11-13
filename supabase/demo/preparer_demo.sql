-- =============================================================================
-- PROJET DE DÉMONSTRATION UNIQUEMENT — définir les mots de passe de démonstration
-- -----------------------------------------------------------------------------
-- Sur le site de démonstration, on se connecte aux comptes fictifs avec un mot
-- de passe (pas besoin de recevoir un e-mail sur un salon).
--
-- AVANT DE LANCER : remplacer les deux mots de passe ci-dessous (au moins
-- 12 caractères). Ils ne sont enregistrés nulle part ailleurs que dans Supabase,
-- sous forme chiffrée. Ne pas les écrire dans GitHub.
--
-- Sécurité : le script refuse de tourner s'il trouve des organisations autres
-- que les deux organisations de démonstration (protection contre une erreur
-- de projet).
-- =============================================================================

do $$
declare
  mdp_clients text := 'MOT_DE_PASSE_CLIENTS';       -- <<< À REMPLACER (comptes clients A et B)
  mdp_admin   text := 'MOT_DE_PASSE_ADMINISTRATION'; -- <<< À REMPLACER (compte ACG de démonstration)
begin
  if exists (
    select 1 from public.organisations
    where id not in ('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001')
  ) then
    raise exception 'Ce projet contient d''autres organisations que les démos : ce n''est pas le projet de démonstration. Rien n''a été modifié.';
  end if;
  if mdp_clients like 'MOT_DE_PASSE%' or mdp_admin like 'MOT_DE_PASSE%' or length(mdp_clients) < 12 or length(mdp_admin) < 12 then
    raise exception 'Remplacez les deux mots de passe (12 caractères au moins).';
  end if;

  update auth.users set encrypted_password = extensions.crypt(mdp_clients, extensions.gen_salt('bf'))
  where id in ('a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001');

  update auth.users set encrypted_password = extensions.crypt(mdp_admin, extensions.gen_salt('bf'))
  where id = 'ad000000-0000-4000-8000-000000000001';
end;
$$;

select email, encrypted_password <> '' as mot_de_passe_defini
from auth.users
where email like '%@example.com'
order by email;
