-- ============================================================================
-- LIGHTPOINT USER MANAGEMENT & TICKET SYSTEM SETUP
-- ============================================================================
-- Creates tables for user profiles, complaint assignments, and management tickets
-- Run this in Supabase SQL Editor after COMPLETE_SETUP.sql
-- ============================================================================

-- ============================================================================
-- 1. ENHANCE lightpoint_users TABLE
-- ============================================================================

-- Add additional fields to existing lightpoint_users table
ALTER TABLE lightpoint_users 
ADD COLUMN IF NOT EXISTS full_name text,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS job_title text,
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS last_login timestamp with time zone,
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- Add check constraint for role
ALTER TABLE lightpoint_users DROP CONSTRAINT IF EXISTS lightpoint_users_role_check;
ALTER TABLE lightpoint_users 
ADD CONSTRAINT lightpoint_users_role_check 
CHECK (role IN ('admin', 'manager', 'analyst', 'viewer'));

COMMENT ON COLUMN lightpoint_users.role IS 'admin = full access, manager = oversight + user management, analyst = complaint handling, viewer = read-only';

-- ============================================================================
-- 2. CREATE COMPLAINT ASSIGNMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS complaint_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  assigned_to uuid NOT NULL REFERENCES lightpoint_users(id),
  assigned_by uuid REFERENCES lightpoint_users(id),
  assigned_at timestamp with time zone DEFAULT now(),
  notes text,
  UNIQUE(complaint_id, assigned_to)
);

CREATE INDEX idx_complaint_assignments_complaint_id ON complaint_assignments(complaint_id);
CREATE INDEX idx_complaint_assignments_assigned_to ON complaint_assignments(assigned_to);

COMMENT ON TABLE complaint_assignments IS 'Tracks which users are assigned to which complaints for attribution';

-- ============================================================================
-- 3. CREATE MANAGEMENT TICKETS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS management_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  raised_by uuid NOT NULL REFERENCES lightpoint_users(id),
  assigned_to uuid REFERENCES lightpoint_users(id),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  subject text NOT NULL,
  description text NOT NULL,
  resolution_notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  resolved_at timestamp with time zone
);

CREATE INDEX idx_management_tickets_complaint_id ON management_tickets(complaint_id);
CREATE INDEX idx_management_tickets_raised_by ON management_tickets(raised_by);
CREATE INDEX idx_management_tickets_assigned_to ON management_tickets(assigned_to);
CREATE INDEX idx_management_tickets_status ON management_tickets(status);
CREATE INDEX idx_management_tickets_priority ON management_tickets(priority);

COMMENT ON TABLE management_tickets IS 'Tickets raised by analysts to flag issues to management';

-- ============================================================================
-- 4. CREATE TICKET COMMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS ticket_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES management_tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES lightpoint_users(id),
  comment text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX idx_ticket_comments_ticket_id ON ticket_comments(ticket_id);
CREATE INDEX idx_ticket_comments_user_id ON ticket_comments(user_id);

COMMENT ON TABLE ticket_comments IS 'Comments/responses on management tickets';

-- ============================================================================
-- 5. UPDATE COMPLAINTS TABLE
-- ============================================================================

-- Ensure complaints has assigned_to field
ALTER TABLE complaints 
ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES lightpoint_users(id);

CREATE INDEX IF NOT EXISTS idx_complaints_assigned_to ON complaints(assigned_to);

COMMENT ON COLUMN complaints.assigned_to IS 'Primary user assigned to this complaint';

-- ============================================================================
-- 6. UPDATE time_logs TABLE
-- ============================================================================

-- Ensure time_logs has user_id field (should already exist from previous setup)
ALTER TABLE time_logs 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES lightpoint_users(id);

CREATE INDEX IF NOT EXISTS idx_time_logs_user_id ON time_logs(user_id);

COMMENT ON COLUMN time_logs.user_id IS 'User who performed the activity';

