/**
 * AI-Powered Knowledge Base Comparison Engine
 * 
 * Analyzes new documents against existing knowledge base to detect:
 * - Duplicates (high similarity)
 * - Overlaps (partial similarity)
 * - New information (gaps filled)
 * - Conflicts (contradictory information)
 * - Recommendations (add, merge, skip, update)
 */

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const COMPARISON_MODEL = 'anthropic/claude-sonnet-4.5'; // 1M context for comprehensive comparison

interface KnowledgeEntry {
  id: string;
  title: string;
  category: string;
  content: string;
  similarity?: number;
}

interface ComparisonResult {
  duplicates: Array<{
    kb_id: string;
    title: string;
    similarity: number;
    recommendation: 'skip' | 'replace' | 'merge';
    reason: string;
  }>;
  overlaps: Array<{
    kb_id: string;
    title: string;
    similarity: number;
    overlap_percentage: number;
    overlap_sections: string[];
    recommendation: 'merge' | 'add_separately' | 'update_existing';
    reason: string;
  }>;
  new_information: Array<{
    category: string;
    topic: string;
    content: string;
    confidence: number;
    importance: 'high' | 'medium' | 'low';
  }>;
  gaps_filled: Array<{
    existing_kb_id: string;
    gap_description: string;
    fills_gap: boolean;
    impact: 'high' | 'medium' | 'low';
  }>;
  conflicts: Array<{
    kb_id: string;
    conflict_type: string;
    description: string;
    severity: 'high' | 'medium' | 'low';
    resolution_needed: boolean;
  }>;
  recommendations: {
    action: 'add' | 'merge' | 'replace' | 'skip' | 'review_required';
    confidence: number;
    reason: string;
    suggested_category?: string;
    suggested_title?: string;
    merge_targets?: string[]; // KB IDs to merge with
  };
}

/**
 * Compare a new document against existing knowledge base
 */
export async function compareDocumentToKnowledgeBase(
  documentText: string,
  documentChunks: string[],
  potentialDuplicates: KnowledgeEntry[]
): Promise<ComparisonResult> {
  console.log('🔍 Starting AI-powered knowledge base comparison');
  console.log(`📄 Document length: ${documentText.length} chars`);
  console.log(`🔢 Found ${potentialDuplicates.length} potential duplicates`);

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not configured');
  }

  // Prepare context for AI comparison
  const duplicatesContext = potentialDuplicates.map(dup => {
    const content = dup.content || '';
    const contentPreview = content.length > 0 ? content.substring(0, 500) : '[No content available]';
    
    return `
[Existing Entry: ${dup.title || 'Untitled'}]
Category: ${dup.category || 'Uncategorized'}
Similarity: ${((dup.similarity || 0) * 100).toFixed(1)}%
Content Preview: ${contentPreview}...
`;
  }).join('\n\n');

  const prompt = `You are an expert knowledge base curator analyzing whether a new document should be added to an HMRC complaints guidance knowledge base.

NEW DOCUMENT TO ANALYZE:
${documentText.substring(0, 10000)} ${documentText.length > 10000 ? '...[truncated]' : ''}

POTENTIALLY SIMILAR EXISTING DOCUMENTS:
${duplicatesContext || 'No similar documents found.'}

YOUR TASK:
Perform a comprehensive analysis to determine:

1. **DUPLICATES**: Is this document a duplicate or near-duplicate of existing entries?
   - Similarity > 90%: Exact or near-duplicate
   - Recommendation: skip, replace, or merge

2. **OVERLAPS**: Does this document partially overlap with existing entries?
   - Similarity 60-90%: Significant overlap
   - Identify which sections overlap
   - Recommendation: merge, add separately, or update existing

3. **NEW INFORMATION**: What genuinely new information does this document provide?
   - Topics not covered in existing KB
   - Updated guidance, new case studies, recent changes
   - Assess importance: high/medium/low

4. **GAPS FILLED**: Does this document fill gaps in existing entries?
   - Missing sections in existing docs
   - More recent information
   - Better explanations

5. **CONFLICTS**: Are there contradictions with existing knowledge?
   - Different dates, amounts, procedures
   - Superseded guidance
   - Conflicting interpretations

6. **FINAL RECOMMENDATION**: What should we do with this document?
   - add: Valuable new content, add to KB
   - merge: Combine with existing entries
   - replace: Supersedes outdated content
   - skip: Duplicate with no new value
   - review_required: Manual review needed

Return your analysis as JSON with this EXACT structure:

\`\`\`json
{
  "duplicates": [
    {
      "kb_id": "uuid",
      "title": "Document title",
      "similarity": 0.95,
      "recommendation": "skip",
      "reason": "Exact duplicate of existing guidance document"
    }
  ],
  "overlaps": [
    {
      "kb_id": "uuid",
      "title": "Document title",
      "similarity": 0.75,
      "overlap_percentage": 40,
      "overlap_sections": ["CRG4025", "Delay procedures"],
      "recommendation": "merge",
      "reason": "Significant overlap but contains updated 2024 timelines"
    }
  ],
  "new_information": [
    {
      "category": "CRG",
      "topic": "2024 Delay Standards Update",
      "content": "New 15-day response standard for high-value cases",
      "confidence": 0.90,
      "importance": "high"
    }
  ],
  "gaps_filled": [
    {
      "existing_kb_id": "uuid",
      "gap_description": "Missing examples of interest calculations",
      "fills_gap": true,
      "impact": "medium"
    }
  ],
  "conflicts": [
    {
      "kb_id": "uuid",
      "conflict_type": "outdated_timeline",
      "description": "Existing doc states 30 days, new doc shows 15 days for high-value",
      "severity": "high",
      "resolution_needed": true
    }
  ],
  "recommendations": {
    "action": "merge",
    "confidence": 0.85,
    "reason": "Document contains valuable 2024 updates that should be merged with existing CRG4025 guidance",
    "suggested_category": "CRG",
    "suggested_title": "CRG4025 - Unreasonable Delay (Updated 2024)",
    "merge_targets": ["uuid1", "uuid2"]
  }
}
\`\`\`

Be thorough, accurate, and conservative. When in doubt, recommend "review_required".`;

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://lightpoint.app',
        'X-Title': 'Lightpoint Knowledge Base Comparison',
      },
      body: JSON.stringify({
        model: COMPARISON_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are an expert knowledge base curator. Return ONLY valid JSON, no markdown formatting, no explanations outside the JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3, // Lower temperature for more consistent, analytical output
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    // Extract JSON from response (handle markdown code blocks)
    let jsonContent = content;
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1];
    }

    const comparisonResult: ComparisonResult = JSON.parse(jsonContent);

    console.log('✅ Comparison complete:');
    console.log(`   - ${comparisonResult.duplicates.length} duplicates found`);
    console.log(`   - ${comparisonResult.overlaps.length} overlaps detected`);
    console.log(`   - ${comparisonResult.new_information.length} new information items`);
    console.log(`   - ${comparisonResult.gaps_filled.length} gaps filled`);
    console.log(`   - ${comparisonResult.conflicts.length} conflicts detected`);
    console.log(`   - Recommendation: ${comparisonResult.recommendations.action} (${(comparisonResult.recommendations.confidence * 100).toFixed(0)}% confidence)`);

    return comparisonResult;
  } catch (error: any) {
    console.error('❌ Knowledge comparison failed:', error);
    
    // Return a safe default if AI comparison fails
    return {
      duplicates: [],
      overlaps: potentialDuplicates.map(dup => ({
        kb_id: dup.id,
        title: dup.title,
        similarity: dup.similarity || 0,
        overlap_percentage: Math.round((dup.similarity || 0) * 100),
        overlap_sections: [],
        recommendation: 'add_separately',
        reason: 'AI comparison unavailable, manual review recommended',
      })),
      new_information: [{
        category: 'unknown',
        topic: 'Uploaded document',
        content: documentText.substring(0, 200),
        confidence: 0.5,
        importance: 'medium',
      }],
      gaps_filled: [],
      conflicts: [],
      recommendations: {
        action: 'review_required',
        confidence: 0.5,
        reason: 'AI comparison failed, manual review required before adding to knowledge base',
      },
    };
  }
}

