/**
 * Embedding Model Comparison Test
 * 
 * IMMEDIATE PRIORITY (This Week):
 * - Test text-embedding-3-small vs ada-002 vs 3-large
 * - Run 100 sample searches
 * - Measure precision@3, recall@10
 * - Analyze cost impact
 * 
 * Usage: npx tsx scripts/tests/test-embeddings.ts
 */

import { supabaseAdmin } from '../../lib/supabase/client';
import { 
  EMBEDDING_TEST_MODELS, 
  EMBEDDING_TEST_QUERIES,
  calculatePrecisionAtK,
  calculateRecallAtK,
  type EmbeddingTestResult 
} from '../../lib/testing/modelTesting';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  console.error('❌ OPENROUTER_API_KEY not set');
  process.exit(1);
}

/**
 * Generate embedding using specified model
 */
async function generateEmbedding(text: string, model: string): Promise<number[]> {
  const startTime = Date.now();
  
  const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://lightpoint.app',
      'X-Title': 'Lightpoint Embeddings Test',
    },
    body: JSON.stringify({
      model,
      input: text,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Embedding API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const embedding = data.data[0].embedding;
  const latency = Date.now() - startTime;
  
  console.log(`  ✓ Generated ${model} embedding in ${latency}ms`);
  
  return embedding;
}

/**
 * Search knowledge base with given embedding
 */
async function searchKnowledgeBase(
  embedding: number[],
  limit: number = 10
): Promise<Array<{ id: string; title: string; similarity: number }>> {
  const { data, error } = await (supabaseAdmin as any).rpc('search_knowledge_base', {
    query_embedding: embedding,
    match_threshold: 0.5,
    match_count: limit
  });

  if (error) {
    console.error('Search error:', error);
    return [];
  }

  return data || [];
}

/**
 * Manual relevance judgments (you'll need to review and mark these)
 */
const RELEVANCE_JUDGMENTS: Record<string, Set<string>> = {
  // Query ID → Set of relevant document IDs
  // You'll populate this as you review results
};

/**
 * Run embedding test for one model
 */
async function testEmbeddingModel(model: string): Promise<EmbeddingTestResult> {
  console.log(`\n🧪 Testing: ${model}`);
  console.log('─'.repeat(60));
  
  const results = {
    precisions: [] as number[],
    recalls: [] as number[],
    latencies: [] as number[],
  };
  
  for (let i = 0; i < EMBEDDING_TEST_QUERIES.length; i++) {
    const query = EMBEDDING_TEST_QUERIES[i];
    console.log(`\n${i + 1}/${EMBEDDING_TEST_QUERIES.length}: "${query.substring(0, 50)}..."`);
    
    try {
      const startTime = Date.now();
      const embedding = await generateEmbedding(query, model);
      const searchResults = await searchKnowledgeBase(embedding, 10);
      const latency = Date.now() - startTime;
      
      results.latencies.push(latency);
      
      // For now, just log results
      // Later: compare with relevance judgments
      console.log(`  Top 3 results:`);
      searchResults.slice(0, 3).forEach((r, idx) => {
        console.log(`    ${idx + 1}. ${r.title} (${(r.similarity * 100).toFixed(1)}%)`);
      });
      
      // If we have relevance judgments for this query
      const relevantDocs = RELEVANCE_JUDGMENTS[query];
      if (relevantDocs) {
        const precision3 = calculatePrecisionAtK(searchResults, relevantDocs, 3);
        const recall10 = calculateRecallAtK(searchResults, relevantDocs, 10);
        results.precisions.push(precision3);
        results.recalls.push(recall10);
        console.log(`  P@3: ${(precision3 * 100).toFixed(1)}% | R@10: ${(recall10 * 100).toFixed(1)}%`);
      }
      
      // Rate limit: wait 1s between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error: any) {
      console.error(`  ❌ Error: ${error.message}`);
    }
  }
  
  const avgLatency = results.latencies.reduce((a, b) => a + b, 0) / results.latencies.length;
  const avgPrecision = results.precisions.length > 0
    ? results.precisions.reduce((a, b) => a + b, 0) / results.precisions.length
    : 0;
  const avgRecall = results.recalls.length > 0
    ? results.recalls.reduce((a, b) => a + b, 0) / results.recalls.length
    : 0;
  
  // Cost calculation (approximate)
  const dimensions = model.includes('3-large') ? 3072 : model.includes('3-small') ? 1536 : 1536;
  const costPer1M = model.includes('3-large') ? 0.13 : model.includes('3-small') ? 0.02 : 0.10;
  const totalTokens = EMBEDDING_TEST_QUERIES.length * 50; // rough estimate
  const totalCost = (totalTokens / 1_000_000) * costPer1M;
  
  return {
    model,
    dimensions,
    queryCount: EMBEDDING_TEST_QUERIES.length,
    avgPrecisionAt3: avgPrecision,
    avgRecallAt10: avgRecall,
    avgLatencyMs: avgLatency,
    costPer1MTokens: costPer1M,
    totalCost
  };
}

/**
 * Main test runner
 */
async function main() {
  console.log('🚀 EMBEDDING MODEL COMPARISON TEST');
  console.log('═'.repeat(60));
  console.log(`Testing ${EMBEDDING_TEST_MODELS.length} models on ${EMBEDDING_TEST_QUERIES.length} queries`);
  
  const results: EmbeddingTestResult[] = [];
  
  for (const model of EMBEDDING_TEST_MODELS) {
    try {
      const result = await testEmbeddingModel(model);
      results.push(result);
      
      console.log(`\n✅ Completed: ${model}`);
      console.log(`   Avg latency: ${result.avgLatencyMs.toFixed(0)}ms`);
      console.log(`   Cost: $${result.totalCost.toFixed(4)}`);
      if (result.avgPrecisionAt3 > 0) {
        console.log(`   P@3: ${(result.avgPrecisionAt3 * 100).toFixed(1)}%`);
        console.log(`   R@10: ${(result.avgRecallAt10 * 100).toFixed(1)}%`);
      }
      
    } catch (error: any) {
      console.error(`❌ Failed to test ${model}: ${error.message}`);
    }
  }
  
  // Summary report
  console.log('\n\n📊 SUMMARY REPORT');
  console.log('═'.repeat(60));
  console.log('\nModel Comparison:\n');
  
  console.log('Model                              | Dims | Latency | Cost/1M | Total Cost');
  console.log('─'.repeat(80));
  
  results.forEach(r => {
    const modelName = r.model.padEnd(35);
    const dims = r.dimensions.toString().padStart(4);
    const latency = `${r.avgLatencyMs.toFixed(0)}ms`.padStart(7);
    const costPerM = `$${r.costPer1MTokens.toFixed(2)}`.padStart(7);
    const totalCost = `$${r.totalCost.toFixed(4)}`.padStart(10);
    
    console.log(`${modelName} | ${dims} | ${latency} | ${costPerM} | ${totalCost}`);
  });
  
  // Recommendations
  const cheapest = results.reduce((min, r) => r.costPer1MTokens < min.costPer1MTokens ? r : min);
  const fastest = results.reduce((min, r) => r.avgLatencyMs < min.avgLatencyMs ? r : min);
  
  console.log('\n💡 RECOMMENDATIONS:\n');
  console.log(`Cheapest: ${cheapest.model} ($${cheapest.costPer1MTokens}/M - ${((results[0].costPer1MTokens / cheapest.costPer1MTokens)).toFixed(1)}x cheaper)`);
  console.log(`Fastest:  ${fastest.model} (${fastest.avgLatencyMs.toFixed(0)}ms avg)`);
  
  console.log('\n⚠️  NOTE: Precision/Recall metrics require manual relevance judgments.');
  console.log('     1. Review search results for each query');
  console.log('     2. Mark relevant documents in RELEVANCE_JUDGMENTS');
  console.log('     3. Re-run test to get P@3 and R@10 metrics');
  
  // Save results
  const timestamp = new Date().toISOString().split('T')[0];
  const fs = await import('fs');
  const outputPath = `./test-results/embeddings-${timestamp}.json`;
  
  fs.writeFileSync(outputPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    results,
    queries: EMBEDDING_TEST_QUERIES
  }, null, 2));
  
  console.log(`\n💾 Results saved to: ${outputPath}`);
}

main().catch(console.error);

