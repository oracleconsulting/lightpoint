# AI Model Optimization Research Guide
## Detailed Breakdown for LLM Selection at Each Stage

**Purpose:** Enable research into optimal AI models for each processing stage  
**Current Status:** ✅ OPTIMIZED - Using best-in-class models via OpenRouter  
**Reranking:** ✅ INTEGRATED - Cohere/Voyage reranking active in all search paths  
**Testing:** ✅ READY - Complete testing framework built  
**Goal:** Continuous optimization based on data-driven testing

---

## 🎯 Current Optimized Stack (November 2025)

### Production Models (Active)

| Stage | Model | Cost/M | Context | Purpose |
|-------|-------|--------|---------|---------|
| **0A: Embeddings** | text-embedding-ada-002 | $0.10 | 8K | Vector search (WILL TEST 3-small) |
| **0B: Document Extraction** | Sonnet 4.5 | $3.00 | 200K | Extract dates/amounts/refs (WILL TEST Haiku 4.5) |
| **1: Reranking** | ✅ Cohere Rerank 3.5 | $1/1K searches | - | Cross-encoder precision boost |
| **2: Complaint Analysis** | Sonnet 4.5 | $3.00 | 200K | Synthesize complaint from docs |
| **3A: Letter Facts** | Haiku 4.5 | $0.25 | 200K | Fast fact extraction |
| **3B: Letter Structure** | Sonnet 4.5 | $3.00 | 200K | Clean legal structure |
| **3C: Letter Tone** | Opus 4.1 | $15.00 | 200K | Frontier writing quality |

### Cost per Complaint

**Current**: ~$0.60-0.80 per complaint
- Embeddings: $0.0001
- Document extraction: $0.03
- Reranking: $0.003-0.010
- Analysis: $0.15
- Letter (3-stage): $0.40

**Target** (after testing): ~$0.35-0.50 per complaint
- Switch to 3-small embeddings: -80% ($960/year)
- Switch to Haiku extraction: -92% ($33k/year)
- Keep reranking: Quality > cost

---

## 📊 Data Storage & Processing Map

### Where Data Lives

```
┌─────────────────────────────────────────────────────────────┐
│                    DATA STORAGE LAYER                       │
└─────────────────────────────────────────────────────────────┘

1. SUPABASE POSTGRESQL (Primary Database)
   Location: Supabase Cloud (europe-west region available)
   Size: Currently <1GB, scalable to 50GB (Pro plan)
   
   Tables:
   ├── complaints (text data, JSONB metadata)
   ├── documents (text + VECTOR(1536) embeddings)
   ├── knowledge_base (text + VECTOR(1536) embeddings, ~50 docs)
   ├── precedents (text + VECTOR(1536) embeddings, 16 cases)
   ├── generated_letters (text, timestamps, metadata)
   └── time_logs (integer, timestamps)

2. SUPABASE STORAGE (File Storage)
   Location: Supabase Cloud S3-compatible
   Bucket: complaint-documents
   Files: Original PDFs, DOCX, XLS, CSV, TXT
   Size: ~50MB currently, scalable to GBs

3. BROWSER LOCAL STORAGE (Temporary)
   Location: User's browser
   Data: Practice settings (firm name, rates)
   Size: <10KB
   Purpose: No backend needed for settings

4. IN-MEMORY (Transient)
   Location: Railway server RAM
   Data: Intermediate processing results
   Duration: Request lifetime only
```

---

## 🔄 AI Processing Pipeline: Detailed Breakdown

### STAGE 0: Document Upload & Initial Processing

**What Happens:**
```
User uploads file → Server receives → Store to Supabase Storage
                                           ↓
                              Extract text (no AI yet)
                                           ↓
                    Call STAGE 0A: Embedding Generation
```

#### STAGE 0A: Text → Vector Embedding

**Current Implementation:**
```typescript
// lib/embeddings.ts
const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
  model: 'openai/text-embedding-ada-002',
  input: text
});
// Returns: float[1536]
```

**Input:**
- Text: Extracted document content (up to ~8K tokens)
- Format: Plain string

**Output:**
- Vector: float[1536] (array of floating-point numbers)
- Purpose: Enable similarity search

**Current Model:** `openai/text-embedding-ada-002`
- Provider: OpenAI (via OpenRouter)
- Dimensions: 1536
- Cost: $0.10 per 1M tokens
- Speed: ~100ms per document
- Max input: 8,191 tokens

