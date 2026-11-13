# Espace client ACG NET SPE – Cahier des charges

13/11/2026 · Keryann Garvi

Un site sécurisé où chaque exploitant client retrouve ses centrales, l'historique des interventions, ses rapports et la date de son prochain passage. L'équipe ACG NET SPE y planifie les interventions, dépose les rapports et les publie. C'est un argument commercial fort : le client n'a plus à chercher un rapport dans ses mails, il a tout au même endroit.

## 1. Périmètre et versions

Deux types d'utilisateurs :

- **Client** (exploitant, asset manager, responsable maintenance) : il consulte les données de son organisation et envoie des demandes.
- **Administrateur ACG NET SPE** : il gère les clients, les sites et les interventions, et publie les rapports.

| Version | Contenu | Objectif |
|---|---|---|
| V1 | Connexion, sites, historique des interventions, rapports PDF, prochains passages ; côté ACG : clients, sites, interventions, dépôt et publication des rapports | Utilisable avec un ou deux clients pilotes |
| V2 | Photos avant/après, demandes des clients, e-mails automatiques, carte des sites | Outil complet au quotidien |
| V3 | Lien avec l'application de rapport terrain, statistiques (surfaces, encrassement), exports | Moins de saisie, plus de valeur pour le client |

## 2. Technique et hébergement

| Choix | Valeur retenue | Pourquoi |
|---|---|---|
| Interface | Vite, React et TypeScript | Même base que le calculateur de devis |
| Base de données, connexion, fichiers | Supabase : PostgreSQL, Auth, Storage | Tout-en-un ; la sécurité ligne par ligne (Row Level Security) garantit qu'un client ne voit que ses données |
| Région des données | Supabase « West EU (Paris) », eu-west-3 | Données hébergées en France, dans l'Union européenne |
| Connexion des clients | Lien magique envoyé par e-mail, sans mot de passe | Plus simple pour les clients, moins de mots de passe oubliés |
| Hébergement de l'interface | Netlify | L'offre gratuite autorise un usage commercial, contrairement à l'offre gratuite de Vercel |
| Adresse | espace-client.acgnetspe.fr | À confirmer (question 3) |

**Coûts.** L'offre gratuite de Supabase suffit pour développer (500 Mo de base, 1 Go de fichiers), mais un projet gratuit est mis en pause après une semaine d'inactivité : ce n'est pas acceptable pour de vrais clients. À la mise en service, passer à l'offre Pro, à partir de 25 $ par mois (8 Go de base, 100 Go de fichiers, sauvegardes quotidiennes conservées 7 jours).

## 3. Rôles et sécurité

| Règle | Détail |
|---|---|
| Isolement des clients | Row Level Security sur toutes les tables : un utilisateur ne lit que les lignes de son organisation |
| Accès par site (option) | Un contact client peut être limité à certains sites seulement |
| Fichiers | Stockage privé ; téléchargement par liens signés valables 1 heure |
| Publication | Une intervention, son rapport et ses photos ne sont visibles du client qu'après « Publier » côté ACG |
| Notes internes | Dans une table séparée, réservée aux administrateurs, jamais lisible par un client |
| Secrets | Aucune clé dans le dépôt : fichier .env local et .env.example sans valeurs |
| Données du dépôt | Uniquement des données de démonstration fictives, jamais de vraies données client |
| RGPD | Données dans l'UE ; données personnelles limitées au nom, à la fonction, à l'e-mail et au téléphone des contacts ; page « Mentions légales et confidentialité » ; suppression d'un compte sur demande |

**Test obligatoire** : un utilisateur de l'organisation A ne voit aucun site, aucune intervention et aucun fichier de l'organisation B, même en devinant un identifiant.

## 4. Écrans côté client

1. **Connexion.** Saisie de l'e-mail, réception d'un lien de connexion. Message clair si l'adresse n'est pas invitée.
2. **Tableau de bord.**
   - Les 3 prochains passages (site, prestation, date ou période, statut).
   - Les 3 derniers rapports publiés, téléchargeables.
   - Alertes : anomalies signalées non traitées (panneaux cassés), échéance OLD à moins de 60 jours.
   - Chiffres de l'année civile : surface nettoyée (m²), surface débroussaillée (ha), nombre d'interventions.
3. **Mes sites.** Liste filtrable par type d'installation et par département. Fiche site : informations, historique des interventions en frise (la plus récente en haut), documents.
4. **Intervention.** Type, dates, surface traitée, niveau d'encrassement sur 10, anomalies (nombre de panneaux cassés et emplacement), numéro de bon de commande, rapport PDF à télécharger ; photos avant/après en V2.
5. **Planning.** Les passages à venir par site, avec leur statut (Proposé, Confirmé, Réalisé). Bouton « Demander un changement de date » (V2).
6. **Demandes (V2).** Formulaire : nouvelle intervention, demande de devis, signaler un problème. Suivi du statut : Envoyée, Prise en compte, Traitée.
7. **Mon compte.** Nom, e-mail, liste des utilisateurs de mon organisation.

## 5. Écrans côté ACG NET SPE (administration)

