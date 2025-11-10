import { supabaseAdmin } from '@/lib/supabase/client';
import { generateEmbedding } from '@/lib/embeddings';
import { cohereRerank, voyageRerank } from '@/lib/search/hybridSearch';

// Reranking configuration
const USE_RERANKING = true;  // Always use reranking for quality
const RERANKER = process.env.COHERE_API_KEY ? 'cohere' : 
                 process.env.VOYAGE_API_KEY ? 'voyage' : 
                 'none';

/**
 * Multi-angle vector search in knowledge base
 * Performs multiple searches from different angles to ensure comprehensive coverage
 * NOW WITH RERANKING for maximum precision!
 */
export const searchKnowledgeBaseMultiAngle = async (
  queryText: string,
  threshold: number = 0.75,
  matchCount: number = 10
) => {
  try {
    console.log('🔍 Starting multi-angle knowledge base search with reranking...');
    
    // Extract key components for targeted searches
    const searchQueries = generateSearchQueries(queryText);
    
    console.log(`📊 Generated ${searchQueries.length} search angles:`, searchQueries);
    
    // Get MORE candidates for reranking (3x the final count)
    const candidateCount = matchCount * 3;
    
    // Perform all searches in parallel
    const allResults = await Promise.all(
      searchQueries.map(query => searchKnowledgeBase(query, threshold, candidateCount))
    );
    
    // Combine and deduplicate results
    let combinedResults = deduplicateResults(allResults.flat());
    
    console.log(`📦 Multi-angle search found ${combinedResults.length} candidates`);
    
    // RERANK for precision
    if (USE_RERANKING && combinedResults.length > matchCount) {
      console.log(`🎯 Reranking with ${RERANKER}...`);
      
      const documentsToRerank = combinedResults.map(r => ({
        id: r.id,
        content: `${r.title || ''}\n${r.content || ''}`
      }));
      
      if (RERANKER === 'cohere') {
        combinedResults = await cohereRerank(queryText, documentsToRerank, matchCount);
      } else if (RERANKER === 'voyage') {
        combinedResults = await voyageRerank(queryText, documentsToRerank, matchCount);
      } else {
        console.log('⚠️  No reranker API key set, using vector scores only');
        combinedResults = combinedResults.slice(0, matchCount);
      }
      
      console.log(`✅ Reranked to top ${combinedResults.length} results`);
    }
    
    return combinedResults;
  } catch (error) {
    console.error('Multi-angle search error:', error);
    // Fall back to single search
    return searchKnowledgeBase(queryText, threshold, matchCount);
  }
};

/**
 * Generate multiple search query variations for comprehensive coverage
 */
function generateSearchQueries(originalQuery: string): string[] {
  const queries: string[] = [originalQuery]; // Always include original
  
  // Extract key terms and concepts
  const lowerQuery = originalQuery.toLowerCase();
  
  // Search 1: Direct topic search (extract main concepts)
  if (lowerQuery.includes('penalty') || lowerQuery.includes('penalties')) {
    queries.push('HMRC penalty cancellation errors');
    queries.push('penalty appeal CRG guidance');
  }
  
  if (lowerQuery.includes('delay') || lowerQuery.includes('delayed')) {
    queries.push('unreasonable delays CRG4025 remedy');
    queries.push('HMRC delay compensation charter');
  }
  
  if (lowerQuery.includes('seis') || lowerQuery.includes('eis')) {
    queries.push('SEIS EIS claim processing timeline');
    queries.push('SEIS claim errors and appeals');
  }
  
  // Search 2: Process/procedure search
  queries.push('complaint escalation tier 1 tier 2 adjudicator');
  queries.push('HMRC complaints procedure timeline');
  
  // Search 3: CRG reference search
  queries.push('CRG professional fees reimbursement CRG5225');
  queries.push('CRG compensation distress inconvenience CRG6050');
  queries.push('CRG financial redress remedy');
  
  // Search 4: Charter commitments search
  queries.push('Charter commitments being responsive getting things right');
  queries.push('Charter violations complaint grounds');
  
  // Search 5: Template and effective language
  queries.push('effective complaint letter phrases breakthrough language');
  queries.push('successful complaint examples letter templates');
  
  // Search 6: Timeline and documentation
  queries.push('complaint response timeframes 15 working days');
  queries.push('evidence documentation requirements complaints');
  
  return [...new Set(queries)]; // Remove duplicates
}