/**
 * Generate a human-readable comparison summary for UI display
 */
export function generateComparisonSummary(comparison: ComparisonResult): string {
  const lines: string[] = [];

  lines.push('# Knowledge Base Comparison Report\n');

  // Overall recommendation
  lines.push(`## Overall Recommendation: ${comparison.recommendations.action.toUpperCase()}`);
  lines.push(`Confidence: ${(comparison.recommendations.confidence * 100).toFixed(0)}%`);
  lines.push(`Reason: ${comparison.recommendations.reason}\n`);

  // Duplicates
  if (comparison.duplicates.length > 0) {
    lines.push('## ⚠️ Duplicates Detected');
    comparison.duplicates.forEach(dup => {
      lines.push(`- **${dup.title}** (${(dup.similarity * 100).toFixed(1)}% similar)`);
      lines.push(`  → ${dup.recommendation}: ${dup.reason}`);
    });
    lines.push('');
  }

  // Overlaps
  if (comparison.overlaps.length > 0) {
    lines.push('## 🔄 Overlaps Found');
    comparison.overlaps.forEach(overlap => {
      lines.push(`- **${overlap.title}** (${overlap.overlap_percentage}% overlap)`);
      lines.push(`  Sections: ${overlap.overlap_sections.join(', ')}`);
      lines.push(`  → ${overlap.recommendation}: ${overlap.reason}`);
    });
    lines.push('');
  }

  // New information
  if (comparison.new_information.length > 0) {
    lines.push('## ✨ New Information');
    comparison.new_information.forEach(info => {
      lines.push(`- **[${info.importance.toUpperCase()}] ${info.topic}** (${info.category})`);
      lines.push(`  ${info.content}`);
      lines.push(`  Confidence: ${(info.confidence * 100).toFixed(0)}%`);
    });
    lines.push('');
  }

  // Gaps filled
  if (comparison.gaps_filled.length > 0) {
    lines.push('## 🎯 Gaps Filled');
    comparison.gaps_filled.forEach(gap => {
      lines.push(`- **[${gap.impact.toUpperCase()}] ${gap.gap_description}**`);
      lines.push(`  Fills gap: ${gap.fills_gap ? 'Yes' : 'No'}`);
    });
    lines.push('');
  }

  // Conflicts
  if (comparison.conflicts.length > 0) {
    lines.push('## ⚠️ Conflicts Detected');
    comparison.conflicts.forEach(conflict => {
      lines.push(`- **[${conflict.severity.toUpperCase()}] ${conflict.conflict_type}**`);
      lines.push(`  ${conflict.description}`);
      lines.push(`  Resolution needed: ${conflict.resolution_needed ? 'Yes' : 'No'}`);
    });
    lines.push('');
  }

  return lines.join('\n');
}

