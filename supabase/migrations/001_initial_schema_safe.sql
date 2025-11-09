-- Enable pgvector extension
create extension if not exists vector;

-- Organizations (multi-tenancy)
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamp with time zone default now()
);

-- Users (only if not exists - Supabase might have auth.users)
-- We'll use a custom table name to avoid conflicts
create table if not exists lightpoint_users (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id),
  email text unique not null,
  role text not null check (role in ('admin', 'analyst', 'viewer')),
  created_at timestamp with time zone default now()
);

-- Complaints
create table if not exists complaints (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id),
  created_by uuid references lightpoint_users(id),
  client_name_encrypted text,
  complaint_reference text unique not null,
  complaint_context text,
  key_dates jsonb,
  financial_impact jsonb,
  client_objective text,
  status text default 'draft',
  timeline jsonb default '[]'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Documents
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid references complaints(id),
  filename text not null,
  file_path text not null,
  sanitized_text text,
  uploaded_at timestamp with time zone default now(),
  processed_data jsonb,
  vector_id uuid
);

-- Knowledge Base (vectorized HMRC guidance)
create table if not exists knowledge_base (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  title text not null,
  content text not null,
  source text,
  embedding vector(1536),
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now()
);

-- Precedents Library (sanitized past cases)
create table if not exists precedents (
  id uuid primary key default gen_random_uuid(),
  complaint_type text not null,
  issue_category text not null,
  outcome text,
  resolution_time_days integer,
  compensation_amount numeric,
  key_arguments text[],
  effective_citations text[],
  embedding vector(1536),
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now()
);

-- Time Logs (for billing)
create table if not exists time_logs (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid references complaints(id),
  user_id uuid references lightpoint_users(id),
  activity text not null,
  duration_minutes integer not null,
  logged_at timestamp with time zone default now()
);

-- Audit Logs (GDPR compliance)
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references lightpoint_users(id),
  action text not null,
  resource_type text not null,
  resource_id uuid,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now()
);

-- Create indexes for vector search (drop first if exists)
-- Using HNSW index which supports higher dimensions (up to 2000 for ivfflat)
drop index if exists knowledge_base_embedding_idx;
create index knowledge_base_embedding_idx on knowledge_base 
using hnsw (embedding vector_cosine_ops);

drop index if exists precedents_embedding_idx;
create index precedents_embedding_idx on precedents 
using hnsw (embedding vector_cosine_ops);

-- Create function for vector similarity search (knowledge base)
create or replace function match_knowledge_base(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  category text,
  title text,
  content text,
  similarity float
)
language sql stable
as $$
  select
    id,
    category,
    title,
    content,
    1 - (knowledge_base.embedding <=> query_embedding) as similarity
  from knowledge_base
  where 1 - (knowledge_base.embedding <=> query_embedding) > match_threshold
  order by knowledge_base.embedding <=> query_embedding
  limit match_count;
$$;

-- Create function for vector similarity search (precedents)
create or replace function match_precedents(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  complaint_type text,
  issue_category text,
  outcome text,
  key_arguments text[],
  effective_citations text[],
  similarity float
)
language sql stable
as $$
  select
    id,
    complaint_type,
    issue_category,
    outcome,
    key_arguments,
    effective_citations,
    1 - (precedents.embedding <=> query_embedding) as similarity
  from precedents
  where 1 - (precedents.embedding <=> query_embedding) > match_threshold
  order by precedents.embedding <=> query_embedding
  limit match_count;
$$;

-- Enable Row Level Security
alter table organizations enable row level security;
alter table lightpoint_users enable row level security;
alter table complaints enable row level security;
alter table documents enable row level security;
alter table time_logs enable row level security;
alter table audit_logs enable row level security;

-- Drop existing policies if they exist
drop policy if exists "Users can view their own organization data" on organizations;
drop policy if exists "Users can view complaints in their organization" on complaints;
drop policy if exists "Users can insert complaints in their organization" on complaints;

-- RLS Policies (Basic - customize based on your auth setup)
create policy "Users can view their own organization data"
  on organizations for select
  using (id = (select organization_id from lightpoint_users where id = auth.uid()));

create policy "Users can view complaints in their organization"
  on complaints for select
  using (organization_id = (select organization_id from lightpoint_users where id = auth.uid()));

create policy "Users can insert complaints in their organization"
  on complaints for insert
  with check (organization_id = (select organization_id from lightpoint_users where id = auth.uid()));