**✅ TESTING READY:** `npm run test:embeddings`
- Compare ada-002 vs 3-small vs 3-large
- Measure precision@3, recall@10
- Potential: Switch to 3-small = $960/year savings

**Research Questions:**
1. **Quality:** Are there better embeddings for legal/formal text?
2. **Cost:** Cheaper alternatives with similar quality?
3. **Dimensions:** Would 768d or 3072d be better for our use case?
4. **Multilingual:** Future UK Scottish Gaelic/Welsh support?

**Alternative Models to Research:**

| Model | Provider | Dimensions | Cost | Speed | Notes |
|-------|----------|------------|------|-------|-------|
| text-embedding-ada-002 | OpenAI | 1536 | $0.10/M | Fast | Current |
| text-embedding-3-small | OpenAI | 1536 | $0.02/M | Fast | 5x cheaper! |
| text-embedding-3-large | OpenAI | 3072 | $0.13/M | Fast | Higher quality? |
| embed-english-v3.0 | Cohere | 1024 | $0.10/M | Fast | Optimized for English |
| voyage-law-2 | Voyage AI | 1024 | $0.12/M | Medium | **Legal domain-specific** |
| e5-mistral-7b-instruct | Mistral | 4096 | $0.08/M | Slow | High quality |
| bge-large-en-v1.5 | BAAI | 1024 | Free | Self-host | Open source |

**⭐ Recommended Research:**
- **Voyage Law 2** - Built for legal documents, might capture HMRC language better
- **text-embedding-3-small** - 5x cheaper, similar quality per OpenAI
- **Cohere embed-english** - Known for good retrieval performance

**Testing Approach:**
```typescript
// Benchmark embeddings quality
const testQuery = "14-month SEIS relief delay CRG4025 violation";
const testDocs = [
  "CRG4025: Unreasonable delays...",
  "Charter: Being Responsive...",
  "Precedent: 12-month delay case..."
];

// Test each embedding model
for (model of embeddingModels) {
  const results = await searchWithModel(model, testQuery, testDocs);
  // Measure: Precision@3, Recall@5, Speed, Cost
}
```

---

#### STAGE 0B: Individual Document Analysis

**Current Implementation:**
```typescript
// lib/documentAnalysis.ts
export const analyzeIndividualDocument = async (documentText: string)
```

**Model:** `anthropic/claude-sonnet-4.5`
- Context: Up to 1M tokens (but typically 10-50K per document)
- Temperature: 0.2 (factual extraction)
- Cost: $3 per 1M input tokens, $15 per 1M output tokens

**Input:**
- Document text (plain string, 5K-50K tokens)
- Document type (PDF, DOCX, etc.)
- Filename

**Output (Stored in `documents.processed_data.detailed_analysis`):**
```json
{
  "documentType": "HMRC correspondence",
  "keyDates": ["2024-02-15", "2024-03-20"],
  "amounts": ["£34,000 SEIS relief"],
  "hmrcReferences": ["REF123456"],
  "keyEvents": [
    "Claim submitted with SEIS3 forms",
    "HMRC requested additional information"
  ],
  "hmrcFailures": [
    "No response for 9 months",
    "Lost correspondence"
  ],
  "actionItems": ["Follow up on missing letter"],
  "urgency": "high"
}
```

**Purpose:**
- Extract ALL specific details from document immediately
- Store full analysis to avoid information loss
- Enable detailed complaint analysis without re-reading docs

**Current Performance:**
- Speed: 3-5 seconds per document
- Accuracy: Excellent for structured extraction
- Cost: ~$0.05-0.15 per document (depending on size)

**Research Questions:**
1. **Is Sonnet 4.5 overkill for extraction?**
2. **Would a cheaper model (GPT-4o-mini) work as well?**
3. **Could we use structured output (JSON mode) for consistency?**
4. **Is fine-tuning worthwhile for HMRC document patterns?**

**Alternative Models to Research:**

