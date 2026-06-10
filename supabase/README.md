# Supabase setup

Ce dossier contient le socle backend recommande pour CAP Patissier.AI.

## 1. Creation du projet

1. Creer un projet Supabase.
2. Ouvrir `SQL Editor`.
3. Executer le fichier `supabase/schema.sql`.
4. Activer l'authentification email/password dans `Authentication > Providers`.

## 2. Variables a prevoir

Cote navigateur, seules les valeurs publiques doivent etre exposees :

```js
// public/supabase-config.js
window.NOVASKILLTECH_SUPABASE = {
  url: "https://votre-projet.supabase.co",
  anonKey: "votre-cle-anon-publique"
};
```

La cle `service_role` ne doit jamais etre mise dans `public/app.js`.

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

## 4. Tables principales

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
