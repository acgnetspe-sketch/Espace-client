# Guide : photos, demandes et e-mails automatiques (étape 4)

Prérequis : les étapes 1 à 3 sont faites. Compter environ 45 minutes.
Netlify se met à jour tout seul avec le nouveau code.

| Partie | Fonctionne sans réglage ? |
|---|---|
| Photos avant/après | Oui, dès la migration appliquée |
| Demandes des clients | Oui, dès la migration appliquée |
| E-mails automatiques | Non : il faut un service d'envoi d'e-mails (étapes 2 à 5 ci-dessous) |

---

## Étape 1 — Appliquer la migration 6

1. Sur GitHub, ouvrir `supabase/migrations/20261113000006_demandes_emails.sql` et copier son contenu (**Copy raw file**).
2. Supabase, **SQL Editor › New query**, coller, puis **Run**. Résultat attendu : **Success. No rows returned**.
3. Relancer le test de sécurité `supabase/tests/isolement.test.sql`.
   **Résultat attendu : 84 lignes, toutes « OK ».** Les nouvelles lignes vérifient notamment :
   - un e-mail sur un site de A ne part jamais chez B ;
   - un contact limité à certains sites n'est pas prévenu pour les autres ;
   - un client ne peut ni lire la boîte d'envoi, ni viser un passage d'un autre client dans une demande.

À ce stade, **les photos et les demandes fonctionnent déjà** (étape 6 pour les essayer). Les e-mails se mettent en attente : ils partiront dès que l'envoi sera branché.

---

## Étape 2 — Créer le compte d'envoi d'e-mails (Brevo)

On utilise **Brevo**, société française dont les données sont hébergées dans l'Union européenne. L'offre gratuite permet d'envoyer 300 e-mails par jour, ce qui suffit largement pour démarrer.

1. Aller sur **brevo.com** et créer un compte au nom d'ACG NET SPE.
2. **Adresse d'expédition** (cahier des charges, question 7) : dans Brevo, menu **Expéditeurs, domaines et IP dédiées** (*Senders, domains*), ajouter l'adresse d'envoi, par exemple `espace-client@acgnetspe.fr`, puis la valider avec le code reçu.
   - Pour que les e-mails n'arrivent pas dans les courriers indésirables, Brevo propose d'**authentifier le domaine** `acgnetspe.fr`. Cela consiste à ajouter quelques lignes dans les réglages du nom de domaine : c'est à faire par la personne qui gère le domaine (question 3).
   - En attendant, on peut faire les essais avec une adresse existante validée dans Brevo.
3. Menu **SMTP et API**, onglet **Clés API**, puis **Générer une nouvelle clé API**. Nom : `espace-client`. **Copier la clé** : elle ne s'affiche qu'une fois. Elle ira dans Supabase à l'étape 4, nulle part ailleurs.

---

## Étape 3 — Déployer la fonction d'envoi

1. Sur GitHub, ouvrir `supabase/functions/envoyer-emails/index.ts` et copier son contenu.
2. Supabase, **Edge Functions › Deploy a new function › Via Editor**.
3. **Nom : `envoyer-emails`**, exactement.
4. Remplacer le code d'exemple par le contenu copié, puis **Deploy function**.
5. Dans les réglages de la fonction (**Details** ou **Settings**), **désactiver « Verify JWT »** (« Enforce JWT verification »). Cette fonction n'est pas appelée par une personne connectée, mais par la base elle-même : elle est protégée par sa propre clé (étape 5).

---

## Étape 4 — Renseigner les réglages de la fonction

Supabase, **Edge Functions › Secrets** (ou **Manage secrets**). Ajouter :

| Nom | Valeur |
|---|---|
| `BREVO_API_KEY` | la clé API Brevo de l'étape 2 |
| `EMAIL_EXPEDITEUR` | l'adresse validée chez Brevo, par exemple `espace-client@acgnetspe.fr` |
| `SITE_URL` | l'adresse de l'espace client, par exemple `https://espace-client-acg.netlify.app` |

`CLE_ENVOI` sera ajoutée à l'étape suivante.

---

## Étape 5 — Programmer l'envoi automatique

