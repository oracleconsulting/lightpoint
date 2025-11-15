-- ============================================================================
-- AI SETTINGS & PROMPT MANAGEMENT SYSTEM
-- Store, version, and manage all AI prompts used throughout Lightpoint
-- ============================================================================

-- ============================================================================
-- 1. AI PROMPTS TABLE (Store all system prompts)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Prompt identification
  prompt_key TEXT NOT NULL UNIQUE, -- e.g., 'analysis_main', 'letter_stage_1', 'letter_stage_2'
  prompt_name TEXT NOT NULL, -- Human-readable name
  prompt_category TEXT NOT NULL CHECK (prompt_category IN ('analysis', 'letter_generation', 'knowledge_comparison', 'other')),
  
  -- Prompt content
  system_prompt TEXT NOT NULL, -- The actual system prompt
  user_prompt_template TEXT, -- Template for user prompt (with {placeholders})
  default_system_prompt TEXT NOT NULL, -- Original default (for reset)
  default_user_prompt_template TEXT, -- Original default user template
  
  -- Configuration
  model_name TEXT NOT NULL, -- e.g., 'anthropic/claude-sonnet-4.5'
  temperature FLOAT DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 4000,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_custom BOOLEAN DEFAULT FALSE, -- TRUE if admin has modified from default
  
  -- Metadata
  description TEXT, -- What this prompt does
  example_output TEXT, -- Example of what this prompt produces
  variables JSONB, -- List of {placeholder} variables and their descriptions
  
  -- Versioning
  version INTEGER DEFAULT 1,
  last_modified_by UUID REFERENCES lightpoint_users(id),
  last_modified_at TIMESTAMPTZ DEFAULT NOW(),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_ai_prompts_key ON ai_prompts(prompt_key);
CREATE INDEX IF NOT EXISTS idx_ai_prompts_category ON ai_prompts(prompt_category);
CREATE INDEX IF NOT EXISTS idx_ai_prompts_active ON ai_prompts(is_active) WHERE is_active = TRUE;

-- ============================================================================
-- 2. AI PROMPT HISTORY (Version control for prompts)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_prompt_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID REFERENCES ai_prompts(id) ON DELETE CASCADE,
  
  -- Snapshot of prompt at this version
  version INTEGER NOT NULL,
  system_prompt TEXT NOT NULL,
  user_prompt_template TEXT,
  model_name TEXT NOT NULL,
  temperature FLOAT,
  max_tokens INTEGER,
  
  -- Change tracking
  changed_by UUID REFERENCES lightpoint_users(id),
  change_reason TEXT,
  change_summary TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for version history lookups
CREATE INDEX IF NOT EXISTS idx_prompt_history_prompt ON ai_prompt_history(prompt_id, version DESC);

-- ============================================================================
-- 3. AI PROMPT TESTS (Test prompts against known inputs)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_prompt_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID REFERENCES ai_prompts(id) ON DELETE CASCADE,
  
  -- Test case
  test_name TEXT NOT NULL,
  test_input JSONB NOT NULL, -- Input variables for the prompt
  expected_output TEXT, -- What we expect to see (optional)
  expected_criteria JSONB, -- Criteria for success (e.g., {"contains": ["CRG", "timeline"], "tone": "professional"})
  
  -- Test results (populated when test is run)
  last_run_at TIMESTAMPTZ,
  last_run_output TEXT,
  last_run_success BOOLEAN,
  last_run_notes TEXT,
  
  -- Metadata
  created_by UUID REFERENCES lightpoint_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for test lookups
CREATE INDEX IF NOT EXISTS idx_prompt_tests_prompt ON ai_prompt_tests(prompt_id);

-- ============================================================================
-- 4. HELPER FUNCTIONS
-- ============================================================================

