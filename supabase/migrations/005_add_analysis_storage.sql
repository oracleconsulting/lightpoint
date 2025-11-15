-- Add analysis and context storage to complaints table
-- This prevents losing analysis on refresh and saves LLM costs

ALTER TABLE complaints 
ADD COLUMN IF NOT EXISTS analysis JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS complaint_context TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS analysis_completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create index for quick lookup
CREATE INDEX IF NOT EXISTS idx_complaints_analysis_completed 
ON complaints(analysis_completed_at) 
WHERE analysis_completed_at IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN complaints.analysis IS 'Stores the complete AI analysis result to avoid re-running LLM on refresh';
COMMENT ON COLUMN complaints.complaint_context IS 'Stores the original complaint context provided by the user';
COMMENT ON COLUMN complaints.analysis_completed_at IS 'Timestamp when analysis was completed and locked';

