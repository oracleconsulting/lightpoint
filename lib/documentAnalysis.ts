/**
 * Two-Stage Document Analysis for HMRC Complaints
 * 
 * Stage 1: Individual document analysis (full context, no loss)
 * Stage 2: Combined analysis using structured data
 */

import { callOpenRouter } from './openrouter/client';
import { sanitizeForLLM } from './privacy';

// Use Sonnet 4.5 for document analysis (1M context, cheaper, fast)
const ANALYSIS_MODEL = 'anthropic/claude-sonnet-4.5';

/**
 * Stage 1: Analyze individual document in full detail
 * This captures EVERYTHING without loss of information
 * Uses Claude Sonnet 4.5 (1M tokens, $3/M input - 5x cheaper than Opus)
 */
export async function analyzeIndividualDocument(
  documentText: string,
  documentType: string,
  fileName: string
): Promise<DocumentAnalysis> {
  
  console.log(`📄 Stage 1 (Sonnet 4.5): Analyzing ${fileName} (${documentText.length} chars)`);
  
  const response = await callOpenRouter({
    model: ANALYSIS_MODEL, // Sonnet 4.5 for analysis
    messages: [
      {
        role: 'system',
        content: `You are an expert HMRC document analyst. Extract ALL relevant information from this document.

CRITICAL: Do NOT summarize or lose any details. Extract:
1. ALL dates mentioned (exact format)
2. ALL monetary amounts (with context)
3. ALL reference numbers (HMRC refs, UTRs, NINOs, case refs)
4. ALL correspondence details (who sent, who received, when)
5. ALL issues, errors, or problems mentioned
6. ALL HMRC instructions or requirements
7. ALL deadlines or timeframes
8. ALL direct quotes from HMRC (use exact wording)
9. Key chronological events
10. Any Charter violations or CRG-relevant issues

Return ONLY valid JSON:
{
  "dates": [{ "date": "16 February 2024", "context": "Initial SEIS claim submitted" }],
  "amounts": [{ "amount": "£34,000", "context": "Total SEIS relief claimed" }],
  "references": [{ "type": "HMRC Ref", "value": "000079849735/SAEEU01/129274" }],
  "correspondence": [{ "from": "HMRC", "to": "Client", "date": "20 March 2025", "summary": "..." }],
  "issues": ["Lost correspondence", "Contradictory instructions", "Unreasonable delay"],
  "hmrcQuotes": ["not made in the correct way", "submit using SEIS3 form"],
  "deadlines": [{ "date": "...", "description": "..." }],
  "charterViolations": ["Being Responsive - 13 month delay", "Getting Things Right - contradictory guidance"],
  "summary": "Brief overall summary of document content"
}`
      },
      {
        role: 'user',
        content: `Document Type: ${documentType}
File Name: ${fileName}

Document Content:
${sanitizeForLLM(documentText)}

Extract ALL information as structured JSON:`
      }
    ],
    temperature: 0.3, // Lower temp for accurate extraction
    max_tokens: 4000,
  });
  
  // Parse JSON response
  try {
    let jsonText = response.trim();
    const jsonBlockMatch = jsonText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonBlockMatch) {
      jsonText = jsonBlockMatch[1].trim();
    }
    
    const parsed = JSON.parse(jsonText);
    console.log(`✅ Extracted ${parsed.dates?.length || 0} dates, ${parsed.amounts?.length || 0} amounts, ${parsed.issues?.length || 0} issues`);
    
    return parsed;
  } catch (error: any) {
    console.error('❌ Failed to parse document analysis:', error);
    // Fallback: return basic structure
    return {
      dates: [],
      amounts: [],
      references: [],
      correspondence: [],
      issues: [],
      hmrcQuotes: [],
      deadlines: [],
      charterViolations: [],
      summary: response.substring(0, 500)
    };
  }
}

/**
 * Stage 2: Combine all document analyses for complaint generation
 * Uses structured data - no information loss, but compact representation
 */
export function combineDocumentAnalyses(
  analyses: DocumentAnalysis[],
  complaintContext: string
): string {
  
  console.log(`📊 Stage 2: Combining ${analyses.length} document analyses`);
  
  // Aggregate all structured data
  const allDates = analyses.flatMap(a => a.dates || []);
  const allAmounts = analyses.flatMap(a => a.amounts || []);
  const allReferences = analyses.flatMap(a => a.references || []);
  const allCorrespondence = analyses.flatMap(a => a.correspondence || []);
  const allIssues = [...new Set(analyses.flatMap(a => a.issues || []))];
  const allHmrcQuotes = analyses.flatMap(a => a.hmrcQuotes || []);
  const allDeadlines = analyses.flatMap(a => a.deadlines || []);
  const allCharterViolations = [...new Set(analyses.flatMap(a => a.charterViolations || []))];
  
  // Build comprehensive but structured context
  const combined = `
COMPLAINT CONTEXT:
${complaintContext}

CHRONOLOGICAL TIMELINE:
${allDates.map(d => `${d.date}: ${d.context}`).join('\n')}

FINANCIAL DETAILS:
${allAmounts.map(a => `${a.amount} - ${a.context}`).join('\n')}

REFERENCE NUMBERS:
${allReferences.map(r => `${r.type}: ${r.value}`).join('\n')}

CORRESPONDENCE HISTORY:
${allCorrespondence.map(c => `${c.date}: ${c.from} to ${c.to} - ${c.summary}`).join('\n')}

IDENTIFIED ISSUES:
${allIssues.map((issue, i) => `${i + 1}. ${issue}`).join('\n')}

HMRC'S EXACT WORDS (Direct Quotes):
${allHmrcQuotes.map(q => `"${q}"`).join('\n')}

DEADLINES AND TIMEFRAMES:
${allDeadlines.map(d => `${d.date}: ${d.description}`).join('\n')}

CHARTER VIOLATIONS:
${allCharterViolations.map((v, i) => `${i + 1}. ${v}`).join('\n')}

DOCUMENT SUMMARIES:
${analyses.map((a, i) => `Document ${i + 1}: ${a.summary}`).join('\n\n')}
`.trim();
  
  console.log(`✅ Combined context: ${combined.length} chars, ~${Math.ceil(combined.length / 4)} tokens`);
  
  return combined;
}

/**
 * Estimate if we can send full text or need to use structured approach
 */
export function shouldUseStructuredAnalysis(
  documents: any[]
): boolean {
  const totalTextLength = documents.reduce((sum, doc) => {
    const text = doc.processed_data?.text || '';
    return sum + text.length;
  }, 0);
  
  const estimatedTokens = Math.ceil(totalTextLength / 4);
  const threshold = 100000; // If >100K tokens in raw text, use structured
  
  console.log(`📊 Document analysis decision: ${estimatedTokens} tokens, threshold: ${threshold}`);
  
  return estimatedTokens > threshold;
}

// Type definitions
export interface DocumentAnalysis {
  dates: Array<{ date: string; context: string }>;
  amounts: Array<{ amount: string; context: string }>;
  references: Array<{ type: string; value: string }>;
  correspondence: Array<{ from: string; to: string; date: string; summary: string }>;
  issues: string[];
  hmrcQuotes: string[];
  deadlines: Array<{ date: string; description: string }>;
  charterViolations: string[];
  summary: string;
}

