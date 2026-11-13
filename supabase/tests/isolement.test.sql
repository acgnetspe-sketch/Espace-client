-- =============================================================================
-- Espace client ACG NET SPE — TESTS D'ISOLEMENT ET DE SÉCURITÉ
-- -----------------------------------------------------------------------------
-- Comment l'utiliser : coller TOUT ce fichier dans l'éditeur SQL de Supabase
-- (SQL Editor › New query), puis cliquer sur « Run ».
--
-- Prérequis : les 4 migrations ET les données de démonstration (seed.sql)
-- ont été appliquées.
--
-- Ce que fait le script : il se fait passer successivement pour le client A,
-- le client A à accès limité, le client B, l'administrateur et un visiteur non
-- connecté, et vérifie ce que chacun peut voir ou modifier. Il ajoute quelques
-- données temporaires pour les besoins des tests, puis ANNULE TOUT à la fin :
-- la base est laissée exactement comme avant.
--
-- Résultat attendu : un tableau où chaque ligne affiche « OK ».
-- Une seule ligne « ÉCHEC » = problème de sécurité à corriger avant toute
-- mise en service.
-- =============================================================================

-- Une ligne de résultat.
create type pg_temp.ligne_test as (test text, ok boolean, detail text);

-- Compte les lignes qu'une requête renvoie POUR une personne donnée.
-- p_uid null = visiteur non connecté. Renvoie -1 si l'accès est refusé.
create function pg_temp.compter(p_uid uuid, p_requete text)
returns bigint
language plpgsql
as $$
declare
  n bigint;
begin
  perform set_config('request.jwt.claims',
    case when p_uid is null then '{"role":"anon"}'
         else json_build_object('sub', p_uid, 'role', 'authenticated')::text end, true);
  perform set_config('role', case when p_uid is null then 'anon' else 'authenticated' end, true);
  begin
    execute 'select count(*) from (' || p_requete || ') as q' into n;
  exception when insufficient_privilege then
    n := -1;
  end;
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return n;
end;
$$;

-- Tente une écriture POUR une personne donnée.
-- Renvoie le nombre de lignes modifiées, ou -1 si l'écriture est refusée.
create function pg_temp.ecrire(p_uid uuid, p_requete text)
returns bigint
language plpgsql
as $$
declare
  n bigint;
begin
  perform set_config('request.jwt.claims',
    case when p_uid is null then '{"role":"anon"}'
         else json_build_object('sub', p_uid, 'role', 'authenticated')::text end, true);
  perform set_config('role', case when p_uid is null then 'anon' else 'authenticated' end, true);
  begin
    execute p_requete;
    get diagnostics n = row_count;
  exception when others then
    -- Refus de la sécurité (42501) ou contrainte qui bloque : rien n'est écrit.
    n := -1;
  end;
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return n;
end;
$$;

