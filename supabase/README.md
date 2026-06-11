# Supabase setup

Ce dossier contient le socle backend recommande pour CAP Patissier.AI.

## 1. Creation du projet

1. Creer un projet Supabase.
2. Ouvrir `SQL Editor`.
3. Executer le fichier `supabase/schema.sql`.
4. Activer l'authentification email/password dans `Authentication > Providers`.

Si Supabase affiche `ERROR: 42703: column "user_id" does not exist`, cela veut dire qu'une table existait deja avec une ancienne structure.

Option diagnostic non destructive :

```sql
-- executer supabase/diagnose-schema.sql
```

Option reset si aucune donnee n'est a conserver :

```sql
-- 1. executer supabase/reset-schema.sql
-- 2. executer supabase/schema.sql
```

Alternative locale avec `psql` :

```powershell
$env:SUPABASE_DB_URL="postgresql://postgres.tqbcmcddnohnqmcxvgut:MOT_DE_PASSE@aws-0-REGION.pooler.supabase.com:5432/postgres"
.\supabase\apply-schema.ps1
```

Connexion directe fournie par Supabase :

```text
postgresql://postgres:MOT_DE_PASSE@db.tqbcmcddnohnqmcxvgut.supabase.co:5432/postgres
```

Sur cette machine, `db.tqbcmcddnohnqmcxvgut.supabase.co` ne resout pas. Utiliser plutot le `Session Pooler` dans Supabase `Project Settings > Database > Pooler settings`.

## 2. Variables a prevoir

Cote navigateur, seules les valeurs publiques doivent etre exposees :

Projet actuel (statique, sans Next.js) :

```js
// public/supabase-config.js
window.NOVASKILLTECH_SUPABASE = {
  url: "https://votre-projet.supabase.co",
  anonKey: "votre-cle-anon-publique"
};
```

Variables egalement presentes pour compatibilite future Next/Vercel :

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

La cle `service_role` ne doit jamais etre mise dans `public/app.js`.

Pour que Codex fasse la connexion lui-meme, fournir temporairement :

- `SUPABASE_DB_URL` : URL Postgres depuis Supabase `Project Settings > Database`.
- `SUPABASE_URL` : URL API du projet.
- `SUPABASE_ANON_KEY` : cle publique anon.

Ne jamais envoyer la cle `service_role` si l'URL Postgres suffit pour appliquer le schema.

## 3. Migration conseillee

Phase 1 :
- garder `localStorage` comme cache local ;
- ajouter un bouton "Synchroniser" apres connexion ;
- envoyer progression, notes, favoris, checklist et statuts vers Supabase.

Phase 2 :
- lire depuis Supabase au demarrage si l'utilisateur est connecte ;
- conserver une sauvegarde locale en secours.

Phase 3 :
- stocker l'historique coach par semaine + seance seulement si l'utilisateur l'accepte.

## 4. Google Auth

Le bouton Google de l'application utilise :

```js
supabase.auth.signInWithOAuth({
  provider: "google",
  options: { redirectTo: window.location.origin }
});
```

Configuration a faire dans Supabase :

1. Aller dans `Authentication > Providers > Google`.
2. Activer Google.
3. Copier le `Callback URL` affiche par Supabase.
4. Dans Google Cloud Console, creer un OAuth Client ID de type `Web application`.
5. Ajouter dans `Authorized JavaScript origins` :
   - `http://localhost:8080`
   - le domaine de production quand il existe.
6. Ajouter dans `Authorized redirect URIs` le callback Supabase, par exemple :
   - `https://tqbcmcddnohnqmcxvgut.supabase.co/auth/v1/callback`
7. Copier le `Client ID` et le `Client Secret` Google dans Supabase.
8. Dans `Authentication > URL Configuration`, ajouter les redirect URLs autorisees :
   - `http://localhost:8080`
   - le domaine de production quand il existe.

## 5. Tables principales

- `profiles`
- `user_progress`
- `user_week_checklists`
- `user_notes`
- `user_favorites`
- `user_sheet_statuses`
- `quiz_results`
- `exam_sessions`
- `recent_history`
- `coach_messages`

Toutes les tables utilisateur ont le Row Level Security active avec une policy proprietaire basee sur `auth.uid()`.
