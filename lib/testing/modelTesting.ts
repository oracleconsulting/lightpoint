/**
 * Model Testing & Benchmarking Framework
 * 
 * Purpose: A/B test different models at each stage to find optimal cost/quality balance
 * 
 * Usage:
 * 1. Collect baseline data (20-50 sample complaints)
 * 2. Run tests with different model configurations
 * 3. Compare quality metrics vs gold standard
 * 4. Analyze cost implications
 * 5. Make data-driven model selection decisions
 */

import { MODEL_CONFIG } from './modelConfig';

// ============================================================================
// TEST CONFIGURATION
// ============================================================================

export interface TestConfig {
  name: string;
  description: string;
  models: {
    embeddings?: string;
    documentExtraction?: string;
    complaintAnalysis?: string;
    letterFacts?: string;
    letterStructure?: string;
    letterTone?: string;
  };
  expectedCostPerComplaint: number;
}

export const TEST_CONFIGURATIONS: Record<string, TestConfig> = {
  // Current production
  baseline: {
    name: 'Baseline (Current)',
    description: 'Sonnet 4.5 + Opus 4.1 (current production)',
    models: {
      embeddings: 'openai/text-embedding-ada-002',
      documentExtraction: 'anthropic/claude-sonnet-4.5',
      complaintAnalysis: 'anthropic/claude-sonnet-4.5',
      letterFacts: 'anthropic/claude-sonnet-4.5',
      letterStructure: 'anthropic/claude-opus-4.1',
      letterTone: 'anthropic/claude-opus-4.1'
    },
    expectedCostPerComplaint: 1.96
  },

  // Optimized (recommended)
  optimized: {
    name: 'Optimized (Recommended)',
    description: 'Haiku 4.5 + Sonnet 4.5 + Opus 4.1',
    models: {
      embeddings: 'openai/text-embedding-3-large',
      documentExtraction: 'anthropic/claude-haiku-4.5',
      complaintAnalysis: 'anthropic/claude-sonnet-4.5',
      letterFacts: 'anthropic/claude-haiku-4.5',
      letterStructure: 'anthropic/claude-sonnet-4.5',
      letterTone: 'anthropic/claude-opus-4.1'
    },
    expectedCostPerComplaint: 0.60
  },

  // Ultra cost-efficient
  ultraCheap: {
    name: 'Ultra Cost-Efficient',
    description: 'Cheapest possible while maintaining quality',
    models: {
      embeddings: 'openai/text-embedding-3-small',
      documentExtraction: 'anthropic/claude-haiku-4.5',
      complaintAnalysis: 'google/gemini-pro-1.5',
      letterFacts: 'anthropic/claude-haiku-4.5',
      letterStructure: 'anthropic/claude-sonnet-4.5',
      letterTone: 'openai/gpt-4o'
    },
    expectedCostPerComplaint: 0.35
  },

  // Best quality (cost no object)
  bestQuality: {
    name: 'Best Quality',
    description: 'Premium models at every stage',
    models: {
      embeddings: 'openai/text-embedding-3-large',
      documentExtraction: 'anthropic/claude-sonnet-4.5',
      complaintAnalysis: 'anthropic/claude-sonnet-4.5',
      letterFacts: 'anthropic/claude-sonnet-4.5',
      letterStructure: 'anthropic/claude-opus-4.1',
      letterTone: 'anthropic/claude-opus-4.1'
    },
    expectedCostPerComplaint: 2.20
  },

  // GPT-4o heavy (strict JSON)
  gpt4oStrict: {
    name: 'GPT-4o (Strict JSON)',
    description: 'Use GPT-4o for structured outputs',
    models: {
      embeddings: 'openai/text-embedding-3-large',
      documentExtraction: 'openai/gpt-4o',
      complaintAnalysis: 'openai/gpt-4o',
      letterFacts: 'openai/gpt-4o-mini',
      letterStructure: 'openai/gpt-4o',
      letterTone: 'anthropic/claude-opus-4.1'
    },
    expectedCostPerComplaint: 0.85
  },

  // Gemini heavy (huge context)
  geminiHeavy: {
    name: 'Gemini Pro 1.5 (Huge Context)',
    description: 'Use Gemini for 2M context, no chunking needed',
    models: {
      embeddings: 'openai/text-embedding-3-large',
      documentExtraction: 'google/gemini-pro-1.5',
      complaintAnalysis: 'google/gemini-pro-1.5',
      letterFacts: 'anthropic/claude-haiku-4.5',
      letterStructure: 'google/gemini-pro-1.5',
      letterTone: 'anthropic/claude-opus-4.1'
    },
    expectedCostPerComplaint: 0.70
  }
};

