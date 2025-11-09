-- Migration: Enhance document vectorization and timeline system
-- Purpose: Add document embeddings, improve timeline tracking, strengthen data isolation

-- ============================================================================
-- 1. ADD DOCUMENT EMBEDDINGS FOR VECTOR SEARCH
-- ============================================================================

-- Add embedding column to documents table
alter table documents add column if not exists embedding vector(1536);

-- Add document metadata for better tracking
alter table documents add column if not exists document_type text check (document_type in (
  'hmrc_letter',
  'client_correspondence', 
  'evidence',
  'complaint_letter',
  'hmrc_response',
  'escalation_letter',
  'final_outcome'
));

alter table documents add column if not exists uploaded_by uuid references lightpoint_users(id);
alter table documents add column if not exists document_date date;
alter table documents add column if not exists description text;

-- Create index for document vector search
drop index if exists documents_embedding_idx;
create index documents_embedding_idx on documents 
using hnsw (embedding vector_cosine_ops)
where embedding is not null;

-- Create function to search documents within a specific complaint (data isolation!)
create or replace function match_complaint_documents(
  p_complaint_id uuid,
  query_embedding vector(1536),
  match_threshold float default 0.7,
  match_count int default 10
)
returns table (
  id uuid,
  filename text,
  document_type text,
  sanitized_text text,
  document_date date,
  similarity float
)
language sql stable
security definer
as $$
  select
    d.id,
    d.filename,
    d.document_type,
    d.sanitized_text,
    d.document_date,
    1 - (d.embedding <=> query_embedding) as similarity
  from documents d
  inner join complaints c on d.complaint_id = c.id
  where 
    d.complaint_id = p_complaint_id
    and d.embedding is not null
    and 1 - (d.embedding <=> query_embedding) > match_threshold
  order by d.embedding <=> query_embedding
  limit match_count;
$$;

-- ============================================================================
-- 2. ENHANCE TIMELINE SYSTEM
-- ============================================================================

-- Timeline events follow this structure in JSONB:
-- {
--   "date": "2024-11-09T12:00:00Z",
--   "type": "document_uploaded|letter_generated|hmrc_response|escalation|status_change|note",
--   "title": "HMRC Letter Received",
--   "description": "Received response from HMRC denying complaint grounds",
--   "document_id": "uuid", (optional)
--   "user_id": "uuid",
--   "metadata": {} (optional)
-- }

