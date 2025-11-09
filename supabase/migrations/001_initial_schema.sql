-- Enable vector extension
create extension if not exists vector;

-- Organizations (accounting firms)
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamp with time zone default now(),
  settings jsonb default '{}'::jsonb
);

-- Users (accountants)
create table users (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id),
  email text unique not null,
  full_name text,
  created_at timestamp with time zone default now()
);

-- Complaints
create table complaints (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id),
  created_by uuid references users(id),
  client_reference text not null, -- anonymized reference
  status text check (status in ('assessment', 'draft', 'active', 'escalated', 'resolved', 'closed')),
  complaint_type text,
  hmrc_department text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  timeline jsonb default '[]'::jsonb,
  metadata jsonb default '{}'::jsonb -- stores non-PII data
);

-- Documents (with privacy-first design)
create table documents (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid references complaints(id) on delete cascade,
  document_type text check (document_type in ('hmrc_letter', 'complaint_draft', 'response', 'evidence', 'final_outcome')),
  file_path text, -- Supabase storage path
  uploaded_at timestamp with time zone default now(),
  processed_data jsonb, -- extracted non-PII data only
  vector_id uuid -- reference to vector storage
);

-- Knowledge Base (vectorized HMRC guidance)
create table knowledge_base (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  title text not null,
  content text not null,
  source text,
  embedding vector(3072),
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now()
);

-- Precedents Library (sanitized past cases)
create table precedents (
  id uuid primary key default gen_random_uuid(),
  complaint_type text not null,
  issue_category text not null,
  outcome text,
  resolution_time_days integer,
  compensation_amount numeric,
  key_arguments text[],
  effective_citations text[],
  embedding vector(3072),
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now()
);

-- Time Logs (for billing)
create table time_logs (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid references complaints(id),
  activity_type text not null,
  minutes_spent integer not null,
  automated boolean default true,
  created_at timestamp with time zone default now()
);

-- Audit Logs (GDPR compliance)
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  action text not null,
  data_type text,
  timestamp timestamp with time zone default now(),
  metadata jsonb default '{}'::jsonb
);

-- Create indexes for vector similarity search
create index knowledge_base_embedding_idx on knowledge_base 
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

create index precedents_embedding_idx on precedents 
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

-- Create function for vector similarity search (knowledge base)
create or replace function match_knowledge_base(
  query_embedding vector(3072),
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
  query_embedding vector(3072),
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
alter table users enable row level security;
alter table complaints enable row level security;
alter table documents enable row level security;
alter table time_logs enable row level security;
alter table audit_logs enable row level security;

-- RLS Policies (basic example - customize based on auth setup)
create policy "Users can view their own organization data"
  on organizations for select
  using (auth.uid() in (select id from users where organization_id = organizations.id));

create policy "Users can view complaints in their organization"
  on complaints for select
  using (organization_id in (select organization_id from users where id = auth.uid()));

create policy "Users can insert complaints in their organization"
  on complaints for insert
  with check (organization_id in (select organization_id from users where id = auth.uid()));