// ============================================================================
// QUALITY METRICS
// ============================================================================

export interface QualityMetrics {
  // Document extraction quality
  extractionCompleteness: number;  // 0-1: Did it extract all dates/amounts?
  extractionAccuracy: number;      // 0-1: Were extracted values correct?
  
  // Analysis quality
  violationRecall: number;         // 0-1: Found all actual violations?
  violationPrecision: number;      // 0-1: No false positive violations?
  timelineAccuracy: number;        // 0-1: Timeline correctly constructed?
  
  // Letter quality
  letterStructure: number;         // 0-10: Proper HMRC complaint structure?
  letterTone: number;              // 0-10: Professional fury, authentic?
  letterSpecificity: number;       // 0-10: Specific details vs generic?
  letterOverall: number;           // 0-10: Overall quality rating
  
  // Performance
  totalTime: number;               // seconds
  
  // Cost
  actualCost: number;              // dollars
}

export interface TestResult {
  configName: string;
  complaintId: string;
  metrics: QualityMetrics;
  timestamp: Date;
  notes?: string;
}

// ============================================================================
// EMBEDDINGS TESTING (IMMEDIATE - THIS WEEK)
// ============================================================================

export interface EmbeddingTestResult {
  model: string;
  dimensions: number;
  queryCount: number;
  avgPrecisionAt3: number;    // Precision@3: % of top 3 results that are relevant
  avgRecallAt10: number;      // Recall@10: % of relevant docs found in top 10
  avgLatencyMs: number;
  costPer1MTokens: number;
  totalCost: number;
}

export const EMBEDDING_TEST_MODELS = [
  'openai/text-embedding-ada-002',        // Current
  'openai/text-embedding-3-small',        // 5x cheaper
  'openai/text-embedding-3-large',        // Best quality
  // 'voyage-law-2'                       // Legal specialist (requires Voyage API)
];

export const EMBEDDING_TEST_QUERIES = [
  // HMRC delays
  "14-month delay in SEIS relief processing, no response from HMRC",
  "Unreasonable delays CRG4025 violation Charter Being Responsive",
  "9 months silence after submitting PAYE amendment",
  
  // Lost correspondence
  "HMRC claims letter sent but never received, phantom correspondence",
  "System failure CRG3250 lost mail delivery issues",
  
  // Contradictory instructions
  "HMRC gave conflicting instructions, told to submit form then rejected",
  "Inter-departmental coordination failures Making Things Easy Charter",
  
  // Financial impact
  "Professional fees reimbursement CRG5225 time wasted on HMRC errors",
  "Compensation for worry and distress CRG6050-6075",
  
  // Specific tax types
  "CIS deductions incorrect HMRC Construction Industry Scheme",
  "R&D tax credit claim delayed innovation relief",
  "VAT repayment claim processing 30-day standard exceeded",
  
  // Precedent matching
  "NHS doctor PAYE code issues rotation between hospitals",
  "Debt collection during active dispute penalty notice",
  "Self-assessment system generated incorrect calculation"
];

// ============================================================================
// DOCUMENT EXTRACTION TESTING (IMMEDIATE - THIS WEEK)
// ============================================================================

export const DOCUMENT_EXTRACTION_TEST_MODELS = [
  'anthropic/claude-sonnet-4.5',   // Current
  'anthropic/claude-haiku-4.5',    // 12x cheaper - TEST THIS!
  'openai/gpt-4o-mini',             // Cheap + fast
  'google/gemini-flash-1.5'         // 40x cheaper
];

export interface DocumentExtractionTest {
  model: string;
  documentType: 'structured' | 'unstructured' | 'tabular' | 'scan';
  extractedDates: string[];
  extractedAmounts: string[];
  extractedReferences: string[];
  extractedEvents: string[];
  completeness: number;             // 0-1: vs gold standard
  accuracy: number;                 // 0-1: correct values
  jsonConsistency: number;          // 0-1: valid JSON every time?
  avgTimeSeconds: number;
  costPerDocument: number;
}

// ============================================================================
// ANALYSIS TESTING (SHORT-TERM - THIS MONTH)
// ============================================================================