1. Sur GitHub, ouvrir `supabase/taches_planifiees.sql` et copier son contenu.
2. **SQL Editor › New query**, coller.
3. **Avant de lancer**, remplacer `ADRESSE_DU_PROJET` (vers la ligne 30) par l'adresse du projet, celle notée au guide Supabase (étape 8), par exemple `https://abcdefghijkl.supabase.co`. Garder les guillemets simples autour.
4. **Run**. Le résultat affiche :
   - une longue clé, colonne `cle_a_copier_dans_CLE_ENVOI` ;
   - les deux tâches créées : l'envoi toutes les 5 minutes et la préparation des rappels chaque matin.
5. Retourner dans **Edge Functions › Secrets** et ajouter **`CLE_ENVOI`** avec cette clé.

Ce script peut être relancé sans risque : la clé ne change pas.

---

## Étape 6 — Essayer

Se connecter en administrateur.

| À faire | Résultat attendu |
|---|---|
| **Photos.** Fiche d'une intervention, bloc « Rapport, photos et documents » : type « Photo avant », choisir une ou plusieurs photos, puis « Déposer ». Recommencer avec « Photo après » | Les vignettes apparaissent. Les photos sont réduites automatiquement (une photo d'iPad de 4 Mo passe à environ 400 Ko) |
| Côté client (menu « Vue client », ou compte prêté au client A comme au guide de l'étape 2) : ouvrir l'intervention | Un bloc « Photos » avec les colonnes « Avant » et « Après ». Un toucher sur une photo l'ouvre en grand. Seulement si l'intervention est publiée |
| **Demande.** En client : Planning, puis « Changer la date » sur un passage. Indiquer une date souhaitée et un message, puis envoyer | « Demande envoyée » ; la demande apparaît avec le statut « Envoyée » |
| En administrateur : tableau de bord, puis **Demandes** | La demande apparaît. Écrire une réponse, choisir « Traitée », puis « Enregistrer » |
| Côté client : menu « Demandes » | La réponse et le statut « Traitée » s'affichent |
| **E-mails.** Tableau de bord, puis le lien « Journal des e-mails automatiques » (sous les passages) | Chaque e-mail préparé, avec son destinataire et son état. Il passe à « Envoyé » dans les 5 minutes |

**Les 4 e-mails automatiques :**

| E-mail | Quand | Destinataires |
|---|---|---|
| Rapport disponible | Au moment de « Publier » | Contacts du client ayant accès au site |
| Rappel de passage | 7 jours avant un passage **confirmé** (préparé chaque matin) | Contacts du client ayant accès au site |
| Réponse à votre demande | Quand ACG enregistre ou modifie une réponse | L'auteur de la demande |
| Nouvelle demande | Quand un client envoie une demande | L'équipe ACG (tous les administrateurs) |

Un contact peut être retiré des e-mails automatiques : **Clients › fiche du client › Gérer**, décocher « Reçoit les e-mails automatiques ».

**Si un e-mail reste « En attente » plus de 10 minutes** : vérifier les 4 secrets de l'étape 4 et 5. Le journal affiche le message d'erreur, par exemple une clé Brevo refusée. Un envoi raté est retenté jusqu'à 5 fois.

---

## Recommandé : les e-mails de connexion aussi par Brevo

Les e-mails de connexion (lien magique) et d'invitation sont envoyés par Supabase lui-même. Sans réglage, Supabase n'en envoie que quelques-uns par heure, et uniquement à l'équipe du projet. **Avant d'ouvrir l'espace aux clients pilotes, il faut lui faire utiliser Brevo :**

1. Dans Brevo, **SMTP et API**, onglet **SMTP** : noter le serveur (`smtp-relay.brevo.com`), le port (`587`), l'identifiant de connexion, puis générer une **clé SMTP**.
2. Supabase, **Authentication › Emails › SMTP Settings** : activer **Enable custom SMTP** et remplir :
   - **Sender email** : l'adresse validée chez Brevo ;
   - **Sender name** : `ACG NET SPE` ;
   - **Host**, **Port** et **Username** : les valeurs notées au point 1 ;
   - **Password** : la clé SMTP.
3. **Save**. Les invitations aux vrais clients arriveront alors normalement.
