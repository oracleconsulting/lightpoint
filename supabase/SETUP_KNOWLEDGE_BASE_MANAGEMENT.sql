-- ============================================================================
-- KNOWLEDGE BASE MANAGEMENT SYSTEM
-- Comprehensive schema for document uploads, versioning, comparison, and RSS
-- ============================================================================

-- ============================================================================
-- 1. KNOWLEDGE BASE UPDATES TABLE (Timeline & Versioning)
-- ============================================================================

CREATE TABLE IF NOT EXISTS knowledge_base_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_base_id UUID REFERENCES knowledge_base(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('added', 'updated', 'deprecated', 'deleted', 'restored')),
  performed_by UUID REFERENCES lightpoint_users(id),
  
  -- Version tracking
  version_number INTEGER NOT NULL DEFAULT 1,
  previous_version_id UUID REFERENCES knowledge_base_updates(id),
  
  -- Change details
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  source TEXT,
  change_summary TEXT,
  changes_detected JSONB, -- AI-generated diff: {added: [], removed: [], modified: []}
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for timeline queries
CREATE INDEX IF NOT EXISTS idx_kb_updates_timeline ON knowledge_base_updates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kb_updates_kb_id ON knowledge_base_updates(knowledge_base_id);
CREATE INDEX IF NOT EXISTS idx_kb_updates_action ON knowledge_base_updates(action);

-- ============================================================================
-- 2. KNOWLEDGE BASE UPLOAD STAGING (For comparison before confirming)
-- ============================================================================

CREATE TABLE IF NOT EXISTS knowledge_base_staging (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by UUID REFERENCES lightpoint_users(id),
  
  -- Document details
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL, -- Supabase storage path
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  
  -- Extracted content
  extracted_text TEXT NOT NULL,
  document_chunks JSONB, -- Chunked for embedding
  embedding VECTOR(1536),
  
  -- AI Comparison Results
  comparison_result JSONB NOT NULL,
  /* comparison_result structure:
  {
    "duplicates": [
      {"kb_id": "uuid", "title": "...", "similarity": 0.95, "recommendation": "skip"}
    ],
    "overlaps": [
      {"kb_id": "uuid", "title": "...", "similarity": 0.75, "overlap_percentage": 40, "recommendation": "merge"}
    ],
    "new_information": [
      {"category": "CRG", "topic": "Delay Standards", "content": "...", "confidence": 0.85}
    ],
    "gaps_filled": [
      {"existing_kb_id": "uuid", "gap_description": "Missing 2024 update", "fills_gap": true}
    ],
    "conflicts": [
      {"kb_id": "uuid", "conflict_type": "contradictory_dates", "description": "..."}
    ],
    "recommendations": {
      "action": "add_with_merge",
      "confidence": 0.88,
      "reason": "Fills gaps in CRG sections, minor overlap with existing docs"
    }
  }
  */
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'merged')),
  approved_by UUID REFERENCES lightpoint_users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for pending uploads
CREATE INDEX IF NOT EXISTS idx_kb_staging_status ON knowledge_base_staging(status);
CREATE INDEX IF NOT EXISTS idx_kb_staging_user ON knowledge_base_staging(uploaded_by);

-- ============================================================================
-- 3. RSS FEED CONFIGURATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS rss_feeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Feed details
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  feed_type TEXT NOT NULL CHECK (feed_type IN ('hmrc_guidance', 'tax_legislation', 'case_law', 'gov_uk', 'custom')),
  
  -- Monitoring
  is_active BOOLEAN DEFAULT TRUE,
  check_frequency_hours INTEGER DEFAULT 24,
  last_checked_at TIMESTAMPTZ,
  last_successful_check_at TIMESTAMPTZ,
  
  -- Processing rules
  auto_approve BOOLEAN DEFAULT FALSE, -- Auto-approve updates from trusted sources
  processing_rules JSONB DEFAULT '{}'::JSONB,
  /* processing_rules structure:
  {
    "extract_patterns": ["CRG[0-9]+", "HMRC[0-9]+"],
    "ignore_patterns": ["archived", "superseded"],
    "category_mapping": {"guidance": "CRG", "legislation": "Tax_Law"},
    "required_approval": true
  }
  */
  
  -- Statistics
  total_items_processed INTEGER DEFAULT 0,
  items_added INTEGER DEFAULT 0,
  items_updated INTEGER DEFAULT 0,
  last_error TEXT,
  last_error_at TIMESTAMPTZ,
  
  created_by UUID REFERENCES lightpoint_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for active feeds
CREATE INDEX IF NOT EXISTS idx_rss_feeds_active ON rss_feeds(is_active) WHERE is_active = TRUE;

-- ============================================================================
-- 4. RSS FEED ITEMS (What was detected)
-- ============================================================================

CREATE TABLE IF NOT EXISTS rss_feed_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_id UUID REFERENCES rss_feeds(id) ON DELETE CASCADE,
  
  -- Item details from RSS
  item_guid TEXT NOT NULL, -- RSS item unique ID
  title TEXT NOT NULL,
  link TEXT NOT NULL,
  published_date TIMESTAMPTZ,
  description TEXT,
  content TEXT, -- Full content if available
  
  -- Processing
  processed BOOLEAN DEFAULT FALSE,
  processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'staged', 'added', 'ignored', 'error')),
  staging_id UUID REFERENCES knowledge_base_staging(id),
  knowledge_base_id UUID REFERENCES knowledge_base(id),
  
  -- Error handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Index for processing queue
