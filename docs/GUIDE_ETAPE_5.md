# Guide : mise en service et site de démonstration (étape 5)

## Le principe : deux environnements séparés

| | **Production** | **Démonstration** |
|---|---|---|
| Pour qui | Les vrais clients | Salons (EnerGaïa), rendez-vous commerciaux |
| Projet Supabase | Le projet actuel, `espace-client-acg` | Un **nouveau** projet, `espace-client-acg-demo` |
| Données | Uniquement les vraies données | Uniquement les données fictives |
| Site Netlify | Le site actuel, à l'adresse `espace-client.acgnetspe.fr` | Un second site, par exemple `espace-client-acg-demo.netlify.app` |
| Connexion | Lien magique uniquement | Lien magique, ou **mot de passe de démonstration** (pratique sur un stand) |
| Offre Supabase | **Pro** (environ 25 $ par mois, sauvegardes quotidiennes) | Gratuite |

**Pourquoi séparer ?** Le compte administrateur de démonstration voit toutes les données de son projet. Sur un projet commun, il verrait les vrais clients, devant les visiteurs d'un salon. Avec deux projets, c'est impossible.

Le code est le même pour les deux sites. Seuls les réglages diffèrent.

---

# Partie A — Le site de démonstration

Compter environ 40 minutes. À faire avant le salon des 9 et 10 décembre 2026.

### A1. Créer le projet Supabase de démonstration

Suivre les étapes 1 à 5 de [GUIDE_SUPABASE.md](GUIDE_SUPABASE.md) avec ces différences :

- **Nom du projet** : `espace-client-acg-demo`. Région **West EU (Paris)**, offre gratuite.
- **Migrations** : appliquer les **6** fichiers de `supabase/migrations`, dans l'ordre.
- Appliquer ensuite `supabase/seed.sql`, puis lancer le test d'isolement : **84 lignes « OK »**.
- **Inutile** de déposer les PDF à la main (étape 6 du guide Supabase) : un bouton s'en chargera (A4).
- **Inutile** de créer ton propre compte administrateur : le compte de démonstration ACG suffit.

### A2. Choisir les mots de passe de démonstration

1. Copier `supabase/demo/preparer_demo.sql` dans **SQL Editor › New query** du projet **de démonstration**.
2. Remplacer `MOT_DE_PASSE_CLIENTS` et `MOT_DE_PASSE_ADMINISTRATION` par deux mots de passe de 12 caractères au moins, entre les guillemets simples. Les noter dans le gestionnaire de mots de passe. **Ne pas les écrire dans GitHub.**
3. **Run**. Le tableau doit afficher `true` pour les 4 comptes `@example.com`.

Ce script refuse de tourner s'il détecte de vraies données : impossible de l'appliquer par erreur à la production.

### A3. Créer le site Netlify de démonstration

1. Netlify, **Add new site › Import an existing project › GitHub**, puis choisir **le même dépôt** `Espace-client`.
2. **Branch to deploy** : la même branche que le site actuel.
3. **Environment variables** :

   | Key | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | l'adresse du projet **de démonstration** |
   | `VITE_SUPABASE_ANON_KEY` | la clé anon / publishable du projet **de démonstration** |
   | `VITE_MODE_DEMO` | `true` |

4. **Deploy**, puis **Site configuration › Change site name** : `espace-client-acg-demo`.
5. Dans le projet Supabase de démonstration, menu **Authentication › URL Configuration** : **Site URL** et **Redirect URLs** avec l'adresse de ce site (comme à l'étape 2 du guide de l'étape 2).

### A4. Installer les fichiers de démonstration

1. Ouvrir le site de démonstration. Sous le cadre de connexion habituel, un cadre jaune **« Démonstration »** apparaît.
2. Choisir **Équipe ACG NET SPE (administration)**, saisir le mot de passe d'administration, puis **Entrer dans la démonstration**.
3. Sur le tableau de bord interne, cliquer sur **Installer les fichiers de démonstration**. Message attendu : « 7 fichiers de démonstration installés » (3 rapports PDF et 4 photos avant/après, tous fictifs).

**Comment vérifier.**
- Un bandeau jaune « Démonstration – toutes les données affichées sont fictives » est visible en haut de chaque écran.
- En client A, l'intervention de nettoyage des Garrigues montre les photos avant/après et le rapport.

### A5. Avant chaque salon ou rendez-vous

Un projet gratuit **se met en pause après 7 jours sans visite**. Quelques jours avant :

1. **Ouvrir le site de démonstration** et s'y connecter : le projet se réveille. S'il est en pause, cliquer sur **Restore project** dans le tableau de bord Supabase.
2. **La veille, remettre la démo à neuf.** Les dates sont alors recalculées : passages « dans 12 jours », échéance OLD « dans 45 jours ». Lancer, dans l'ordre, dans le projet **de démonstration** :
   1. `supabase/demo/reinitialiser_demo.sql`, qui efface ce qui a été fait pendant les démonstrations ;
   2. `supabase/seed.sql`, qui recharge les données fictives ;
   3. `supabase/demo/preparer_demo.sql`, avec les mêmes mots de passe ;
   4. sur le site, **Installer les fichiers de démonstration**.
3. Sur l'iPad du stand, ouvrir le site dans Safari, puis **Partager › Sur l'écran d'accueil** : l'espace s'ouvre alors comme une application.

### Suggestion de démonstration (5 minutes)

