-- Cold Call Guide schema. Apply in the Supabase SQL Editor or through a tracked migration.
-- The public demo uses fictional records only. The backend key stays server-side.

create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  prospect_name text,
  company_name text,
  current_stage smallint not null default 1 check (current_stage between 1 and 8),
  last_stage smallint check (last_stage between 1 and 8),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  outcome text check (outcome in (
    'agreed_to_receive_report',
    'call_again',
    'do_not_call',
    'follow_up',
    'interested',
    'moved_company',
    'next_step_agreed',
    'not_interested',
    'not_logged',
    'wrong_person'
  )),
  agreed_next_step text,
  latest_note text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ai_summary text
);

create table if not exists public.stage_results (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls(id) on delete cascade,
  stage_number smallint not null check (stage_number between 1 and 8),
  event text not null,
  prospect_words text not null default '',
  notes text not null default '',
  idempotency_key uuid,
  created_at timestamptz not null default now()
);

create index if not exists calls_started_at_idx
  on public.calls (created_at desc);

create index if not exists stage_results_call_stage_created_idx
  on public.stage_results (call_id, stage_number, created_at desc);

create unique index if not exists stage_results_close_idempotency_idx
  on public.stage_results (call_id, idempotency_key)
  where idempotency_key is not null;

-- Browser/anon and authenticated roles receive no direct data access. The app talks to
-- FastAPI, which uses a server-only Supabase secret key. RLS remains enabled as defense-in-depth.
alter table public.calls enable row level security;
alter table public.stage_results enable row level security;

revoke all on table public.calls, public.stage_results from anon, authenticated;
grant select, insert, update, delete on table public.calls, public.stage_results to service_role;

-- Insert a stage result and update the call summary fields in one PostgreSQL transaction.
create or replace function public.save_call_stage_atomic(
  p_call_id uuid,
  p_stage_number smallint,
  p_event text,
  p_prospect_words text,
  p_notes text,
  p_created_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_call public.calls%rowtype;
  v_stage public.stage_results%rowtype;
begin
  select * into v_call
  from public.calls
  where id = p_call_id
  for update;

  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;
  if v_call.status = 'completed' then
    return jsonb_build_object('error', 'completed');
  end if;

  insert into public.stage_results (
    call_id, stage_number, event, prospect_words, notes, created_at
  ) values (
    p_call_id, p_stage_number, p_event, coalesce(p_prospect_words, ''), coalesce(p_notes, ''), p_created_at
  ) returning * into v_stage;

  update public.calls
  set current_stage = p_stage_number,
      last_stage = p_stage_number,
      latest_note = coalesce(
        nullif(btrim(coalesce(p_notes, '')), ''),
        nullif(btrim(coalesce(p_prospect_words, '')), ''),
        latest_note
      ),
      updated_at = p_created_at
  where id = p_call_id
  returning * into v_call;

  return jsonb_build_object('call', to_jsonb(v_call), 'stage_result', to_jsonb(v_stage));
end;
$$;

-- Lock the parent call, save the final stage and close outcome in one transaction.
-- The caller supplies one UUID per unchanged close payload; identical retries replay the
-- first response, while a reused key with different data is rejected.
create or replace function public.close_call_atomic(
  p_call_id uuid,
  p_stage_number smallint,
  p_event text,
  p_prospect_words text,
  p_notes text,
  p_outcome text,
  p_agreed_next_step text,
  p_idempotency_key uuid,
  p_now timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_call public.calls%rowtype;
  v_stage public.stage_results%rowtype;
begin
  select * into v_call
  from public.calls
  where id = p_call_id
  for update;

  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;
  if p_idempotency_key is null then
    return jsonb_build_object('error', 'missing_idempotency_key');
  end if;

  select * into v_stage
  from public.stage_results
  where call_id = p_call_id and idempotency_key = p_idempotency_key
  limit 1;

  if found then
    if v_call.status = 'completed'
      and v_call.outcome = p_outcome
      and v_call.agreed_next_step is not distinct from p_agreed_next_step
      and v_stage.stage_number = p_stage_number
      and v_stage.event = p_event
      and v_stage.prospect_words = coalesce(p_prospect_words, '')
      and v_stage.notes = coalesce(p_notes, '') then
      return jsonb_build_object(
        'call', to_jsonb(v_call),
        'stage_result', to_jsonb(v_stage),
        'replayed', true
      );
    end if;
    return jsonb_build_object('error', 'idempotency_conflict');
  end if;

  if v_call.status = 'completed' then
    return jsonb_build_object('error', 'completed');
  end if;

  select * into v_stage
  from public.stage_results
  where call_id = p_call_id
  order by created_at desc, id desc
  limit 1
  for update;

  if found
    and v_stage.idempotency_key is null
    and v_stage.stage_number = p_stage_number
    and v_stage.event = p_event
    and v_stage.prospect_words = coalesce(p_prospect_words, '')
    and v_stage.notes = coalesce(p_notes, '') then
    update public.stage_results
    set idempotency_key = p_idempotency_key
    where id = v_stage.id
    returning * into v_stage;
  else
    insert into public.stage_results (
      call_id, stage_number, event, prospect_words, notes, idempotency_key, created_at
    ) values (
      p_call_id, p_stage_number, p_event, coalesce(p_prospect_words, ''),
      coalesce(p_notes, ''), p_idempotency_key, p_now
    ) returning * into v_stage;
  end if;

  update public.calls
  set status = 'completed',
      current_stage = p_stage_number,
      last_stage = p_stage_number,
      outcome = p_outcome,
      agreed_next_step = p_agreed_next_step,
      latest_note = coalesce(
        nullif(btrim(coalesce(p_notes, '')), ''),
        nullif(btrim(coalesce(p_prospect_words, '')), ''),
        latest_note
      ),
      ended_at = p_now,
      updated_at = p_now
  where id = p_call_id
  returning * into v_call;

  return jsonb_build_object(
    'call', to_jsonb(v_call),
    'stage_result', to_jsonb(v_stage),
    'replayed', false
  );
end;
$$;

revoke all on function public.save_call_stage_atomic(uuid, smallint, text, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.save_call_stage_atomic(uuid, smallint, text, text, text, timestamptz)
  to service_role;

revoke all on function public.close_call_atomic(uuid, smallint, text, text, text, text, text, uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.close_call_atomic(uuid, smallint, text, text, text, text, text, uuid, timestamptz)
  to service_role;