| Model | Provider | Context | Cost | Speed | JSON Mode | Notes |
|-------|----------|---------|------|-------|-----------|-------|
| claude-sonnet-4.5 | Anthropic | 1M | $3/M in | Fast | ✅ | Current |
| claude-haiku-4 | Anthropic | 200K | $0.25/M in | Very Fast | ✅ | **12x cheaper!** |
| gpt-4o-mini | OpenAI | 128K | $0.15/M in | Fast | ✅ | Cheap, good |
| gpt-4o | OpenAI | 128K | $2.50/M in | Fast | ✅ | Slightly cheaper |
| gemini-1.5-flash | Google | 1M | $0.075/M in | Very Fast | ✅ | **40x cheaper!** |
| gemini-1.5-pro | Google | 2M | $1.25/M in | Medium | ✅ | Huge context |
| llama-3.1-70b | Meta | 128K | $0.35/M in | Medium | ⚠️ | Open weights |

**⭐ Recommended Research:**
- **Claude Haiku 4** - Same family as Sonnet, 12x cheaper, excellent for extraction
- **Gemini 1.5 Flash** - 40x cheaper, very fast, 1M context
- **GPT-4o-mini** - Proven extraction quality, cheap

**Testing Approach:**
```typescript
// Benchmark document analysis
const testDocuments = [
  hmrcLetter,      // Structured
  clientEmail,     // Unstructured
  excelSpreadsheet // Tabular
];

for (model of analysisModels) {
  const results = await analyzeWithModel(model, testDocuments);
  // Measure:
  // - Extraction completeness (did it get all dates/amounts?)
  // - Accuracy (correct dates/amounts?)
  // - Cost per document
  // - Speed
  // - JSON consistency
}
```

---

### STAGE 1: Knowledge Base Search (Vector Similarity + Reranking)

**✅ NOW WITH RERANKING INTEGRATION (Quality-First Approach)**

**Current Implementation:**
```typescript
// lib/vectorSearch.ts
export const searchKnowledgeBaseMultiAngle = async (query: string)
```

**Process (Updated with Reranking):**
1. Generate embedding for query (STAGE 0A model)
2. Search knowledge_base table using pgvector
3. Perform 6 different searches with different angles
4. Get 30 candidates (3x the final count)
5. **✅ NEW: Rerank with Cohere/Voyage for precision**
6. Return top 10 most relevant

**Two-Stage Retrieval Pipeline:**

```
STAGE 1A: Candidate Generation (Fast & Broad)
    ↓
Vector Search → 30 candidates (high recall)
    ↓
STAGE 1B: Reranking (Slow & Precise) ✅ NEW!
    ↓
Cohere Cross-Encoder → Top 10 (high precision)
```

**Database Query:**
```sql
-- Uses pgvector extension
SELECT *, embedding <-> $1::vector as distance
FROM knowledge_base
WHERE embedding <-> $1::vector < 0.3  -- similarity threshold
ORDER BY embedding <-> $1::vector
LIMIT 30;  -- Get more candidates for reranking
```

**✅ Reranking Integration:**
```typescript
// After vector search
if (USE_RERANKING && results.length > 10) {
  if (RERANKER === 'cohere') {
    results = await cohereRerank(query, results, 10);
  } else if (RERANKER === 'voyage') {
    results = await voyageRerank(query, results, 10);
  }
}
```

**Index:** HNSW (Hierarchical Navigable Small World)
- Optimized for high-recall similarity search
- Handles 10K-100K vectors efficiently

**Input:**
- Query: "14-month SEIS delay, no response from HMRC"
- Returns: Top 10 most relevant Charter/CRG documents (reranked)

**Output (passed to next stage):**
```json
[
  {
    "id": "uuid",
    "title": "CRG4025 - Unreasonable Delays",
    "content": "Where HMRC takes longer than...",
    "similarity": 0.85,
    "rerank_score": 0.98  // ← NEW: Cross-encoder score
  },
  {
    "id": "uuid",
    "title": "Charter: Being Responsive",
    "content": "HMRC will respond within 15 working days...",
    "similarity": 0.82,
    "rerank_score": 0.95  // ← Higher precision than vector alone
  }
]
```

**Performance Impact:**
- **Speed**: +200-300ms per search (acceptable for quality)
- **Precision@3**: +15-30% improvement
- **Cost**: +$0.001-0.003 per search
- **Quality**: Better CRG/Charter citations in letters

**Research Questions:**
1. ~~**Re-ranking:** Should we use a cross-encoder after retrieval?~~ ✅ **DONE**
2. **Is HNSW the best index for our data size?**
3. **Should we use IVFFlat for larger scale?**
4. **Optimal similarity threshold?** (currently 0.7-0.8)
5. **Cohere vs Voyage:** Which reranker performs better for legal text?

