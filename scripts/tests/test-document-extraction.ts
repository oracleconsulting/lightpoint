/**
 * Document Extraction Model Comparison
 * 
 * IMMEDIATE PRIORITY (This Week):
 * - Test Haiku 4.5 vs Sonnet 4.5 for document extraction
 * - Process 20 sample documents
 * - Compare completeness and accuracy
 * - If quality similar, switch to Haiku (92% cost savings!)
 * 
 * Usage: npx tsx scripts/tests/test-document-extraction.ts
 */

import { supabaseAdmin } from '../../lib/supabase/client';
import { DOCUMENT_EXTRACTION_TEST_MODELS, type DocumentExtractionTest } from '../../lib/testing/modelTesting';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  console.error('❌ OPENROUTER_API_KEY not set');
  process.exit(1);
}

/**
 * Gold standard test documents with expected extractions
 */
const TEST_DOCUMENTS = [
  {
    id: 'test-001',
    name: 'SEIS Relief Letter',
    type: 'structured' as const,
    text: `From: HMRC Business Tax Unit
Date: 15 March 2024
Reference: BT/2024/12345

Dear Taxpayer,

Regarding SEIS3 relief claim for tax year 2023/24 (£125,000 investment).

Your claim submitted on 5 February 2024 requires additional information.

Please provide Form SEIS3 within 30 days.

Regards,
HMRC`,
    expected: {
      dates: ['15 March 2024', '5 February 2024'],
      amounts: ['£125,000'],
      references: ['BT/2024/12345', 'SEIS3', '2023/24'],
      events: ['claim submitted', 'requires additional information']
    }
  },
  {
    id: 'test-002',
    name: 'Delay Acknowledgment',
    type: 'unstructured' as const,
    text: `Thank you for your enquiry dated 10 May 2025. We apologise for the 8-month delay in responding to your initial correspondence from September 2024. Your case has been escalated to our Technical Team. The standard processing time is 30 working days. We will respond by 15 June 2025 at the latest.`,
    expected: {
      dates: ['10 May 2025', 'September 2024', '15 June 2025'],
      amounts: [],
      references: ['30 working days', '8-month'],
      events: ['enquiry', 'delay', 'escalated', 'processing']
    }
  }
  // Add more test cases...
];

/**
 * Call LLM to extract structured data from document
 */
async function extractWithModel(documentText: string, model: string): Promise<{
  dates: string[];
  amounts: string[];
  references: string[];
  events: string[];
  json_valid: boolean;
  time_seconds: number;
}> {
  console.log(`  🤖 Extracting with ${model}...`);
  const startTime = Date.now();
  
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://lightpoint.app',
        'X-Title': 'Lightpoint Document Extraction Test',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: `Extract ALL dates, amounts, reference numbers, and key events from HMRC documents.

Return ONLY a JSON object with this exact structure:
{
  "dates": ["dd Month yyyy"],
  "amounts": ["£X,XXX"],
  "references": ["REF123"],
  "events": ["brief event description"]
}

Be exhaustive - extract EVERY date, amount, and reference found.`
          },
          {
            role: 'user',
            content: documentText
          }
        ],
        temperature: 0.1,
        max_tokens: 1000
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    let content = data.choices[0].message.content;
    
    // Strip markdown code blocks if present
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    const timeSeconds = (Date.now() - startTime) / 1000;
    
    try {
      const extracted = JSON.parse(content);
      return {
        ...extracted,
        json_valid: true,
        time_seconds: timeSeconds
      };
    } catch {
      console.error(`  ❌ Invalid JSON from ${model}`);
      return {
        dates: [],
        amounts: [],
        references: [],
        events: [],
        json_valid: false,
        time_seconds: timeSeconds
      };
    }
    
  } catch (error: any) {
    console.error(`  ❌ Extraction failed: ${error.message}`);
    return {
      dates: [],
      amounts: [],
      references: [],
      events: [],
      json_valid: false,
      time_seconds: (Date.now() - startTime) / 1000
    };
  }
}

/**
 * Calculate extraction quality metrics
 */
