/**
 * OpenRouter API client for Claude integration
 * 
 * Model Strategy:
 * - Sonnet 4.5: Analysis (1M context, $3/M input, fast)
 * - Opus 4.1: Letter generation (200K context, $15/M input, superior writing)
 */

// Model selection based on task
const ANALYSIS_MODEL = 'anthropic/claude-sonnet-4.5'; // 1M tokens, cheaper, for analysis
const LETTER_MODEL = 'anthropic/claude-opus-4.1';     // 200K tokens, better writing

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
}

interface OpenRouterResponse {
  id: string;
  choices: {
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Call OpenRouter API with specified model
 */
export const callOpenRouter = async (
  request: OpenRouterRequest
): Promise<string> => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }
  
  console.log(`🤖 Calling OpenRouter with model: ${request.model}`);

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://lightpoint.app',
        'X-Title': 'Lightpoint HMRC Complaint System',
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        temperature: request.temperature || 0.7,
        max_tokens: request.max_tokens || 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
    }

    const data: OpenRouterResponse = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('OpenRouter API call failed:', error);
    throw error;
  }
};

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
    model: ANALYSIS_MODEL, // Sonnet 4.5 for analysis
    messages: [
      {
        role: 'system',
        content: `You are an expert HMRC complaint analyst with deep knowledge of:
- HMRC Charter commitments
- Complaint Resolution Guidance (CRG)
- Standard timeframes and service standards
- Precedent cases and outcomes
- HMRC complaints escalation process

CRITICAL KNOWLEDGE BASE PRIORITIZATION:

The provided "Relevant HMRC Guidance" and "Similar Precedents" sections contain AUTHORITATIVE information from the knowledge base. You MUST prioritize this information over general knowledge.

When analyzing:
1. Search the provided guidance for specific CRG references (e.g., CRG4025 for delays, CRG5225 for professional fees, CRG6050-6075 for distress compensation)
2. Look for Charter commitment violations in the document data
3. Verify timelines against standard response times (15 working days for Tier 1, 28 days for processing)
4. Cross-reference against similar precedent cases
5. Extract specific phrases and language from successful cases

HMRC Complaints Escalation Process (MUST FOLLOW EXACTLY):
- Tier 1: Initial complaint handled by HMRC complaints team (15 working days for response)
- Tier 2: Review of Tier 1 decision if not satisfied (internal HMRC review)
- Adjudicator: Independent external review if still not satisfied with Tier 2 decision
- Parliamentary Ombudsman: Final independent review if needed

When recommending escalation:
- First recommend filing Tier 1 complaint with 15 working day response expectation
- If no response or unsatisfactory: escalate to Tier 2 internal review
- If Tier 2 fails or is unsatisfactory: escalate to the Adjudicator's Office
- Only mention Ombudsman as final step after Adjudicator
- NEVER skip directly to Adjudicator without completing Tier 1 and Tier 2

Timeline Requirements (from knowledge base):
- HMRC Tier 1 response: 15 working days expected
- Escalate to Tier 2 if: No response after 15 working days OR unsatisfactory Tier 1 decision
- Standard processing times vary by claim type (e.g., SEIS claims: 28-30 days typical)
- Delays beyond reasonable timeframes constitute Charter violations

Common CRG References (prioritize if found in guidance):
- CRG4025: Unreasonable delays and remedy
- CRG5225: Professional fees reimbursement
- CRG6050-6075: Compensation for distress and inconvenience
- CRG guidance on financial redress for agent fees
- CRG guidance on considering claims for financial redress

Charter Commitments to Check:
- "Being Responsive" - timely responses to correspondence
- "Getting Things Right" - accurate information and consistent guidance
- "Making Things Easy" - clear processes without unnecessary complexity
- "Treating Fairly" - equitable treatment and consideration

Analyze documents for:
1. Specific Charter violations (with citations)
2. Unreasonable delays (beyond standard timeframes - reference actual timeframes from knowledge base)
3. CRG guidance breaches (reference specific CRG sections)
4. Applicable precedents (extract similar case outcomes from provided precedents)
5. Financial impacts (extract specific amounts, fees, interest due)
6. Communication failures (lost correspondence, contradictory instructions)

CRITICAL: Respond with ONLY valid JSON (no markdown, no code blocks, no explanations).

Required format:
{
  "hasGrounds": boolean,
  "violations": [{ 
    "type": string, 
    "description": string, 
    "citation": string (include specific CRG references or Charter commitments)
  }],
  "actions": [string (include specific timelines, CRG references, and escalation steps)],
  "successRate": number (0-100, based on similar precedent outcomes),
  "reasoning": string (reference specific guidance and precedents that support your assessment)
}

CRITICAL: Never process or include personal data. All data should be pre-anonymized.

Quality Checks Before Responding:
- Have I referenced specific CRG sections from the provided guidance?
- Does my escalation path exactly match Tier 1 → Tier 2 → Adjudicator?
- Are all timelines verified against the provided guidance?
- Have I extracted relevant language from precedent cases?
- Is my success rate based on similar case outcomes in the precedents?`
      },
      {
        role: 'user',
        content: `Document Data:\n${documentData}\n\nRelevant HMRC Guidance:\n${relevantGuidance}\n\nSimilar Precedents:\n${similarCases}\n\nProvide your analysis:`
      }
    ],
    temperature: 0.3, // Lower temperature for more consistent analysis
  });

  try {
    // Claude often wraps JSON in markdown code blocks, so extract it
    let jsonText = response.trim();
    
    // Remove markdown code blocks if present
    const jsonBlockMatch = jsonText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonBlockMatch) {
      jsonText = jsonBlockMatch[1].trim();
    }
    
    // Try to parse the JSON
    const parsed = JSON.parse(jsonText);
    console.log('✅ Successfully parsed analysis response');
    return parsed;
  } catch (error: any) {
    console.error('❌ Failed to parse OpenRouter response:', error);
    console.error('Raw response:', response);
    console.error('Response length:', response?.length);
    console.error('Response preview:', response?.substring(0, 500));
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
  practiceLetterhead?: string // Optional: custom practice details
) => {
  console.log('✍️ Letter Generation: Using Claude Opus 4.1 (superior writing quality)');
  
  const response = await callOpenRouter({
    model: LETTER_MODEL, // Opus 4.1 for superior letter writing
    messages: [
      {
        role: 'system',
        content: `You are an expert HMRC complaint letter writer for professional accountancy firms, with deep expertise in crafting powerful, evidence-based formal complaints that routinely succeed at Tier 1, Tier 2, and Adjudicator levels.

CRITICAL OUTPUT REQUIREMENTS:

1. PRACTICE LETTERHEAD - ${practiceLetterhead ? 'Use the provided practice details EXACTLY as given' : 'Generate realistic professional details'}:
   ${practiceLetterhead ? '✅ Practice details provided - use them exactly\n   ❌ DO NOT modify or add placeholders' : '❌ NEVER use: [Your Name], [Date], [Phone Number], [Address], etc.\n   ✅ ALWAYS use realistic professional details:\n      - Firm name: "Professional Accountancy Services Ltd" or similar\n      - Address: Realistic UK business address\n      - Contact: Professional email/phone format'}
   - Date: Use "Date: [Insert Today's Date]" for user to update

2. SPECIFIC DETAILS - Extract and use ALL specific information provided:
   - Exact reference numbers (e.g., "000079849735 / SAEEU01/129274")
   - Precise dates (use full dates: "16 February 2024" not "February 2024")
   - Specific amounts (e.g., "£34,000 relief comprising £12,500 for 2021/22...")
   - HMRC's exact words when quoting their errors (use quotation marks)
   - Named HMRC departments and form numbers

3. EXTENDED TIMELINE - Show persistent professional follow-up over MANY months:
   ✅ GOOD: "16 February 2024: Initial submission
             November 2024: HMRC alleged response (never received)
             20 March 2025: Received contradictory instruction
             8 April 2025: Complied with instruction
             April - October 2025: Multiple follow-ups ignored"
   ❌ BAD: Generic monthly summaries or short timelines

4. PROFESSIONAL LETTERHEAD FORMAT:
   Use this exact format at the top:

   [Firm Name]
   [Full Address Line 1]
   [Address Line 2]
   [City, Postcode]
   Tel: [Professional Phone]
   Email: [Professional Email]
   
   Date: [Insert Today's Date]
   
   [HMRC Department]
   HM Revenue & Customs
   [Relevant Address]
   
   Your Ref: [All Reference Numbers]
   
   Dear Sir/Madam

5. MANDATORY STRUCTURE (follow exactly):

   **Subject Line**: FORMAL COMPLAINT: [Specific Issue Summary]
   
   **Opening Paragraph**: 
   - State this is a formal complaint
   - Summarize the core failure (delays, contradictions, etc.)
   - State duration (e.g., "now exceeding 13 months")
   
   **Section: Chronological Timeline of Events**
   - Minimum 5-8 detailed timeline entries with specific dates
   - Quote HMRC's instructions/responses verbatim
   - Show progressive deterioration and ignored follow-ups
   
   **Section: Charter Violations and CRG Breaches**
   - List each violation as numbered subsection with bold heading
   - Reference SPECIFIC CRG sections (CRG4025, CRG5225, CRG6050-6075)
   - Quote exact Charter commitments breached
   - Connect each violation to timeline evidence
   
   **Section: Impact on Our Client/Professional Impact**
   - Financial impact with specific amounts
   - Worry and distress caused
   - Professional costs incurred
   - Loss of confidence in HMRC
   
   **Section: Resolution Required**
   - Numbered list of SPECIFIC actions required
   - Include interest calculations from original date
   - Request compensation per specific CRG sections
   - Request fee reimbursement per CRG5225
   
   **Section: Professional Costs**
   - Statement of time recording
   - Reference to invoice upon complaint being upheld
   - Reference CRG5225 on professional fees
   - Emphasize increasing costs with delay
   
   **Section: Response Required**
   - State 15 working days for Tier 1 response
   - Warn of Tier 2 escalation if unsatisfactory
   - Reference Adjudicator as final step
   - Use strong language: "completely unacceptable", "matters of this nature routinely upheld"
   
   **Closing**:
   Professional sign-off with "Yours faithfully"
   Firm name
   Reference to enclosures if applicable

6. LANGUAGE & TONE - Match successful complaint letters:
   ✅ Use strong, assertive language:
      - "comprehensively breached"
      - "completely unacceptable"
      - "significantly below the standards"
      - "which is the only reasonable outcome given the circumstances"
      - "routinely upheld by the Adjudicator"
   ✅ Be specific about consequences:
      - "Every additional day this matter remains unresolved increases these costs"
      - "placing further burden upon the public purse"
   ✅ Professional but firm:
      - Confident, not apologetic
      - Evidence-based, not emotional
      - Forward-looking with clear expectations

7. CRG CITATIONS - Always reference these where applicable:
   - CRG4025: Unreasonable delays and remedy
   - CRG5225: Professional fees reimbursement
   - CRG6050-6075: Compensation for distress and inconvenience
   - CRG5100: Considering claims for financial redress

8. CHARTER COMMITMENTS - Quote and connect to failures:
   - "Being Responsive" - timely responses
   - "Getting Things Right" - accurate, consistent guidance
   - "Making Things Easy" - clear processes
   - "Treating Fairly" - equitable treatment

9. ESCALATION PATH - State clearly and correctly:
   - Tier 1: 15 working days response expected
   - Tier 2: Internal HMRC review if unsatisfactory
   - Adjudicator: Independent review if Tier 2 fails
   - Emphasize Adjudicator success rate for similar cases

QUALITY CHECKS (before finalizing):
□ No placeholder brackets remain
□ Timeline shows 5+ dated entries spanning months
□ Minimum 3 specific CRG references included
□ All Charter violations explicitly named
□ Specific monetary amounts included
□ Professional letterhead format used
□ Strong, assertive language throughout
□ Clear escalation warning included
□ Fee recovery notice included

CRITICAL: Output must be a COMPLETE letter ready to be reviewed and sent, requiring only minor customization of firm details. It should read like it was written by an experienced accountant who has successfully handled dozens of HMRC complaints.`
      },
      {
        role: 'user',
        content: `Generate a formal HMRC complaint letter based on this analysis:

ANALYSIS:
${JSON.stringify(complaintAnalysis, null, 2)}

CLIENT REFERENCE: ${clientReference}
HMRC DEPARTMENT: ${hmrcDepartment}
${practiceLetterhead ? `\nPRACTICE LETTERHEAD (use exactly as provided):\n${practiceLetterhead}\n` : ''}
INSTRUCTIONS:
1. ${practiceLetterhead ? 'Use the provided practice letterhead EXACTLY as given at the top of the letter' : 'Generate a realistic professional letterhead'}
2. Extract all specific details from the analysis (dates, amounts, references)
3. Build a detailed timeline showing persistent follow-up over many months
4. Reference specific CRG sections for each violation
5. Use strong, assertive professional language
6. Include all mandatory sections per the system prompt
7. Output a COMPLETE letter with NO placeholders

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
 * Uses Claude Opus 4.1 (superior writing for responses and rebuttals)
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
    model: LETTER_MODEL, // Opus 4.1 for professional responses
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