CREATE INDEX IF NOT EXISTS idx_rss_items_processing ON rss_feed_items(feed_id, processed, processing_status);
CREATE INDEX IF NOT EXISTS idx_rss_items_guid ON rss_feed_items(feed_id, item_guid);

-- ============================================================================
-- 5. KNOWLEDGE BASE COMPARISON CACHE (For faster subsequent comparisons)
-- ============================================================================

CREATE TABLE IF NOT EXISTS knowledge_base_comparison_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kb_id_1 UUID REFERENCES knowledge_base(id) ON DELETE CASCADE,
  kb_id_2 UUID REFERENCES knowledge_base(id) ON DELETE CASCADE,
  
  -- Comparison results
  similarity_score FLOAT NOT NULL,
  overlap_percentage FLOAT,
  comparison_type TEXT NOT NULL CHECK (comparison_type IN ('duplicate', 'overlap', 'complement', 'unrelated')),
  comparison_details JSONB,
  
  -- Cache metadata
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(kb_id_1, kb_id_2)
);

-- Index for similarity lookups
CREATE INDEX IF NOT EXISTS idx_kb_comparison_similarity ON knowledge_base_comparison_cache(similarity_score DESC);

-- ============================================================================
-- 6. HELPER FUNCTIONS
-- ============================================================================

-- Function to get knowledge base update timeline
CREATE OR REPLACE FUNCTION get_knowledge_base_timeline(
  p_limit INTEGER DEFAULT 50,
  p_category TEXT DEFAULT NULL,
  p_action TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  action TEXT,
  title TEXT,
  category TEXT,
  source TEXT,
  change_summary TEXT,
  user_name TEXT,
  created_at TIMESTAMPTZ
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.action,
    u.title,
    u.category,
    u.source,
    u.change_summary,
    COALESCE(lu.full_name, lu.email) as user_name,
    u.created_at
  FROM knowledge_base_updates u
  LEFT JOIN lightpoint_users lu ON u.performed_by = lu.id
  WHERE 
    (p_category IS NULL OR u.category = p_category)
    AND (p_action IS NULL OR u.action = p_action)
  ORDER BY u.created_at DESC
  LIMIT p_limit;
END;
$$;

-- Function to check for duplicate content
CREATE OR REPLACE FUNCTION check_knowledge_duplicate(
  p_embedding VECTOR(1536),
  p_similarity_threshold FLOAT DEFAULT 0.90
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  category TEXT,
  similarity FLOAT
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 
    kb.id,
    kb.title,
    kb.category,
    1 - (kb.embedding <=> p_embedding) as similarity
  FROM knowledge_base kb
  WHERE 1 - (kb.embedding <=> p_embedding) >= p_similarity_threshold
  ORDER BY similarity DESC
  LIMIT 10;
END;
$$;

-- Function to get RSS feed statistics
CREATE OR REPLACE FUNCTION get_rss_feed_stats()
RETURNS TABLE (
  total_feeds INTEGER,
  active_feeds INTEGER,
  total_items_processed INTEGER,
  items_added_today INTEGER,
  pending_items INTEGER
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as total_feeds,
    COUNT(*) FILTER (WHERE is_active = TRUE)::INTEGER as active_feeds,
    COALESCE(SUM(total_items_processed), 0)::INTEGER as total_items_processed,
    (SELECT COUNT(*)::INTEGER FROM rss_feed_items WHERE processed_at >= CURRENT_DATE) as items_added_today,
    (SELECT COUNT(*)::INTEGER FROM rss_feed_items WHERE processed = FALSE) as pending_items
  FROM rss_feeds;
END;
$$;

-- ============================================================================
-- 7. ROW LEVEL SECURITY (Admins only for now)
-- ============================================================================

ALTER TABLE knowledge_base_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base_staging ENABLE ROW LEVEL SECURITY;
ALTER TABLE rss_feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE rss_feed_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base_comparison_cache ENABLE ROW LEVEL SECURITY;

-- Admin/Manager access only
CREATE POLICY "Admin/Manager can manage knowledge base updates" ON knowledge_base_updates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM lightpoint_users
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admin/Manager can manage staging" ON knowledge_base_staging
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM lightpoint_users
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admin/Manager can manage RSS feeds" ON rss_feeds
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM lightpoint_users
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admin/Manager can view RSS items" ON rss_feed_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM lightpoint_users
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Anyone can read comparison cache" ON knowledge_base_comparison_cache
  FOR SELECT USING (TRUE);

CREATE POLICY "Admin/Manager can update comparison cache" ON knowledge_base_comparison_cache
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM lightpoint_users
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- ============================================================================
-- 8. VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Knowledge Base Management System setup complete!';
  RAISE NOTICE '';
  RAISE NOTICE 'Tables created:';
  RAISE NOTICE '  - knowledge_base_updates (versioning & timeline)';
  RAISE NOTICE '  - knowledge_base_staging (upload comparison)';
  RAISE NOTICE '  - rss_feeds (RSS feed configuration)';
  RAISE NOTICE '  - rss_feed_items (RSS items detected)';
  RAISE NOTICE '  - knowledge_base_comparison_cache (performance)';
  RAISE NOTICE '';
  RAISE NOTICE 'Helper functions:';
  RAISE NOTICE '  - get_knowledge_base_timeline()';
  RAISE NOTICE '  - check_knowledge_duplicate()';
  RAISE NOTICE '  - get_rss_feed_stats()';
  RAISE NOTICE '';
  RAISE NOTICE 'Ready for:';
  RAISE NOTICE '  ✓ Document upload & comparison';
  RAISE NOTICE '  ✓ Version tracking';
  RAISE NOTICE '  ✓ RSS feed monitoring (awaiting code oversight)';
END $$;