function calculateQuality(
  extracted: { dates: string[]; amounts: string[]; references: string[]; events: string[] },
  expected: { dates: string[]; amounts: string[]; references: string[]; events: string[] }
): { completeness: number; accuracy: number } {
  // Completeness: % of expected items found
  const totalExpected = expected.dates.length + expected.amounts.length + 
                        expected.references.length + expected.events.length;
  
  if (totalExpected === 0) return { completeness: 1, accuracy: 1 };
  
  let foundCount = 0;
  
  // Check dates (fuzzy match on main components)
  expected.dates.forEach(expectedDate => {
    if (extracted.dates.some(d => 
      d.includes(expectedDate.split(' ')[0]) || expectedDate.includes(d.split(' ')[0])
    )) {
      foundCount++;
    }
  });
  
  // Check amounts (exact match or normalized)
  expected.amounts.forEach(expectedAmount => {
    if (extracted.amounts.some(a => 
      a.replace(/[,\s]/g, '') === expectedAmount.replace(/[,\s]/g, '')
    )) {
      foundCount++;
    }
  });
  
  // Check references (partial match ok)
  expected.references.forEach(expectedRef => {
    if (extracted.references.some(r => 
      r.toLowerCase().includes(expectedRef.toLowerCase()) ||
      expectedRef.toLowerCase().includes(r.toLowerCase())
    )) {
      foundCount++;
    }
  });
  
  // Check events (keyword match)
  expected.events.forEach(expectedEvent => {
    if (extracted.events.some(e => 
      e.toLowerCase().includes(expectedEvent.toLowerCase())
    )) {
      foundCount++;
    }
  });
  
  const completeness = foundCount / totalExpected;
  
  // Accuracy: % of extracted items that are valid (no false positives)
  const totalExtracted = extracted.dates.length + extracted.amounts.length + 
                         extracted.references.length + extracted.events.length;
  
  const accuracy = totalExtracted === 0 ? 0 : foundCount / totalExtracted;
  
  return { completeness, accuracy };
}

/**
 * Test a model on one document
 */
async function testModelOnDocument(
  model: string,
  document: typeof TEST_DOCUMENTS[0]
): Promise<{
  completeness: number;
  accuracy: number;
  jsonValid: boolean;
  timeSeconds: number;
}> {
  const extracted = await extractWithModel(document.text, model);
  const quality = calculateQuality(extracted, document.expected);
  
  return {
    ...quality,
    jsonValid: extracted.json_valid,
    timeSeconds: extracted.time_seconds
  };
}

/**
 * Test all models on all documents
 */