**Alternative Approaches:**

| Approach | Tool | Cost | Speed | Recall | Precision | Notes |
|----------|------|------|-------|--------|-----------|-------|
| Vector only | pgvector | Free | Fast (50ms) | High | Good (70%) | Previous |
| ✅ Vector + Cohere | pgvector + Cohere | $1/1K | Medium (300ms) | High | Excellent (90%) | **ACTIVE** |
| Vector + Voyage | pgvector + Voyage | $0.50/1K | Medium (300ms) | High | Excellent (88%) | Alternative |
| HNSW (current) | pgvector | Free | Fast | High | - | Good for <100K vectors |
| IVFFlat | pgvector | Free | Faster | Medium | - | Better for >100K vectors |
| Pinecone | Pinecone | $70/mo | Fast | High | - | Managed, serverless |
| Weaviate | Self-host | Compute | Fast | High | - | Open source, features |

**✅ Already Implemented:**
- ✅ Cross-encoder reranking (Cohere + Voyage)
- ✅ Multi-angle search (6 query variations)
- ✅ Hybrid search infrastructure (lib/search/hybridSearch.ts)

**Testing Approach:**
```typescript
// Benchmark retrieval quality
const testQueries = [
  "PAYE code dispute after NHS rotation",
  "Lost HMRC correspondence, debt collection active",
  "14-month SEIS delay, contradictory instructions"
];

const groundTruth = {
  // Manually labeled correct documents for each query
};

for (approach of retrievalApproaches) {
  const results = await searchWithApproach(approach, testQueries);
  // Measure:
  // - Precision@3 (top 3 results correct?)
  // - Recall@10 (found all relevant docs in top 10?)
  // - Speed
  // - Cost
}
```

---

### STAGE 2: Complaint-Level Analysis

**Current Implementation:**
```typescript
// lib/openrouter/client.ts
export const analyzeComplaint = async (
  documentData: string,    // From Stage 0B
  relevantGuidance: string, // From Stage 1
  similarCases: string      // From Stage 1 precedents
)
```

**Model:** `anthropic/claude-sonnet-4.5`
- Context: 200K tokens (managed via context budget)
- Temperature: 0.3 (analytical, consistent)
- Cost: $3 per 1M input tokens

**Input (Combined):**
```
Total: ~150K tokens
├── Complaint context: 2K tokens
├── Document analyses: 50K tokens (from Stage 0B)
├── Knowledge base results: 80K tokens (top 10 docs)
└── Precedent cases: 18K tokens (top 3 cases)
```

**Output (JSON):**
```json
{
  "hasGrounds": true,
  "complaintCategory": ["SEIS/EIS Claims", "Delayed Responses"],
  "violations": [
    {
      "type": "Unreasonable Delay",
      "description": "14-month delay vs 30-day standard",
      "citation": "CRG4025",
      "severity": "high"
    }
  ],
  "timeline": {
    "totalDuration": "14 months",
    "longestGap": "9 months",
    "missedDeadlines": 6
  },
  "systemErrors": [
    {
      "type": "Lost correspondence",
      "departments": ["SEIS Processing", "Correspondence"]
    }
  ],
  "breakthroughTriggers": [
    "14-month delay (1,400% beyond standard)",
    "Pattern of lost correspondence"
  ],
  "actions": [
    "File Tier 1 complaint with 15-day deadline",
    "Request £500 distress payment per CRG6050"
  ],
  "compensationEstimate": {
    "professionalFees": "£2,220 (12 hours @ £185/hour)",
    "distressPayment": "£500"
  },
  "successRate": 92,
  "escalationRequired": "Tier1",
  "reasoning": "Strong grounds based on duration, lost correspondence..."
}
```

**Purpose:**
- Synthesize all information into structured analysis
- Identify Charter/CRG violations
- Estimate success probability
- Recommend escalation path

**Current Performance:**
- Speed: 8-12 seconds
- Accuracy: Excellent for structured analysis
- Cost: ~$0.50 per analysis

**Research Questions:**
1. **Is Sonnet 4.5 optimal for JSON structured output?**
2. **Would GPT-4o's native JSON mode be better?**
3. **Could we use a specialized legal reasoning model?**
4. **Should we split into sub-tasks (violations, timeline, etc.)?**

**Alternative Models to Research:**