export const ANALYSIS_TEST_MODELS = [
  'anthropic/claude-sonnet-4.5',   // Current
  'openai/gpt-4o',                  // Strict JSON
  'google/gemini-pro-1.5',          // 2M context
  // 'openai/o1-mini'               // Reasoning specialist
];

export interface AnalysisTestResult {
  model: string;
  complaintComplexity: 'simple' | 'typical' | 'complex';
  violationsFound: number;
  violationsExpected: number;
  falsePositives: number;
  timelineAccuracy: number;         // 0-1
  compensationAccuracy: number;     // 0-1 (vs expert estimate)
  jsonValid: boolean;
  avgTimeSeconds: number;
  costPerAnalysis: number;
}

// ============================================================================
// LETTER GENERATION TESTING (SHORT-TERM - THIS MONTH)
// ============================================================================

export interface LetterGenerationTest {
  stage: 'facts' | 'structure' | 'tone';
  model: string;
  letterQuality: number;            // 0-10: blind review score
  structureCorrect: boolean;        // Has all required sections?
  toneAuthentic: number;            // 0-10: sounds like real accountant?
  specificity: number;              // 0-10: specific vs generic
  precedentUsage: number;           // 0-10: used precedent patterns?
  avgTimeSeconds: number;
  costPerLetter: number;
}

export const LETTER_TEST_CONFIGS = [
  // Current baseline
  {
    name: 'Current (Sonnet + Opus)',
    facts: 'anthropic/claude-sonnet-4.5',
    structure: 'anthropic/claude-opus-4.1',
    tone: 'anthropic/claude-opus-4.1'
  },
  
  // Recommended optimization
  {
    name: 'Optimized (Haiku + Sonnet + Opus)',
    facts: 'anthropic/claude-haiku-4.5',
    structure: 'anthropic/claude-sonnet-4.5',
    tone: 'anthropic/claude-opus-4.1'
  },
  
  // GPT-4o alternative
  {
    name: 'GPT-4o + Opus',
    facts: 'openai/gpt-4o-mini',
    structure: 'openai/gpt-4o',
    tone: 'anthropic/claude-opus-4.1'
  },
  
  // All GPT-4o
  {
    name: 'All GPT-4o',
    facts: 'openai/gpt-4o-mini',
    structure: 'openai/gpt-4o',
    tone: 'openai/gpt-4o'
  }
];

// ============================================================================
// TEST DATA COLLECTION
// ============================================================================

