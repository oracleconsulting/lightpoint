import { callOpenRouter } from './base';

const ANALYSIS_MODEL = 'anthropic/claude-sonnet-4.5'; // 1M tokens, cheaper, for analysis
const LETTER_MODEL = 'anthropic/claude-opus-4.1';     // 200K tokens, better writing

/**
 * Analyze HMRC complaint for violations
 * Uses Claude Sonnet 4.5 (1M context - can handle full documents)
 */
export const analyzeComplaint = async (
  documentData: string,
  relevantGuidance: string,
  similarCases: string
) => {
  console.log('🔍 Analysis: Using Claude Sonnet 4.5 (1M context window)');
  
  const response = await callOpenRouter({
    model: ANALYSIS_MODEL,
    messages: [
      {
        role: 'system',
        content: `You are an expert HMRC complaint analyst. Analyze this complaint for Charter violations, CRG breaches, and success probability.

Focus on:
- Timeline analysis (gaps, missed deadlines, duration vs standards)
- Charter commitments breached
- Specific CRG violations (4025, 5225, 6050-6075, 3250, 5350, 6150)
- System errors and inter-departmental failures
- Evidence quality and breakthrough triggers
- Realistic compensation estimates

Return ONLY valid JSON with no markdown:
{
  "hasGrounds": boolean,
  "complaintCategory": [string],
  "violations": [{"type": string, "description": string, "citation": string, "severity": string}],
  "timeline": {"totalDuration": string, "longestGap": string, "missedDeadlines": number},
  "systemErrors": [{"type": string, "departments": [string]}],
  "breakthroughTriggers": [string],
  "actions": [string],
  "compensationEstimate": {"professionalFees": string, "distressPayment": string},
  "successRate": number,
  "escalationRequired": string,
  "reasoning": string
}`
      },
      {
        role: 'user',
        content: `Document Data:\n${documentData}\n\nRelevant HMRC Guidance:\n${relevantGuidance}\n\nSimilar Precedents:\n${similarCases}\n\nProvide your analysis:`
      }
    ],
    temperature: 0.3,
  });

  try {
    let jsonText = response.trim();
    const jsonBlockMatch = jsonText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonBlockMatch) {
      jsonText = jsonBlockMatch[1].trim();
    }
    return JSON.parse(jsonText);
  } catch (error: any) {
    console.error('❌ Failed to parse analysis:', error);
    throw new Error(`Invalid analysis response format: ${error.message}`);
  }
};

/**
 * Generate formal complaint letter
 * Uses Claude Opus 4.1 (superior language and persuasive writing)
 */
export const generateComplaintLetter = async (
  complaintAnalysis: any,
  clientReference: string,
  hmrcDepartment: string,
  practiceLetterhead?: string,
  chargeOutRate?: number
) => {
  console.log('✍️ Letter Generation: Using Claude Opus 4.1 (superior writing quality)');
  
  const response = await callOpenRouter({
    model: LETTER_MODEL,
    messages: [
      {
        role: 'system',
        content: `You are a senior partner at a professional accountancy firm who has written dozens of successful HMRC complaints. You understand what works at Adjudicator level.

AUTHENTICITY PRINCIPLES:

1. Work with what you're given
   - Use exact dates, amounts, and references from the analysis
   - Don't invent specifics that weren't provided
   - If timeline dates are in the future, set your letter date appropriately after them
   - Never create timeline impossibilities

2. Write naturally, not by checklist
   - Let the situation drive the structure
   - Use breakthrough language when it fits naturally ("routinely upheld by Adjudicator", "public purse", "only reasonable outcome")
   - Calculate percentages when you have the numbers (e.g., 14 months vs 30 days = 1,400%)
   - Build frustration naturally through the timeline

3. Professional standards
   ${practiceLetterhead ? 
     '- Use the provided practice letterhead exactly as given' : 
     '- Generate realistic UK accountancy firm details'}
   ${chargeOutRate ? 
     `- Use exactly £${chargeOutRate}/hour as the charge-out rate (from practice settings)` :
     '- Use realistic London charge-out rate (£150-250/hour typical)'}
   - Timeline should show persistence - detail key events, not every email
   - Cite CRG sections where relevant (4025, 5225, 6050-6075, 3250)
   - Quantify the impact: time spent, costs accumulating, client distress

4. What makes letters succeed
   - Specificity: Exact dates, references, quotes from HMRC
   - Evidence: Screenshots, fax confirmations, phone records
   - Persistence: Timeline showing months of ignored chase attempts
   - Impact: Financial amounts, hours wasted, client distress
   - Pattern: Systemic failure across multiple touchpoints
   - Escalation awareness: Make clear this goes to Adjudicator if not resolved

5. Structure (adapt to situation):
   - Professional letterhead with date (after all timeline events)
   - Strong subject line with duration and reference
   - Opening: State the comprehensive failure
   - Timeline: Key dated events showing the pattern
   - Charter/CRG violations: Connect each to timeline evidence
   - Impact: Financial, professional time, client distress, public purse
   - Resolution: Specific numbered demands
   - Professional costs: Accumulated hours and increasing burden
   - Response deadline: 15 days, warn of Tier 2 then Adjudicator
   - Close professionally with evidence list

6. Reality checks:
   - Do all dates make sense from the letter date working backwards?
   - Are amounts from the input or clearly generic?
   - Would a real senior accountant sign this?
   - Does frustration build naturally through the timeline?
   - Are phrases used naturally, not robotically?
   - Is the tone professional but unmistakably serious?

Write as if you're the accountant who has personally dealt with this frustration for months and knows exactly what language gets results.`
      },
      {
        role: 'user',
        content: `Generate a formal HMRC complaint letter based on this analysis:

ANALYSIS:
${JSON.stringify(complaintAnalysis, null, 2)}

CLIENT REFERENCE: ${clientReference}
HMRC DEPARTMENT: ${hmrcDepartment}
${practiceLetterhead ? `\nPRACTICE LETTERHEAD (use exactly as provided):\n${practiceLetterhead}\n` : ''}
${chargeOutRate ? `\nCHARGE-OUT RATE: £${chargeOutRate}/hour (use this exact rate)\n` : ''}

Generate the complete formal complaint letter now:`
      }
    ],
    temperature: 0.7,
    max_tokens: 4000,
  });

  return response;
};

/**
 * Generate response to HMRC correspondence
 */
export const generateResponse = async (
  complaintContext: any,
  hmrcCorrespondence: string,
  responseType: 'acknowledgement' | 'rebuttal' | 'escalation'
) => {
  const systemPrompts = {
    acknowledgement: 'Generate a professional acknowledgement of HMRC\'s response, noting any commitments made and setting expectations for next steps.',
    rebuttal: 'Generate a professional rebuttal addressing inadequate responses, referencing original violations and requesting proper resolution.',
    escalation: 'Generate a formal escalation letter to the Adjudicator, summarizing the complaint journey and HMRC\'s inadequate response.'
  };
  
  console.log(`✍️ Response Generation (${responseType}): Using Claude Opus 4.1`);

  const response = await callOpenRouter({
    model: LETTER_MODEL,
    messages: [
      {
        role: 'system',
        content: systemPrompts[responseType]
      },
      {
        role: 'user',
        content: `Complaint Context: ${JSON.stringify(complaintContext)}\n\nHMRC Correspondence: ${hmrcCorrespondence}\n\nGenerate appropriate response:`
      }
    ],
  });

  return response;
};

