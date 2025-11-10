# Model Testing & Optimization Guide

Complete guide to testing, benchmarking, and optimizing AI models for Lightpoint.

---

## 🎯 Testing Roadmap

### ✅ IMMEDIATE (This Week) - 2 Tests

**Priority 1: Embedding Comparison**
- **Goal**: Test if text-embedding-3-small (6.5x cheaper) maintains quality
- **Time**: ~2 hours
- **Script**: `scripts/tests/test-embeddings.ts`

**Priority 2: Document Extraction**
- **Goal**: Test if Haiku 4.5 matches Sonnet quality (92% cost savings!)
- **Time**: ~1 hour  
- **Script**: `scripts/tests/test-document-extraction.ts`

### 📅 SHORT-TERM (This Month) - 3 Tests

**Test 3: Complaint Analysis Models**
- Compare Sonnet 4.5, GPT-4o, Gemini Pro 1.5
- 50 complaints each
- Measure JSON consistency, violation detection, timeline accuracy

**Test 4: Letter Generation Pipeline**
- Test Haiku for Stage 1 (facts)
- Test Sonnet for Stage 2 (structure)  
- Keep Opus for Stage 3 (tone)
- Measure letter quality vs current baseline

**Test 5: Reranking Impact**
- Add Cohere rerank to retrieval pipeline
- Measure precision@k improvement
- Estimate impact on letter quality

### 🔮 LONG-TERM (This Quarter) - 3 Major Projects

**Project 6: Hybrid Search**
- Implement BM25 + vector search fusion
- Test on 100 edge cases
- Measure recall improvement

**Project 7: Fine-Tuning**
- Collect 100+ successful letters (rated 8+/10)
- Fine-tune GPT-4o on complaint writing
- A/B test vs Opus 4.1
- Potential 80% cost savings if quality matches

**Project 8: Production Optimization**
- Roll out winning configurations
- Implement A/B testing framework
- Set up monitoring and alerting
- Document learnings

---

## 📊 Test 1: Embedding Comparison

### Setup

```bash
cd /Users/James.Howard/Documents/OracleConsultingAI/lightpoint-complaint-system
npm install  # Ensure dependencies are up to date
```

### Run Test

```bash
npx tsx scripts/tests/test-embeddings.ts
```

### What It Tests

- **Models**: ada-002 (current), 3-small (cheap), 3-large (best)
- **Queries**: 15 representative HMRC complaint searches
- **Metrics**: Latency, cost, precision@3, recall@10

### Expected Output

```
🚀 EMBEDDING MODEL COMPARISON TEST
═══════════════════════════════════════════════════════
Testing 3 models on 15 queries

🧪 Testing: openai/text-embedding-ada-002
──────────────────────────────────────────────────────
1/15: "14-month delay in SEIS relief processing..."
  ✓ Generated embedding in 245ms
  Top 3 results:
    1. CRG4025 - Unreasonable Delays (89.3%)
    2. Delay Compensation Guidelines (87.1%)
    3. SEIS Processing Standards (84.6%)
...

📊 SUMMARY REPORT
═══════════════════════════════════════════════════════
Model                              | Dims | Latency | Cost/1M | Total Cost
────────────────────────────────────────────────────────────────────────────
text-embedding-ada-002             | 1536 |   245ms |   $0.10 |    $0.0015
text-embedding-3-small             | 1536 |   198ms |   $0.02 |    $0.0003
text-embedding-3-large             | 3072 |   267ms |   $0.13 |    $0.0020

💡 RECOMMENDATIONS:
Cheapest: text-embedding-3-small ($0.02/M - 5.0x cheaper)
Fastest:  text-embedding-3-small (198ms avg)
```

### Decision Criteria

✅ **Switch to 3-small if**:
- Precision@3 within 5% of current
- Recall@10 within 10% of current
- Saves 80% on embedding costs

⚠️ **Consider 3-large if**:
- Need maximum recall for complex queries
- Quality improvement justifies 30% cost increase

### Add Relevance Judgments (Optional but Recommended)

For more accurate metrics, manually review results:

1. Open `scripts/tests/test-embeddings.ts`
2. For each query, mark which results are truly relevant
3. Add to `RELEVANCE_JUDGMENTS` map
4. Re-run test for P@3 and R@10 scores

---

## 📄 Test 2: Document Extraction

