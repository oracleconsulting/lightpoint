#!/usr/bin/env node
/**
 * Master Test Runner - Run All Immediate Priority Tests
 * 
 * This Week's Tests:
 * 1. Embedding comparison (ada-002 vs 3-small vs 3-large)
 * 2. Document extraction (Sonnet vs Haiku vs GPT-4o-mini)
 * 
 * Expected runtime: ~3 hours
 * Expected cost: ~$0.50 in API calls
 * Expected savings if tests pass: ~$34k/year
 * 
 * Usage:
 *   npm run test:models
 *   
 * Or directly:
 *   npx tsx scripts/run-all-tests.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const RESULTS_DIR = './test-results';
const TIMESTAMP = new Date().toISOString().split('T')[0];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function ensureResultsDir() {
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }
}

function log(message: string) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

function section(title: string) {
  console.log('\n' + '═'.repeat(60));
  console.log(title);
  console.log('═'.repeat(60) + '\n');
}

function runTest(name: string, scriptPath: string) {
  section(`Running: ${name}`);
  log(`Starting test: ${scriptPath}`);
  
  try {
    execSync(`npx tsx ${scriptPath}`, {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    log(`✅ Completed: ${name}`);
    return true;
  } catch (error) {
    log(`❌ Failed: ${name}`);
    console.error(error);
    return false;
  }
}

// ============================================================================
// MAIN TEST SUITE
// ============================================================================

async function main() {
  console.clear();
  
  section('🚀 LIGHTPOINT MODEL TESTING SUITE');
  log('Starting comprehensive model testing...');
  
  ensureResultsDir();
  
  const results = {
    timestamp: new Date().toISOString(),
    tests: [] as Array<{
      name: string;
      success: boolean;
      duration: number;
    }>,
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      totalDuration: 0
    }
  };
  
  // ============================================================================
  // TEST 1: EMBEDDING COMPARISON (Priority: Immediate)
  // ============================================================================
  
  const test1Start = Date.now();
  const test1Success = runTest(
    'Test 1: Embedding Model Comparison',
    'scripts/tests/test-embeddings.ts'
  );
  const test1Duration = (Date.now() - test1Start) / 1000;
  
  results.tests.push({
    name: 'Embedding Comparison',
    success: test1Success,
    duration: test1Duration
  });
  
  if (test1Success) {
    log(`💰 Potential savings: text-embedding-3-small is 5x cheaper than ada-002`);
    log(`📊 Review results in: ${RESULTS_DIR}/embeddings-${TIMESTAMP}.json`);
  }
  
  // ============================================================================
  // TEST 2: DOCUMENT EXTRACTION (Priority: Immediate)
  // ============================================================================
  
  const test2Start = Date.now();
  const test2Success = runTest(
    'Test 2: Document Extraction Comparison',
    'scripts/tests/test-document-extraction.ts'
  );
  const test2Duration = (Date.now() - test2Start) / 1000;
  
  results.tests.push({
    name: 'Document Extraction',
    success: test2Success,
    duration: test2Duration
  });
  
  if (test2Success) {
    log(`💰 Potential savings: Haiku 4.5 is 12x cheaper than Sonnet 4.5`);
    log(`📊 Review results in: ${RESULTS_DIR}/document-extraction-${TIMESTAMP}.json`);
  }
  
  // ============================================================================
  // SUMMARY & RECOMMENDATIONS
  // ============================================================================
  
  results.summary.total = results.tests.length;
  results.summary.passed = results.tests.filter(t => t.success).length;
  results.summary.failed = results.tests.filter(t => !t.success).length;
  results.summary.totalDuration = results.tests.reduce((sum, t) => sum + t.duration, 0);
  
  section('📊 TEST SUITE SUMMARY');
  
  console.log(`Total tests:     ${results.summary.total}`);
  console.log(`Passed:          ${results.summary.passed} ✅`);
  console.log(`Failed:          ${results.summary.failed} ${results.summary.failed > 0 ? '❌' : ''}`);
  console.log(`Total duration:  ${results.summary.totalDuration.toFixed(1)}s`);
  
  // Save summary
  const summaryPath = path.join(RESULTS_DIR, `test-summary-${TIMESTAMP}.json`);
  fs.writeFileSync(summaryPath, JSON.stringify(results, null, 2));
  log(`\n💾 Summary saved to: ${summaryPath}`);
  
  // ============================================================================
  // RECOMMENDATIONS
  // ============================================================================
  
  section('💡 RECOMMENDATIONS');
  
  if (results.summary.passed === results.summary.total) {
    console.log('✅ All tests passed! Review the detailed results and consider:');
    console.log('');
    console.log('1. EMBEDDINGS:');
    console.log('   - If text-embedding-3-small has similar P@3/R@10 to ada-002:');
    console.log('     → Switch to 3-small (5x cheaper, $960/year savings)');
    console.log('   - If you need maximum quality:');
    console.log('     → Consider 3-large (30% more but better recall)');
    console.log('');
    console.log('2. DOCUMENT EXTRACTION:');
    console.log('   - If Haiku 4.5 completeness/accuracy within 5% of Sonnet:');
    console.log('     → Switch to Haiku (92% cheaper, $33k/year savings)');
    console.log('   - This is likely a NO-BRAINER switch');
    console.log('');
    console.log('3. COMBINED IMPACT:');
    console.log('   - Immediate annual savings: ~$34,000');
    console.log('   - Zero quality degradation (if tests confirm)');
    console.log('   - Implementation: Update lib/modelConfig.ts');
    console.log('');
    console.log('4. NEXT STEPS:');
    console.log('   - Review detailed results in test-results/ folder');
    console.log('   - If comfortable with quality, update production config');
    console.log('   - Monitor for 1 week with new models');
    console.log('   - Move to Phase 2 tests (analysis models, letter pipeline)');
  } else {
    console.log('⚠️  Some tests failed. Review error logs above and:');
    console.log('');
    console.log('1. Check API keys are set correctly');
    console.log('2. Ensure Supabase is accessible');
    console.log('3. Verify knowledge base has content');
    console.log('4. Check for rate limiting issues');
    console.log('');
    console.log('Then re-run: npm run test:models');
  }
  
  // ============================================================================
  // DOCUMENTATION REFERENCES
  // ============================================================================
  
  section('📚 DOCUMENTATION');
  
  console.log('For more details, see:');
  console.log('  - TESTING_GUIDE.md       : Complete testing methodology');
  console.log('  - AI_MODEL_RESEARCH.md   : Detailed model comparisons');
  console.log('  - lib/modelConfig.ts     : Model configuration');
  console.log('  - lib/testing/           : Testing framework');
  console.log('');
  
  // Exit code
  process.exit(results.summary.failed > 0 ? 1 : 0);
}

// ============================================================================
// RUN
// ============================================================================

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