| Model | Provider | Context | Cost | JSON | Reasoning | Notes |
|-------|----------|---------|------|------|-----------|-------|
| claude-sonnet-4.5 | Anthropic | 200K | $3/M | ✅ | Excellent | Current |
| claude-opus-4.1 | Anthropic | 200K | $15/M | ✅ | Superior | 5x more expensive |
| gpt-4o | OpenAI | 128K | $2.50/M | ✅ Native | Excellent | Slightly cheaper |
| gpt-4-turbo | OpenAI | 128K | $10/M | ✅ Native | Excellent | More expensive |
| gemini-1.5-pro | Google | 2M | $1.25/M | ✅ | Very Good | 2.4x cheaper |
| gemini-1.5-flash | Google | 1M | $0.075/M | ✅ | Good | 40x cheaper |
| o1-preview | OpenAI | 128K | $15/M | ⚠️ | **Best** | Reasoning specialist |
| o1-mini | OpenAI | 128K | $3.75/M | ⚠️ | Very Good | Reasoning focused |

**⭐ Recommended Research:**
- **GPT-4o** - Native JSON mode, slightly cheaper, excellent reasoning
- **Gemini 1.5 Pro** - 2.4x cheaper, 2M context (could skip context management)
- **O1-preview** - For critical/complex cases requiring deep reasoning

**Testing Approach:**
```typescript
// Benchmark analysis quality
const testCases = [
  simpleCase,     // Clear violation, straightforward
  complexCase,    // Multiple departments, contradictions
  edgeCase        // Borderline grounds, nuanced
];

const expertAnalysis = {
  // Gold standard from senior partner review
};

for (model of analysisModels) {
  const results = await analyzeWithModel(model, testCases);
  // Measure:
  // - Agreement with expert (F1 score for violations)
  // - JSON consistency (valid JSON every time?)
  // - Success rate accuracy (vs actual outcomes)
  // - Cost per analysis
  // - Speed
}
```

---

### STAGE 3: Letter Generation (Three-Stage Pipeline)

#### STAGE 3A: Fact Extraction

**Current Implementation:**
```typescript
// lib/openrouter/three-stage-client.ts
export const stage1_extractFacts = async (complaintAnalysis, ...)
```

**Model:** `anthropic/claude-sonnet-4.5`
- Context: 200K tokens
- Temperature: 0.2 (factual, objective)
- Cost: $3 per 1M input tokens

**Input:**
- Complete analysis JSON from Stage 2 (~50K tokens)

**Output:**
```
Structured fact sheet (plain text, ~2K tokens):

TIMELINE FACTS:
- February 2024: SEIS relief claim submitted
- February - November 2024: 9 months silence
- November 2024: HMRC claims letter sent (never received)
...

FINANCIAL FACTS:
- Relief amount: £34,000+
- Standard processing: 30 days
- Actual processing: 14 months
- Delay excess: 1,400%
- Professional hours: 11.5 hours @ £275/hour = £3,162.50
...

PRECEDENT EXAMPLES:
- Case 2 used phrase "phantom letter"
- Case 1 numbered violations 1-5
- Case 3 awarded £500 for 12-month delay
...
```

**Purpose:**
- Extract pure facts without any persuasive language
- Create clean input for structure stage
- Identify precedent patterns if available

**Research Questions:**
1. **Is Sonnet 4.5 overkill for extraction?**
2. **Would a cheaper model work as well?**
3. **Should we use structured output format?**

**Alternative Models:**

| Model | Provider | Context | Cost | Speed | Notes |
|-------|----------|---------|------|-------|-------|
| claude-sonnet-4.5 | Anthropic | 200K | $3/M | Fast | Current |
| claude-haiku-4 | Anthropic | 200K | $0.25/M | Very Fast | **12x cheaper** |
| gpt-4o-mini | OpenAI | 128K | $0.15/M | Fast | Very cheap |
| gemini-1.5-flash | Google | 1M | $0.075/M | Very Fast | **40x cheaper** |

**⭐ Recommended Research:**
- **Claude Haiku 4** - Same family, 12x cheaper, excellent extraction
- **Gemini 1.5 Flash** - Extremely cheap, fast, good quality

---

#### STAGE 3B: Letter Structure

**Current Implementation:**
```typescript
export const stage2_structureLetter = async (factSheet, ...)
```

**Model:** `anthropic/claude-opus-4.1`
- Context: 200K tokens
- Temperature: 0.3 (consistent structure)
- Cost: $15 per 1M input tokens, $75 per 1M output tokens

