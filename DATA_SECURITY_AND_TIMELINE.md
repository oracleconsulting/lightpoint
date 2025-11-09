# Data Security, Isolation & Timeline System

## 🔒 Multi-Tenant Data Isolation

### Organization-Level Security

Every piece of data in Lightpoint is **isolated by organization** using Supabase Row Level Security (RLS):

```
Organization A              Organization B
├── User 1                 ├── User 3
├── User 2                 └── User 4
├── Complaint #001         ├── Complaint #100
│   ├── Document 1         │   ├── Document 1
│   ├── Document 2         │   └── Document 2
│   └── Timeline           └── Timeline
└── Complaint #002         
    └── ...                
```

**No data can cross organization boundaries** - it's enforced at the database level.

---

## 🗄️ Document Vectorization & Secure Storage

### How Documents Are Stored

1. **File Storage** (Supabase Storage)
   - Organized by: `organization_id/complaint_id/document_id.pdf`
   - Access controlled by RLS policies
   - Each organization has its own storage bucket namespace

2. **Document Metadata** (PostgreSQL + pgvector)
   ```sql
   documents
   ├── id (uuid)
   ├── complaint_id (links to specific complaint)
   ├── filename
   ├── file_path
   ├── sanitized_text (PII-anonymized content)
   ├── embedding (vector(1536)) ← For semantic search
   ├── document_type (hmrc_letter, evidence, etc.)
   ├── document_date
   └── processed_data (extracted info)
   ```

3. **Vector Search - Scoped to Organization**
   ```sql
   -- Search within ONE complaint (most common)
   match_complaint_documents(complaint_id, embedding)
   
   -- Search across ALL complaints in your organization (precedent building)
   search_organization_documents(embedding)
   ```

### Data Isolation Guarantees

✅ **Organization A cannot see Organization B's documents** - enforced by RLS
✅ **Document embeddings are organization-scoped** - search functions filter by org
✅ **Storage paths include organization ID** - physical file separation
✅ **All queries automatically filtered** - RLS policies on every table

---

## 📊 Timeline System

### Timeline Structure

Each complaint has a **complete timeline** stored as JSONB:

```json
{
  "timeline": [
    {
      "id": "uuid",
      "date": "2024-11-09T10:00:00Z",
      "type": "document_uploaded",
      "title": "HMRC Letter Received",
      "description": "Penalty notice for £5,000",
      "document_id": "uuid",
      "user_id": "uuid",
      "metadata": {
        "filename": "HMRC_Penalty_Notice.pdf",
        "document_type": "hmrc_letter"
      }
    },
    {
      "id": "uuid",
      "date": "2024-11-09T11:30:00Z",
      "type": "letter_generated",
      "title": "Complaint Letter Generated",
      "description": "AI-generated formal complaint citing Charter commitment 1.2",
      "document_id": "uuid",
      "user_id": "uuid",
      "metadata": {
        "violations": ["Unreasonable delay", "Poor communication"],
        "confidence": 0.89
      }
    },
    {
      "id": "uuid",
      "date": "2024-11-12T14:00:00Z",
      "type": "hmrc_response",
      "title": "HMRC Response Received",
      "description": "Response upholding original decision",
      "document_id": "uuid",
      "user_id": "uuid"
    },
    {
      "id": "uuid",
      "date": "2024-11-15T09:00:00Z",
      "type": "escalation",
      "title": "Escalated to Adjudicator",
      "description": "Formal escalation due to inadequate response",
      "document_id": "uuid",
      "user_id": "uuid"
    },
    {
      "id": "uuid",
      "date": "2024-12-01T16:00:00Z",
      "type": "status_change",
      "title": "Complaint Resolved - Successful",
      "description": "HMRC issued apology and £500 compensation",
      "metadata": {
        "previous_status": "active",
        "new_status": "resolved",
        "final_outcome": "successful"
      }
    }
  ]
}
```

### Timeline Event Types

| Type | Description | Example |
|------|-------------|---------|
| `document_uploaded` | Any document added | HMRC letter, evidence, statement |
| `letter_generated` | AI-generated complaint letter | Initial complaint, escalation letter |
| `hmrc_response` | Response from HMRC | Acknowledgement, decision, appeal result |
| `escalation` | Complaint escalated | To manager, Adjudicator, ombudsman |
| `status_change` | Complaint status changed | Draft → Active → Resolved |
| `note` | User note/comment | Internal team communication |
| `archived` | Complaint archived | Case closed with outcome |

### Helper Functions

