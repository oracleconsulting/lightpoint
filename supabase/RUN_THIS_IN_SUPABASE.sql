-- ============================================================================
-- LIGHTPOINT TIME TRACKING - COPY THIS ENTIRE FILE
-- ============================================================================
-- Go to: https://supabase.com/dashboard
-- Click: SQL Editor (left sidebar)
-- Click: "New Query" button
-- Paste: THIS ENTIRE FILE
-- Click: RUN (bottom right)
-- ============================================================================

CREATE TABLE IF NOT EXISTS time_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  user_id uuid,
  activity_type text NOT NULL,
  minutes_spent integer NOT NULL,
  automated boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_time_logs_complaint ON time_logs(complaint_id);

ALTER TABLE time_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "time_select" ON time_logs;
DROP POLICY IF EXISTS "time_insert" ON time_logs;

CREATE POLICY "time_select" ON time_logs FOR SELECT USING (true);
CREATE POLICY "time_insert" ON time_logs FOR INSERT WITH CHECK (true);

-- ============================================================================
-- DONE - Close this, refresh Lightpoint, re-analyze complaint
-- ============================================================================