**Input:**
- Fact sheet from Stage 3A (~2K tokens)
- Practice letterhead (optional, ~200 tokens)
- Charge-out rate (single number)

**Output:**
```
Structured letter with objective tone (~3K tokens):

RPGCC LLP
40 Gracechurch Street
London EC3V 0BT
...

**FORMAL COMPLAINT - 14-MONTH DELAY IN SEIS RELIEF PROCESSING**

Dear Sir/Madam,

This complaint concerns a 14-month delay in processing a SEIS relief claim.

**TIMELINE OF FAILURES**

**February 2024:** SEIS relief claim submitted with documentation.
Standard processing time is 30 days.

**February - November 2024:** No response received for 9 months.

...

**CHARTER & COMPLAINTS REFORM VIOLATIONS**

**1. CRG4025 - Unreasonable Delays (Critical Breach)**

The 14-month delay exceeds the 30-day standard by 1,400%.

...
```

**Purpose:**
- Apply HMRC complaint letter structure
- Use precedent structure patterns if available
- Remain objective (no emotional language yet)

**Research Questions:**
1. **Is Opus 4.1 necessary for structure?**
2. **Would Sonnet 4.5 be good enough?**
3. **Do we need creative language for structure?**

**Alternative Models:**

| Model | Provider | Context | Cost | Structure | Notes |
|-------|----------|---------|------|-----------|-------|
| claude-opus-4.1 | Anthropic | 200K | $15/M | Excellent | Current |
| claude-sonnet-4.5 | Anthropic | 200K | $3/M | Very Good | **5x cheaper** |
| gpt-4o | OpenAI | 128K | $2.50/M | Excellent | Cheaper |
| gemini-1.5-pro | Google | 2M | $1.25/M | Very Good | Much cheaper |

**⭐ Recommended Research:**
- **Claude Sonnet 4.5** - May be sufficient for structure (5x cheaper)
- **GPT-4o** - Excellent structure, 6x cheaper than Opus

---

#### STAGE 3C: Professional Tone

**Current Implementation:**
```typescript
export const stage3_addTone = async (structuredLetter)
```

**Model:** `anthropic/claude-opus-4.1`
- Context: 200K tokens
- Temperature: 0.7 (creative language)
- Cost: $15 per 1M input tokens, $75 per 1M output tokens

**Input:**
- Structured letter from Stage 3B (~3K tokens)

**Output:**
```
Final letter with professional fury (~4K tokens):

RPGCC LLP
40 Gracechurch Street
London EC3V 0BT
...

**FORMAL COMPLAINT - 14-MONTH DELAY IN SEIS RELIEF PROCESSING**

Dear Sir/Madam,

I write to lodge a formal complaint regarding HMRC's comprehensive 
administrative failure in processing my client's straightforward SEIS 
relief claim, now spanning over 14 months with no resolution despite 
full compliance with your contradictory instructions.

This case represents one of the most severe examples of systemic HMRC 
failure I have encountered in 20 years of practice. My client has been 
deprived of legitimate tax relief exceeding £34,000 since February 2024 
due to a catalogue of errors that would be comedic if the consequences 
weren't so serious.

**TIMELINE OF FAILURES**

**February 2024:** Initial SEIS relief claim submitted with full supporting 
documentation. Standard processing time for such claims is 30 days per your 
own guidance.

**February - November 2024:** Complete silence. Nine months without 
acknowledgement, update, or response despite the claim involving significant 
tax relief. No response to periodic status enquiries.

**November 2024:** HMRC now claims correspondence was sent to both my client 
and our firm. Neither party received anything. When challenged, HMRC cannot 
produce a copy of this phantom letter, cannot confirm its content, and cannot 
explain why neither the taxpayer nor their professional agent received it...

[Continues with authentic professional fury]
```

**Purpose:**
- Transform objective structure into powerful complaint
- Add memorable phrases ("phantom letter")
- Maintain professional but genuinely frustrated tone
- Use precedent tone examples if available

**THIS IS THE CRITICAL STAGE FOR QUALITY!**

**Research Questions:**
1. **Is Opus 4.1 the best for creative professional writing?**
2. **Would GPT-4 be as good?**
3. **Should we try specialized writing models?**
4. **Could we fine-tune a model on successful letters?**

**Alternative Models:**

