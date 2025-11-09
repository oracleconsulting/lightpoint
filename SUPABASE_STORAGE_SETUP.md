# Supabase Storage Setup - CRITICAL STEP! 📦

## ⚠️ ISSUE: File uploads are failing with "Failed to upload file"

**Root Cause:** The Supabase Storage bucket `complaint-documents` doesn't exist yet.

---

## 🎯 Quick Fix (2 minutes):

### Step 1: Create the Storage Bucket

1. Go to your Supabase project dashboard
2. Click **Storage** in the left sidebar
3. Click **New bucket**
4. Enter these settings:
   - **Name:** `complaint-documents`
   - **Public:** ❌ **No** (keep it private)
   - **File size limit:** 10 MB (or higher if needed)
5. Click **Create bucket**

---

### Step 2: Set Up Access Policies

The bucket needs RLS policies so your app can upload files. 

Go to **Storage > Policies** and create these two policies:

#### Policy 1: Allow Uploads
```sql
create policy "Allow authenticated uploads"
on storage.objects for insert
to authenticated, anon
with check (bucket_id = 'complaint-documents');
```

#### Policy 2: Allow Downloads
```sql
create policy "Allow authenticated downloads"
on storage.objects for select
to authenticated, anon
using (bucket_id = 'complaint-documents');
```

**OR** use the Supabase UI:

1. Click **New Policy** on the `complaint-documents` bucket
2. Choose **Custom policy**
3. For **INSERT** (uploads):
   - Target roles: `authenticated`, `anon`
   - USING expression: (leave empty)
   - WITH CHECK expression: `bucket_id = 'complaint-documents'`
4. For **SELECT** (downloads):
   - Target roles: `authenticated`, `anon`
   - USING expression: `bucket_id = 'complaint-documents'`
   - WITH CHECK expression: (leave empty)

---

### Step 3: Verify It Works

1. Go back to your app: https://lightpoint-production.up.railway.app/complaints/new
2. Try creating a complaint and uploading files again
3. You should now see:
   ```
   ✅ Uploaded SAAEU01 - HMRC Mar-25.pdf
   ✅ Uploaded SAAEU01 - Letterhead to HMRC Feb-24.docx
   ✅ Uploaded Umeryr Saeed - SEIS Claim summary...pdf
   ```

---

## 📊 What This Bucket Stores:

- **Original complaint documents** (PDFs, DOCX)
- **Uploaded evidence files**
- **HMRC correspondence**
- **Generated complaint letters**

All files are:
- ✅ Encrypted at rest (Supabase default)
- ✅ PII-stripped before AI processing
- ✅ Organization-isolated via RLS
- ✅ Automatically backed up

---

## 🔍 Troubleshooting:

### Still getting "Failed to upload file"?

1. **Check bucket exists:**
   - Supabase Dashboard > Storage > Should see `complaint-documents`

2. **Check policies:**
   - Storage > complaint-documents > Policies tab
   - Should see INSERT and SELECT policies

3. **Check environment variables:**
   - Railway > Variables > Should have `SUPABASE_SERVICE_KEY`
   - This key bypasses RLS, so it should work even without policies

4. **Check Railway logs:**
   ```bash
   railway logs
   ```
   - Look for "Upload error:" messages with details

---

## ✅ After Setup:

Once the bucket is created, your uploads will work and you'll see:

1. **Console logs:**
   ```
   ✅ Complaint created
   📤 Uploading 3 documents...
   ✅ Uploaded file 1
   ✅ Uploaded file 2
   ✅ Uploaded file 3
   🔄 Navigating to /complaints/xxx
   ```

2. **Supabase Storage:**
   - Files appear in `complaint-documents` bucket
   - Organized by complaint ID and document type

3. **Database:**
   - `documents` table has entries
   - `processed_data` field contains extracted text
   - `embedding` field has vector embeddings for search

🎉 **Your AI-powered complaint system will then be fully operational!**

