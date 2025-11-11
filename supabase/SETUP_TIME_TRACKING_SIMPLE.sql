-- ============================================================================
-- LIGHTPOINT TIME TRACKING SETUP - SAFE VERSION
-- ============================================================================
-- Run this entire script in Supabase SQL Editor
-- It will create the time_logs table and set up everything needed
-- ============================================================================

-- Step 1: Create the table
CREATE TABLE IF NOT EXISTS time_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  user_id uuid REFERENCES lightpoint_users(id),
  activity_type text NOT NULL,
  minutes_spent integer NOT NULL CHECK (minutes_spent > 0),
  automated boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Step 2: Create indexes
CREATE INDEX IF NOT EXISTS idx_time_logs_complaint_id ON time_logs(complaint_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_user_id ON time_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_created_at ON time_logs(created_at);

-- Step 3: Enable RLS
ALTER TABLE time_logs ENABLE ROW LEVEL SECURITY;

-- Step 4: Drop old policies if they exist
DROP POLICY IF EXISTS "Users can view time logs for their organization complaints" ON time_logs;
DROP POLICY IF EXISTS "Users can insert time logs for their organization complaints" ON time_logs;
DROP POLICY IF EXISTS "System can insert automated time logs" ON time_logs;

-- Step 5: Create RLS policies
CREATE POLICY "Users can view time logs for their organization complaints"
  ON time_logs FOR SELECT
  USING (
    complaint_id IN (
      SELECT c.id 
      FROM complaints c
      JOIN lightpoint_users u ON u.organization_id = c.organization_id
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "Users can insert time logs for their organization complaints"
  ON time_logs FOR INSERT
  WITH CHECK (
    complaint_id IN (
      SELECT c.id 
      FROM complaints c
      JOIN lightpoint_users u ON u.organization_id = c.organization_id
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "System can insert automated time logs"
  ON time_logs FOR INSERT
  WITH CHECK (automated = true);

-- ============================================================================
-- DONE! Table created successfully
-- ============================================================================
-- Your app will now automatically start tracking time
-- Refresh your Lightpoint app and re-analyze a complaint to see it work
-- ============================================================================

