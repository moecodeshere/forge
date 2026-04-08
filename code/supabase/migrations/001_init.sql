-- ============================================================
-- Forge AI Workflow Studio — Initial Schema Migration
-- Version: 001  (Postgres 17 compatible)
-- ============================================================

-- Extensions
-- uuid-ossp is registered but gen_random_uuid() is used (built-in PG 13+)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"   WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "vector"       WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pg_trgm"      WITH SCHEMA extensions;

-- ============================================================
-- USERS
-- Mirrors auth.users, auto-populated via trigger on signup.
-- ============================================================

CREATE TYPE user_role AS ENUM ('user', 'developer', 'enterprise_admin');

CREATE TABLE IF NOT EXISTS public.users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL UNIQUE,
  role        user_role NOT NULL DEFAULT 'user',
  full_name   TEXT,
  avatar_url  TEXT,
  bio         TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Shared updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- GRAPHS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.graphs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 128),
  description TEXT CHECK (char_length(description) <= 512),
  -- "content" matches the API code (graphs router + frontend)
  content     JSONB NOT NULL DEFAULT '{"nodes":[],"edges":[],"viewport":{"x":0,"y":0,"zoom":1}}',
  version     INTEGER NOT NULL DEFAULT 1,
  is_public   BOOLEAN NOT NULL DEFAULT FALSE,
  -- marketplace attribution
  original_listing_id UUID,
  original_author_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER graphs_updated_at
  BEFORE UPDATE ON public.graphs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_graphs_user_updated ON public.graphs (user_id, updated_at DESC);
CREATE INDEX idx_graphs_public       ON public.graphs (is_public, updated_at DESC) WHERE is_public = TRUE;

-- ============================================================
-- GRAPH_RUNS
-- ============================================================

CREATE TYPE graph_run_status AS ENUM (
  'pending', 'running', 'paused', 'completed', 'failed', 'cancelled'
);

CREATE TABLE IF NOT EXISTS public.graph_runs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_id     UUID NOT NULL REFERENCES public.graphs(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status       graph_run_status NOT NULL DEFAULT 'pending',
  input        JSONB,
  output       JSONB,
  error        TEXT,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_runs_graph_started ON public.graph_runs (graph_id, started_at DESC);
CREATE INDEX idx_runs_user_started  ON public.graph_runs (user_id,  started_at DESC);
CREATE INDEX idx_runs_user_status   ON public.graph_runs (user_id, status) WHERE status IN ('pending','running');

-- ============================================================
-- CHECKPOINTS
-- "run_id" matches execution service; AES-256 encrypted at app layer.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.checkpoints (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id     UUID NOT NULL REFERENCES public.graph_runs(id) ON DELETE CASCADE,
  node_id    TEXT NOT NULL,
  state      JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_checkpoints_run_created ON public.checkpoints (run_id, created_at DESC);

-- ============================================================
-- DEPLOYMENTS
-- "type" and "status" use plain TEXT to match the API router strings.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.deployments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_id    UUID NOT NULL REFERENCES public.graphs(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('cloud','mcp','code','docker')),
  status      TEXT NOT NULL DEFAULT 'deploying'
                CHECK (status IN ('deploying','active','failed','stopped')),
  metadata    JSONB DEFAULT '{}',
  error       TEXT,
  deployed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER deployments_updated_at
  BEFORE UPDATE ON public.deployments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_deployments_graph ON public.deployments (graph_id, created_at DESC);
CREATE INDEX idx_deployments_user  ON public.deployments (user_id,  created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY (policies in 002_rls.sql)
-- ============================================================

ALTER TABLE public.users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graphs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_runs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deployments ENABLE ROW LEVEL SECURITY;