1. **Client A, tableau de bord** : les alertes (échéance OLD, 3 panneaux cassés), les chiffres de l'année, les prochains passages.
2. **Mes sites**, puis la **Centrale Démo Les Garrigues** : la frise des interventions. Ouvrir le nettoyage d'octobre : encrassement, anomalie, **photos avant/après**, **rapport PDF**.
3. **Planning**, puis « Changer la date » : la demande part directement chez ACG.
4. Se déconnecter, puis entrer en **Équipe ACG** : la demande est arrivée. Répondre. Montrer une intervention à publier et le bouton **Publier**.
5. Phrase clé : *« Vous n'avez plus à chercher un rapport dans vos mails : tout est au même endroit, et vous êtes prévenu dès qu'il est disponible. »*

---

# Partie B — La production

### B1. Avant d'ouvrir aux clients pilotes : la liste de contrôle

**Décisions** (cahier des charges, section 10)
- [ ] Clients pilotes d'accord ; clauses de confidentialité vérifiées (question 1)
- [ ] Documents à partager arrêtés (question 2)
- [ ] Nom de domaine : qui le gère (question 3)
- [ ] Qui saisit et publie côté ACG : au moins **deux administrateurs**, pour ne jamais dépendre d'une seule personne (question 4)
- [ ] Budget Supabase Pro validé (question 5)
- [ ] Adresse d'envoi sur le domaine de l'entreprise (question 7)
- [ ] **Mentions légales** complétées et validées (question 8). M'envoyer les informations entre crochets (SIRET, adresse, contact, durée de conservation) et je mets la page à jour.

**Réglages**
- [ ] B2 Supabase en offre Pro
- [ ] B3 données de démonstration retirées
- [ ] B4 adresse `espace-client.acgnetspe.fr`
- [ ] B5 e-mails (Brevo) pour la connexion **et** les e-mails automatiques (guide de l'étape 4, y compris la partie « Recommandé »), domaine authentifié chez Brevo
- [ ] B6 vérifications finales

### B2. Passer le projet de production en offre Pro

Supabase, **Organization settings › Billing**, puis passer l'organisation en **Pro**. Laisser **Spend cap** activé : la facture ne dépasse alors jamais le forfait sans accord.

Avantages : plus de mise en pause, des sauvegardes quotidiennes conservées 7 jours, plus d'espace.

**Attention** : si le projet de démonstration est dans la même organisation, il est facturé lui aussi, comme projet supplémentaire. Pour éviter ce coût, créer le projet de démonstration (A1) dans une **seconde organisation**, restée en offre gratuite.

### B3. Retirer les données de démonstration de la production

1. Dans le projet **de production**, lancer `supabase/production/retirer_donnees_demo.sql`. Le résultat doit afficher **0 / 0 / 0** : plus d'organisation de démonstration, plus de compte fictif, plus aucun mot de passe.
   - En production, on se connecte **uniquement par lien magique**. Ton compte administrateur n'a plus de mot de passe, ce qui est voulu.
   - Seuls les identifiants fixes des données fictives sont visés : aucun risque pour de vraies données.
2. Supabase, **Storage › documents** : supprimer les dossiers `a0000000-0000-4000-8000-000000000001` et `b0000000-0000-4000-8000-000000000001`, qui contiennent les fichiers fictifs.
3. Ne **plus jamais** lancer `seed.sql` ni les scripts du dossier `supabase/demo` dans ce projet. Ils sont de toute façon protégés.

**Le test d'isolement** se lance désormais dans le **projet de démonstration** : il a exactement les mêmes règles de sécurité que la production. GitHub le relance aussi automatiquement à chaque modification.

### B4. L'adresse espace-client.acgnetspe.fr

1. Netlify, site de **production**, **Domain management › Add a domain** : saisir `espace-client.acgnetspe.fr`.
2. Netlify indique un enregistrement **CNAME** à créer : `espace-client` pointant vers `<nom-du-site>.netlify.app`. La personne qui gère le nom de domaine l'ajoute chez le registraire (OVH, Gandi…).
3. Après quelques minutes (jusqu'à 24 h), Netlify active **HTTPS** automatiquement. Vérifier que le cadenas apparaît.
4. Supabase (production), **Authentication › URL Configuration** :
   - **Site URL** : `https://espace-client.acgnetspe.fr` ;
   - **Redirect URLs** : `https://espace-client.acgnetspe.fr/**` ; retirer les autres adresses, sauf l'ancienne adresse Netlify si on veut la garder.
5. **Edge Functions › Secrets** : mettre `SITE_URL` à `https://espace-client.acgnetspe.fr`. Les liens des e-mails pointent ainsi vers la bonne adresse.
6. Vérifier que le site de production n'a **pas** la variable `VITE_MODE_DEMO`.

### B5. Version de référence du code

Aujourd'hui, les deux sites Netlify suivent la branche de travail `claude/espace-client-acg-aztjjq`. Pour la mise en service, il est plus propre de fusionner ce travail dans la branche principale `main`, puis de régler **Branch to deploy** sur `main` dans les deux sites Netlify. Je peux préparer cette fusion (une « pull request » à valider sur GitHub) si tu me le demandes.

### B6. Vérifications finales

| Vérification | Attendu |
|---|---|
| Ouvrir `https://espace-client.acgnetspe.fr` | L'écran de connexion, **sans** cadre « Démonstration » ni bandeau jaune |
| Se connecter avec ton adresse | Lien reçu, tableau de bord interne vide, sans aucune donnée Démo |
| Créer le premier client, ses sites (import CSV) et inviter un contact pilote | L'invitation arrive (expéditeur : l'adresse de l'entreprise) |
| Publier une première intervention avec son rapport | Le contact reçoit « Rapport disponible » dans les 5 minutes |
| Supabase, **Advisors › Security Advisor** | Seul avertissement attendu : « Security Definer View » sur `interventions_visibles` (voulu, voir le guide Supabase) |

En cas de doute, me copier le message affiché.
