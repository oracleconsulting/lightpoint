/**
 * Hybrid Search Implementation
 * 
 * LONG-TERM PRIORITY (This Quarter):
 * - Combine vector search (semantic) with BM25 (keyword)
 * - Implement cross-encoder reranking (Cohere/Voyage)
 * - Boost retrieval precision for edge cases
 * 
 * Hybrid search is particularly powerful for:
 * - Specific reference numbers (e.g., "CRG4025")
 * - Exact phrases (e.g., "phantom letter")
 * - Rare terms that might not embed well
 */

import { supabaseAdmin } from '../supabase/client';
import { generateEmbedding } from '../embeddings';

const COHERE_API_KEY = process.env.COHERE_API_KEY;
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;

// ============================================================================
// VECTOR SEARCH (Current Implementation)
// ============================================================================

export async function vectorSearch(
  query: string,
  limit: number = 10,
  threshold: number = 0.7
): Promise<Array<{ id: string; content: string; score: number; source: 'vector' }>> {
  const embedding = await generateEmbedding(query);
  
  const { data, error } = await (supabaseAdmin as any).rpc('search_knowledge_base', {
    query_embedding: embedding,
    match_threshold: threshold,
    match_count: limit * 2  // Get more candidates for reranking
  });

  if (error) {
    console.error('❌ Vector search error:', error);
    return [];
  }

  return (data || []).map((item: any) => ({
    id: item.id,
    content: item.content,
    score: item.similarity,
    source: 'vector' as const
  }));
}

// ============================================================================
// BM25 KEYWORD SEARCH (New Implementation)
// ============================================================================

/**
 * SQL full-text search using PostgreSQL's built-in capabilities
 * BM25-like ranking for keyword matches
 */
export async function keywordSearch(
  query: string,
  limit: number = 10
): Promise<Array<{ id: string; content: string; score: number; source: 'keyword' }>> {
  // PostgreSQL full-text search
  const { data, error } = await (supabaseAdmin as any)
    .from('knowledge_base')
    .select('id, title, content, category')
    .textSearch('content', query, {
      type: 'websearch',  // Supports phrases, AND/OR
      config: 'english'
    })
    .limit(limit * 2);

  if (error) {
    console.error('❌ Keyword search error:', error);
    return [];
  }

  // Simple BM25-like scoring based on term frequency
  return (data || []).map((item: any) => {
    const queryTerms = query.toLowerCase().split(/\s+/);
    const content = item.content.toLowerCase();
    
    // Count term occurrences
    let score = 0;
    queryTerms.forEach(term => {
      const matches = (content.match(new RegExp(term, 'g')) || []).length;
      score += matches * (1 / (1 + Math.log(1 + matches))); // Diminishing returns
    });
    
    // Boost for title matches
    const titleContent = (item.title || '').toLowerCase();
    queryTerms.forEach(term => {
      if (titleContent.includes(term)) {
        score += 5; // Strong boost for title matches
      }
    });
    
    return {
      id: item.id,
      content: item.content,
      score: score / 10, // Normalize to 0-1 range (roughly)
      source: 'keyword' as const
    };
  }).sort((a, b) => b.score - a.score);
}

// ============================================================================
// HYBRID FUSION (Reciprocal Rank Fusion)
// ============================================================================

/**
 * Combine vector and keyword search results using Reciprocal Rank Fusion
 * RRF is a simple but effective rank fusion method
 * 
 * Formula: RRF(d) = Σ 1 / (k + rank_i(d))
 * where k = 60 (standard constant)
 */
export function reciprocalRankFusion<T extends { id: string; score: number }>(
  results: T[],
  k: number = 60
): T[] {
  // Group by document ID
  const docScores = new Map<string, { doc: T; ranks: number[] }>();
  
  results.forEach((doc, index) => {
    if (!docScores.has(doc.id)) {
      docScores.set(doc.id, { doc, ranks: [] });
    }
    docScores.get(doc.id)!.ranks.push(index + 1); // 1-indexed rank
  });
  
  // Calculate RRF scores
  const fusedResults = Array.from(docScores.values()).map(({ doc, ranks }) => {
    const rrfScore = ranks.reduce((sum, rank) => sum + 1 / (k + rank), 0);
    return { ...doc, score: rrfScore };
  });
  
  // Sort by RRF score (descending)
  return fusedResults.sort((a, b) => b.score - a.score);
}

