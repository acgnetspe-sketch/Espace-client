# Guide : créer la base de données Supabase (étape 1)

Ce guide se suit entièrement dans le navigateur (Safari sur iPad ou ordinateur).
Compter environ 30 minutes. Aucune installation n'est nécessaire.

> Les noms des menus de Supabase changent parfois légèrement. Si un libellé
> ne correspond pas exactement, chercher le plus proche ; en cas de doute,
> me décrire ce qui est affiché à l'écran.

---

## En deux mots : ce que l'on construit

- **Supabase** est le « coffre-fort » de l'espace client. Il range trois choses : les **données** (sites, interventions…), les **comptes** des personnes qui se connectent et les **fichiers** (rapports PDF).
- Les **migrations** sont 4 fichiers de texte qui décrivent les tables et les règles de sécurité. On les colle une par une dans Supabase, qui construit tout.
- Les **données de démonstration** remplissent la base avec deux clients fictifs, A et B.
- Le **test d'isolement** vérifie automatiquement que A ne voit rien de B. Il affiche « OK » ou « ÉCHEC » pour chaque point vérifié.

---

## Étape 1 — Créer le compte et le projet

1. Aller sur **supabase.com** et cliquer sur **Start your project**. S'inscrire, par exemple avec le compte GitHub.
2. Si Supabase le demande, créer une **organisation** : nom `ACG NET SPE`, type « Company », offre **Free**.
3. Cliquer sur **New project** et remplir :
   - **Name** : `espace-client-acg`
   - **Database Password** : cliquer sur **Generate a password**, puis **enregistrer ce mot de passe** dans un endroit sûr (gestionnaire de mots de passe). On n'en aura pas besoin au quotidien.
   - **Region** : choisir **West EU (Paris)**. C'est important pour le RGPD : les données restent en France. *Cette région ne peut plus être changée ensuite.*
4. Cliquer sur **Create new project**. La préparation prend 1 à 2 minutes.

**Comment vérifier.** Le tableau de bord du projet s'affiche. Dans **Project Settings › General**, la région indiquée est bien Paris (eu-west-3).

---

## Étape 2 — Fermer les inscriptions libres

Seules les personnes invitées par ACG doivent pouvoir se connecter.

1. Menu de gauche : **Authentication**, puis **Sign In / Providers** (parfois appelé **Providers** ou **Settings**).
2. Désactiver **Allow new users to sign up**.
3. Vérifier que le fournisseur **Email** est activé.
4. Cliquer sur **Save**.

**Comment vérifier.** L'interrupteur « Allow new users to sign up » est grisé ou sur « off ».

---

## Étape 3 — Appliquer les 4 migrations

On va copier le contenu de chaque fichier depuis GitHub, puis le coller dans Supabase.
**Respecter l'ordre 1, 2, 3, 4.**

| Ordre | Fichier dans le dépôt | Ce qu'il fait |
|---|---|---|
| 1 | `supabase/migrations/20261113000001_schema.sql` | Crée les tables |
| 2 | `supabase/migrations/20261113000002_securite.sql` | Pose les règles de sécurité |
| 3 | `supabase/migrations/20261113000003_stockage.sql` | Crée l'espace privé des fichiers |
| 4 | `supabase/migrations/20261113000004_regles_metier.sql` | Ajoute les calculs : prochain passage, alertes, chiffres de l'année |

Pour **chaque** fichier :

1. Sur GitHub, ouvrir le fichier, puis cliquer sur l'icône **Copy raw file** (deux petits carrés), en haut à droite du contenu.
2. Dans Supabase, menu de gauche : **SQL Editor**, puis **New query** (ou le bouton **+**).
3. Coller le texte dans la grande zone, puis cliquer sur **Run** (en bas à droite).
4. Résultat attendu : **Success. No rows returned**.

**Si un message rouge apparaît**, ne pas continuer avec le fichier suivant. Me copier le message tel quel.

**Comment vérifier.** Menu **Table Editor** : 9 tables apparaissent (`organisations`, `profils`, `sites`, `interventions`…), chacune **sans** l'étiquette « RLS disabled » / « Unrestricted ». Menu **Storage** : un espace `documents` existe, marqué privé (pas « Public »).

---

## Étape 4 — Charger les données de démonstration

1. Sur GitHub, ouvrir `supabase/seed.sql` et copier son contenu (**Copy raw file**).
2. **SQL Editor › New query**, coller, puis **Run**.
3. Résultat attendu : **Success. No rows returned**.

**Comment vérifier.** Dans **Table Editor › sites**, on doit voir 5 sites : 4 pour « Exploitant Démo A » et 1 pour « Exploitant Démo B ». Dans **Authentication › Users**, 4 comptes en `@example.com` apparaissent.