/**
 * Deduplicate search results by ID and rank by relevance
 */
function deduplicateResults(results: any[]): any[] {
  const seen = new Set();
  const unique: any[] = [];
  
  for (const result of results) {
    const id = result.id || result.title;
    if (!seen.has(id)) {
      seen.add(id);
      unique.push(result);
    }
  }
  
  // Sort by similarity score if available
  return unique.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
}

/**
 * Vector search in knowledge base (single query)
 */
export const searchKnowledgeBase = async (
  queryText: string,
  threshold: number = 0.8,
  matchCount: number = 5
) => {
  try {
    // Generate embedding for query
    const embedding = await generateEmbedding(queryText);
    
    // Search using Supabase RPC function
    const { data, error } = await (supabaseAdmin as any).rpc('match_knowledge_base', {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: matchCount,
    });
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    console.error('Knowledge base search error:', error);
    throw new Error('Failed to search knowledge base');
  }
};

/**
 * Vector search in precedents
 * NOW WITH RERANKING - precedent accuracy is CRITICAL for letter quality!
 */
export const searchPrecedents = async (
  queryText: string,
  threshold: number = 0.8,
  matchCount: number = 5
) => {
  try {
    console.log('📚 Searching precedents with reranking...');
    
    // Get 3x candidates for reranking
    const candidateCount = matchCount * 3;
    
    // Generate embedding for query
    const embedding = await generateEmbedding(queryText);
    
    // Search using Supabase RPC function
    const { data, error } = await (supabaseAdmin as any).rpc('match_precedents', {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: candidateCount,
    });
    
    if (error) throw error;
    
    let results = data || [];
    
    // RERANK precedents for maximum accuracy
    if (USE_RERANKING && results.length > matchCount) {
      console.log(`🎯 Reranking ${results.length} precedents with ${RERANKER}...`);
      
      const documentsToRerank = results.map((r: any) => ({
        id: r.id,
        content: `${r.title || ''}\n${r.letter_content || r.content || ''}`
      }));
      
      if (RERANKER === 'cohere') {
        results = await cohereRerank(queryText, documentsToRerank, matchCount);
      } else if (RERANKER === 'voyage') {
        results = await voyageRerank(queryText, documentsToRerank, matchCount);
      } else {
        console.log('⚠️  No reranker API key set, using vector scores only');
        results = results.slice(0, matchCount);
      }
      
      console.log(`✅ Reranked to top ${results.length} precedents`);
    }
    
    return results;
  } catch (error) {
    console.error('Precedents search error:', error);
    throw new Error('Failed to search precedents');
  }
};

/**
 * Add document to knowledge base with embedding
 */
export const addToKnowledgeBase = async (
  category: string,
  title: string,
  content: string,
  source?: string,
  metadata?: Record<string, any>
) => {
  try {
    // Generate embedding
    const embedding = await generateEmbedding(content);
    
    // Insert into database
    const { data, error } = await (supabaseAdmin as any)
      .from('knowledge_base')
      .insert({
        category,
        title,
        content,
        source,
        embedding,
        metadata: metadata || {},
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return data;
  } catch (error) {
    console.error('Failed to add to knowledge base:', error);
    throw error;
  }
};

/**
 * Add precedent case with embedding
 */
export const addPrecedent = async (
  complaintType: string,
  issueCategory: string,
  outcome: string,
  resolutionTimeDays: number,
  compensationAmount: number,
  keyArguments: string[],
  effectiveCitations: string[],
  metadata?: Record<string, any>
) => {
  try {
    // Create searchable text from precedent data
    const searchableText = `${complaintType} ${issueCategory} ${outcome} ${keyArguments.join(' ')} ${effectiveCitations.join(' ')}`;
    
    // Generate embedding
    const embedding = await generateEmbedding(searchableText);
    
    // Insert into database
    const { data, error } = await (supabaseAdmin as any)
      .from('precedents')
      .insert({
        complaint_type: complaintType,
        issue_category: issueCategory,
        outcome,
        resolution_time_days: resolutionTimeDays,
        compensation_amount: compensationAmount,
        key_arguments: keyArguments,
        effective_citations: effectiveCitations,
        embedding,
        metadata: metadata || {},
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return data;
  } catch (error) {
    console.error('Failed to add precedent:', error);
    throw error;
  }
};

