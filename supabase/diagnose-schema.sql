select
  table_name,
  bool_or(column_name = 'user_id') as has_user_id,
  string_agg(column_name, ', ' order by ordinal_position) as columns
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'profiles',
    'user_progress',
    'user_week_checklists',
    'user_notes',
    'user_favorites',
    'user_sheet_statuses',
    'quiz_results',
    'exam_sessions',
    'recent_history',
    'coach_messages'
  )
group by table_name
order by table_name;