async function main() {
  console.log('🚀 DOCUMENT EXTRACTION MODEL COMPARISON');
  console.log('═'.repeat(60));
  console.log(`Testing ${DOCUMENT_EXTRACTION_TEST_MODELS.length} models on ${TEST_DOCUMENTS.length} documents\n`);
  
  const results: Record<string, DocumentExtractionTest[]> = {};
  
  for (const model of DOCUMENT_EXTRACTION_TEST_MODELS) {
    console.log(`\n🧪 Testing: ${model}`);
    console.log('─'.repeat(60));
    
    results[model] = [];
    
    for (const doc of TEST_DOCUMENTS) {
      console.log(`\n  📄 Document: ${doc.name} (${doc.type})`);
      
      const testResult = await testModelOnDocument(model, doc);
      
      results[model].push({
        model,
        documentType: doc.type,
        extractedDates: [],
        extractedAmounts: [],
        extractedReferences: [],
        extractedEvents: [],
        completeness: testResult.completeness,
        accuracy: testResult.accuracy,
        jsonConsistency: testResult.jsonValid ? 1 : 0,
        avgTimeSeconds: testResult.timeSeconds,
        costPerDocument: 0 // calculated below
      });
      
      console.log(`     Completeness: ${(testResult.completeness * 100).toFixed(1)}%`);
      console.log(`     Accuracy:     ${(testResult.accuracy * 100).toFixed(1)}%`);
      console.log(`     JSON Valid:   ${testResult.jsonValid ? '✓' : '✗'}`);
      console.log(`     Time:         ${testResult.timeSeconds.toFixed(2)}s`);
      
      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }
  
  // Calculate aggregate metrics and costs
  console.log('\n\n📊 AGGREGATE RESULTS');
  console.log('═'.repeat(60));
  console.log('\nModel                              | Complete | Accurate | JSON | Time | Cost/doc');
  console.log('─'.repeat(90));
  
  const modelCosts: Record<string, number> = {
    'anthropic/claude-sonnet-4.5': 3.0,
    'anthropic/claude-haiku-4.5': 0.25,
    'openai/gpt-4o-mini': 0.15,
    'google/gemini-flash-1.5': 0.075
  };
  
  for (const [model, tests] of Object.entries(results)) {
    const avgCompleteness = tests.reduce((sum, t) => sum + t.completeness, 0) / tests.length;
    const avgAccuracy = tests.reduce((sum, t) => sum + t.accuracy, 0) / tests.length;
    const jsonSuccess = tests.reduce((sum, t) => sum + t.jsonConsistency, 0) / tests.length;
    const avgTime = tests.reduce((sum, t) => sum + t.avgTimeSeconds, 0) / tests.length;
    
    // Rough cost estimate (1K tokens per doc * cost per 1M tokens)
    const costPerDoc = (modelCosts[model] || 1.0) / 1000;
    
    const modelName = model.padEnd(35);
    const complete = `${(avgCompleteness * 100).toFixed(1)}%`.padStart(8);
    const accurate = `${(avgAccuracy * 100).toFixed(1)}%`.padStart(8);
    const json = `${(jsonSuccess * 100).toFixed(0)}%`.padStart(4);
    const time = `${avgTime.toFixed(2)}s`.padStart(6);
    const cost = `$${costPerDoc.toFixed(4)}`.padStart(8);
    
    console.log(`${modelName} | ${complete} | ${accurate} | ${json} | ${time} | ${cost}`);
  }
  
  // Recommendations
  const modelNames = Object.keys(results);
  const baseline = results[modelNames[0]]; // Sonnet 4.5
  const haiku = results['anthropic/claude-haiku-4.5'];
  
  if (baseline && haiku) {
    const baselineQuality = (baseline.reduce((sum, t) => sum + t.completeness + t.accuracy, 0) / (baseline.length * 2));
    const haikuQuality = (haiku.reduce((sum, t) => sum + t.completeness + t.accuracy, 0) / (haiku.length * 2));
    const qualityDelta = ((haikuQuality - baselineQuality) / baselineQuality) * 100;
    
    console.log('\n\n💡 HAIKU 4.5 RECOMMENDATION:\n');
    
    if (Math.abs(qualityDelta) < 5) {
      console.log(`✅ STRONGLY RECOMMEND switching to Haiku 4.5!`);
      console.log(`   Quality: ${qualityDelta >= 0 ? '+' : ''}${qualityDelta.toFixed(1)}% (within acceptable range)`);
      console.log(`   Cost:    92% reduction ($3.00 → $0.25 per 1M tokens)`);
      console.log(`   Savings: $2.75 per 1M tokens`);
      console.log(`   At 1,000 docs/month: Save ~$2,750/month ($33k/year)`);
    } else if (qualityDelta < -5) {
      console.log(`⚠️  NOT RECOMMENDED: Quality degradation of ${Math.abs(qualityDelta).toFixed(1)}%`);
      console.log(`   While cost savings are significant, the quality loss is too high.`);
    } else {
      console.log(`✅ RECOMMEND: Haiku 4.5 is actually BETTER (+${qualityDelta.toFixed(1)}%)`);
      console.log(`   And it's 92% cheaper. This is a no-brainer!`);
    }
  }
  
  // Save results
  const timestamp = new Date().toISOString().split('T')[0];
  const fs = await import('fs');
  const outputPath = `./test-results/document-extraction-${timestamp}.json`;
  
  fs.writeFileSync(outputPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    results,
    testDocuments: TEST_DOCUMENTS.map(d => ({ id: d.id, name: d.name, type: d.type }))
  }, null, 2));
  
  console.log(`\n💾 Results saved to: ${outputPath}`);
}

main().catch(console.error);