Ces comptes fictifs servent uniquement aux tests : aucun e-mail ne peut leur être envoyé.

---

## Étape 5 — Lancer le test d'isolement

1. Sur GitHub, ouvrir `supabase/tests/isolement.test.sql` et copier son contenu.
2. **SQL Editor › New query**, coller, puis **Run**.
3. Supabase peut afficher un avertissement du type *« potentially destructive operation »*, parce que le test essaie justement de modifier et de supprimer des données en se faisant passer pour un client. Confirmer avec **Run this query**. **Le test annule tout à la fin** : la base reste exactement comme avant.

**Résultat attendu.** Un tableau d'environ 66 lignes, toutes marquées **OK** dans la colonne `resultat`.

**Si une ligne affiche ÉCHEC**, me copier la ligne entière.

Les lignes « stockage » (téléchargement des PDF) sont testées avec des fichiers temporaires. Il n'est donc pas nécessaire d'avoir fait l'étape 6 avant.

---

## Étape 6 — Déposer les 3 rapports PDF factices (peut attendre l'étape 2)

Ces PDF permettront de tester le téléchargement dans l'application. Ils se trouvent dans le dossier `supabase/demo/rapports/` du dépôt. Pour chacun : l'ouvrir sur GitHub, cliquer sur **Download** (ou **View raw**), puis l'enregistrer sur l'iPad.

Dans Supabase, menu **Storage › documents**, recréer les dossiers ci-dessous avec **Create folder**, en **copiant-collant** les noms, puis déposer le PDF avec **Upload file**.

| PDF | Dossiers à créer, l'un dans l'autre |
|---|---|
| `rapport-demo-garrigues.pdf` | `a0000000-0000-4000-8000-000000000001` › `a2000000-0000-4000-8000-000000000001` › `a3000000-0000-4000-8000-000000000001` |
| `rapport-demo-mistral.pdf` | `a0000000-0000-4000-8000-000000000001` › `a2000000-0000-4000-8000-000000000002` › `a3000000-0000-4000-8000-000000000002` |
| `rapport-demo-atelier-b.pdf` | `b0000000-0000-4000-8000-000000000001` › `b2000000-0000-4000-8000-000000000001` › `b3000000-0000-4000-8000-000000000001` |

Garder le nom du fichier tel quel. Plus tard, l'écran administrateur de l'étape 3 rangera les fichiers tout seul.

---

## Étape 7 — Créer ton compte administrateur

1. **Authentication › Users › Add user › Create new user**.
2. Saisir ton adresse e-mail professionnelle et cocher **Auto Confirm User**. Le mot de passe ne servira pas : la connexion se fera par lien magique.
3. **SQL Editor › New query**, coller le texte ci-dessous en remplaçant les deux valeurs entre guillemets simples, puis **Run** :

```sql
insert into public.profils (id, nom, email, role)
select id, 'Prénom Nom', email, 'admin'
from auth.users
where email = 'ton.adresse@exemple.fr';
```

**Comment vérifier.** Le message est **Success. 1 row affected** (ou « INSERT 0 1 »). Si c'est « 0 rows », l'adresse ne correspond pas exactement à celle du compte créé.

---

## Étape 8 — Noter les deux informations pour l'étape 2

Menu **Project Settings › API** (ou **API Keys** / **Data API**) :

- **Project URL**, de la forme `https://xxxxxxxx.supabase.co` ;
- la clé **anon** / **publishable**.

Ces deux valeurs iront dans le fichier `.env` de l'application, à l'étape 2. Elles ne sont pas secrètes au sens strict : elles sont faites pour être utilisées dans le navigateur, et ce sont les règles de sécurité qui protègent les données.

**Ne jamais copier nulle part la clé `service_role` / `secret`** : elle ouvre toutes les portes. Elle ne doit pas apparaître dans le dépôt GitHub, ni dans un e-mail, ni dans une conversation.

---

## Bon à savoir

- **Security Advisor.** Supabase peut signaler « Security Definer View » sur la vue `interventions_visibles`. C'est **voulu et vérifié par le test** : c'est cette vue qui masque le compte rendu des interventions non publiées. Elle applique elle-même le filtre par client. Les autres avertissements éventuels sont à me transmettre.
- **Projet gratuit en pause.** Un projet gratuit se met en pause après une semaine sans activité. Il suffit de cliquer sur **Restore project** dans le tableau de bord. Pour de vrais clients, passer à l'offre Pro (cahier des charges §2).
- **Avant les vrais clients.** Les données de démonstration et les comptes `@example.com` seront retirés, ou un projet séparé sera créé pour la production. On en parlera à l'étape 5.
