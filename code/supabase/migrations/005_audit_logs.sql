-- Epic 8: Audit logs for all mutations

create table if not exists audit_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  entity_type text not null,
  entity_id   text not null,
  action      text not null,
  metadata    jsonb default '{}',
  ip_address  inet,
  user_agent  text,
  created_at  timestamptz not null default now()
);

-- Optimised for per-user timeline queries
create index if not exists audit_logs_user_created_idx
  on audit_logs (user_id, created_at desc);
create index if not exists audit_logs_entity_idx
  on audit_logs (entity_type, entity_id);

-- RLS — users only see their own log entries
alter table audit_logs enable row level security;

drop policy if exists "Users read own audit logs" on audit_logs;
create policy "Users read own audit logs"
  on audit_logs for select
  using (auth.uid() = user_id);

-- Service role writes bypass RLS by default
