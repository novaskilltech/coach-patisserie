-- Reset complet du schema applicatif CAP Patissier.AI.
-- A utiliser uniquement si les tables ne contiennent pas encore de donnees a conserver.

drop table if exists public.coach_messages cascade;
drop table if exists public.recent_history cascade;
drop table if exists public.exam_sessions cascade;
drop table if exists public.quiz_results cascade;
drop table if exists public.user_sheet_statuses cascade;
drop table if exists public.user_favorites cascade;
drop table if exists public.user_notes cascade;
drop table if exists public.user_week_checklists cascade;
drop table if exists public.user_progress cascade;
drop table if exists public.profiles cascade;

drop function if exists public.set_updated_at() cascade;

-- Apres execution de ce fichier, executer supabase/schema.sql.
