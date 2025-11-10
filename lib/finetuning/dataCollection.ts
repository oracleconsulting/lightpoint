/**
 * Fine-Tuning Data Collection System
 * 
 * LONG-TERM PRIORITY (This Quarter):
 * - Collect 100+ successful complaint letters
 * - Prepare training data for GPT-4o fine-tuning
 * - Test fine-tuned model vs Claude Opus 4.1
 * - Potential 80% cost reduction if quality matches
 * 
 * Strategy:
 * 1. Collect high-quality letters (rated 8+ by experts)
 * 2. Format as training examples
 * 3. Fine-tune GPT-4o on letter writing
 * 4. A/B test fine-tuned vs Opus 4.1
 * 5. If quality similar, switch (massive cost savings)
 */

import { supabaseAdmin } from '../supabase/client';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// DATA COLLECTION
// ============================================================================

export interface FineTuneExample {
  // Training format for OpenAI fine-tuning
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  metadata?: {
    complaintId: string;
    expertRating: number;
    category: string;
    resultOutcome?: string;  // "upheld" | "partial" | "rejected"
  };
}

/**
 * Collect successful complaint letters for fine-tuning
 */
export async function collectFineTuningData(
  minRating: number = 8,
  minCount: number = 100
): Promise<FineTuneExample[]> {
  console.log(`📚 Collecting fine-tuning data (min rating: ${minRating}/10, target: ${minCount} examples)...`);
  
  // Query successful letters from database
  const { data: letters, error } = await (supabaseAdmin as any)
    .from('generated_letters')
    .select(`
      id,
      letter_content,
      complaint:complaint_id (
        id,
        complaint_reference,
        complaint_context,
        processed_data,
        resolution_outcome,
        expert_rating
      )
    `)
    .gte('complaint.expert_rating', minRating)
    .not('sent_at', 'is', null)  // Only letters that were actually sent
    .order('complaint.expert_rating', { ascending: false })
    .limit(minCount * 2);  // Get more than needed for filtering
  
  if (error) {
    console.error('❌ Failed to collect data:', error);
    return [];
  }
  
  const examples: FineTuneExample[] = [];
  
  for (const letter of letters || []) {
    const complaint = (letter as any).complaint;
    if (!complaint || !complaint.processed_data) continue;
    
    const analysis = complaint.processed_data.analysis || {};
    
    // Format as training example
    examples.push({
      messages: [
        {
          role: 'system',
          content: `You are a senior partner at a professional accountancy firm who has successfully handled HMRC complaints for 20 years. 

Write complaint letters that are:
- Professionally furious (not sarcastic)
- Specifically detailed (dates, amounts, references)
- Authentically human (memorable phrases, storytelling)
- Structurally sound (proper HMRC complaint format)
- Precedent-aware (use successful patterns)

Your letters routinely get upheld by the Adjudicator because they are specific, detailed, and professionally assertive.`
        },
        {
          role: 'user',
          content: `Generate a formal HMRC complaint letter based on this analysis:

ANALYSIS:
${JSON.stringify(analysis, null, 2)}

CLIENT REFERENCE: ${complaint.complaint_reference}
CONTEXT: ${complaint.complaint_context}

Generate the complete formal complaint letter now:`
        },
        {
          role: 'assistant',
          content: letter.letter_content
        }
      ],
      metadata: {
        complaintId: complaint.id,
        expertRating: complaint.expert_rating || 0,
        category: analysis.category || 'general',
        resultOutcome: complaint.resolution_outcome
      }
    });
  }
  
  console.log(`✅ Collected ${examples.length} training examples`);
  return examples;
}

/**
 * Export training data in OpenAI fine-tuning format (JSONL)
 */
