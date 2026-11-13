# Guide : mettre en place et essayer l'administration (étape 3)

Prérequis : les étapes 1 et 2 sont faites (base Supabase, site Netlify, connexion qui fonctionne).
Compter environ 30 minutes.

Netlify se met à jour tout seul : dès que le code est envoyé sur GitHub, le site est reconstruit en une à deux minutes. Il n'y a rien à faire de ce côté.

---

## Étape 1 — Appliquer la migration 5

Elle permet à l'administrateur de voir où en est chaque invitation (en attente, dernière connexion).

1. Sur GitHub, ouvrir `supabase/migrations/20261113000005_administration.sql` et copier son contenu (**Copy raw file**).
2. Supabase, **SQL Editor › New query**, coller, puis **Run**. Résultat attendu : **Success. No rows returned**.
3. Relancer le test de sécurité : copier `supabase/tests/isolement.test.sql`, le coller dans une nouvelle requête, puis **Run**.
   **Résultat attendu : 69 lignes, toutes « OK »** (3 tests de plus qu'à l'étape 1).

---

## Étape 2 — Déployer la fonction d'invitation

Inviter ou supprimer un contact crée ou supprime un compte de connexion. Il faut pour cela la clé secrète de Supabase, qui ne doit jamais aller dans le navigateur. Cette petite fonction la garde côté serveur, et elle vérifie à chaque appel que la personne est bien un administrateur ACG.

1. Sur GitHub, ouvrir `supabase/functions/admin-contacts/index.ts` et copier son contenu.
2. Supabase, menu **Edge Functions**, puis **Deploy a new function › Via Editor** (éditeur dans le navigateur).
3. **Nom de la fonction : `admin-contacts`**, exactement. L'application l'appelle par ce nom.
4. Remplacer tout le code d'exemple par le contenu copié, puis cliquer sur **Deploy function**.
5. Laisser activé le réglage **Verify JWT** (ou « Enforce JWT verification ») s'il est proposé.

La fonction reçoit automatiquement de Supabase les clés dont elle a besoin. **Il n'y a aucune clé à copier nulle part.**

**Comment vérifier.** La fonction `admin-contacts` apparaît dans la liste des Edge Functions. Si, plus tard, l'application affiche « Le service d'invitation ne répond pas », vérifier le nom de la fonction.

---

## Étape 3 — Mettre l'e-mail d'invitation en français

1. Supabase, **Authentication › Emails**, onglet **Invite user**.
2. **Subject** : `Invitation à l'espace client ACG NET SPE`
3. **Body** : remplacer tout le contenu par :

```html
<div style="font-family: Arial, sans-serif; color: #2A3A47; max-width: 520px;">
  <p style="font-weight: bold; color: #0B1E2D; font-size: 18px;">
    <span style="display: inline-block; width: 14px; height: 14px; background: #FFC629; margin-right: 8px;"></span>ACG NET SPE
  </p>
  <p>Bonjour,</p>
  <p>ACG NET SPE vous invite à rejoindre votre espace client. Vous y retrouverez vos sites, l'historique de nos interventions, les rapports et les prochains passages.</p>
  <p>
    <a href="{{ .ConfirmationURL }}"
       style="display: inline-block; background: #0B1E2D; color: #FFFFFF; padding: 12px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">
      Accéder à mon espace client
    </a>
  </p>
  <p style="color: #5B6B78; font-size: 14px;">
    Ce lien ne fonctionne qu'une fois. Ensuite, pour vous connecter, il suffit de saisir votre adresse e-mail sur l'espace client : vous recevrez un lien de connexion, sans mot de passe.
  </p>
</div>
```

4. **Save changes**.

---

## Étape 4 — Essayer l'administration

Se connecter avec ton compte administrateur. On arrive directement sur le **Tableau de bord interne**.

| Écran | À essayer | Résultat attendu |
|---|---|---|
| Tableau de bord | Regarder les blocs | « Anomalies ouvertes » (3 panneaux cassés chez Démo A), passages à venir de A et B, échéance OLD |
| Clients | Créer un client « Client Test » | La fiche du client s'ouvre |
| Sites › Importer un CSV | Télécharger le modèle, choisir « Client Test » et le fichier du modèle | Aperçu de 2 sites, puis bouton « Importer 2 site(s) ». Une ligne en erreur s'affiche en rouge avec la raison |
| Fiche d'un site | Modifier un champ, puis « Enregistrer » | « Site enregistré. » |
| Planifier une intervention | Choisir un site, « Confirmé », une période | L'intervention apparaît aussitôt dans le planning **côté client** |
| Fiche intervention | Passer à « Réalisé », remplir le compte rendu, puis « Enregistrer les modifications » | « Intervention enregistrée. » ; le bouton jaune **Publier** devient actif |
| Rapport et documents | Déposer un PDF (type « Rapport ») | Le fichier apparaît dans la liste, avec un bouton « Ouvrir » |
| Publication | Cliquer sur **Publier** et confirmer | « Publiée le … ». Le client voit maintenant le compte rendu et le rapport |
| Tableau de bord | « Marquer traitée » sur une anomalie | L'alerte disparaît, aussi côté client |
| Vue client | Menu « Vue client » | Les écrans tels qu'un client les voit (avec les données de tous les clients) |

**Les notes internes** (fiche client et fiche intervention) ne sont jamais visibles par un client. Le test de sécurité le vérifie.

---

## Étape 5 — Essayer une invitation

**Limite importante.** Tant qu'aucun service d'envoi d'e-mails n'est branché (cahier des charges, question 7), Supabase n'envoie des e-mails qu'**aux membres de l'équipe du projet Supabase**, et seulement quelques-uns par heure. Une invitation envoyée à un vrai client n'arriverait donc pas.

Pour l'essayer dès maintenant :

1. Ajouter une deuxième personne à l'équipe Supabase, par exemple Christophe : tableau de bord Supabase, **Organization settings › Team › Invite**.
2. Dans l'application : **Clients › Client Test › Inviter un contact**, avec l'adresse de cette personne.
3. Elle reçoit l'e-mail « Invitation à l'espace client ACG NET SPE » et clique sur le bouton. Elle arrive sur l'espace client de « Client Test », et ne voit que ses sites.
4. Dans la fiche du client, son contact passe de « Invitation en attente » à « Dernière connexion le … ».
5. Essayer **Gérer › Accès aux sites** : en cochant un seul site, la personne ne voit plus que celui-là.
6. Pour finir, **Gérer › Supprimer le contact**.

**Avant d'ouvrir l'espace aux clients pilotes,** il faudra brancher un service d'envoi d'e-mails avec une adresse du domaine de l'entreprise (menu **Authentication › Emails › SMTP Settings**). On le fera à l'étape 5, une fois la question 7 tranchée.

---

## Ménage après les essais

Les clients, sites et interventions de test se suppriment depuis l'application :

1. supprimer les interventions (bouton « Supprimer » ; une intervention publiée doit d'abord être dépubliée) ;
2. supprimer ensuite les sites, puis les contacts, puis le client.

Les données de démonstration (Démo A et Démo B) peuvent rester : elles serviront pour le salon.
