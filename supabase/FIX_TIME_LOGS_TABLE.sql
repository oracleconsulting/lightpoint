-- ============================================================================
-- DIAGNOSE AND FIX TIME_LOGS TABLE
-- ============================================================================
-- This will check if the table exists and fix column names if needed
-- Copy/paste into Supabase SQL Editor and click RUN
-- ============================================================================

-- Step 1: Check if table exists and what columns it has
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'time_logs'
ORDER BY ordinal_position;

-- ============================================================================
-- IF YOU SEE RESULTS ABOVE:
-- Check if 'activity_type' column exists
-- If NOT, the table has wrong schema - proceed to Step 2
--
-- IF YOU SEE NO RESULTS:
-- Table doesn't exist - proceed to Step 2
-- ============================================================================

-- Step 2: Drop and recreate table with correct schema
-- (This is safe - no time logs exist yet anyway)

DROP TABLE IF EXISTS time_logs CASCADE;

CREATE TABLE time_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  user_id uuid,
  activity_type text NOT NULL,
  minutes_spent integer NOT NULL,
  automated boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX idx_time_logs_complaint ON time_logs(complaint_id);

ALTER TABLE time_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "time_select" ON time_logs;
DROP POLICY IF EXISTS "time_insert" ON time_logs;

CREATE POLICY "time_select" ON time_logs FOR SELECT USING (true);
CREATE POLICY "time_insert" ON time_logs FOR INSERT WITH CHECK (true);

-- Step 3: Verify the fix
SELECT 'Table recreated successfully! Columns:' as status;

SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'time_logs'
ORDER BY ordinal_position;

-- ============================================================================
-- DONE! Now run ADD_MISSING_TIME_LOGS.sql
-- ============================================================================

