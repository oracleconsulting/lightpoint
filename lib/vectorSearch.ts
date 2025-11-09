import { supabaseAdmin } from '@/lib/supabase/client';
import { generateEmbedding } from '@/lib/embeddings';

/**
 * Vector search in knowledge base
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
 */
export const searchPrecedents = async (
  queryText: string,
  threshold: number = 0.8,
  matchCount: number = 5
) => {
  try {
    // Generate embedding for query
    const embedding = await generateEmbedding(queryText);
    
    // Search using Supabase RPC function
    const { data, error } = await (supabaseAdmin as any).rpc('match_precedents', {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: matchCount,
    });
    
    if (error) throw error;
    
    return data || [];
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