### Run Test

```bash
npx tsx scripts/tests/test-document-extraction.ts
```

### What It Tests

- **Models**: Sonnet 4.5 (current), Haiku 4.5 (cheap), GPT-4o-mini, Gemini Flash
- **Documents**: 2 test cases (structured HMRC letter, unstructured response)
- **Metrics**: Completeness, accuracy, JSON consistency, speed, cost

### Expected Output

```
🚀 DOCUMENT EXTRACTION MODEL COMPARISON
═══════════════════════════════════════════════════════
Testing 4 models on 2 documents

🧪 Testing: anthropic/claude-haiku-4.5
──────────────────────────────────────────────────────
  📄 Document: SEIS Relief Letter (structured)
  🤖 Extracting with claude-haiku-4.5...
     Completeness: 95.0%
     Accuracy:     100.0%
     JSON Valid:   ✓
     Time:         1.23s
...

📊 AGGREGATE RESULTS
═══════════════════════════════════════════════════════
Model                              | Complete | Accurate | JSON | Time | Cost/doc
──────────────────────────────────────────────────────────────────────────────────
claude-sonnet-4.5                  |   95.0% |   95.0%  | 100% |  1.4s |  $0.0030
claude-haiku-4.5                   |   95.0% |   95.0%  | 100% |  1.2s |  $0.0003
gpt-4o-mini                        |   90.0% |   92.0%  | 100% |  0.8s |  $0.0002
gemini-flash-1.5                   |   88.0% |   90.0%  |  95% |  0.9s |  $0.0001

💡 HAIKU 4.5 RECOMMENDATION:
✅ STRONGLY RECOMMEND switching to Haiku 4.5!
   Quality: +0.0% (within acceptable range)
   Cost:    92% reduction ($3.00 → $0.25 per 1M tokens)
   Savings: $2.75 per 1M tokens
   At 1,000 docs/month: Save ~$2,750/month ($33k/year)
```

### Decision Criteria

✅ **Switch to Haiku 4.5 if**:
- Completeness within 5% of Sonnet
- Accuracy within 5% of Sonnet  
- JSON consistency > 95%
- **Immediate 92% cost savings**

### Add Real Test Cases

For production testing:

1. Upload 10-20 real HMRC documents
2. Manually extract "gold standard" data from each
3. Add to `TEST_DOCUMENTS` array
4. Re-run test for accurate metrics

---

## 🔍 Test 3-5: Advanced Testing (This Month)

### Test 3: Analysis Model Comparison

**Setup**: Create `scripts/tests/test-analysis.ts` (similar structure)

**Test Matrix**:
| Model | Context | Cost/M | JSON | Reasoning |
|-------|---------|--------|------|-----------|
| Sonnet 4.5 | 200K | $3 | Good | Excellent |
| GPT-4o | 128K | $2.50 | Perfect | Good |
| Gemini 1.5 | 2M | $1.25 | Fair | Good |

**Key Metrics**:
- Violation detection (precision/recall)
- Timeline accuracy
- Compensation calculation accuracy
- JSON schema compliance
- Processing time

**Sample Size**: 50 complaints per model

### Test 4: Letter Pipeline Optimization

**Current** (baseline):
```
Stage 1: Sonnet 4.5 ($3/M)
Stage 2: Opus 4.1 ($15/M)
Stage 3: Opus 4.1 ($15/M)
Total: ~$1.96 per letter
```

**Optimized** (test):
```
Stage 1: Haiku 4.5 ($0.25/M)   ← 92% cheaper
Stage 2: Sonnet 4.5 ($3/M)     ← 80% cheaper
Stage 3: Opus 4.1 ($15/M)      ← keep premium for tone
Total: ~$0.60 per letter (70% reduction!)
```

**Blind Review**: Have 3 experts rate letters (1-10) without knowing which model generated them.

### Test 5: Reranking Impact

**Baseline**: Vector search only
**Treatment**: Vector search + Cohere rerank

**Test on**:
- 100 real queries from production logs
- Measure precision@3, recall@10, MRR
- Cost: +$0.001 per search (Cohere API)
- Benefit: Estimated 15-30% precision improvement

---

## 🚀 Test 6-8: Long-Term Projects

### Test 6: Hybrid Search Implementation

**Code**: `lib/search/hybridSearch.ts` (already created)