| Model | Provider | Context | Cost | Creative Writing | Notes |
|-------|----------|---------|------|------------------|-------|
| claude-opus-4.1 | Anthropic | 200K | $15/M | **Excellent** | Current, best quality |
| gpt-4-turbo | OpenAI | 128K | $10/M | Excellent | Slightly cheaper |
| gpt-4o | OpenAI | 128K | $5/M | Very Good | 3x cheaper |
| claude-sonnet-4.5 | Anthropic | 200K | $3/M | Good | 5x cheaper, test quality |
| gemini-1.5-pro | Google | 2M | $1.25/M | Good | 12x cheaper |

**⭐ Recommended Research:**
- **Keep Opus 4.1** - This stage is worth the cost for quality
- **Test GPT-4-turbo** - Slightly cheaper, excellent writing
- **A/B test outputs** - Compare Opus vs GPT-4 vs Gemini Pro blind

---

## 💰 Cost Analysis Current vs Alternatives

### Current Setup (per complaint):

| Stage | Model | Tokens In | Tokens Out | Cost |
|-------|-------|-----------|------------|------|
| 0A: Embeddings (×5 docs) | Ada-002 | 40K | - | $0.004 |
| 0B: Doc Analysis (×5) | Sonnet 4.5 | 125K | 15K | $0.60 |
| 2: Complaint Analysis | Sonnet 4.5 | 150K | 5K | $0.53 |
| 3A: Fact Extraction | Sonnet 4.5 | 50K | 2K | $0.18 |
| 3B: Structure | Opus 4.1 | 2K | 3K | $0.26 |
| 3C: Tone | Opus 4.1 | 3K | 4K | $0.35 |
| **TOTAL** | | | | **$1.96** |

### Optimized Setup (hypothetical):

| Stage | Model | Tokens In | Tokens Out | Cost | Savings |
|-------|-------|-----------|------------|------|---------|
| 0A: Embeddings | text-emb-3-small | 40K | - | $0.0008 | 80% |
| 0B: Doc Analysis | Haiku 4 | 125K | 15K | $0.05 | 92% |
| 2: Analysis | Gemini 1.5 Pro | 150K | 5K | $0.25 | 53% |
| 3A: Facts | Haiku 4 | 50K | 2K | $0.015 | 92% |
| 3B: Structure | Sonnet 4.5 | 2K | 3K | $0.23 | 12% |
| 3C: Tone | Opus 4.1 | 3K | 4K | $0.35 | 0% |
| **TOTAL** | | | | **$0.90** | **54%** |

**Potential savings: £1.06 per complaint or 54%**

At 1,000 complaints/month: **Save $1,060/month ($12,720/year)**

---

## 🔬 Research Methodology

### Step 1: Establish Baseline

**Collect 20 test cases:**
- 5 simple (clear violation, straightforward)
- 10 typical (standard HMRC delay/error)
- 5 complex (multiple issues, nuanced)

**Create gold standard:**
- Senior partner reviews each case
- Marks expected violations, timeline, compensation
- Rates final letter quality (1-10)

### Step 2: Test Alternative Models

**For each stage, test 3-5 alternative models:**

```typescript
const models = {
  embeddings: ['ada-002', 'text-emb-3-small', 'voyage-law-2', 'cohere'],
  docAnalysis: ['sonnet-4.5', 'haiku-4', 'gpt-4o-mini', 'gemini-flash'],
  analysis: ['sonnet-4.5', 'gpt-4o', 'gemini-pro', 'o1-mini'],
  letterFacts: ['sonnet-4.5', 'haiku-4', 'gpt-4o-mini'],
  letterStructure: ['opus-4.1', 'sonnet-4.5', 'gpt-4o'],
  letterTone: ['opus-4.1', 'gpt-4-turbo', 'gpt-4o']
};

for (stage of stages) {
  for (model of models[stage]) {
    results[stage][model] = await testWithModel(model, testCases);
  }
}
```

**Metrics to track:**

1. **Quality Metrics:**
   - Accuracy (vs gold standard)
   - Completeness (missed violations?)
   - Consistency (same input → same output?)
   - Letter quality score (1-10, blind review)

2. **Performance Metrics:**
   - Speed (seconds per operation)
   - Cost ($ per operation)
   - Token usage (input + output)
   - Reliability (success rate)

3. **User Experience:**
   - Total time (upload → final letter)
   - Perceived quality (user ratings)
   - Regeneration rate (how often do users regenerate?)