/**
 * Hybrid search: Combine vector and keyword search
 */
export async function hybridSearch(
  query: string,
  limit: number = 10,
  vectorWeight: number = 0.7,  // Weight for semantic search
  keywordWeight: number = 0.3   // Weight for keyword search
): Promise<Array<{ id: string; content: string; score: number; source: 'hybrid' }>> {
  console.log(`🔍 Hybrid search: "${query}"`);
  
  // Run both searches in parallel
  const [vectorResults, keywordResults] = await Promise.all([
    vectorSearch(query, limit),
    keywordSearch(query, limit)
  ]);
  
  console.log(`  Vector: ${vectorResults.length} results`);
  console.log(`  Keyword: ${keywordResults.length} results`);
  
  // Apply weights
  const weightedVector = vectorResults.map(r => ({ ...r, score: r.score * vectorWeight }));
  const weightedKeyword = keywordResults.map(r => ({ ...r, score: r.score * keywordWeight }));
  
  // Fuse results
  const allResults = [...weightedVector, ...weightedKeyword];
  const fused = reciprocalRankFusion(allResults);
  
  // Take top N
  return fused.slice(0, limit).map(r => ({ ...r, source: 'hybrid' as const }));
}

// ============================================================================
// COHERE RERANKING (Cross-Encoder)
// ============================================================================

/**
 * Rerank results using Cohere's cross-encoder model
 * Significantly improves precision by understanding query-document relationship
 */
