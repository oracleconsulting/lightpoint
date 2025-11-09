# ⚠️ CRITICAL: Railway Environment Variables Not Configured

## Error: `TypeError: fetch failed`

This means Railway can't connect to your Supabase database because the environment variables are missing!

---

## 🔧 Fix: Add Environment Variables to Railway

### Step 1: Get Your Supabase Credentials

1. Go to https://supabase.com/dashboard/project/YOUR_PROJECT_ID/settings/api
2. Copy these values:
   - **Project URL** (starts with `https://xyz.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)
   - **service_role key** (starts with `eyJ...` - **KEEP SECRET!**)

### Step 2: Add Variables to Railway

1. Go to your Railway project: https://railway.app/project/YOUR_PROJECT_ID
2. Click on your service (lightpoint-complaint-system)
3. Click the "Variables" tab
4. Click "New Variable"
5. Add these **THREE** variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key...
SUPABASE_SERVICE_KEY=eyJ...your-service-role-key...
```

⚠️ **Important:** 
- Use the exact names above (with `NEXT_PUBLIC_` prefix for the first two)
- The `SUPABASE_SERVICE_KEY` is SECRET - never commit it to git!
- The anon key is safe for client-side (has Row Level Security)

### Step 3: Also Add OpenRouter Key (For AI Features)

```bash
OPENROUTER_API_KEY=sk-or-v1-...your-key...
```

Get this from: https://openrouter.ai/keys

### Step 4: Redeploy

Railway will automatically redeploy when you add variables.

Wait for the deployment to finish (~2 minutes), then try creating a complaint again!

---

## ✅ How to Verify It's Working

After adding the variables and redeploying:

1. Open the app
2. Open browser console (F12)
3. Try creating a complaint
4. You should see:
   - ✅ `Complaint created: {id: "...", ...}`
   - NOT ❌ `fetch failed`

---

## 🔍 Check Railway Logs

To see the actual error:

1. Go to Railway dashboard
2. Click "Deployments" tab
3. Click the latest deployment
4. Look for errors mentioning "Supabase" or "Missing environment variables"

---

## Current State

✅ Code is deployed and correct
✅ Database schema exists (once you run migrations)
❌ **Railway can't connect to Supabase** (no env vars)

**Once you add the environment variables, everything will work!**