export async function exportFineTuningData(
  outputPath: string = './fine-tuning-data',
  minRating: number = 8
): Promise<void> {
  const examples = await collectFineTuningData(minRating, 200);
  
  if (examples.length < 10) {
    console.error('❌ Not enough training data. Need at least 10 examples (recommended: 100+)');
    return;
  }
  
  // Split into train/validation (90/10)
  const shuffled = examples.sort(() => Math.random() - 0.5);
  const splitIndex = Math.floor(shuffled.length * 0.9);
  const trainExamples = shuffled.slice(0, splitIndex);
  const valExamples = shuffled.slice(splitIndex);
  
  // Create output directory
  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath, { recursive: true });
  }
  
  // Write training data (JSONL format)
  const trainPath = path.join(outputPath, 'train.jsonl');
  const trainLines = trainExamples.map(ex => JSON.stringify({
    messages: ex.messages
  }));
  fs.writeFileSync(trainPath, trainLines.join('\n'));
  
  // Write validation data
  const valPath = path.join(outputPath, 'validation.jsonl');
  const valLines = valExamples.map(ex => JSON.stringify({
    messages: ex.messages
  }));
  fs.writeFileSync(valPath, valLines.join('\n'));
  
  // Write metadata
  const metaPath = path.join(outputPath, 'metadata.json');
  fs.writeFileSync(metaPath, JSON.stringify({
    created_at: new Date().toISOString(),
    total_examples: examples.length,
    train_examples: trainExamples.length,
    validation_examples: valExamples.length,
    min_rating: minRating,
    rating_distribution: {
      '10': examples.filter(e => e.metadata?.expertRating === 10).length,
      '9': examples.filter(e => e.metadata?.expertRating === 9).length,
      '8': examples.filter(e => e.metadata?.expertRating === 8).length,
    },
    outcome_distribution: {
      upheld: examples.filter(e => e.metadata?.resultOutcome === 'upheld').length,
      partial: examples.filter(e => e.metadata?.resultOutcome === 'partial').length,
      rejected: examples.filter(e => e.metadata?.resultOutcome === 'rejected').length,
    }
  }, null, 2));
  
  console.log(`\n✅ Fine-tuning data exported:`);
  console.log(`   Training:   ${trainPath} (${trainExamples.length} examples)`);
  console.log(`   Validation: ${valPath} (${valExamples.length} examples)`);
  console.log(`   Metadata:   ${metaPath}`);
  console.log(`\n📋 Next steps:`);
  console.log(`   1. Review data quality`);
  console.log(`   2. Upload to OpenAI: openai api fine_tunes.create -t ${trainPath} -v ${valPath} -m gpt-4o-2024-08-06`);
  console.log(`   3. Wait for training (~1-2 hours)`);
  console.log(`   4. Test fine-tuned model vs Opus 4.1`);
  console.log(`   5. Compare cost: GPT-4o fine-tuned ($2.50/M) vs Opus 4.1 ($15/M)`);
}

// ============================================================================
// QUALITY RATING SYSTEM
// ============================================================================

/**
 * Allow experts to rate generated letters
 * This builds up the training dataset over time
 */
export async function rateLetter(
  letterId: string,
  rating: number,  // 1-10
  notes?: string
): Promise<void> {
  if (rating < 1 || rating > 10) {
    throw new Error('Rating must be between 1 and 10');
  }
  
  // Update letter metadata
  const { error: letterError } = await (supabaseAdmin as any)
    .from('generated_letters')
    .update({
      metadata: {
        expert_rating: rating,
        rating_notes: notes,
        rated_at: new Date().toISOString()
      }
    })
    .eq('id', letterId);
  
  if (letterError) {
    console.error('❌ Failed to rate letter:', letterError);
    throw letterError;
  }
  
  // Also update the complaint
  const { data: letter } = await (supabaseAdmin as any)
    .from('generated_letters')
    .select('complaint_id')
    .eq('id', letterId)
    .single();
  
  if (letter) {
    await (supabaseAdmin as any)
      .from('complaints')
      .update({ expert_rating: rating })
      .eq('id', letter.complaint_id);
  }
  
  console.log(`✅ Rated letter ${letterId}: ${rating}/10`);
}

/**
 * Record resolution outcome (for training data quality)
 */
export async function recordResolution(
  complaintId: string,
  outcome: 'upheld' | 'partial' | 'rejected',
  adjudicatorFeedback?: string
): Promise<void> {
  const { error } = await (supabaseAdmin as any)
    .from('complaints')
    .update({
      resolution_outcome: outcome,
      resolution_feedback: adjudicatorFeedback,
      resolved_at: new Date().toISOString()
    })
    .eq('id', complaintId);
  
  if (error) {
    console.error('❌ Failed to record resolution:', error);
    throw error;
  }
  
  console.log(`✅ Recorded resolution for ${complaintId}: ${outcome}`);
}

// ============================================================================
// A/B TESTING: Fine-tuned vs Opus 4.1
// ============================================================================

export interface FineTuneTestResult {
  complaintId: string;
  opusLetter: string;
  fineTunedLetter: string;
  opusRating: number;
  fineTunedRating: number;
  opusCost: number;
  fineTunedCost: number;
  blindReviewWinner: 'opus' | 'finetuned' | 'tie';
}