1. **Clients.** Organisations, contacts, invitations par e-mail, accès limités à certains sites.
2. **Sites.** Création, modification, import d'une liste au format CSV.
3. **Interventions.** Planifier (date précise ou période), saisir le compte rendu, déposer le rapport PDF (et les photos en V2), puis Publier.
4. **Demandes (V2).** Liste des demandes reçues, changement de statut, réponse.
5. **Tableau de bord interne.** Passages à venir tous clients confondus, rapports réalisés mais pas encore publiés, anomalies ouvertes.

## 6. Modèle de données

| Table | Champs principaux |
|---|---|
| organisations | id, nom, adresse, notes |
| profils | id (lié au compte Auth), organisation_id, nom, fonction, téléphone, rôle (admin ou client) |
| acces_sites | profil_id, site_id (seulement si l'accès est limité à certains sites) |
| sites | id, organisation_id, nom, code_interne, commune, département, type_installation (sol, trackers, toiture, ombrière), surface_modules_m2, surface_vegetation_ha, soumis_old, date_limite_old, latitude, longitude |
| interventions | id, site_id, type (nettoyage, débroussaillage intérieur, OLD, élagage, autre), statut (proposée, confirmée, réalisée, annulée), début_prévu, fin_prévue, début_réel, fin_réelle, surface_m2, surface_ha, encrassement (1 à 10), panneaux_cassés, anomalies, anomalie_traitée, bon_commande, publiée, publiée_le |
| interventions_internes | intervention_id, notes_internes (administrateurs uniquement) |
| fichiers | id, intervention_id ou site_id, type (rapport, photo avant, photo après, document), chemin de stockage, nom, taille, ajouté_le |
| demandes (V2) | id, organisation_id, site_id, type, message, statut, créée_le, réponse |

## 7. Règles de fonctionnement

1. **Prochain passage d'un site** : la première intervention proposée ou confirmée dont la date de début est aujourd'hui ou plus tard. S'il n'y en a pas, afficher « À planifier ».
2. **Alerte OLD** : un site soumis aux OLD dont la date limite approche à moins de 60 jours, sans intervention OLD réalisée depuis la date limite précédente.
3. **Alerte anomalie** : une intervention publiée avec des panneaux cassés reste en alerte jusqu'à ce qu'un administrateur la marque « traitée ».
4. **Chiffres de l'année** : somme des surfaces des interventions réalisées et publiées dans l'année civile en cours.
5. **Formats** : dates au format JJ/MM/AAAA, heure de Paris, surfaces au format 52 763 m² et 12,5 ha.
6. **E-mails (V2)** : rapport publié ; rappel 7 jours avant un passage confirmé ; réponse à une demande. Pour la mise en service, configurer un service d'envoi d'e-mails (SMTP) avec une adresse du domaine de l'entreprise.

## 8. Données de démonstration

Fictives, pour développer, tester et faire des démonstrations commerciales (salon EnerGaïa des 9 et 10 décembre 2026, par exemple) :

- Organisation « Exploitant Démo A » : 4 sites (un au sol, un sur trackers, une toiture, une ombrière), dont un soumis aux OLD ; 10 interventions passées publiées, 3 planifiées ; 2 rapports PDF factices ; 1 anomalie ouverte.
- Organisation « Exploitant Démo B » : 1 site et 2 interventions, pour vérifier l'isolement entre clients.
- Un compte administrateur de démonstration et un compte client de démonstration par organisation.

## 9. Charte graphique

Même identité que les books et guides : bleu nuit #0B1E2D, jaune #FFC629, fond clair #F6F5F1, texte #2A3A47, police Inter, mot-symbole « ACG NET SPE » précédé d'un carré jaune. Style sobre et professionnel, sans emoji. Lisible sur ordinateur, iPad et téléphone.

## 10. Questions à trancher avec Christophe

- [ ] 1. Quels clients pilotes, et sont-ils d'accord pour recevoir leurs rapports par une plateforme ? Vérifier les clauses de confidentialité des contrats et plans de prévention.
- [ ] 2. Quels documents partager : rapports, photos, plans de prévention, attestations OLD, factures ?
- [ ] 3. Adresse espace-client.acgnetspe.fr : qui gère le nom de domaine acgnetspe.fr ?
- [ ] 4. Qui saisit et publie les interventions côté ACG ?
- [ ] 5. Budget d'hébergement à la mise en service (offre Pro de Supabase, à partir de 25 $ par mois) validé ?
- [ ] 6. Sous quelle forme sont les rapports actuels (PDF, nommage) pour les déposer tels quels en V1 ?
- [ ] 7. Adresse d'envoi des e-mails : créer une adresse sur le domaine de l'entreprise (l'adresse Gmail actuelle convient mal aux envois automatiques).
- [ ] 8. Qui rédige et valide la page « Mentions légales et confidentialité » ?

## 11. Décisions prises lors du cadrage (13/11/2026)

1. Un passage proposé ou confirmé est visible du client dès sa planification ; le compte rendu (surfaces, encrassement, anomalies, bon de commande), le rapport et les photos ne le sont qu'après « Publier ». Une intervention réalisée mais non publiée est entièrement cachée au client.
2. « Mon compte » est en lecture seule en V1 : les coordonnées des contacts sont modifiées par ACG.
3. Les comptes de démonstration du dépôt utilisent des adresses fictives en @example.com ; les vrais comptes de démonstration (adresses contrôlées par ACG) sont créés à la mise en ligne.
4. En V1, les clients ne déposent aucun fichier.