export interface GoldStandardComplaint {
  id: string;
  documents: Array<{
    filename: string;
    expectedDates: string[];
    expectedAmounts: string[];
    expectedReferences: string[];
  }>;
  expectedViolations: Array<{
    type: string;
    citation: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  expectedTimeline: {
    totalDuration: string;
    longestGap: string;
    missedDeadlines: number;
  };
  expectedCompensation: {
    professionalFees: number;
    distressPayment: number;
  };
  expertLetterRating: number;       // 1-10: expert's rating of letter quality
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate precision@k: What % of top K results are relevant?
 */
export const calculatePrecisionAtK = (
  results: any[],
  relevantIds: Set<string>,
  k: number
): number => {
  const topK = results.slice(0, k);
  const relevantInTopK = topK.filter(r => relevantIds.has(r.id)).length;
  return relevantInTopK / k;
};

/**
 * Calculate recall@k: What % of relevant docs are found in top K?
 */
export const calculateRecallAtK = (
  results: any[],
  relevantIds: Set<string>,
  k: number
): number => {
  const topK = results.slice(0, k);
  const relevantInTopK = topK.filter(r => relevantIds.has(r.id)).length;
  return relevantInTopK / relevantIds.size;
};

/**
 * Calculate F1 score (harmonic mean of precision and recall)
 */
export const calculateF1 = (precision: number, recall: number): number => {
  if (precision + recall === 0) return 0;
  return 2 * (precision * recall) / (precision + recall);
};

/**
 * Compare test result to baseline
 */
export const compareToBaseline = (
  testResult: TestResult,
  baseline: TestResult
): {
  qualityDelta: number;      // -1 to +1: worse to better
  costDelta: number;          // -1 to +1: more expensive to cheaper
  speedDelta: number;         // -1 to +1: slower to faster
  recommendation: string;
} => {
  const qualityDelta = (
    testResult.metrics.letterOverall - baseline.metrics.letterOverall
  ) / 10;
  
  const costDelta = (
    baseline.metrics.actualCost - testResult.metrics.actualCost
  ) / baseline.metrics.actualCost;
  
  const speedDelta = (
    baseline.metrics.totalTime - testResult.metrics.totalTime
  ) / baseline.metrics.totalTime;
  
  let recommendation = '';
  
  if (qualityDelta >= 0 && costDelta >= 0.3) {
    recommendation = 'STRONGLY RECOMMEND: Better quality + 30%+ cost savings';
  } else if (qualityDelta >= -0.1 && costDelta >= 0.5) {
    recommendation = 'RECOMMEND: Similar quality + 50%+ cost savings';
  } else if (qualityDelta >= 0.2 && costDelta >= -0.2) {
    recommendation = 'CONSIDER: Significantly better quality for modest cost';
  } else if (qualityDelta < -0.2) {
    recommendation = 'NOT RECOMMENDED: Quality degradation too significant';
  } else {
    recommendation = 'NEUTRAL: No clear advantage';
  }
  
  return { qualityDelta, costDelta, speedDelta, recommendation };
};

/**
 * Generate test report
 */
export const generateTestReport = (
  results: TestResult[]
): {
  summary: string;
  recommendations: string[];
  costAnalysis: string;
  qualityAnalysis: string;
} => {
  const baseline = results.find(r => r.configName === 'baseline');
  if (!baseline) {
    throw new Error('Baseline results required for comparison');
  }
  
  const comparisons = results
    .filter(r => r.configName !== 'baseline')
    .map(r => ({
      config: r.configName,
      ...compareToBaseline(r, baseline)
    }));
  
  const bestQuality = comparisons.reduce((best, curr) =>
    curr.qualityDelta > best.qualityDelta ? curr : best
  );
  
  const bestCost = comparisons.reduce((best, curr) =>
    curr.costDelta > best.costDelta ? curr : best
  );
  
  const recommendations = comparisons
    .filter(c => c.recommendation.includes('RECOMMEND'))
    .map(c => `${c.config}: ${c.recommendation}`);
  
  return {
    summary: `Tested ${results.length} configurations. Best quality: ${bestQuality.config} (+${(bestQuality.qualityDelta * 100).toFixed(1)}%). Best cost: ${bestCost.config} (-${(bestCost.costDelta * 100).toFixed(1)}% cost).`,
    recommendations,
    costAnalysis: `Baseline: $${baseline.metrics.actualCost.toFixed(2)}. Range: $${Math.min(...results.map(r => r.metrics.actualCost)).toFixed(2)} - $${Math.max(...results.map(r => r.metrics.actualCost)).toFixed(2)}`,
    qualityAnalysis: `Baseline: ${baseline.metrics.letterOverall}/10. Range: ${Math.min(...results.map(r => r.metrics.letterOverall)).toFixed(1)} - ${Math.max(...results.map(r => r.metrics.letterOverall)).toFixed(1)}`
  };
};

// ============================================================================
// EXPERIMENT TRACKING
// ============================================================================

export interface Experiment {
  id: string;
  name: string;
  hypothesis: string;
  startDate: Date;
  endDate?: Date;
  configA: string;  // Baseline
  configB: string;  // Treatment
  sampleSize: number;
  results?: {
    aMetrics: QualityMetrics;
    bMetrics: QualityMetrics;
    statisticallySignificant: boolean;
    pValue: number;
    recommendation: string;
  };
}

export const ACTIVE_EXPERIMENTS: Experiment[] = [
  {
    id: 'exp-001',
    name: 'Haiku 4.5 for Document Extraction',
    hypothesis: 'Haiku 4.5 can match Sonnet 4.5 extraction quality at 12x lower cost',
    startDate: new Date('2025-11-10'),
    configA: 'baseline',
    configB: 'optimized',
    sampleSize: 20
  },
  {
    id: 'exp-002',
    name: 'GPT-4o vs Sonnet for Analysis',
    hypothesis: 'GPT-4o structured outputs provide better JSON consistency',
    startDate: new Date('2025-11-10'),
    configA: 'baseline',
    configB: 'gpt4oStrict',
    sampleSize: 50
  },
  {
    id: 'exp-003',
    name: 'Sonnet 4.5 for Letter Structure',
    hypothesis: 'Sonnet 4.5 can match Opus structure quality at 5x lower cost',
    startDate: new Date('2025-11-10'),
    configA: 'baseline',
    configB: 'optimized',
    sampleSize: 50
  }
];