-- ============================================================================
-- 7. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE complaint_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE management_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 8. CREATE RLS POLICIES
-- ============================================================================

-- Users Table Policies
DROP POLICY IF EXISTS "Users can view users in their organization" ON lightpoint_users;
DROP POLICY IF EXISTS "Admins can insert users in their organization" ON lightpoint_users;
DROP POLICY IF EXISTS "Admins can update users in their organization" ON lightpoint_users;

CREATE POLICY "Users can view users in their organization"
  ON lightpoint_users FOR SELECT
  USING (organization_id = (SELECT organization_id FROM lightpoint_users WHERE id = auth.uid()));

CREATE POLICY "Admins can insert users in their organization"
  ON lightpoint_users FOR INSERT
  WITH CHECK (
    organization_id = (SELECT organization_id FROM lightpoint_users WHERE id = auth.uid())
    AND
    (SELECT role FROM lightpoint_users WHERE id = auth.uid()) IN ('admin', 'manager')
  );

CREATE POLICY "Admins can update users in their organization"
  ON lightpoint_users FOR UPDATE
  USING (
    organization_id = (SELECT organization_id FROM lightpoint_users WHERE id = auth.uid())
    AND
    (SELECT role FROM lightpoint_users WHERE id = auth.uid()) IN ('admin', 'manager')
  );

-- Complaint Assignments Policies
DROP POLICY IF EXISTS "Users can view assignments in their organization" ON complaint_assignments;
DROP POLICY IF EXISTS "Users can create assignments in their organization" ON complaint_assignments;

