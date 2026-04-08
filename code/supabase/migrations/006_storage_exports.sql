-- ============================================================
-- Storage bucket for deployment exports (code ZIP, Docker bundle)
-- ============================================================
-- Private bucket; signed URLs used for downloads.
-- Run via Dashboard or: supabase migration up

INSERT INTO storage.buckets (id, name, public)
VALUES ('exports', 'exports', false)
ON CONFLICT (id) DO NOTHING;