```sql
-- Add timeline event
SELECT add_timeline_event(
  p_complaint_id := 'uuid',
  p_event_type := 'document_uploaded',
  p_title := 'HMRC Response Received',
  p_description := 'Response denying complaint',
  p_document_id := 'uuid',
  p_user_id := auth.uid()
);

-- Get timeline
SELECT * FROM get_complaint_timeline('complaint-uuid');

-- Get specific event types
SELECT * FROM get_complaint_timeline('complaint-uuid', 'hmrc_response');
```

---

## 🗃️ Complaint Archival System

### Archive Types

Complaints are archived with one of these outcomes:

- ✅ **`successful`** - Full or substantial remedy achieved
- ⚠️ **`partially_successful`** - Some remedy, not complete
- ❌ **`unsuccessful`** - No remedy achieved
- 🚫 **`withdrawn`** - Client withdrew complaint
- 📤 **`escalated_to_adjudicator`** - Moved to Adjudicator

### Archive Process

```sql
-- Archive a complaint
SELECT archive_complaint(
  p_complaint_id := 'uuid',
  p_final_outcome := 'successful',
  p_archive_reason := 'HMRC issued £500 compensation and formal apology'
);
```

**What happens:**
1. Complaint marked as `archived = true`
2. Status set to `closed`
3. Final outcome recorded
4. Timestamp captured
5. Timeline event automatically added

### Querying Archives

```sql
-- Active complaints only
SELECT * FROM complaints 
WHERE archived = false;

-- Archived complaints
SELECT * FROM complaints 
WHERE archived = true
ORDER BY archived_at DESC;

-- Success rate
SELECT 
  final_outcome,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM complaints
WHERE archived = true
GROUP BY final_outcome;
```

---

## 🔍 Document Analysis Tracking

### AI Analysis Storage

Every AI analysis is logged for transparency and learning:

```sql
document_analysis
├── id
├── document_id
├── complaint_id
├── analysis_type
│   ├── charter_violation
│   ├── timeline_extraction
│   ├── financial_impact
│   ├── key_dates
│   └── precedent_match
├── analysis_result (jsonb)
├── confidence_score (0-1)
├── analyzed_at
└── analyzed_by ('ai' or user_id)
```

### Example Analysis Record

```json
{
  "document_id": "uuid",
  "analysis_type": "charter_violation",
  "analysis_result": {
    "violations": [
      {
        "charter_commitment": "1.2 - Timely Response",
        "description": "HMRC failed to respond within 28 days",
        "evidence": "Letter sent 15/01/2024, chase sent 20/02/2024, no response by 01/03/2024",
        "severity": "high"
      }
    ],
    "recommended_actions": ["Formal complaint", "Request compensation"],
    "similar_precedents": ["case-001", "case-045"]
  },
  "confidence_score": 0.87,
  "analyzed_by": "ai"
}
```

---

## 🛡️ Security Best Practices

### 1. Data Encryption
- ✅ PII anonymized before storage
- ✅ Client names encrypted at rest
- ✅ Document text sanitized before AI processing

### 2. Access Control
- ✅ Organization-level RLS on all tables
- ✅ User role-based permissions (admin, analyst, viewer)
- ✅ Audit logging on all sensitive operations

### 3. Document Isolation
- ✅ Vector search scoped to organization
- ✅ File storage paths include org ID
- ✅ Cross-org queries impossible at DB level

### 4. GDPR Compliance
- ✅ Audit trail of all data access
- ✅ Right to erasure (delete complaint cascade)
- ✅ Data export functionality
- ✅ No client data sent to AI training

---

## 📈 Scaling Considerations

### Current Setup (MVP)
- Single Supabase project
- Organization-level isolation via RLS
- Shared knowledge base (HMRC Charter, CRG guidance)
- Isolated complaint/document data per org

### Future Scaling (Production)
- Consider separate Supabase projects per large customer
- Dedicated embeddings for each organization's internal precedents
- Regional compliance (UK GDPR, data residency)
- Advanced audit logging and monitoring

---

## 🚀 Implementation Status

✅ **Implemented:**
- Organization-level data isolation (RLS)
- Document vectorization
- Timeline system with helper functions
- Archive system with outcomes
- Document analysis tracking
- Secure vector search (org-scoped)

📋 **To Do:**
- Frontend timeline visualization component
- Archive dashboard with success metrics
- Document analysis UI display
- Bulk document upload with progress tracking
- Timeline export (PDF report)

---

## 📚 Related Files

- `/supabase/migrations/001_initial_schema_safe.sql` - Base schema
- `/supabase/migrations/002_enhance_documents_and_timeline.sql` - This enhancement
- `/lib/documentProcessor.ts` - Document upload & processing
- `/lib/vectorSearch.ts` - Vector search functions
- `/lib/correspondenceTracking.ts` - Timeline management

---

**Questions?** Check `DEPLOYMENT.md` for Supabase setup instructions.

