-- CHECK KNOWLEDGE BASE TIMELINE DATA
-- Run this in Supabase SQL Editor to verify timeline entries exist

-- 1. Check how many updates are logged
SELECT 
  COUNT(*) as total_updates,
  action,
  category
FROM knowledge_base_updates
GROUP BY action, category
ORDER BY COUNT(*) DESC;

-- 2. Check recent updates (last 20)
SELECT 
  id,
  action,
  title,
  category,
  source,
  user_name,
  created_at
FROM knowledge_base_updates
ORDER BY created_at DESC
LIMIT 20;

-- 3. Test the timeline function directly
SELECT * FROM get_knowledge_base_timeline(20, NULL, NULL);

-- 4. Check if knowledge_base entries were created
SELECT 
  COUNT(*) as total_kb_entries,
  category
FROM knowledge_base
GROUP BY category;

-- Expected Results:
-- - Should see 63 entries in knowledge_base_updates with action='added'
-- - Should see 63 entries in knowledge_base table
-- - Timeline function should return the same 63 entries