-- Add helper function to add timeline event
create or replace function add_timeline_event(
  p_complaint_id uuid,
  p_event_type text,
  p_title text,
  p_description text default null,
  p_document_id uuid default null,
  p_user_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_event jsonb;
  v_timeline jsonb;
begin
  -- Create event object
  v_event := jsonb_build_object(
    'id', gen_random_uuid(),
    'date', now(),
    'type', p_event_type,
    'title', p_title,
    'description', p_description,
    'document_id', p_document_id,
    'user_id', p_user_id,
    'metadata', p_metadata
  );
  
  -- Get current timeline
  select timeline into v_timeline
  from complaints
  where id = p_complaint_id;
  
  -- Append new event
  v_timeline := coalesce(v_timeline, '[]'::jsonb) || v_event;
  
  -- Update complaint
  update complaints
  set 
    timeline = v_timeline,
    updated_at = now()
  where id = p_complaint_id;
  
  return v_event;
end;
$$;

-- Add helper function to get timeline
create or replace function get_complaint_timeline(
  p_complaint_id uuid,
  p_event_type text default null
)
returns table (
  id uuid,
  date timestamp with time zone,
  type text,
  title text,
  description text,
  document_id uuid,
  user_id uuid,
  metadata jsonb
)
language sql stable
as $$
  select 
    (event->>'id')::uuid as id,
    (event->>'date')::timestamp with time zone as date,
    event->>'type' as type,
    event->>'title' as title,
    event->>'description' as description,
    (event->>'document_id')::uuid as document_id,
    (event->>'user_id')::uuid as user_id,
    (event->'metadata')::jsonb as metadata
  from complaints,
  jsonb_array_elements(timeline) as event
  where complaints.id = p_complaint_id
    and (p_event_type is null or event->>'type' = p_event_type)
  order by (event->>'date')::timestamp with time zone desc;
$$;

-- ============================================================================
-- 3. STRENGTHEN DATA ISOLATION (Row Level Security)
-- ============================================================================

-- Drop existing document policies
drop policy if exists "Users can view documents in their organization" on documents;
drop policy if exists "Users can insert documents in their organization" on documents;
drop policy if exists "Users can update documents in their organization" on documents;

-- Create strict RLS policies for documents
create policy "Users can view documents in their organization"
  on documents for select
  using (
    complaint_id in (
      select c.id from complaints c
      where c.organization_id = (
        select organization_id from lightpoint_users where id = auth.uid()
      )
    )
  );

create policy "Users can insert documents in their organization"
  on documents for insert
  with check (
    complaint_id in (
      select c.id from complaints c
      where c.organization_id = (
        select organization_id from lightpoint_users where id = auth.uid()
      )
    )
  );

create policy "Users can update documents in their organization"
  on documents for update
  using (
    complaint_id in (
      select c.id from complaints c
      where c.organization_id = (
        select organization_id from lightpoint_users where id = auth.uid()
      )
    )
  );

-- ============================================================================
-- 4. ADD COMPLAINT ARCHIVAL SYSTEM
-- ============================================================================

-- Add archival fields to complaints
alter table complaints add column if not exists archived boolean default false;
alter table complaints add column if not exists archived_at timestamp with time zone;
alter table complaints add column if not exists archive_reason text;
alter table complaints add column if not exists final_outcome text check (final_outcome in (
  'successful',
  'partially_successful',
  'unsuccessful',
  'withdrawn',
  'escalated_to_adjudicator'
));

-- Create index for active complaints
create index if not exists complaints_active_idx on complaints (organization_id, status) 
where archived = false;

-- Create index for archived complaints
create index if not exists complaints_archived_idx on complaints (organization_id, archived_at) 
where archived = true;

-- Function to archive complaint
create or replace function archive_complaint(
  p_complaint_id uuid,
  p_final_outcome text,
  p_archive_reason text default null
)
returns boolean
language plpgsql
security definer
as $$
declare
  v_organization_id uuid;
begin
  -- Get organization_id for RLS check
  select organization_id into v_organization_id
  from complaints
  where id = p_complaint_id;
  
  -- Check user has access
  if v_organization_id != (select organization_id from lightpoint_users where id = auth.uid()) then
    raise exception 'Access denied';
  end if;
  
  -- Archive complaint
  update complaints
  set 
    archived = true,
    archived_at = now(),
    final_outcome = p_final_outcome,
    archive_reason = p_archive_reason,
    status = 'closed',
    updated_at = now()
  where id = p_complaint_id;
  
  -- Add timeline event
  perform add_timeline_event(
    p_complaint_id,
    'archived',
    'Complaint Archived',
    format('Final outcome: %s. %s', p_final_outcome, coalesce(p_archive_reason, '')),
    null,
    auth.uid(),
    jsonb_build_object('final_outcome', p_final_outcome)
  );
  
  return true;
end;
$$;

-- ============================================================================
-- 5. ADD DOCUMENT SEARCH WITHIN ORGANIZATION (GLOBAL PRECEDENT BUILDING)
-- ============================================================================

-- Search ALL documents across organization's complaints (for building internal precedents)
create or replace function search_organization_documents(
  query_embedding vector(1536),
  match_threshold float default 0.7,
  match_count int default 20
)
returns table (
  id uuid,
  complaint_id uuid,
  filename text,
  document_type text,
  sanitized_text text,
  complaint_reference text,
  final_outcome text,
  similarity float
)
language sql stable
security definer
as $$
  select
    d.id,
    d.complaint_id,
    d.filename,
    d.document_type,
    d.sanitized_text,
    c.complaint_reference,
    c.final_outcome,
    1 - (d.embedding <=> query_embedding) as similarity
  from documents d
  inner join complaints c on d.complaint_id = c.id
  where 
    c.organization_id = (select organization_id from lightpoint_users where id = auth.uid())
    and d.embedding is not null
    and 1 - (d.embedding <=> query_embedding) > match_threshold
  order by d.embedding <=> query_embedding
  limit match_count;
$$;

-- ============================================================================
-- 6. ADD DOCUMENT METADATA TABLE FOR ENHANCED TRACKING
-- ============================================================================

create table if not exists document_analysis (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade,
  complaint_id uuid references complaints(id) on delete cascade,
  analysis_type text not null check (analysis_type in (
    'charter_violation',
    'timeline_extraction',
    'financial_impact',
    'key_dates',
    'precedent_match'
  )),
  analysis_result jsonb not null,
  confidence_score float check (confidence_score >= 0 and confidence_score <= 1),
  analyzed_at timestamp with time zone default now(),
  analyzed_by text -- 'ai' or user_id
);

-- Enable RLS on document_analysis
alter table document_analysis enable row level security;

create policy "Users can view analysis in their organization"
  on document_analysis for select
  using (
    complaint_id in (
      select c.id from complaints c
      where c.organization_id = (
        select organization_id from lightpoint_users where id = auth.uid()
      )
    )
  );

-- Create index for quick analysis retrieval
create index if not exists document_analysis_document_idx on document_analysis(document_id);
create index if not exists document_analysis_complaint_idx on document_analysis(complaint_id);

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- This migration adds:
-- 1. ✅ Document vectorization for semantic search within complaints
-- 2. ✅ Enhanced timeline system with helper functions
-- 3. ✅ Strict data isolation via RLS (organization-level)
-- 4. ✅ Complaint archival system with success tracking
-- 5. ✅ Document analysis tracking for AI-generated insights
-- 6. ✅ Organization-wide document search (for internal precedent building)