CREATE POLICY "Users can view assignments in their organization"
  ON complaint_assignments FOR SELECT
  USING (
    complaint_id IN (
      SELECT c.id FROM complaints c
      WHERE c.organization_id = (SELECT organization_id FROM lightpoint_users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can create assignments in their organization"
  ON complaint_assignments FOR INSERT
  WITH CHECK (
    complaint_id IN (
      SELECT c.id FROM complaints c
      WHERE c.organization_id = (SELECT organization_id FROM lightpoint_users WHERE id = auth.uid())
    )
  );

-- Management Tickets Policies
DROP POLICY IF EXISTS "Users can view tickets in their organization" ON management_tickets;
DROP POLICY IF EXISTS "Users can create tickets for their complaints" ON management_tickets;
DROP POLICY IF EXISTS "Users can update their tickets or assigned tickets" ON management_tickets;

CREATE POLICY "Users can view tickets in their organization"
  ON management_tickets FOR SELECT
  USING (
    complaint_id IN (
      SELECT c.id FROM complaints c
      WHERE c.organization_id = (SELECT organization_id FROM lightpoint_users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can create tickets for their complaints"
  ON management_tickets FOR INSERT
  WITH CHECK (
    complaint_id IN (
      SELECT c.id FROM complaints c
      WHERE c.organization_id = (SELECT organization_id FROM lightpoint_users WHERE id = auth.uid())
    )
    AND raised_by = auth.uid()
  );

CREATE POLICY "Users can update their tickets or assigned tickets"
  ON management_tickets FOR UPDATE
  USING (
    raised_by = auth.uid() 
    OR assigned_to = auth.uid()
    OR (SELECT role FROM lightpoint_users WHERE id = auth.uid()) IN ('admin', 'manager')
  );

-- Ticket Comments Policies
DROP POLICY IF EXISTS "Users can view comments on accessible tickets" ON ticket_comments;
DROP POLICY IF EXISTS "Users can add comments to accessible tickets" ON ticket_comments;

CREATE POLICY "Users can view comments on accessible tickets"
  ON ticket_comments FOR SELECT
  USING (
    ticket_id IN (
      SELECT mt.id FROM management_tickets mt
      JOIN complaints c ON c.id = mt.complaint_id
      WHERE c.organization_id = (SELECT organization_id FROM lightpoint_users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can add comments to accessible tickets"
  ON ticket_comments FOR INSERT
  WITH CHECK (
    ticket_id IN (
      SELECT mt.id FROM management_tickets mt
      JOIN complaints c ON c.id = mt.complaint_id
      WHERE c.organization_id = (SELECT organization_id FROM lightpoint_users WHERE id = auth.uid())
    )
    AND user_id = auth.uid()
  );

-- ============================================================================
-- 9. CREATE HELPER FUNCTIONS
-- ============================================================================

-- Function to get user's full name
CREATE OR REPLACE FUNCTION get_user_full_name(user_id uuid)
RETURNS text AS $$
BEGIN
  RETURN (
    SELECT COALESCE(full_name, email) 
    FROM lightpoint_users 
    WHERE id = user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get complaint workload per user
CREATE OR REPLACE FUNCTION get_user_workload(user_id uuid)
RETURNS TABLE(
  total_complaints bigint,
  active_complaints bigint,
  pending_tickets bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT c.id) as total_complaints,
    COUNT(DISTINCT c.id) FILTER (WHERE c.status IN ('active', 'assessment')) as active_complaints,
    COUNT(DISTINCT mt.id) FILTER (WHERE mt.status IN ('open', 'in_progress') AND mt.assigned_to = user_id) as pending_tickets
  FROM complaints c
  LEFT JOIN management_tickets mt ON mt.complaint_id = c.id
  WHERE c.assigned_to = user_id
  OR c.created_by = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 10. CREATE VIEWS FOR REPORTING
-- ============================================================================

-- View for management dashboard
CREATE OR REPLACE VIEW management_overview AS
SELECT 
  u.id as user_id,
  u.full_name,
  u.email,
  u.role,
  COUNT(DISTINCT c.id) as total_complaints,
  COUNT(DISTINCT CASE WHEN c.status IN ('active', 'assessment') THEN c.id END) as active_complaints,
  COUNT(DISTINCT CASE WHEN mt.status IN ('open', 'in_progress') THEN mt.id END) as open_tickets,
  COALESCE(SUM(tl.minutes_spent), 0) as total_minutes_logged,
  MAX(u.last_login) as last_login
FROM lightpoint_users u
LEFT JOIN complaints c ON c.assigned_to = u.id OR c.created_by = u.id
LEFT JOIN management_tickets mt ON mt.raised_by = u.id AND mt.status IN ('open', 'in_progress')
LEFT JOIN time_logs tl ON tl.user_id = u.id
WHERE u.is_active = true
GROUP BY u.id, u.full_name, u.email, u.role;

-- View for ticket summary
CREATE OR REPLACE VIEW ticket_summary AS
SELECT 
  mt.id,
  mt.complaint_id,
  c.complaint_reference,
  mt.subject,
  mt.priority,
  mt.status,
  mt.created_at,
  u_raised.full_name as raised_by_name,
  u_raised.email as raised_by_email,
  u_assigned.full_name as assigned_to_name,
  u_assigned.email as assigned_to_email,
  (SELECT COUNT(*) FROM ticket_comments tc WHERE tc.ticket_id = mt.id) as comment_count
FROM management_tickets mt
JOIN complaints c ON c.id = mt.complaint_id
JOIN lightpoint_users u_raised ON u_raised.id = mt.raised_by
LEFT JOIN lightpoint_users u_assigned ON u_assigned.id = mt.assigned_to;

-- ============================================================================
-- SETUP COMPLETE!
-- ============================================================================

SELECT '✅ User Management & Ticket System Setup Complete!' as status;
SELECT 'Tables Created: complaint_assignments, management_tickets, ticket_comments' as tables;
SELECT 'Enhanced: lightpoint_users, complaints, time_logs' as enhanced;
SELECT 'RLS Policies: Applied to all new tables' as security;
SELECT 'Ready for: User management, complaint attribution, ticket system' as ready;

