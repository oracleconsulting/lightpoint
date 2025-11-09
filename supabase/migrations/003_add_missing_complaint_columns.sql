-- Migration: Add missing columns to complaints table
-- These columns are needed for complaint categorization

alter table complaints add column if not exists complaint_type text;
alter table complaints add column if not exists hmrc_department text;

-- Add index for filtering
create index if not exists complaints_type_idx on complaints(complaint_type);
create index if not exists complaints_department_idx on complaints(hmrc_department);

