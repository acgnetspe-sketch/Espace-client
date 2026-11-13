# Espace client ACG NET SPE

Espace sécurisé où chaque exploitant client d'ACG NET SPE (nettoyage et débroussaillage de centrales photovoltaïques) retrouve ses sites, l'historique des interventions, ses rapports et ses prochains passages. L'équipe ACG y planifie et publie les interventions.

- Cahier des charges : [CAHIER_DES_CHARGES.md](CAHIER_DES_CHARGES.md)
- Mise en place de la base de données : [docs/GUIDE_SUPABASE.md](docs/GUIDE_SUPABASE.md)
- Mise en ligne d'essai et vérification des écrans client : [docs/GUIDE_ETAPE_2.md](docs/GUIDE_ETAPE_2.md)
- Administration (fonction d'invitation, essais) : [docs/GUIDE_ETAPE_3.md](docs/GUIDE_ETAPE_3.md)
- Photos, demandes et e-mails automatiques : [docs/GUIDE_ETAPE_4.md](docs/GUIDE_ETAPE_4.md)

## Technique

- Interface : Vite, React 19, React Router et TypeScript ; police Inter hébergée avec le site (aucun appel à Google)
- Base de données, connexion par lien magique, fichiers privés : Supabase, région Paris (eu-west-3)
- Hébergement de l'interface : Netlify
- E-mails automatiques : Brevo (société française, données dans l'UE), appelé par une Edge Function

## Avancement

| Étape | Contenu | État |
|---|---|---|
| 1 | Tables, règles de sécurité, données de démonstration, tests d'isolement | Fait |
| 2 | Connexion par lien magique et écrans client en lecture | Fait |
| 3 | Écrans administrateur : clients et invitations, sites et import CSV, interventions, rapports PDF, publication | Fait |
| 4 | Photos avant/après, demandes des clients, e-mails automatiques (V2) | Fait |
| 5 | Mise en ligne sur Netlify | À faire |

## Organisation du dépôt

```
src/
  lib/             Connexion à Supabase, requêtes, formats français, libellés
  composants/      Éléments communs (en-tête, badges, boutons de fichiers)
  pages/           Un fichier par écran (pages/admin : administration ACG)
supabase/
  migrations/      Schéma et sécurité, à appliquer dans l'ordre (1 à 6)
  functions/       Edge Functions : admin-contacts (invitations), envoyer-emails (e-mails automatiques)
  taches_planifiees.sql   Envoi des e-mails toutes les 5 minutes, rappels J-7 (à lancer une fois)
  seed.sql         Données de démonstration fictives
  tests/
    isolement.test.sql   Tests d'isolement entre clients (éditeur SQL de Supabase)
    local/               Lancement des mêmes tests sur un PostgreSQL local
  demo/rapports/   Rapports PDF factices
scripts/           Petits outils (génération des PDF factices)
docs/              Guides
```

## Sécurité, en résumé

- La Row Level Security est activée sur **toutes** les tables. Un client ne **lit** que les données de son organisation, voire de certains sites seulement. Il ne modifie rien.
- Les interventions sont lues par les clients à travers la vue `interventions_visibles`. Un passage planifié est visible, mais le compte rendu, le rapport et les photos n'apparaissent qu'après « Publier ».
- Les notes internes sont dans des tables réservées aux administrateurs.
- Les fichiers sont dans un stockage privé et se téléchargent par lien signé valable 1 heure. Un fichier n'est lisible que s'il est référencé dans la table `fichiers` et visible par la personne.
- Les comptes de connexion sont créés et supprimés par l'Edge Function `admin-contacts`, qui garde la clé secrète côté serveur et vérifie à chaque appel que l'appelant est administrateur.
- Les e-mails automatiques passent par une boîte d'envoi en base : les destinataires y sont calculés avec les mêmes règles que l'écran (un contact n'est jamais prévenu pour un site qu'il ne voit pas). Le texte saisi par les utilisateurs est neutralisé dans les e-mails.
- Les photos sont réduites dans le navigateur (2000 px, JPEG) avant l'envoi, et suivent les mêmes règles que les rapports : visibles du client seulement après publication.
- Aucune clé secrète dans le dépôt : `.env` est ignoré par Git, et `.env.example` ne contient pas de valeurs.
- Le dépôt ne contient que des données fictives.

## Lancer l'application sur un ordinateur

Il faut Node.js 22.

```
npm install
cp .env.example .env      # puis remplir les deux valeurs
npm run dev               # ouvre http://127.0.0.1:5173
```

Pour que le lien magique fonctionne en local, ajouter `http://127.0.0.1:5173/**` dans Supabase, menu Authentication › URL Configuration › Redirect URLs.

## Tests

- **Dans Supabase** : coller `supabase/tests/isolement.test.sql` dans l'éditeur SQL. Chaque ligne du tableau doit afficher « OK ».
- **En local** (PostgreSQL 15 ou plus récent) : `bash supabase/tests/local/lancer_tests.sh`
- **Formats, import CSV, photos, mise en forme des e-mails** : `npm test`
- **Automatiquement** : à chaque envoi sur GitHub, l'onglet *Actions* relance les tests d'isolement, les tests de formats et la construction de l'application (« Tests de sécurité »).