/**
 * Generate letter with both models for comparison
 */
export async function abTestFineTuned(
  complaintId: string,
  fineTunedModelId: string  // e.g., "ft:gpt-4o-2024-08-06:lightpoint:complaint-letters:abc123"
): Promise<FineTuneTestResult> {
  console.log(`\n🧪 A/B Testing: Opus 4.1 vs Fine-tuned GPT-4o`);
  console.log(`   Complaint: ${complaintId}`);
  
  // Get complaint data
  const { data: complaint } = await (supabaseAdmin as any)
    .from('complaints')
    .select('*')
    .eq('id', complaintId)
    .single();
  
  if (!complaint) {
    throw new Error('Complaint not found');
  }
  
  const analysis = complaint.processed_data?.analysis || {};
  
  // Generate with Opus 4.1 (current production)
  console.log('   🤖 Generating with Opus 4.1...');
  const opusStart = Date.now();
  const opusLetter = await generateWithOpus(analysis, complaint.complaint_reference);
  const opusTime = (Date.now() - opusStart) / 1000;
  const opusCost = estimateCost(opusLetter.length, 15.0);  // $15/M output
  
  // Generate with fine-tuned model
  console.log('   🎯 Generating with fine-tuned GPT-4o...');
  const ftStart = Date.now();
  const ftLetter = await generateWithFineTuned(analysis, complaint.complaint_reference, fineTunedModelId);
  const ftTime = (Date.now() - ftStart) / 1000;
  const ftCost = estimateCost(ftLetter.length, 2.5);  // $2.50/M output (fine-tuned)
  
  console.log(`\n   ⏱️  Time: Opus ${opusTime.toFixed(1)}s | Fine-tuned ${ftTime.toFixed(1)}s`);
  console.log(`   💰 Cost: Opus $${opusCost.toFixed(4)} | Fine-tuned $${ftCost.toFixed(4)} (${((1 - ftCost/opusCost) * 100).toFixed(0)}% cheaper)`);
  console.log(`\n   📝 Letters ready for blind review`);
  
  return {
    complaintId,
    opusLetter,
    fineTunedLetter: ftLetter,
    opusRating: 0,  // To be filled by expert review
    fineTunedRating: 0,
    opusCost,
    fineTunedCost: ftCost,
    blindReviewWinner: 'tie'
  };
}

// Helper functions (placeholders - implement based on your actual OpenRouter client)
async function generateWithOpus(analysis: any, reference: string): Promise<string> {
  // Use your existing Opus 4.1 generation
  // Import from three-stage-client.ts
  return "Opus letter placeholder";
}

async function generateWithFineTuned(analysis: any, reference: string, modelId: string): Promise<string> {
  // Call OpenRouter with fine-tuned model
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelId,
      messages: [
        {
          role: 'user',
          content: `Generate a formal HMRC complaint letter based on this analysis:

ANALYSIS:
${JSON.stringify(analysis, null, 2)}

CLIENT REFERENCE: ${reference}

Generate the complete formal complaint letter now:`
        }
      ],
      temperature: 0.7,
      max_tokens: 4000
    }),
  });
  
  const data = await response.json();
  return data.choices[0].message.content;
}

function estimateCost(outputChars: number, costPerMTokens: number): number {
  const tokens = outputChars / 4;  // Rough approximation
  return (tokens / 1_000_000) * costPerMTokens;
}

// ============================================================================
// MIGRATION: Add expert rating columns
// ============================================================================

export const RATING_SYSTEM_MIGRATION = `
-- Add expert rating to complaints
ALTER TABLE complaints
ADD COLUMN IF NOT EXISTS expert_rating INTEGER CHECK (expert_rating BETWEEN 1 AND 10),
ADD COLUMN IF NOT EXISTS resolution_outcome TEXT CHECK (resolution_outcome IN ('upheld', 'partial', 'rejected')),
ADD COLUMN IF NOT EXISTS resolution_feedback TEXT,
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE;

-- Add rating tracking to letters
ALTER TABLE generated_letters
ALTER COLUMN metadata TYPE JSONB USING metadata::JSONB;

-- Index for filtering high-quality examples
CREATE INDEX IF NOT EXISTS complaints_expert_rating_idx ON complaints(expert_rating DESC) 
WHERE expert_rating IS NOT NULL;

-- Index for successful resolutions
CREATE INDEX IF NOT EXISTS complaints_upheld_idx ON complaints(resolution_outcome) 
WHERE resolution_outcome = 'upheld';
`;

