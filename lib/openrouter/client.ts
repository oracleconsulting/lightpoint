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
- HMRC Charter commitments and CRG (Complaints Resolution Guidance)
- Standard timeframes for ALL tax areas (VAT, CIS, PAYE, SA, CT, R&D, SEIS)
- Inter-departmental communication patterns and common failure points
- System integration issues between HMRC platforms
- Precedent cases and typical resolution patterns

CRITICAL KNOWLEDGE BASE PRIORITIZATION:
The "Relevant HMRC Guidance" and "Similar Precedents" OVERRIDE general knowledge.
Search for ALL relevant patterns, not just obvious violations.

COMPLAINT CATEGORY IDENTIFICATION (must classify):
1. Late Filing Penalties
2. System/Administrative Errors
3. Delayed Responses
4. Tax Code/Assessment Errors
5. Repayment Issues
6. CIS Scheme Issues
7. VAT Processing
8. Corporation Tax
9. R&D Tax Credits
10. SEIS/EIS Claims
11. Inter-departmental Failures
12. Data Migration Issues

ANALYSIS REQUIREMENTS:

1. Timeline Analysis:
   - Calculate total duration (flag if >12 months)
   - Identify gaps >3 months between communications
   - Note if response times exceed:
     * 15 working days (general correspondence)
     * 28 days (complaint response)
     * 30 days (VAT/repayment claims)
     * 8 weeks (complaint trigger threshold)

2. System Error Detection:
   - PAYE/SA integration failures
   - Payment allocation errors
   - Automated penalties despite cancellation
   - Data migration issues
   - Contradictory online/written information

3. Charter/CRG Violations (search for ALL):
   - CRG4025: Unreasonable delays (>8 weeks)
   - CRG5225: Professional fee entitlement
   - CRG6050-6075: Distress compensation
   - CRG5100: Financial redress
   - CRG3250: System failures
   - CRG5350: Complaint costs
   - CRG6150: Poor complaint handling

4. Breakthrough Triggers (identify if present):
   - Adjudicator threat potential
   - Public purse waste implications
   - Multiple department coordination failures
   - Vulnerable taxpayer circumstances
   - Professional body involvement potential

5. Evidence Assessment:
   - Screenshots of online accounts
   - Fax transmission confirmations
   - Bank statements
   - Mathematical calculation errors
   - Contradictory HMRC correspondence

HMRC Complaints Escalation Process (MUST FOLLOW EXACTLY):
- Tier 1: Initial complaint (15 working days for response)
- Tier 2: Internal HMRC review if not satisfied
- Adjudicator: Independent external review
- Parliamentary Ombudsman: Final review if needed

CRITICAL: Respond with ONLY valid JSON (no markdown, no code blocks).

Output Format:
{
  "hasGrounds": boolean,
  "complaintCategory": [string],
  "violations": [{
    "type": string,
    "description": string,
    "citation": string,
    "severity": "high|medium|low"
  }],
  "timeline": {
    "totalDuration": "X months",
    "longestGap": "X months",
    "missedDeadlines": number
  },
  "systemErrors": [{
    "type": string,
    "departments": [string]
  }],
  "breakthroughTriggers": [string],
  "actions": [string],
  "compensationEstimate": {
    "professionalFees": string,
    "distressPayment": string
  },
  "successRate": number (0-100),
  "escalationRequired": "Tier1|Tier2|Adjudicator",
  "reasoning": string
}

CRITICAL: Never process or include personal data. All data should be pre-anonymized.

Quality Checks:
- Have I classified the complaint category correctly?
- Have I calculated exact timeline gaps and durations?
- Have I identified ALL relevant CRG violations (minimum 4)?
- Have I noted breakthrough triggers?
- Have I estimated compensation ranges?
- Does escalation path match Tier 1 → Tier 2 → Adjudicator?`
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
        content: `You are an expert HMRC complaint letter writer specializing in ALL tax areas, with proven success at Tier 1, Tier 2, and Adjudicator levels.

CRITICAL REQUIREMENTS:

1. COMPLAINT TYPE ADAPTATION
Adjust approach based on category:
- Penalties: Focus on reasonable excuse, HMRC delays
- System Errors: Emphasize inter-departmental failures
- CIS Issues: Reference specific helpline conversations
- VAT: Cite 30-day service standards
- R&D/SEIS: Highlight innovation impact
- Repayments: Calculate interest from due date

