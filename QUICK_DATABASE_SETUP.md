# Quick Database Setup

## ⚠️ IMPORTANT: Run These Migrations in Supabase

The database is missing required columns. You need to run these SQL migrations in your Supabase dashboard:

### Step 1: Go to Supabase SQL Editor
1. Open your Supabase project: https://supabase.com/dashboard/project/YOUR_PROJECT_ID
2. Click "SQL Editor" in the left sidebar
3. Click "New query"

### Step 2: Run Migrations in Order

#### Migration 1: Base Schema
Copy and paste the contents of:
```
supabase/migrations/001_initial_schema_safe.sql
```
Click "Run" ✅

#### Migration 2: Document Vectorization & Timeline
Copy and paste the contents of:
```
supabase/migrations/002_enhance_documents_and_timeline.sql
```
Click "Run" ✅

#### Migration 3: Add Missing Columns (CRITICAL!)
Copy and paste the contents of:
```
supabase/migrations/003_add_missing_complaint_columns.sql
```
Click "Run" ✅

### Step 3: Verify

Run this query to check if columns exist:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'complaints'
ORDER BY ordinal_position;
```

You should see:
- ✅ `complaint_reference`
- ✅ `complaint_type`
- ✅ `hmrc_department`
- ✅ `complaint_context`
- ✅ `timeline`
- ✅ `status`
- ... (other columns)

### Step 4: Test

After running migrations, try creating a complaint again in the app!

---

## Alternative: Use Supabase CLI

If you have Supabase CLI installed:

```bash
cd lightpoint-complaint-system
supabase db push
```

This will automatically run all migrations in the `supabase/migrations/` folder.

---

## Current Error

If you see:
```
Could not find the 'complaint_type' column of 'complaints' in the schema cache
```

It means **Migration 3 hasn't been run yet**. Go run it in your Supabase SQL Editor!

