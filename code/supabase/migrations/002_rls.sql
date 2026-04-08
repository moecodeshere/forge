-- ============================================================
-- Forge AI Workflow Studio — RLS Policies
-- Version: 002
-- ============================================================

-- USERS: each user can read and update only their own profile.
DROP POLICY IF EXISTS users_select_own ON public.users;
CREATE POLICY users_select_own
ON public.users
FOR SELECT
USING (auth.uid() = id);

DROP POLICY IF EXISTS users_update_own ON public.users;
CREATE POLICY users_update_own
ON public.users
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- GRAPHS: owner-only access, plus public read for published graphs.
DROP POLICY IF EXISTS graphs_select_own_or_public ON public.graphs;
CREATE POLICY graphs_select_own_or_public
ON public.graphs
FOR SELECT
USING (auth.uid() = user_id OR is_public = TRUE);

DROP POLICY IF EXISTS graphs_insert_own ON public.graphs;
CREATE POLICY graphs_insert_own
ON public.graphs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS graphs_update_own ON public.graphs;
CREATE POLICY graphs_update_own
ON public.graphs
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS graphs_delete_own ON public.graphs;
CREATE POLICY graphs_delete_own
ON public.graphs
FOR DELETE
USING (auth.uid() = user_id);

-- GRAPH_RUNS: owner-only access.
DROP POLICY IF EXISTS graph_runs_select_own ON public.graph_runs;
CREATE POLICY graph_runs_select_own
ON public.graph_runs
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS graph_runs_insert_own ON public.graph_runs;
CREATE POLICY graph_runs_insert_own
ON public.graph_runs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS graph_runs_update_own ON public.graph_runs;
CREATE POLICY graph_runs_update_own
ON public.graph_runs
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- CHECKPOINTS: allowed only when user owns the underlying graph run.
DROP POLICY IF EXISTS checkpoints_select_own ON public.checkpoints;
CREATE POLICY checkpoints_select_own
ON public.checkpoints
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.graph_runs gr
    WHERE gr.id = checkpoints.run_id
      AND gr.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS checkpoints_insert_own ON public.checkpoints;
CREATE POLICY checkpoints_insert_own
ON public.checkpoints
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.graph_runs gr
    WHERE gr.id = checkpoints.run_id
      AND gr.user_id = auth.uid()
  )
);

-- DEPLOYMENTS: owner-only access.
DROP POLICY IF EXISTS deployments_select_own ON public.deployments;
CREATE POLICY deployments_select_own
ON public.deployments
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS deployments_insert_own ON public.deployments;
CREATE POLICY deployments_insert_own
ON public.deployments
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS deployments_update_own ON public.deployments;
CREATE POLICY deployments_update_own
ON public.deployments
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS deployments_delete_own ON public.deployments;
CREATE POLICY deployments_delete_own
ON public.deployments
FOR DELETE
USING (auth.uid() = user_id);