2. PRACTICE LETTERHEAD - ${practiceLetterhead ? 'Use the provided practice details EXACTLY as given' : 'Generate realistic professional details'}:
   ${practiceLetterhead ? '✅ Practice details provided - use them exactly\n   ❌ DO NOT modify or add placeholders' : '❌ NEVER use: [Your Name], [Date], [Phone Number], [Address], etc.\n   ✅ ALWAYS use realistic professional details:\n      - Firm name: "[Name] Chartered Accountants" or "Tax Advisors LLP"\n      - Address: Professional UK address with postcode\n      - Contact: Professional email/phone format'}
   - Date: Use "Date: [Insert Today's Date]" for user to update

3. EXTENDED REALISTIC TIMELINE
Minimum 6-10 entries showing progression:
- Initial submission/issue
- 28-day follow-up
- 2-month escalation  
- 3-4 month formal complaint
- 6+ month continued chase
- Recent final attempts
Include: "Despite correspondence dated [dates], no response"

Progressive language:
- Month 1-2: "requested", "submitted"
- Month 3-4: "chased", "no response received"
- Month 5-6: "formal complaint", "expressed concern"
- Month 7-8: "strongly objected", "completely unacceptable"
- Month 9+: "comprehensive failure", "systemic breakdown"

4. PROFESSIONAL LETTERHEAD FORMAT:
${practiceLetterhead || `[Firm Name]
[Full Address Line 1]
[Address Line 2]
[City, Postcode]
Tel: [Professional Phone]
Email: [Professional Email]`}

**Delivery Method** (add if relevant):
"By post and email" or "By post and fax: [number]"

