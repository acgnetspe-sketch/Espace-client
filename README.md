# Espace client ACG NET SPE

Espace sécurisé où chaque exploitant client d'ACG NET SPE (nettoyage et débroussaillage de centrales photovoltaïques) retrouve ses sites, l'historique des interventions, ses rapports et ses prochains passages. L'équipe ACG y planifie et publie les interventions.

- Cahier des charges : [CAHIER_DES_CHARGES.md](CAHIER_DES_CHARGES.md)
- Mise en place de la base de données : [docs/GUIDE_SUPABASE.md](docs/GUIDE_SUPABASE.md)
- Mise en ligne d'essai et vérification des écrans client : [docs/GUIDE_ETAPE_2.md](docs/GUIDE_ETAPE_2.md)
- Administration (fonction d'invitation, essais) : [docs/GUIDE_ETAPE_3.md](docs/GUIDE_ETAPE_3.md)

## Technique

- Interface : Vite, React 19, React Router et TypeScript ; police Inter hébergée avec le site (aucun appel à Google)
- Base de données, connexion par lien magique, fichiers privés : Supabase, région Paris (eu-west-3)
- Hébergement de l'interface : Netlify

## Avancement

| Étape | Contenu | État |
|---|---|---|
| 1 | Tables, règles de sécurité, données de démonstration, tests d'isolement | Fait |
| 2 | Connexion par lien magique et écrans client en lecture | Fait |
| 3 | Écrans administrateur : clients et invitations, sites et import CSV, interventions, rapports PDF, publication | Fait |
| 4 | Photos, demandes, e-mails automatiques (V2) | À faire |
| 5 | Mise en ligne sur Netlify | À faire |

## Organisation du dépôt

```
src/
  lib/             Connexion à Supabase, requêtes, formats français, libellés
  composants/      Éléments communs (en-tête, badges, boutons de fichiers)
  pages/           Un fichier par écran (pages/admin : administration ACG)
supabase/
  migrations/      Schéma et sécurité, à appliquer dans l'ordre (1 à 5)
  functions/       Edge Function « admin-contacts » (invitations, suppression de comptes)
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
- **Formats et import CSV** : `npm test`
- **Automatiquement** : à chaque envoi sur GitHub, l'onglet *Actions* relance les tests d'isolement, les tests de formats et la construction de l'application (« Tests de sécurité »).
