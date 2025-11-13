-- ============================================================================
-- CREATE ADMIN USER FOR LIGHTPOINT
-- ============================================================================
-- Run this in Supabase SQL Editor to create/update your admin user
-- ============================================================================

-- Option 1: Create a new admin user
-- Replace with your actual email
INSERT INTO lightpoint_users (
  id,
  organization_id,
  email,
  full_name,
  role,
  job_title,
  is_active
) VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000001',  -- Default org
  'your.email@example.com',                 -- CHANGE THIS
  'Your Name',                               -- CHANGE THIS
  'admin',
  'Managing Partner',
  true
)
ON CONFLICT (email) DO UPDATE SET
  role = 'admin',
  is_active = true;

-- Option 2: Update existing user to admin
-- If you already have a user, just update their role:
UPDATE lightpoint_users
SET 
  role = 'admin',
  is_active = true,
  updated_at = now()
WHERE email = 'your.email@example.com';  -- CHANGE THIS

-- Verify admin user exists
SELECT 
  id,
  email,
  full_name,
  role,
  is_active,
  created_at
FROM lightpoint_users
WHERE role = 'admin';

-- ============================================================================
-- AFTER RUNNING THIS:
-- ============================================================================
-- 1. Go to: https://lightpoint-production.up.railway.app/settings
-- 2. Look for "Current User" section at the top
-- 3. Find your admin user in the list
-- 4. Click "Switch" button
-- 5. You're now logged in as admin!
-- 6. You can now access /users to manage team
-- ============================================================================