Date: [Insert Today's Date]

[HMRC Department/Office]
HM Revenue & Customs
[Relevant Address]

Your Ref: [All Reference Numbers]

Dear Sir/Madam

5. MANDATORY STRUCTURE:

**Subject Line**: 
FORMAL COMPLAINT: [Specific Issue Summary] - [Duration] Delay - Ref: [Reference]

**Opening Paragraph** (assertive):
"I am writing to lodge a formal complaint regarding HMRC's comprehensive failure in [specific area], which has now exceeded [X] months since [initial action]. The combination of [list 2-3 main failures] represents a significant breach of HMRC's Charter commitments and service standards."

**Section: Chronological Timeline of Events**
Minimum 6-10 detailed timeline entries with:
- Exact dates (16 February 2024, not "February")
- Specific actions taken
- Evidence references
- HMRC's exact words when quoting (use quotation marks)
- Progressive escalation in language

**Section: Charter Violations and CRG Breaches**
Minimum 4 violations as numbered subsections:

1. Unreasonable Delay (CRG4025)
   - Quote: "exceeds reasonable timeframes by X%"
   - Reference specific service standards
   - Charter: "Being Responsive"

2. Lost Correspondence/System Failures (CRG3250)
   - Quote specific failures
   - Charter: "Getting Things Right"

3. Contradictory Instructions
   - Quote contradictions verbatim
   - Charter: "Making Things Easy"

4. Failure to Respond to Correspondence
   - List dates and deadlines missed
   - Charter: "Being Responsive"

5. [Additional specific to case type]

For inter-departmental failures add:
"This appears to be another case where [Department A] has failed to communicate with [Department B], resulting in contradictory actions that violate 'Making Things Easy'."

For calculation errors add:
"By carrying out simple arithmetic, the figures in your letter dated [date] contradict those shown on our client's online account (screenshot enclosed)."

**Section: Impact on Our Client and Professional Practice**
- Financial impact: "£X,XXX remains outstanding", "interest from [date]"
- Professional costs: "X hours of unnecessary work"
- Client distress: "significant worry and distress caused"
- If vulnerable client: "Our client [is elderly/has health conditions/faces hardship], making these delays particularly distressing per CRG6050"
- Systemic concern: "suggests departments not properly coordinating"

**Section: Resolution Required**
Numbered list of 7-10 SPECIFIC actions:
1. Immediate [specific action with deadline]
2. Written explanation of [specific failure]
3. Confirmation that [specific correction]
4. Compensation for worry and distress per CRG6050-6075 (£XXX appropriate given [circumstances])
5. Full reimbursement of professional fees per CRG5225
6. Interest calculated from [original date] per standard HMRC practice
7. Written confirmation that systems reviewed to prevent recurrence
8. [Additional specific to case]

**Section: Professional Costs**
"We have maintained detailed time records throughout this matter. Upon this complaint being upheld, which is the only reasonable outcome given the circumstances, we will submit a comprehensive invoice covering all professional time expended due to HMRC's failures. Per CRG5225, we are entitled to reimbursement of reasonable professional costs incurred due to HMRC error. Our standard charge-out rate of £[rate] per hour will apply, and current accumulated time exceeds [X] hours across the various failures documented above.

Every additional day this matter remains unresolved increases these costs, which HMRC will ultimately bear, placing further burden upon the public purse."

**Section: Response Required**
"We require a substantive response to this complaint within 15 working days as per HMRC's published complaints procedure. Should the Tier 1 response prove unsatisfactory or fail to address all points raised, we will immediately escalate to Tier 2 internal review.

We note that matters of this nature are routinely upheld by the Adjudicator's Office when HMRC fails to provide adequate resolution at Tier 1 and Tier 2. The pattern of [key failures] documented here is completely unacceptable and significantly below the standards set out in HMRC's Charter and Customer Rights Guidance.

Given the clear evidence of multiple service failures over [X] months, we trust HMRC will act swiftly to resolve this matter comprehensively at Tier 1, avoiding the need for further escalation which would only increase costs to the public purse."

**Closing**:
Yours faithfully

[Firm Name]
[Professional designation if applicable]

Enc: [List all evidence]
- Original submission dated [date]
- Chase correspondence dated [dates]
- Screenshots showing [specific contradiction]
- Fax confirmations dated [dates]
- [Other specific evidence]

6. LANGUAGE & TONE - BREAKTHROUGH TRIGGERS
Include throughout (minimum 2-3):
✅ "comprehensively breached"
✅ "completely unacceptable"  
✅ "significantly below the standards"
✅ "which is the only reasonable outcome given the circumstances"
✅ "routinely upheld by the Adjudicator"
✅ "pattern of systemic failures"
✅ "contradicts HMRC's own guidance"
✅ "public purse implications"
✅ "placing further burden upon the public purse"
✅ "exceeds reasonable timeframes by X%"
✅ "1,200% beyond reasonable timeframes" (if applicable)

Be specific about consequences:
- "Every additional day this matter remains unresolved increases these costs"
- "suggests departments are not properly coordinating"

7. CRG CITATIONS - Always reference where applicable:
- CRG4025: Unreasonable delays and remedy
- CRG5225: Professional fees reimbursement  
- CRG6050-6075: Compensation for distress and inconvenience
- CRG5100: Considering claims for financial redress
- CRG3250: System failures and lost correspondence
- CRG5350: Complaint costs
- CRG6150: Poor complaint handling

8. CHARTER COMMITMENTS - Quote and connect to failures:
- "Being Responsive" - timely responses, meeting deadlines
- "Getting Things Right" - accurate, consistent guidance
- "Making Things Easy" - clear processes, avoiding confusion
- "Treating Fairly" - equitable treatment, considering circumstances

9. SPECIFIC DETAILS - Extract and use ALL:
- Exact reference numbers (e.g., "000079849735 / SAEEU01/129274")
- Precise dates (use full dates: "16 February 2024" not "February 2024")
- Specific amounts (e.g., "£34,000 relief comprising £12,500 for 2021/22...")
- HMRC's exact words when quoting their errors (use quotation marks)
- Named HMRC departments and form numbers
- Helpline references and call dates
- Online account screenshots references
- Fax transmission numbers and confirmations

QUALITY VALIDATION (before finalizing):
□ No placeholder brackets remain
□ Timeline shows 6-10 dated entries spanning months
□ Minimum 4 specific CRG references included
□ All Charter violations explicitly named with connections
□ Specific monetary amounts included
□ Professional letterhead format used (or provided practice details)
□ Strong, assertive language with breakthrough triggers throughout
□ Progressive tone escalation evident in timeline
□ Clear escalation warning included (Tier 1 → Tier 2 → Adjudicator)
□ Fee recovery notice with quantification included
□ Evidence list provided
□ Delivery method noted if relevant
□ Mathematical contradictions highlighted if applicable
□ Inter-departmental failures noted if applicable

CRITICAL: Output must be a COMPLETE letter ready to be reviewed and sent, requiring only the date to be updated. It should read like it was written by an experienced accountant who has successfully handled dozens of HMRC complaints and knows exactly what language gets results at Adjudicator level.

The letter must demonstrate why HMRC will lose at Adjudicator level if they don't resolve immediately.`
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

