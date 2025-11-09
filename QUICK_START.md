# Lightpoint - Quick Start Guide

## 🎯 Setup Your Practice (First Time Only)

1. **Navigate to Practice Settings:**
   - Click "Practice Settings" button in the dashboard header
   - Or visit: http://localhost:3004/settings

2. **Fill in your firm details:**
   ```
   Firm Name: Your Firm Name Here
   Address Line 1: 45 Victoria Street
   Address Line 2: Westminster (optional)
   City: London
   Postcode: SW1H 0EU
   Phone: 020 7946 0832
   Email: complaints@yourfirm.co.uk
   Charge-Out Rate: £185/hour (for fee recovery)
   Default Signatory: John Smith, Partner (optional)
   ```

3. **Click "Save Settings"**
   - Settings are saved locally in your browser
   - Will be used for ALL future complaint letters
   - Preview shows exactly how it will appear

## 📝 Creating a Complaint

### Option 1: Single Complaint (Multiple Documents, One Issue)

1. **Dashboard → New Complaint → Single Complaint**

2. **Enter Client Reference:**
   ```
   e.g., SEIS-2024-001
   ```

3. **Provide Context:**
   ```
   HMRC delayed SEIS claim for 14 months. Initial submission Feb 2024,
   no response until Nov 2024 (which we never received). March 2025
   they asked for SEIS3 forms, we complied April 2025. October 2025
   they contradicted their own instructions. Multiple follow-ups ignored.
   ```

4. **Upload Documents:**
   - Select "Evidence/Supporting" for each document
   - Supports: PDF, DOCX, DOC, XLS, XLSX, TXT, CSV
   - Upload all related documents (HMRC letters, responses, evidence)

5. **Click "Create Complaint"**
   - All documents will be uploaded and processed
   - Stage 1 analysis extracts details from each document
   - Wait for "All uploads complete!"

### Option 2: Batch Assessment (Multiple Documents, Different Issues)

1. **Dashboard → New Complaint → Batch Assessment**
2. Upload multiple unrelated documents
3. Provide context for each individually (optional)
4. Get separate assessments for each document

## 🔍 Analyzing the Complaint

1. **Open the complaint** from dashboard
2. **Click "Analyze Complaint"**
   - Sonnet 4.5 performs comprehensive analysis
   - Uses ALL documents with full context
   - Multi-angle knowledge base search
   - Identifies Charter violations + CRG breaches
   - Wait 20-30 seconds for analysis

3. **Review the Analysis:**
   - Charter violations identified
   - CRG references (CRG4025, CRG5225, etc.)
   - Success rate estimate
   - Recommended actions

## ✍️ Generating the Letter

1. **After analysis completes, click "Generate Letter"**
   - Opus 4.1 generates professional letter
   - Uses YOUR practice details automatically
   - Includes detailed timeline
   - Strong assertive language
   - Ready-to-send quality

2. **Review the Letter:**
   - Check all dates and amounts are correct
   - Verify timeline matches your situation
   - Confirm CRG references are appropriate
   - Update "[Insert Today's Date]" with actual date

3. **Copy and send to HMRC**

## 📚 Knowledge Base

The system includes:
- HMRC Charter commitments
- Complaint Resolution Guidance (CRG)
- Precedent cases and outcomes
- Ex-gratia payment guidance
- Standard timeframes and procedures

All embedded and searchable via vector search.

## ✅ What to Expect

### Analysis Output (Sonnet 4.5):
```json
{
  "hasGrounds": true,
  "violations": [
    {
      "type": "Unreasonable Delay",
      "description": "14+ month delay exceeds standard 28-30 days",
      "citation": "CRG4025 - Unreasonable delays"
    }
  ],
  "actions": [
    "File Tier 1 complaint (15 working days)",
    "Request compensation per CRG6050-6075",
    "Request fee reimbursement per CRG5225"
  ],
  "successRate": 85
}
```

### Letter Output (Opus 4.1):
- **Professional letterhead** (your practice details)
- **Formal subject line**
- **Detailed timeline** (5-8 specific dated entries)
- **Charter violations section** (numbered with CRG refs)
- **Impact section** (financial + distress)
- **Resolution required** (specific numbered demands)
- **Professional costs** (reference to invoice)
- **Response required** (15 days + escalation warning)
- **Strong language** throughout
- **NO PLACEHOLDERS** - ready to send!

## 🎨 Features

✅ **Multi-format support**: PDF, DOCX, XLS, CSV, TXT  
✅ **PII anonymization**: Protects sensitive data  
✅ **Stage 1 analysis**: Deep document analysis (no info loss)  
✅ **Stage 2 analysis**: Smart context management (stays within token limits)  
✅ **Hybrid AI**: Sonnet 4.5 (analysis) + Opus 4.1 (writing)  
✅ **Multi-angle KB search**: Comprehensive precedent matching  
✅ **Practice settings**: Your firm details auto-populate  
✅ **Time tracking**: Professional fees calculation  
✅ **Vector search**: Find similar cases instantly  

## 🚀 Cost Optimization

- **Sonnet 4.5** ($3/M tokens): Analysis, document processing, KB search
- **Opus 4.1** ($15/M tokens): Final letter writing only
- **73% cost savings** vs. using Opus for everything
- **Superior quality** by using each model's strengths

## 🔒 Privacy

- All PII automatically anonymized before LLM processing
- Data encrypted at rest
- Audit logging for compliance
- Local practice settings (browser only)

## 📞 Support

For issues or questions, check:
- `LOCAL_SETUP.md` - Running locally
- `AI_PROMPTS_DOCUMENTATION.md` - How AI works
- `RAILWAY_DEPLOYMENT_ISSUE.md` - Known deployment issues

---

**That's it! Configure your practice settings once, then create complaints with superior AI-generated letters.** 🎉

