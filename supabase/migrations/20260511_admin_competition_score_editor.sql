-- Admin helper RPCs to list and edit competition submissions (e.g. Masjid Al-Aqsa).
-- Works by discovering the competition submissions table in public schema based on expected columns.

create or replace function public._find_competition_submissions_table()
returns text
language plpgsql
stable
as $$
declare
  t text;
begin
  select table_name
  into t
  from (
    select table_name, count(*) as cnt
    from information_schema.columns
    where table_schema = 'public'
      and column_name in (
        'id',
        'competition_key',
        'full_name',
        'email',
        'status',
        'question_marks',
        'bonus_marks',
        'main_score',
        'total_score',
        'created_at'
      )
    group by table_name
  ) c
  where c.cnt = 10
  order by table_name
  limit 1;

  return t;
end;
$$;

create or replace function public.admin_list_competition_submissions(
  p_competition_key text,
  p_status text default 'all',
  p_limit int default 200,
  p_offset int default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tbl text;
  result jsonb;
  q text;
begin
  tbl := public._find_competition_submissions_table();
  if tbl is null then
    return jsonb_build_object('error', 'No competition submissions table found.');
  end if;

  q := format(
    'select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb)
     from (
       select *
       from %I
       where competition_key = $1
         and ($4 is null or $4 = ''all'' or status = $4)
       order by created_at desc
       limit $2 offset $3
     ) t',
    tbl
  );

  execute q into result using p_competition_key, p_limit, p_offset, p_status;
  return result;
end;
$$;

create or replace function public.admin_update_competition_submission(
  p_id uuid,
  p_question_marks int[],
  p_bonus_marks int,
  p_status text default null,
  p_admin_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tbl text;
  updated jsonb;
  q text;
begin
  tbl := public._find_competition_submissions_table();
  if tbl is null then
    raise exception 'No competition submissions table found.';
  end if;

  q := format(
    'update %I as t
     set question_marks = $2,
         bonus_marks = $3,
         status = coalesce($4, t.status),
         admin_notes = coalesce($5, t.admin_notes),
         reviewed_at = case when coalesce($4, t.status) in (''approved'',''rejected'') then timezone(''utc''::text, now()) else t.reviewed_at end
     where t.id = $1
     returning to_jsonb(t)',
    tbl
  );

  execute q into updated using p_id, p_question_marks, p_bonus_marks, p_status, p_admin_notes;
  return updated;
end;
$$;