create function pg_temp.tests_isolement()
returns table (numero integer, resultat text, test text, detail text)
language plpgsql
as $$
declare
  -- Personnes
  adm  constant uuid := 'ad000000-0000-4000-8000-000000000001';
  ca   constant uuid := 'a1000000-0000-4000-8000-000000000001';  -- client A
  cal  constant uuid := 'a1000000-0000-4000-8000-000000000002';  -- client A, accès limité au site A2
  cb   constant uuid := 'b1000000-0000-4000-8000-000000000001';  -- client B
  -- Données
  org_a constant text := '''a0000000-0000-4000-8000-000000000001''';
  org_b constant text := '''b0000000-0000-4000-8000-000000000001''';
  site_a1 constant text := '''a2000000-0000-4000-8000-000000000001''';
  site_a2 constant text := '''a2000000-0000-4000-8000-000000000002''';
  site_b  constant text := '''b2000000-0000-4000-8000-000000000001''';
  int_a_publiee  constant text := '''a3000000-0000-4000-8000-000000000001''';
  int_a_planif   constant text := '''a3000000-0000-4000-8000-000000000011''';
  int_a_nonpub   constant text := '''a3000000-0000-4000-8000-0000000000ff''';
  int_b          constant text := '''b3000000-0000-4000-8000-000000000001''';
  fic_a1  constant text := '''a4000000-0000-4000-8000-000000000001''';
  fic_a2  constant text := '''a4000000-0000-4000-8000-000000000002''';
  fic_b   constant text := '''b4000000-0000-4000-8000-000000000001''';
  chem_a1 constant text := 'a0000000-0000-4000-8000-000000000001/a2000000-0000-4000-8000-000000000001/a3000000-0000-4000-8000-000000000001/rapport-demo-garrigues.pdf';
  chem_a2 constant text := 'a0000000-0000-4000-8000-000000000001/a2000000-0000-4000-8000-000000000002/a3000000-0000-4000-8000-000000000002/rapport-demo-mistral.pdf';
  chem_b  constant text := 'b0000000-0000-4000-8000-000000000001/b2000000-0000-4000-8000-000000000001/b3000000-0000-4000-8000-000000000001/rapport-demo-atelier-b.pdf';
  chem_nonpub constant text := 'a0000000-0000-4000-8000-000000000001/a2000000-0000-4000-8000-000000000002/a3000000-0000-4000-8000-0000000000ff/rapport-non-publie.pdf';

  r pg_temp.ligne_test[] := '{}';
  n bigint;
  stockage_teste boolean := false;
