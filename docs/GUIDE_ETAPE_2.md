# Guide : essayer la connexion et les écrans client (étape 2)

Prérequis : l'étape 1 est faite (projet Supabase, migrations, données de démonstration, test d'isolement tout « OK », compte administrateur créé).

Pour essayer l'application depuis un iPad, il faut la mettre en ligne. On utilise Netlify, prévu pour la mise en service. Cette mise en ligne d'essai sera réutilisée à l'étape 5. Compter environ 30 minutes.

---

## Étape 1 — Mettre l'application en ligne sur Netlify

1. Aller sur **netlify.com** et s'inscrire avec **Sign up with GitHub**. Choisir l'offre gratuite.
2. **Add new site › Import an existing project › GitHub**. Autoriser Netlify à voir le dépôt `Espace-client`, puis le choisir.
3. Dans les réglages proposés :
   - **Branch to deploy** : `claude/espace-client-acg-aztjjq`. Ce sera `main` quand le travail y aura été fusionné.
   - **Build command** et **Publish directory** sont pré-remplis grâce au fichier `netlify.toml`. Ne rien changer.
4. Dans **Environment variables** (bouton **Add environment variables**), ajouter les deux valeurs notées à l'étape 8 du guide Supabase :

   | Key | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | l'adresse du projet, `https://xxxxxxxx.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | la clé **anon** / **publishable** |

   **Jamais la clé `service_role` / `secret`.**
5. Cliquer sur **Deploy**. Au bout d'une à deux minutes, Netlify affiche l'adresse du site, de la forme `https://nom-au-hasard.netlify.app`. On peut la rendre plus lisible avec **Site configuration › Change site name**, par exemple `espace-client-acg`.

**Comment vérifier.** En ouvrant l'adresse Netlify, on doit voir l'écran « Connexion » aux couleurs ACG. Si l'écran affiche « Configuration incomplète », une variable de l'étape 4 manque ou est mal orthographiée. La corriger, puis relancer avec **Deploys › Trigger deploy**.

---

## Étape 2 — Indiquer à Supabase l'adresse du site

Sans ce réglage, le lien reçu par e-mail renverrait vers une mauvaise adresse.

1. Supabase, menu **Authentication › URL Configuration**.
2. **Site URL** : coller l'adresse Netlify, par exemple `https://espace-client-acg.netlify.app`.
3. **Redirect URLs › Add URL** : la même adresse suivie de `/**`, par exemple `https://espace-client-acg.netlify.app/**`.
4. **Save**.

---

## Étape 3 — Mettre l'e-mail de connexion en français

Par défaut, Supabase envoie un e-mail en anglais.

1. Menu **Authentication › Emails** (ou **Email Templates**), onglet **Magic Link**.
2. **Subject** : `Votre lien de connexion – Espace client ACG NET SPE`
3. **Body** : remplacer tout le contenu par :

```html
<div style="font-family: Arial, sans-serif; color: #2A3A47; max-width: 520px;">
  <p style="font-weight: bold; color: #0B1E2D; font-size: 18px;">
    <span style="display: inline-block; width: 14px; height: 14px; background: #FFC629; margin-right: 8px;"></span>ACG NET SPE
  </p>
  <p>Bonjour,</p>
  <p>Pour accéder à votre espace client ACG NET SPE, cliquez sur le bouton ci-dessous :</p>
  <p>
    <a href="{{ .ConfirmationURL }}"
       style="display: inline-block; background: #0B1E2D; color: #FFFFFF; padding: 12px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">
      Se connecter
    </a>
  </p>
  <p style="color: #5B6B78; font-size: 14px;">
    Ce lien est valable une heure et ne fonctionne qu'une fois. Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet e-mail.
  </p>
</div>
```

4. **Save changes**.

**À savoir.** Tant qu'aucun service d'envoi d'e-mails n'est branché (cahier des charges, question 7), Supabase envoie très peu d'e-mails : quelques-uns par heure. Il les envoie seulement aux adresses des membres de l'équipe du projet Supabase, donc la tienne. Si le lien n'arrive pas, attendre un peu avant de redemander. Ces limites disparaîtront à la mise en service.

---

## Étape 4 — Se connecter en tant qu'administrateur

1. Ouvrir l'adresse Netlify et saisir l'adresse e-mail du compte administrateur créé à l'étape 7 du guide Supabase.
2. Ouvrir l'e-mail reçu et toucher **Se connecter**.

**Comment vérifier.** On arrive sur le **Tableau de bord**, avec un bandeau bleu « Vous êtes connecté en tant qu'administrateur ». En administrateur, on voit les données **des deux clients de démonstration**. C'est normal : les écrans d'administration arrivent à l'étape 3.

---

## Étape 5 — Voir l'espace exactement comme un client

Pour se mettre dans la peau du client A sans créer d'autre adresse e-mail, on « prête » temporairement son propre compte à l'organisation Exploitant Démo A.

1. Supabase, **SQL Editor › New query**, coller le texte ci-dessous en remplaçant l'adresse, puis **Run** :

```sql
-- Devenir temporairement un contact du client A
update public.profils
set role = 'client', organisation_id = 'a0000000-0000-4000-8000-000000000001'
where email = 'ton.adresse@exemple.fr';
```

2. Dans l'application, recharger la page.

**Ce que tu dois constater** (en tant que client A) :

| Écran | Attendu |
|---|---|
| Tableau de bord | Une alerte « Échéance OLD proche » et une alerte « 3 panneaux cassés » ; les chiffres de l'année ; 3 prochains passages ; 2 rapports |
| Mes sites | 4 sites, aucun de « Exploitant Démo B ». Les filtres par type et par département fonctionnent. Deux sites affichent « À planifier » |
| Fiche d'un site | Les informations, puis l'historique en frise, le plus récent en haut. Le bouton « Rapport » ouvre le PDF (si les PDF ont été déposés, étape 6 du guide Supabase) |
| Intervention | Encrassement sur 10, bon de commande, anomalies, rapport. Pour un passage seulement prévu : « Le compte rendu […] sera disponible après le passage » |
| Planning | Les passages à venir regroupés par site, avec « Proposé » ou « Confirmé » |
| Mon compte | Ton nom et la liste des utilisateurs de l'organisation A |

3. **Test d'isolement à la main.** Coller dans la barre d'adresse l'adresse Netlify suivie de `/sites/b2000000-0000-4000-8000-000000000001`, l'identifiant du site de B. L'écran doit afficher **« Page introuvable »**.

4. **Redevenir administrateur** (important) :

```sql
update public.profils
set role = 'admin', organisation_id = null
where email = 'ton.adresse@exemple.fr';
```

---

## Étape 6 — Vérifier les messages d'erreur

- Se déconnecter, puis saisir une adresse **non invitée** (par exemple `test@example.com`). Le message « Cette adresse n'a pas été invitée à l'espace client » doit s'afficher.
- Retoucher un lien de connexion **déjà utilisé**. L'application doit afficher « Ce lien de connexion a expiré ou a déjà été utilisé ».

---

## En cas de problème

Me décrire avec des mots simples ce qui ne va pas : l'écran concerné, ce qui était attendu et ce qui s'affiche (une capture d'écran aide beaucoup). Pour un message d'erreur, le copier tel quel.