export async function cohereRerank(
  query: string,
  documents: Array<{ id: string; content: string }>,
  topN: number = 10
): Promise<Array<{ id: string; content: string; score: number; source: 'cohere-rerank' }>> {
  if (!COHERE_API_KEY) {
    console.warn('⚠️  COHERE_API_KEY not set, skipping reranking');
    return documents.slice(0, topN).map(d => ({ ...d, score: 0, source: 'cohere-rerank' as const }));
  }
  
  console.log(`🎯 Cohere reranking ${documents.length} documents...`);
  
  try {
    const response = await fetch('https://api.cohere.ai/v1/rerank', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${COHERE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'rerank-english-v3.0',
        query,
        documents: documents.map(d => d.content),
        top_n: topN,
        return_documents: false
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Cohere rerank error:', error);
      return documents.slice(0, topN).map(d => ({ ...d, score: 0, source: 'cohere-rerank' as const }));
    }

    const data = await response.json();
    
    // Map results back to original documents
    const reranked = data.results.map((result: any) => {
      const doc = documents[result.index];
      return {
        ...doc,
        score: result.relevance_score,
        source: 'cohere-rerank' as const
      };
    });
    
    console.log(`  ✓ Reranked to top ${reranked.length}`);
    return reranked;
    
  } catch (error: any) {
    console.error('❌ Cohere rerank failed:', error.message);
    return documents.slice(0, topN).map(d => ({ ...d, score: 0, source: 'cohere-rerank' as const }));
  }
}

// ============================================================================
// VOYAGE RERANKING (Alternative)
// ============================================================================

/**
 * Rerank using Voyage AI (alternative to Cohere, often cheaper)
 */
export async function voyageRerank(
  query: string,
  documents: Array<{ id: string; content: string }>,
  topN: number = 10
): Promise<Array<{ id: string; content: string; score: number; source: 'voyage-rerank' }>> {
  if (!VOYAGE_API_KEY) {
    console.warn('⚠️  VOYAGE_API_KEY not set, skipping reranking');
    return documents.slice(0, topN).map(d => ({ ...d, score: 0, source: 'voyage-rerank' as const }));
  }
  
  console.log(`🎯 Voyage reranking ${documents.length} documents...`);
  
  try {
    const response = await fetch('https://api.voyageai.com/v1/rerank', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VOYAGE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'rerank-2',
        query,
        documents: documents.map(d => d.content),
        top_k: topN
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Voyage rerank error:', error);
      return documents.slice(0, topN).map(d => ({ ...d, score: 0, source: 'voyage-rerank' as const }));
    }

    const data = await response.json();
    
    // Map results back to original documents
    const reranked = data.results.map((result: any) => {
      const doc = documents[result.index];
      return {
        ...doc,
        score: result.score,
        source: 'voyage-rerank' as const
      };
    });
    
    console.log(`  ✓ Reranked to top ${reranked.length}`);
    return reranked;
    
  } catch (error: any) {
    console.error('❌ Voyage rerank failed:', error.message);
    return documents.slice(0, topN).map(d => ({ ...d, score: 0, source: 'voyage-rerank' as const }));
  }
}

// ============================================================================
// COMPLETE SEARCH PIPELINE (Production-Ready)
// ============================================================================

export interface SearchOptions {
  limit?: number;
  useHybrid?: boolean;        // Combine vector + keyword (default: true)
  useReranking?: boolean;     // Apply cross-encoder reranking (default: true)
  reranker?: 'cohere' | 'voyage' | 'none';
  vectorWeight?: number;      // For hybrid search (default: 0.7)
  keywordWeight?: number;     // For hybrid search (default: 0.3)
}

/**
 * Complete search with all optimizations
 */
export async function search(
  query: string,
  options: SearchOptions = {}
): Promise<Array<{ id: string; content: string; score: number; source: string }>> {
  const {
    limit = 10,
    useHybrid = true,
    useReranking = true,
    reranker = 'cohere',
    vectorWeight = 0.7,
    keywordWeight = 0.3
  } = options;
  
  console.log(`\n🔍 Advanced search: "${query}"`);
  console.log(`   Hybrid: ${useHybrid}, Reranking: ${useReranking} (${reranker})`);
  
  // Step 1: Get candidate documents (retrieve more for reranking)
  const candidateLimit = useReranking ? limit * 3 : limit;
  
  let candidates;
  if (useHybrid) {
    candidates = await hybridSearch(query, candidateLimit, vectorWeight, keywordWeight);
  } else {
    candidates = await vectorSearch(query, candidateLimit);
  }
  
  if (candidates.length === 0) {
    console.log('   ⚠️  No results found');
    return [];
  }
  
  // Step 2: Rerank if enabled
  if (useReranking && (COHERE_API_KEY || VOYAGE_API_KEY)) {
    if (reranker === 'cohere' && COHERE_API_KEY) {
      return await cohereRerank(query, candidates, limit);
    } else if (reranker === 'voyage' && VOYAGE_API_KEY) {
      return await voyageRerank(query, candidates, limit);
    }
  }
  
  // No reranking, just return top candidates
  return candidates.slice(0, limit);
}

// ============================================================================
// MIGRATION HELPER: Add full-text search to existing tables
// ============================================================================

/**
 * SQL to add full-text search capabilities
 * Run this in Supabase SQL editor if not already set up
 */
export const FULLTEXT_SEARCH_MIGRATION = `
-- Add tsvector column for full-text search
ALTER TABLE knowledge_base 
ADD COLUMN IF NOT EXISTS content_search tsvector
GENERATED ALWAYS AS (
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(content, '')), 'B')
) STORED;

-- Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS knowledge_base_content_search_idx 
ON knowledge_base USING GIN (content_search);

-- Same for precedents table
ALTER TABLE precedents
ADD COLUMN IF NOT EXISTS content_search tsvector
GENERATED ALWAYS AS (
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(letter_content, '')), 'B')
) STORED;

CREATE INDEX IF NOT EXISTS precedents_content_search_idx 
ON precedents USING GIN (content_search);
`;