begin
  -- Vérification préalable : les données de démonstration sont-elles là ?
  if (select count(*) from public.sites) < 5
     or not exists (select 1 from public.profils where id = ca) then
    return query select 0, 'ÉCHEC', 'Données de démonstration absentes',
      'Appliquez d''abord supabase/seed.sql, puis relancez ce test.';
    return;
  end if;

  begin
    -- -----------------------------------------------------------------------
    -- Données temporaires (annulées à la fin)
    -- -----------------------------------------------------------------------
    -- Une intervention RÉALISÉE mais NON PUBLIÉE sur le site A2, avec son rapport.
    insert into public.interventions (id, site_id, type, statut, debut_reel, fin_reelle, surface_m2, bon_commande, publiee)
    values ('a3000000-0000-4000-8000-0000000000ff', 'a2000000-0000-4000-8000-000000000002',
            'nettoyage', 'realisee', current_date - 2, current_date - 2, 38420, 'BC-NON-PUBLIE', false);
    insert into public.fichiers (intervention_id, type, chemin, nom)
    values ('a3000000-0000-4000-8000-0000000000ff', 'rapport', chem_nonpub, 'Rapport non publié.pdf');
    -- Un compte rendu saisi à l'avance sur un passage seulement planifié.
    update public.interventions
       set surface_m2 = 52763, bon_commande = 'BC-SECRET', anomalies = 'texte non publié', panneaux_casses = 9
     where id = 'a3000000-0000-4000-8000-000000000011';
    -- Une demande et une anomalie ouverte chez B.
    insert into public.demandes (organisation_id, auteur_id, type, message)
    values ('b0000000-0000-4000-8000-000000000001', cb, 'devis', 'Demande de test de B');
    update public.interventions set panneaux_casses = 2, anomalies = 'Anomalie de test B'
     where id = 'b3000000-0000-4000-8000-000000000001';

    -- Fichiers dans le stockage : on utilise les PDF téléversés s'ils existent,
    -- sinon on crée des entrées temporaires.
    begin
      insert into storage.objects (bucket_id, name)
      select 'documents', c
      from unnest(array[chem_a1, chem_a2, chem_b, chem_nonpub]) as c
      on conflict do nothing;
    exception when others then
      null;
    end;
    stockage_teste := (select count(*) from storage.objects
                       where bucket_id = 'documents'
                         and name in (chem_a1, chem_a2, chem_b, chem_nonpub)) = 4;

    -- -----------------------------------------------------------------------
    -- 1. Contrôles positifs : chacun voit bien SES données
    --    (sans eux, des tests « 0 ligne » pourraient réussir à tort)
    -- -----------------------------------------------------------------------
    n := pg_temp.compter(adm, 'select 1 from public.sites');
    r := r || row('Administrateur : voit les 5 sites de démonstration', n = 5, 'vus : ' || n)::pg_temp.ligne_test;
    n := pg_temp.compter(ca, 'select 1 from public.sites');
    r := r || row('Client A : voit ses 4 sites', n = 4, 'vus : ' || n)::pg_temp.ligne_test;
    n := pg_temp.compter(cb, 'select 1 from public.sites');
    r := r || row('Client B : voit son 1 site', n = 1, 'vus : ' || n)::pg_temp.ligne_test;
    n := pg_temp.compter(ca, 'select 1 from public.interventions_visibles');
    r := r || row('Client A : voit ses 13 interventions (10 publiées, 3 planifiées)', n = 13, 'vues : ' || n)::pg_temp.ligne_test;
    n := pg_temp.compter(ca, 'select 1 from public.fichiers');
    r := r || row('Client A : voit ses 2 rapports publiés', n = 2, 'vus : ' || n)::pg_temp.ligne_test;
    n := pg_temp.compter(ca, 'select 1 from public.interventions_visibles where id = ' || int_a_publiee || ' and surface_m2 is not null and bon_commande is not null');
    r := r || row('Client A : voit le compte rendu d''une intervention publiée', n = 1, 'vu : ' || n)::pg_temp.ligne_test;
    n := pg_temp.compter(adm, 'select 1 from public.interventions_visibles where id = ' || int_a_nonpub);
    r := r || row('Administrateur : voit une intervention non publiée', n = 1, 'vue : ' || n)::pg_temp.ligne_test;
    n := pg_temp.compter(adm, 'select 1 from public.alertes where organisation_id = ' || org_b);
    r := r || row('Administrateur : voit l''alerte anomalie de B', n = 1, 'vue : ' || n)::pg_temp.ligne_test;
    n := pg_temp.compter(ca, 'select 1 from public.alertes where type_alerte = ''anomalie''');
    r := r || row('Client A : voit son anomalie ouverte (règle 3)', n = 1, 'vue : ' || n)::pg_temp.ligne_test;
    n := pg_temp.compter(ca, 'select 1 from public.alertes where type_alerte = ''old''');
    r := r || row('Client A : voit son échéance OLD à moins de 60 jours (règle 2)', n = 1, 'vue : ' || n)::pg_temp.ligne_test;
    n := pg_temp.compter(ca, 'select 1 from public.profils');
    r := r || row('Client A : voit les 2 utilisateurs de son organisation', n = 2, 'vus : ' || n)::pg_temp.ligne_test;
    if stockage_teste then
      n := pg_temp.compter(ca, 'select 1 from storage.objects where bucket_id = ''documents''');
      r := r || row('Client A : peut télécharger ses 2 rapports (stockage)', n = 2, 'vus : ' || n)::pg_temp.ligne_test;
    end if;

    -- -----------------------------------------------------------------------
    -- 2. Isolement : A ne voit RIEN de B, même en devinant les identifiants
    -- -----------------------------------------------------------------------
    n := pg_temp.compter(ca, 'select 1 from public.organisations where id = ' || org_b);
    r := r || row('A ne voit pas l''organisation B (identifiant deviné)', n <= 0, 'vues : ' || n)::pg_temp.ligne_test;
    n := pg_temp.compter(ca, 'select 1 from public.sites where id = ' || site_b);
    r := r || row('A ne voit pas le site de B (identifiant deviné)', n <= 0, 'vus : ' || n)::pg_temp.ligne_test;
    n := pg_temp.compter(ca, 'select 1 from public.sites where organisation_id = ' || org_b);
    r := r || row('A ne voit aucun site de l''organisation B', n <= 0, 'vus : ' || n)::pg_temp.ligne_test;
    n := pg_temp.compter(ca, 'select 1 from public.interventions_visibles where id = ' || int_b || ' or site_id = ' || site_b);
    r := r || row('A ne voit aucune intervention de B (identifiant deviné)', n <= 0, 'vues : ' || n)::pg_temp.ligne_test;
    n := pg_temp.compter(ca, 'select 1 from public.fichiers where id = ' || fic_b || ' or intervention_id = ' || int_b);
    r := r || row('A ne voit aucun fichier de B (identifiant deviné)', n <= 0, 'vus : ' || n)::pg_temp.ligne_test;
    n := pg_temp.compter(ca, 'select 1 from public.profils where organisation_id = ' || org_b || ' or id = ''' || cb || '''');
    r := r || row('A ne voit aucun contact de B', n <= 0, 'vus : ' || n)::pg_temp.ligne_test;
    n := pg_temp.compter(ca, 'select 1 from public.demandes where organisation_id = ' || org_b);
    r := r || row('A ne voit aucune demande de B', n <= 0, 'vues : ' || n)::pg_temp.ligne_test;
    n := pg_temp.compter(ca, 'select 1 from public.sites_prochain_passage where site_id = ' || site_b || ' or organisation_id = ' || org_b);
    r := r || row('A ne voit pas le prochain passage de B', n <= 0, 'vus : ' || n)::pg_temp.ligne_test;
    n := pg_temp.compter(ca, 'select 1 from public.alertes where organisation_id = ' || org_b);
    r := r || row('A ne voit aucune alerte de B', n <= 0, 'vues : ' || n)::pg_temp.ligne_test;
    n := pg_temp.compter(ca, 'select 1 from public.chiffres_annee where organisation_id = ' || org_b);
    r := r || row('A ne voit pas les chiffres de l''année de B', n <= 0, 'vus : ' || n)::pg_temp.ligne_test;
    if stockage_teste then
      n := pg_temp.compter(ca, 'select 1 from storage.objects where name = ' || quote_literal(chem_b));
      r := r || row('A ne peut pas télécharger le rapport de B, même avec son chemin exact', n <= 0, 'vus : ' || n)::pg_temp.ligne_test;
    end if;

    -- Et dans l'autre sens : B ne voit rien de A.
    n := pg_temp.compter(cb, 'select 1 from public.sites where organisation_id = ' || org_a || ' or id = ' || site_a1);
    r := r || row('B ne voit aucun site de A', n <= 0, 'vus : ' || n)::pg_temp.ligne_test;
    n := pg_temp.compter(cb, 'select 1 from public.interventions_visibles where site_id in (' || site_a1 || ',' || site_a2 || ')');
    r := r || row('B ne voit aucune intervention de A', n <= 0, 'vues : ' || n)::pg_temp.ligne_test;
    n := pg_temp.compter(cb, 'select 1 from public.fichiers where id in (' || fic_a1 || ',' || fic_a2 || ')');
    r := r || row('B ne voit aucun fichier de A', n <= 0, 'vus : ' || n)::pg_temp.ligne_test;
    if stockage_teste then
      n := pg_temp.compter(cb, 'select 1 from storage.objects where name in (' || quote_literal(chem_a1) || ',' || quote_literal(chem_a2) || ')');
      r := r || row('B ne peut pas télécharger les rapports de A', n <= 0, 'vus : ' || n)::pg_temp.ligne_test;
    end if;

    -- -----------------------------------------------------------------------
    -- 3. Tables réservées aux administrateurs
    -- -----------------------------------------------------------------------
    n := pg_temp.compter(ca, 'select 1 from public.interventions');
    r := r || row('Un client n''accède pas directement à la table des interventions', n <= 0, 'vues : ' || n)::pg_temp.ligne_test;
    n := pg_temp.compter(ca, 'select 1 from public.interventions_internes');
    r := r || row('Un client ne lit aucune note interne d''intervention', n <= 0, 'vues : ' || n)::pg_temp.ligne_test;
    n := pg_temp.compter(ca, 'select 1 from public.organisations_internes');
    r := r || row('Un client ne lit aucune note interne d''organisation', n <= 0, 'vues : ' || n)::pg_temp.ligne_test;

    -- -----------------------------------------------------------------------
    -- 4. Publication
    -- -----------------------------------------------------------------------
    n := pg_temp.compter(ca, 'select 1 from public.interventions_visibles where id = ' || int_a_nonpub);
    r := r || row('Une intervention réalisée mais non publiée est invisible du client', n <= 0, 'vues : ' || n)::pg_temp.ligne_test;
    n := pg_temp.compter(ca, 'select 1 from public.fichiers where intervention_id = ' || int_a_nonpub);
    r := r || row('Le rapport d''une intervention non publiée est invisible du client', n <= 0, 'vus : ' || n)::pg_temp.ligne_test;
    if stockage_teste then
      n := pg_temp.compter(ca, 'select 1 from storage.objects where name = ' || quote_literal(chem_nonpub));
      r := r || row('Le PDF d''une intervention non publiée n''est pas téléchargeable', n <= 0, 'vus : ' || n)::pg_temp.ligne_test;
    end if;
    n := pg_temp.compter(ca, 'select 1 from public.interventions_visibles where id = ' || int_a_planif);
    r := r || row('Un passage planifié est visible du client', n = 1, 'vus : ' || n)::pg_temp.ligne_test;
    n := pg_temp.compter(ca, 'select 1 from public.interventions_visibles where id = ' || int_a_planif
      || ' and surface_m2 is null and bon_commande is null and anomalies is null and panneaux_casses is null');
    r := r || row('Le compte rendu d''un passage non publié est masqué', n = 1, 'masqué : ' || n)::pg_temp.ligne_test;

    -- -----------------------------------------------------------------------
    -- 5. Accès limité à certains sites
    -- -----------------------------------------------------------------------
    n := pg_temp.compter(cal, 'select 1 from public.sites');
    r := r || row('Contact limité : ne voit que son site autorisé', n = 1, 'vus : ' || n)::pg_temp.ligne_test;
    n := pg_temp.compter(cal, 'select 1 from public.interventions_visibles where site_id = ' || site_a1);
    r := r || row('Contact limité : ne voit pas les interventions des autres sites de A', n <= 0, 'vues : ' || n)::pg_temp.ligne_test;
    n := pg_temp.compter(cal, 'select 1 from public.fichiers where id = ' || fic_a1);
    r := r || row('Contact limité : ne voit pas les rapports des autres sites de A', n <= 0, 'vus : ' || n)::pg_temp.ligne_test;
    n := pg_temp.compter(cal, 'select 1 from public.fichiers where id = ' || fic_a2);
    r := r || row('Contact limité : voit le rapport de son site autorisé', n = 1, 'vus : ' || n)::pg_temp.ligne_test;
    if stockage_teste then
      n := pg_temp.compter(cal, 'select 1 from storage.objects where name = ' || quote_literal(chem_a1));
      r := r || row('Contact limité : ne peut pas télécharger le rapport d''un autre site', n <= 0, 'vus : ' || n)::pg_temp.ligne_test;
    end if;
    n := pg_temp.ecrire(cal, 'delete from public.acces_sites');
    r := r || row('Contact limité : ne peut pas supprimer sa propre limitation', n <= 0, 'lignes : ' || n)::pg_temp.ligne_test;

    -- -----------------------------------------------------------------------
    -- 6. Un client ne peut rien modifier
    -- -----------------------------------------------------------------------
    n := pg_temp.ecrire(ca, 'update public.profils set role = ''admin'', organisation_id = null where id = ''' || ca || '''');
    r := r || row('Un client ne peut pas se donner le rôle administrateur', n <= 0, 'lignes : ' || n)::pg_temp.ligne_test;
    n := pg_temp.ecrire(ca, 'update public.profils set organisation_id = ' || org_b || ' where id = ''' || ca || '''');
    r := r || row('Un client ne peut pas changer d''organisation', n <= 0, 'lignes : ' || n)::pg_temp.ligne_test;
    n := pg_temp.ecrire(ca, 'insert into public.organisations (nom) values (''Intrus'')');
    r := r || row('Un client ne peut pas créer d''organisation', n <= 0, 'lignes : ' || n)::pg_temp.ligne_test;
    n := pg_temp.ecrire(ca, 'update public.sites set nom = ''Modifié'' ');
    r := r || row('Un client ne peut pas modifier un site', n <= 0, 'lignes : ' || n)::pg_temp.ligne_test;
    n := pg_temp.ecrire(ca, 'insert into public.sites (organisation_id, nom, type_installation) values (' || org_a || ', ''Intrus'', ''sol'')');
    r := r || row('Un client ne peut pas créer de site', n <= 0, 'lignes : ' || n)::pg_temp.ligne_test;
    n := pg_temp.ecrire(ca, 'update public.interventions set publiee = false');
    r := r || row('Un client ne peut pas modifier une intervention', n <= 0, 'lignes : ' || n)::pg_temp.ligne_test;
    n := pg_temp.ecrire(ca, 'update public.interventions_visibles set bon_commande = ''X''');
    r := r || row('Un client ne peut pas modifier via la vue des interventions', n <= 0, 'lignes : ' || n)::pg_temp.ligne_test;
    n := pg_temp.ecrire(ca, 'delete from public.fichiers');
    r := r || row('Un client ne peut pas supprimer de fichier', n <= 0, 'lignes : ' || n)::pg_temp.ligne_test;
    n := pg_temp.ecrire(ca, 'insert into public.fichiers (site_id, type, chemin, nom) values (' || site_a1 || ', ''document'', ''x/y.pdf'', ''y.pdf'')');
    r := r || row('Un client ne peut pas déclarer de fichier', n <= 0, 'lignes : ' || n)::pg_temp.ligne_test;
    n := pg_temp.ecrire(ca, 'insert into public.interventions_internes (intervention_id, notes_internes) values (' || int_a_planif || ', ''x'')');
    r := r || row('Un client ne peut pas écrire de note interne', n <= 0, 'lignes : ' || n)::pg_temp.ligne_test;
    n := pg_temp.ecrire(ca, 'insert into public.acces_sites (profil_id, site_id) values (''' || ca || ''', ' || site_b || ')');
    r := r || row('Un client ne peut pas s''ouvrir l''accès à un site de B', n <= 0, 'lignes : ' || n)::pg_temp.ligne_test;
    n := pg_temp.ecrire(ca, 'insert into storage.objects (bucket_id, name) values (''documents'', ''a0000000-0000-4000-8000-000000000001/intrus.pdf'')');
    r := r || row('Un client ne peut pas déposer de fichier dans le stockage', n <= 0, 'lignes : ' || n)::pg_temp.ligne_test;
    n := pg_temp.ecrire(ca, 'delete from storage.objects');
    r := r || row('Un client ne peut pas supprimer de fichier du stockage', n <= 0, 'lignes : ' || n)::pg_temp.ligne_test;

    -- Demandes (V2) : uniquement pour son organisation, au statut « envoyée ».
    n := pg_temp.ecrire(ca, 'insert into public.demandes (organisation_id, type, message) values (' || org_b || ', ''devis'', ''x'')');
    r := r || row('Un client ne peut pas créer une demande au nom de B', n <= 0, 'lignes : ' || n)::pg_temp.ligne_test;
    n := pg_temp.ecrire(ca, 'insert into public.demandes (organisation_id, site_id, type, message) values (' || org_a || ', ' || site_b || ', ''devis'', ''x'')');
    r := r || row('Un client ne peut pas créer une demande sur un site de B', n <= 0, 'lignes : ' || n)::pg_temp.ligne_test;
    n := pg_temp.ecrire(ca, 'insert into public.demandes (organisation_id, type, message, statut) values (' || org_a || ', ''devis'', ''x'', ''traitee'')');
    r := r || row('Un client ne peut pas créer une demande déjà « traitée »', n <= 0, 'lignes : ' || n)::pg_temp.ligne_test;
    n := pg_temp.ecrire(ca, 'insert into public.demandes (organisation_id, site_id, type, message) values (' || org_a || ', ' || site_a1 || ', ''devis'', ''Demande de test'')');
    r := r || row('Un client peut envoyer une demande pour son organisation', n = 1, 'lignes : ' || n)::pg_temp.ligne_test;
    n := pg_temp.ecrire(ca, 'update public.demandes set statut = ''traitee'', reponse = ''x''');
    r := r || row('Un client ne peut pas modifier le statut d''une demande', n <= 0, 'lignes : ' || n)::pg_temp.ligne_test;

    -- -----------------------------------------------------------------------
    -- 7. Visiteur non connecté : rien du tout
    -- -----------------------------------------------------------------------
    n := pg_temp.compter(null, 'select 1 from public.sites');
    r := r || row('Visiteur non connecté : aucun site', n <= 0, 'vus : ' || n)::pg_temp.ligne_test;
    n := pg_temp.compter(null, 'select 1 from public.interventions_visibles');
    r := r || row('Visiteur non connecté : aucune intervention', n <= 0, 'vues : ' || n)::pg_temp.ligne_test;
    n := pg_temp.compter(null, 'select 1 from public.profils');
    r := r || row('Visiteur non connecté : aucun contact', n <= 0, 'vus : ' || n)::pg_temp.ligne_test;
    n := pg_temp.compter(null, 'select 1 from public.fichiers');
    r := r || row('Visiteur non connecté : aucun fichier', n <= 0, 'vus : ' || n)::pg_temp.ligne_test;
    n := pg_temp.compter(null, 'select 1 from storage.objects where bucket_id = ''documents''');
    r := r || row('Visiteur non connecté : aucun fichier du stockage', n <= 0, 'vus : ' || n)::pg_temp.ligne_test;

    -- -----------------------------------------------------------------------
    -- 8. Structure
    -- -----------------------------------------------------------------------
    select count(*) into n
    from pg_class c join pg_namespace s on s.oid = c.relnamespace
    where s.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity;
    r := r || row('Row Level Security activée sur toutes les tables', n = 0,
                  'tables sans RLS : ' || n)::pg_temp.ligne_test;
    select count(*) into n from storage.buckets where id = 'documents' and public = false;
    r := r || row('L''espace de stockage « documents » est privé', n = 1, 'trouvé : ' || n)::pg_temp.ligne_test;

    if not stockage_teste then
      r := r || row('Stockage : tests de téléchargement non effectués', false,
        'Téléversez les 3 PDF de démonstration (docs/GUIDE_SUPABASE.md, étape 6), puis relancez.')::pg_temp.ligne_test;
    end if;

    -- Tout annuler (données temporaires comprises).
    raise exception using errcode = 'XANNU', message = 'annulation des données de test';
  exception
    when sqlstate 'XANNU' then
      null;
    when others then
      r := r || row('Erreur inattendue pendant les tests', false, sqlerrm)::pg_temp.ligne_test;
  end;

  return query
    select t.t_numero::integer,
           case when t.t_ok then 'OK' else 'ÉCHEC' end,
           t.t_test,
           t.t_detail
    from unnest(r) with ordinality as t (t_test, t_ok, t_detail, t_numero);
end;
$$;

-- Lancement. Le tableau de résultats s'affiche en dessous.
select * from pg_temp.tests_isolement();
