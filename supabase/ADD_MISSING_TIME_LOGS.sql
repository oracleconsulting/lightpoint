-- ============================================================================
-- MANUALLY ADD TIME LOGS FOR EXISTING COMPLAINT
-- ============================================================================
-- This will add time entries for the work you've already done
-- Copy/paste into Supabase SQL Editor and click RUN
-- ============================================================================

-- First, let's get your complaint ID
-- (You'll see it in the results, then use it below)
SELECT id, complaint_reference, status 
FROM complaints 
ORDER BY created_at DESC 
LIMIT 5;

-- ============================================================================
-- AFTER YOU SEE YOUR COMPLAINT ID ABOVE, UPDATE THE LINE BELOW
-- Replace 'YOUR-COMPLAINT-ID-HERE' with the actual ID
-- ============================================================================

-- Example: If your ID is 'db57fc2d-1a70-41c9-a762-7c4ac2106323'
-- Replace the text below with that ID

INSERT INTO time_logs (complaint_id, activity_type, minutes_spent, automated, created_at) VALUES

-- Initial Analysis (1 document = 40 minutes)
('YOUR-COMPLAINT-ID-HERE', 'Initial Analysis', 60, true, NOW() - INTERVAL '2 hours'),

-- Letter Generation (fixed 20 minutes)
('YOUR-COMPLAINT-ID-HERE', 'Letter Generation', 20, true, NOW() - INTERVAL '1 hour');

-- ============================================================================
-- AFTER RUNNING:
-- - Refresh Lightpoint
-- - Check Time & Value card
-- - Should show: 1h 20m = £366.67 (at £275/hr)
-- ============================================================================