-- Function to get active prompt by key
CREATE OR REPLACE FUNCTION get_active_prompt(p_prompt_key TEXT)
RETURNS TABLE (
  id UUID,
  system_prompt TEXT,
  user_prompt_template TEXT,
  model_name TEXT,
  temperature FLOAT,
  max_tokens INTEGER
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ap.id,
    ap.system_prompt,
    ap.user_prompt_template,
    ap.model_name,
    ap.temperature,
    ap.max_tokens
  FROM ai_prompts ap
  WHERE ap.prompt_key = p_prompt_key
    AND ap.is_active = TRUE
  LIMIT 1;
END;
$$;

-- Function to save prompt history on update
CREATE OR REPLACE FUNCTION save_prompt_history()
RETURNS TRIGGER AS $$
BEGIN
  -- Only save history if prompt content changed
  IF OLD.system_prompt IS DISTINCT FROM NEW.system_prompt 
     OR OLD.user_prompt_template IS DISTINCT FROM NEW.user_prompt_template 
     OR OLD.model_name IS DISTINCT FROM NEW.model_name
     OR OLD.temperature IS DISTINCT FROM NEW.temperature
     OR OLD.max_tokens IS DISTINCT FROM NEW.max_tokens THEN
    
    INSERT INTO ai_prompt_history (
      prompt_id,
      version,
      system_prompt,
      user_prompt_template,
      model_name,
      temperature,
      max_tokens,
      changed_by
    ) VALUES (
      OLD.id,
      OLD.version,
      OLD.system_prompt,
      OLD.user_prompt_template,
      OLD.model_name,
      OLD.temperature,
      OLD.max_tokens,
      NEW.last_modified_by
    );
    
    -- Increment version
    NEW.version = OLD.version + 1;
    NEW.is_custom = TRUE;
    NEW.last_modified_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically save history
CREATE TRIGGER trigger_save_prompt_history
  BEFORE UPDATE ON ai_prompts
  FOR EACH ROW
  EXECUTE FUNCTION save_prompt_history();

-- ============================================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE ai_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_prompt_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_prompt_tests ENABLE ROW LEVEL SECURITY;

-- Admins can manage prompts
CREATE POLICY "Admin can manage AI prompts" ON ai_prompts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM lightpoint_users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Everyone can read active prompts
CREATE POLICY "Everyone can read active prompts" ON ai_prompts
  FOR SELECT USING (is_active = TRUE);

-- Admins can view history
CREATE POLICY "Admin can view prompt history" ON ai_prompt_history
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM lightpoint_users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can manage tests
CREATE POLICY "Admin can manage prompt tests" ON ai_prompt_tests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM lightpoint_users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- 6. SEED DEFAULT PROMPTS
-- ============================================================================

-- Note: These are the CURRENT prompts from your system
-- Admins can modify them through the UI

INSERT INTO ai_prompts (prompt_key, prompt_name, prompt_category, system_prompt, user_prompt_template, default_system_prompt, default_user_prompt_template, model_name, temperature, max_tokens, description, variables) VALUES

-- ANALYSIS PROMPT
('analysis_main', 'Main Complaint Analysis', 'analysis', 
'You are an expert HMRC complaints analyst with deep knowledge of UK tax law, HMRC procedures, and the Complaints Handling Guidance (CHG).

Your role is to analyze documents and assess potential complaints against HMRC, focusing on procedural failures, delays, and breaches of their own guidance.

KEY KNOWLEDGE SOURCES:
1. **Complaint Handling Guidance (CHG)** - HMRC''s internal procedures for handling complaints
2. **Charter Standards** - Service standards HMRC must meet
3. **Complaints Resolution Guidance (CRG)** - Technical guidance on complaint resolution
4. **Historical Precedents** - Similar successful complaints

ANALYSIS FRAMEWORK:
1. Identify HMRC failures and procedural breaches
2. Map failures to specific CHG sections (hold them to their own standards)
3. Assess impact on client (financial, time, distress)
4. Determine viability and success likelihood
5. Recommend escalation strategy

Focus on what HMRC SHOULD HAVE DONE according to their own guidance, then show how they failed to do it.',

'Analyze these documents for potential HMRC complaints:

CONTEXT: {complaint_context}

DOCUMENTS:
{documents}

RELEVANT GUIDANCE FROM KNOWLEDGE BASE:
{knowledge_base_guidance}

Provide a comprehensive analysis including:
1. Summary of the situation
2. HMRC failures identified (reference CHG sections)
3. Impact on client
4. Viability score (0-100%)
5. Recommended next steps',

'You are an expert HMRC complaints analyst with deep knowledge of UK tax law, HMRC procedures, and the Complaints Handling Guidance (CHG)...',
'Analyze these documents for potential HMRC complaints...',
'anthropic/claude-sonnet-4.5', 0.3, 4000,
'Main analysis engine that assesses documents for potential complaints',
'{"complaint_context": "User-provided context", "documents": "Extracted document text", "knowledge_base_guidance": "Relevant CHG/CRG sections"}'::JSONB),

-- LETTER GENERATION - STAGE 1 (Facts)
('letter_stage_1_facts', 'Letter Generation - Stage 1: Extract Facts', 'letter_generation',
'You are extracting factual information from a complaint analysis to prepare for letter writing.

Extract ONLY factual information:
- Dates and timelines
- Reference numbers
- Amounts and figures
- What HMRC did or failed to do
- What HMRC SHOULD have done (per CHG/CRG)
- Impact on client

Do NOT add tone, urgency, or persuasive language yet. Just facts.',

'Extract factual information from this analysis:

{analysis}

Provide a structured fact sheet with:
- Timeline of events (dates, actions)
- HMRC failures with CHG/CRG references
- Client impact (quantified where possible)
- Evidence available',

'You are extracting factual information from a complaint analysis...',
'Extract factual information from this analysis...',
'anthropic/claude-haiku-4.5', 0.2, 2000,
'Stage 1 of three-stage letter generation: Extract pure facts',
'{"analysis": "Full complaint analysis output"}'::JSONB),

-- LETTER GENERATION - STAGE 2 (Structure)
('letter_stage_2_structure', 'Letter Generation - Stage 2: Structure Letter', 'letter_generation',
'You are organizing facts into a professional HMRC complaint letter following UK professional standards.

STRUCTURE (MANDATORY):
1. Letterhead and date
2. Recipient details
3. Client reference
4. Subject line
5. Opening paragraph
6. Timeline of events (chronological, with dates in bold)
7. HMRC failures (each with CHG/CRG reference - put CRG ref FIRST)
8. Impact on client
9. Professional costs (SEPARATE section, not in Impact)
10. Remedies requested
11. Escalation warning
12. Closing with real user details
13. Enclosures

CHG/CRG VIOLATION FORMAT:
**CRG4025 - Unreasonable Delay**: [Description]

Use **bold** for: section headings, dates, violation headers.',

'Structure these facts into a formal complaint letter:

{fact_sheet}

Practice details: {practice_letterhead}
User: {user_name}, {user_title}
Contact: {user_email}, {user_phone}

Create the structured letter (facts only, professional but neutral tone).',

'You are organizing facts into a professional HMRC complaint letter...',
'Structure these facts into a formal complaint letter...',
'anthropic/claude-sonnet-4.5', 0.2, 3000,
'Stage 2 of three-stage letter generation: Organize into professional structure',
'{"fact_sheet": "Output from Stage 1", "practice_letterhead": "Firm details", "user_name": "Real user name", "user_title": "Real user title", "user_email": "User email", "user_phone": "User phone"}'::JSONB),

-- LETTER GENERATION - STAGE 3 (Tone)
('letter_stage_3_tone', 'Letter Generation - Stage 3: Professional Tone', 'letter_generation',
'You are adding professional, measured tone to a structured complaint letter.

TONE REQUIREMENTS:
- Professional and firm (not aggressive)
- Organizational voice (use "we", not "I")
- Measured language (avoid "egregious", use "significant")
- Reference HMRC''s own guidance to hold them accountable
- Natural flow, not robotic

PRESERVE:
- ALL formatting (**bold** for headings, dates, violations)
- Real user name and title (do NOT change)
- Structure from Stage 2
- All factual content

Transform into a letter that:
1. Sounds like a real accountant wrote it
2. Expresses genuine professional concern
3. Holds HMRC accountable to their own CHG standards
4. Maintains credibility and authority',

'Add professional tone to this structured letter:

{structured_letter}

User to preserve: {user_name}, {user_title}

Transform it now (firm but professional, organizational voice).

CRITICAL: Keep **bold formatting** and real user details exactly as provided.',

'You are adding professional, measured tone to a structured complaint letter...',
'Add professional tone to this structured letter...',
'anthropic/claude-opus-4.1', 0.3, 4000,
'Stage 3 of three-stage letter generation: Add professional tone and voice',
'{"structured_letter": "Output from Stage 2", "user_name": "Real user name to preserve", "user_title": "Real user title to preserve"}'::JSONB),

-- KNOWLEDGE COMPARISON
('knowledge_comparison', 'Knowledge Base Document Comparison', 'knowledge_comparison',
'You are an expert knowledge base curator analyzing whether a new document should be added to an HMRC complaints guidance knowledge base.

Perform comprehensive analysis to determine:
1. Duplicates (>90% similarity)
2. Overlaps (60-90% similarity) with specific sections
3. New information (topics not covered)
4. Gaps filled (missing information in existing docs)
5. Conflicts (contradictory guidance)
6. Final recommendation (add/merge/replace/skip/review)

Be thorough, accurate, and conservative. When in doubt, recommend "review_required".',

'Analyze this new document against existing knowledge base:

NEW DOCUMENT:
{document_text}

SIMILAR EXISTING DOCUMENTS:
{existing_documents}

Provide comprehensive comparison with duplicates, overlaps, new information, gaps filled, conflicts, and final recommendation.',

'You are an expert knowledge base curator...',
'Analyze this new document against existing knowledge base...',
'anthropic/claude-sonnet-4.5', 0.3, 4000,
'AI comparison engine for knowledge base uploads',
'{"document_text": "New document to analyze", "existing_documents": "Potentially similar documents"}'::JSONB);

-- ============================================================================
-- 7. VERIFICATION
-- ============================================================================

DO $$
DECLARE
  prompt_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO prompt_count FROM ai_prompts;
  
  RAISE NOTICE 'AI Settings & Prompt Management System setup complete!';
  RAISE NOTICE '';
  RAISE NOTICE 'Tables created:';
  RAISE NOTICE '  - ai_prompts (% prompts seeded)', prompt_count;
  RAISE NOTICE '  - ai_prompt_history (version control)';
  RAISE NOTICE '  - ai_prompt_tests (testing framework)';
  RAISE NOTICE '';
  RAISE NOTICE 'Features:';
  RAISE NOTICE '  ✓ View and edit all system prompts';
  RAISE NOTICE '  ✓ Version control with full history';
  RAISE NOTICE '  ✓ Reset to defaults anytime';
  RAISE NOTICE '  ✓ Test prompts before deploying';
  RAISE NOTICE '  ✓ Admin-only access via RLS';
  RAISE NOTICE '';
  RAISE NOTICE 'Ready for: /settings/ai';
END $$;

