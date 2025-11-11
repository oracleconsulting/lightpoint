-- ============================================================================
-- MANUALLY ADD TIME LOGS FOR EXISTING COMPLAINT
-- ============================================================================
-- ⚠️  RUN FIX_TIME_LOGS_TABLE.sql FIRST if you get "activity_type does not exist"
-- ============================================================================

-- Step 1: Get your complaint ID for reference "111"
SELECT id, complaint_reference, status 
FROM complaints 
WHERE complaint_reference = '111';

-- ============================================================================
-- Step 2: Copy the ID from above and paste it below
-- Replace 'YOUR-COMPLAINT-ID-HERE' with the actual UUID
-- ============================================================================

INSERT INTO time_logs (complaint_id, activity_type, minutes_spent, automated, created_at) VALUES

-- Initial Analysis (1 document = 60 minutes)
('YOUR-COMPLAINT-ID-HERE', 'Initial Analysis', 60, true, NOW() - INTERVAL '2 hours'),

-- Letter Generation (fixed 20 minutes)
('YOUR-COMPLAINT-ID-HERE', 'Letter Generation', 20, true, NOW() - INTERVAL '1 hour');

-- ============================================================================
-- AFTER RUNNING:
-- - Refresh Lightpoint
-- - Check Time & Value card
-- - Should show: 1h 20m = £366.67 (at £275/hr)
-- ============================================================================