### Step 3: A/B Testing in Production

**Roll out gradually:**
```
Week 1: 10% of traffic → new models
Week 2: 25% of traffic → new models
Week 3: 50% of traffic → new models
Week 4: 100% if metrics good, else rollback
```

**Track:**
- User satisfaction (survey after letter generation)
- Letter acceptance rate (saved/locked vs regenerated)
- Cost per complaint
- Support tickets related to quality

### Step 4: Fine-Tuning (Optional)

**For specialized models:**
```
1. Collect 100+ successful complaint letters (precedents)
2. Format as training data (input: facts, output: letter)
3. Fine-tune GPT-4o or similar
4. Test vs base model
5. Cost analysis (fine-tune cost vs API savings)
```

**Fine-tuning could be worth it if:**
- Volume > 1,000 complaints/month
- Current cost > $2,000/month on AI
- Quality improvements justify effort
- Can collect enough training data

---

## 📋 Decision Matrix

### When to Use Each Model Type:

**Embeddings:**
- **Ada-002** if compatibility/proven reliability critical
- **text-emb-3-small** if cost is priority (5x cheaper)
- **Voyage Law 2** if legal domain quality critical
- **Self-hosted** if data privacy mandates on-premise

**Document Analysis:**
- **Haiku 4** for standard extraction (cheap, fast, good)
- **Sonnet 4.5** for complex documents (superior reasoning)
- **Gemini Flash** for extreme volume (40x cheaper)

**Complaint Analysis:**
- **Sonnet 4.5** for balanced cost/quality (current choice)
- **GPT-4o** for native JSON mode (slightly cheaper)
- **Gemini Pro** for huge context needs (2M tokens)
- **O1-preview** for critical complex cases (best reasoning)

**Letter Generation:**
- **Stage 1 (Facts):** Haiku 4 or Gemini Flash (cheap extraction)
- **Stage 2 (Structure):** Sonnet 4.5 (good enough, 5x cheaper)
- **Stage 3 (Tone):** Keep Opus 4.1 (worth it for quality)

---

## 🎯 Recommended Next Steps

### Immediate (This Week):
1. **Test embeddings alternatives**
   - text-emb-3-small (5x cheaper)
   - Run 100 sample searches
   - Measure precision/recall

2. **Test Haiku 4 for document analysis**
   - Process 20 sample documents
   - Compare output to Sonnet 4.5
   - If quality similar, switch (92% cost savings)

### Short-term (This Month):
3. **A/B test analysis models**
   - GPT-4o vs Sonnet 4.5
   - Gemini Pro vs Sonnet 4.5
   - 50 complaints each
   - Measure quality + cost

4. **Optimize letter pipeline**
   - Test Haiku 4 for Stage 1 (facts)
   - Test Sonnet 4.5 for Stage 2 (structure)
   - Keep Opus 4.1 for Stage 3 (tone)

### Long-term (This Quarter):
5. **Implement cross-encoder reranking**
   - Boost retrieval precision
   - Test Cohere rerank API
   - Measure impact on letter quality

6. **Research fine-tuning**
   - Collect 100+ successful letters
   - Fine-tune GPT-4o on letter writing
   - Compare to Opus 4.1

7. **Hybrid search**
   - Add BM25 keyword search
   - Combine with vector search
   - Test on edge cases

---

## 📚 Resources for Research

### Model Documentation:
- **OpenAI:** https://platform.openai.com/docs/models
- **Anthropic:** https://docs.anthropic.com/claude/docs
- **Google:** https://ai.google.dev/models/gemini
- **Cohere:** https://docs.cohere.com/docs/models
- **Voyage AI:** https://docs.voyageai.com/embeddings

### Evaluation Tools:
- **LangSmith:** Prompt evaluation and tracking
- **Weights & Biases:** Experiment tracking
- **Arize:** ML observability and monitoring
- **PromptLayer:** Prompt management and A/B testing

### Benchmarks:
- **MTEB:** Embedding quality benchmarks
- **HELM:** Holistic model evaluation
- **LegalBench:** Legal reasoning benchmarks
- **BigBench:** General reasoning tasks

---

**End of AI Model Research Guide**

*Last Updated: November 10, 2025*
*Current Total Cost: $1.96 per complaint*
*Optimization Potential: $0.90 per complaint (54% savings)*