**Setup Migration**:
```sql
-- Run in Supabase SQL Editor
-- Add full-text search to knowledge_base
ALTER TABLE knowledge_base 
ADD COLUMN IF NOT EXISTS content_search tsvector
GENERATED ALWAYS AS (
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(content, '')), 'B')
) STORED;

CREATE INDEX IF NOT EXISTS knowledge_base_content_search_idx 
ON knowledge_base USING GIN (content_search);
```

**Test**:
```typescript
import { search } from './lib/search/hybridSearch';

// Vector only (current)
const vectorResults = await search('CRG4025 delays', { useHybrid: false });

// Hybrid (vector + BM25)
const hybridResults = await search('CRG4025 delays', { useHybrid: true });

// Hybrid + Reranking (best)
const rerankResults = await search('CRG4025 delays', { 
  useHybrid: true, 
  useReranking: true 
});
```

### Test 7: Fine-Tuning Pipeline

**Step 1: Collect Data** (needs 100+ letters rated 8+/10)
```bash
npx tsx scripts/collect-finetuning-data.ts
```

**Step 2: Export Training Data**
```typescript
import { exportFineTuningData } from './lib/finetuning/dataCollection';

await exportFineTuningData('./fine-tuning-data', 8);
// Creates: train.jsonl, validation.jsonl, metadata.json
```

**Step 3: Upload to OpenAI**
```bash
openai api fine_tunes.create \
  -t ./fine-tuning-data/train.jsonl \
  -v ./fine-tuning-data/validation.jsonl \
  -m gpt-4o-2024-08-06 \
  --suffix "lightpoint-complaints"
```

**Step 4: A/B Test**
```typescript
import { abTestFineTuned } from './lib/finetuning/dataCollection';

const result = await abTestFineTuned(
  'complaint-id-123',
  'ft:gpt-4o-2024-08-06:lightpoint:abc123'
);

console.log('Opus letter:', result.opusLetter);
console.log('Fine-tuned letter:', result.fineTunedLetter);
console.log('Cost comparison:', result.opusCost, 'vs', result.fineTunedCost);
```

**Step 5: Blind Review**
- Share both letters with 3 experts (randomized order)
- Rate each 1-10
- If fine-tuned >= Opus rating, switch (80% cost savings!)

### Test 8: Production Rollout

**Gradual Rollout**:
```
Week 1: 10% traffic to optimized stack
Week 2: 25% traffic
Week 3: 50% traffic
Week 4: 100% (if metrics stable)
```

**Monitoring**:
- Letter quality ratings (target: maintain 8+/10)
- Processing time (target: <30s per complaint)
- Cost per complaint (target: <$0.60)
- Error rates (target: <1%)

---

## 📈 Success Metrics

### Cost Savings

| Optimization | Monthly Savings (1K complaints) | Annual Savings |
|--------------|--------------------------------|----------------|
| Embedding: ada → 3-small | $80 | $960 |
| Extraction: Sonnet → Haiku | $2,750 | $33,000 |
| Analysis: (varies) | $500-1,500 | $6k-18k |
| Letters: Current → Optimized | $1,360 | $16,320 |
| **TOTAL** | **$4,690-5,690** | **$56k-68k** |

### Quality Targets

- Letter ratings: Maintain 8+/10 average
- Adjudicator uphold rate: >70%
- Client satisfaction: >90%
- Processing time: <30 seconds per complaint

---

## 🛠️ Quick Start

### Run First Two Tests (This Week)

```bash
# 1. Embedding test (~2 hours)
npx tsx scripts/tests/test-embeddings.ts

# 2. Document extraction test (~1 hour)
npx tsx scripts/tests/test-document-extraction.ts

# 3. Review results in test-results/ folder

# 4. Make decision and update modelConfig.ts
```

### Expected Outcomes

If tests confirm quality:
- ✅ Switch embeddings: Save $960/year
- ✅ Switch extraction: Save $33k/year
- ✅ **Total immediate savings: ~$34k/year**

---

## 📞 Questions?

Check the documentation:
- `AI_MODEL_RESEARCH.md` - Detailed model comparison
- `SYSTEM_OVERVIEW.md` - Architecture overview
- `lib/modelConfig.ts` - Model configuration
- `lib/testing/modelTesting.ts` - Testing framework

