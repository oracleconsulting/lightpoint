# Quick Railway Deployment Steps

## ✅ Repository Status
- Code pushed to: https://github.com/oracleconsulting/lightpoint
- Branch: main
- All files committed

## 🚀 Deploy to Railway (Step-by-Step)

### 1. Create Railway Project

1. Go to https://railway.app
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Authorize Railway to access your GitHub account
5. Select the **oracleconsulting/lightpoint** repository
6. Railway will automatically detect it as a Next.js project

### 2. Configure Environment Variables

In the Railway dashboard, go to the **Variables** tab and add these:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_role_key

# OpenRouter API (for Claude-3 Opus)
OPENROUTER_API_KEY=your_openrouter_api_key

# OpenAI API (for Embeddings)
OPENAI_API_KEY=your_openai_api_key

# Encryption Key (generate a 32+ character random string)
ENCRYPTION_KEY=your-secure-encryption-key-minimum-32-characters

# App URL (Railway will provide this after first deployment)
NEXT_PUBLIC_APP_URL=${{RAILWAY_PUBLIC_DOMAIN}}
```

**How to get these keys:**

- **Supabase**: https://app.supabase.com → Your Project → Settings → API
- **OpenRouter**: https://openrouter.ai/keys
- **OpenAI**: https://platform.openai.com/api-keys
- **Encryption Key**: Generate with: `openssl rand -base64 32`

### 3. Deploy

Railway will automatically:
- ✅ Install dependencies (`npm install`)
- ✅ Build the project (`npm run build`)
- ✅ Deploy the application
- ✅ Provide a public URL

**First deployment typically takes 3-5 minutes.**

### 4. Set Up Supabase Database

#### A. Run the Migration

1. Go to your Supabase project: https://app.supabase.com
2. Click **SQL Editor** in the left menu
3. Click **New Query**
4. Copy the contents of `supabase/migrations/001_initial_schema.sql`
5. Paste and click **Run**

#### B. Create Storage Bucket

1. In Supabase, go to **Storage** in the left menu
2. Click **Create new bucket**
3. Name it: `complaint-documents`
4. Set it to **Private**
5. Click **Create bucket**

#### C. Set Storage Policies (Optional but Recommended)

In the Storage bucket, add these policies:

```sql
-- Allow authenticated users to upload
create policy "Allow uploads"
on storage.objects for insert
with check (bucket_id = 'complaint-documents');

-- Allow authenticated users to read
create policy "Allow reads"
on storage.objects for select
using (bucket_id = 'complaint-documents');
```

### 5. Update App URL

After the first deployment, Railway will provide a URL like:
```
https://lightpoint-production-xxxx.railway.app
```

Update the `NEXT_PUBLIC_APP_URL` variable in Railway with this URL.

### 6. Seed Knowledge Base

Before using the system, populate it with HMRC guidance:

See `KNOWLEDGE_SEEDING.md` for detailed instructions.

Quick start:
- Add HMRC Charter commitments
- Add CRG guidance sections
- Add sample precedent cases

### 7. Test the Deployment

Visit your Railway URL and:
1. ✅ Check the dashboard loads
2. ✅ Create a test complaint
3. ✅ Upload a document
4. ✅ Run analysis
5. ✅ Generate a letter

## 🔧 Troubleshooting

### Build Fails
- Check Railway logs in the **Deployments** tab
- Verify all environment variables are set correctly
- Ensure `package.json` has no syntax errors

### Database Connection Errors
- Verify Supabase credentials are correct
- Check that the migration ran successfully
- Ensure RLS policies don't block access

### API Errors
- Verify OpenRouter API key is valid
- Check OpenAI API key has credits
- Review logs in Railway dashboard

## 📊 Monitoring

### Railway Dashboard
- **Deployments**: View build logs and deployment status
- **Metrics**: Monitor CPU, memory, and network usage
- **Logs**: Real-time application logs

### Health Check
Your app has a health endpoint at:
```
https://your-app.railway.app/api/health
```

## 🔄 Continuous Deployment

Railway automatically deploys when you push to the `main` branch:

```bash
# Make changes locally
cd /Users/James.Howard/Documents/OracleConsultingAI/lightpoint-complaint-system

# Commit and push
git add .
git commit -m "Your changes"
git push origin main

# Railway automatically deploys! 🚀
```

## 💰 Cost Estimate

Railway pricing (as of 2024):
- **Hobby Plan**: $5/month + usage
- **Pro Plan**: $20/month + usage
- Usage-based pricing for compute and bandwidth

Typical monthly cost for Lightpoint: **$10-30** depending on usage.

## 📞 Support

- **Railway Discord**: https://discord.gg/railway
- **Railway Docs**: https://docs.railway.app
- **Supabase Docs**: https://supabase.com/docs

## ✨ Optional Enhancements

### Custom Domain
1. In Railway → Settings → **Domains**
2. Add your custom domain
3. Update DNS records as instructed
4. Update `NEXT_PUBLIC_APP_URL` variable

### Production Checklist
- [ ] Environment variables configured
- [ ] Database migrated
- [ ] Storage bucket created
- [ ] Knowledge base seeded
- [ ] Health check passing
- [ ] Test complaint workflow
- [ ] Custom domain configured (optional)
- [ ] Team access configured
- [ ] Monitoring alerts set up

---

**Status**: Ready to deploy! 🚀

**Estimated deployment time**: 10-15 minutes

