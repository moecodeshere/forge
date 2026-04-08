-- Epic 4: RAG document store with pgvector
-- vector extension was installed WITH SCHEMA extensions in 001_init.sql
-- All vector types and operators are therefore in the extensions schema.

-- Re-ensure vector is enabled (idempotent)
CREATE EXTENSION IF NOT EXISTS vector SCHEMA extensions;

create table if not exists documents (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  collection_id uuid not null,
  content       text not null,
  embedding     extensions.vector(1536),
  metadata      jsonb default '{}',
  created_at    timestamptz not null default now()
);

create index if not exists documents_user_id_idx    on documents (user_id);
create index if not exists documents_collection_idx on documents (collection_id);
-- ivfflat index — lists=100 is fine for dev; raise to 1000 in production
create index if not exists documents_embedding_idx  on documents
  using ivfflat (embedding extensions.vector_cosine_ops) with (lists = 100);

-- RLS
alter table documents enable row level security;

drop policy if exists "Users manage own documents" on documents;
create policy "Users manage own documents"
  on documents for all
  using (auth.uid() = user_id);

-- ----------------------------------------------------------------
-- RPC: cosine similarity search (no collection filter)
-- OPERATOR(extensions.<=>) schema-qualifies the operator so it is
-- found at function-creation time regardless of search_path.
-- ----------------------------------------------------------------
create or replace function match_documents(
  query_embedding   extensions.vector(1536),
  match_count       int    default 5,
  match_threshold   float  default 0.65
)
returns table (
  id         uuid,
  content    text,
  metadata   jsonb,
  similarity float
)
language sql stable
set search_path = extensions, public
as $$
  select
    d.id,
    d.content,
    d.metadata,
    1 - (d.embedding OPERATOR(extensions.<=>) query_embedding) as similarity
  from public.documents d
  where 1 - (d.embedding OPERATOR(extensions.<=>) query_embedding) >= match_threshold
  order by d.embedding OPERATOR(extensions.<=>) query_embedding
  limit match_count;
$$;

-- ----------------------------------------------------------------
-- RPC: cosine similarity search filtered by collection
-- ----------------------------------------------------------------
create or replace function match_documents_with_collection(
  query_embedding   extensions.vector(1536),
  collection_id     uuid,
  match_count       int   default 5,
  match_threshold   float default 0.65
)
returns table (
  id         uuid,
  content    text,
  metadata   jsonb,
  similarity float
)
language sql stable
set search_path = extensions, public
as $$
  select
    d.id,
    d.content,
    d.metadata,
    1 - (d.embedding OPERATOR(extensions.<=>) query_embedding) as similarity
  from public.documents d
  where
    d.collection_id = match_documents_with_collection.collection_id
    and 1 - (d.embedding OPERATOR(extensions.<=>) query_embedding) >= match_threshold
  order by d.embedding OPERATOR(extensions.<=>) query_embedding
  limit match_count;
$$;
