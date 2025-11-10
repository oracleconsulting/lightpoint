/**
 * Three-Stage Letter Generation Pipeline
 * 
 * Stage 1: Sonnet 4.5 - Deep Analysis (1M context)
 *   → Extract all facts, dates, amounts, violations
 *   → No tone, just data extraction
 * 
 * Stage 2: Opus 4.1 - Structure (200K context)
 *   → Organize facts into proper letter structure
 *   → Objective, factual presentation
 * 
 * Stage 3: Opus 4.1 - Professional Fury (200K context)
 *   → Add authentic professional tone
 *   → Memorable phrases, power language
 */

const ANALYSIS_MODEL = 'anthropic/claude-sonnet-4.5';
const STRUCTURE_MODEL = 'anthropic/claude-opus-4.1';
const TONE_MODEL = 'anthropic/claude-opus-4.1';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

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

/**
 * Call OpenRouter API
 */
const callOpenRouter = async (request: OpenRouterRequest): Promise<string> => {
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

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('OpenRouter API call failed:', error);
    throw error;
  }
};

/**
 * STAGE 1: Deep Analysis with Claude Haiku 4.5
 * Extract all facts without any tone or structure
 * INCLUDES extraction of precedent examples for reference
 * 
 * Model: Haiku 4.5 - 200K context, $0.25/M in, fast, excellent extraction
 */
export const stage1_extractFacts = async (
  complaintAnalysis: any,
  clientReference: string,
  hmrcDepartment: string
): Promise<string> => {
  console.log('📊 STAGE 1: Extracting facts with Haiku 4.5 (fast extraction, 200K ctx)');
  
  const response = await callOpenRouter({
    model: ANALYSIS_MODEL,
    messages: [
      {
        role: 'system',
        content: `You are a data extraction specialist. Your job is to extract ALL relevant facts from the complaint analysis.

DO NOT add tone, style, or persuasive language. Just extract:

1. Timeline facts (exact dates, durations, gaps)
2. Financial facts (amounts, hours, rates, calculations)
3. Violation facts (specific CRG/Charter breaches with citations)
4. Communication facts (what was sent, when, by whom, method)
5. System failure facts (contradictions, lost correspondence, departmental issues)
6. Impact facts (client distress, wasted time, mounting costs)
7. **PRECEDENT EXAMPLES** (successful complaint letters showing structure and tone)

CRITICAL: If the analysis includes precedents or similar cases, extract:
- Key phrases used in successful complaints
- Structure patterns (how timeline was presented, how violations were numbered)
- Tone examples (level of firmness, memorable phrases)
- Compensation amounts awarded in similar cases

Format as a structured fact sheet with clear sections.
Use bullet points for clarity.
Include ALL specific details - dates, amounts, counts, percentages.`
      },
      {
        role: 'user',
        content: `Extract all facts from this complaint analysis:

ANALYSIS:
${JSON.stringify(complaintAnalysis, null, 2)}

CLIENT REFERENCE: ${clientReference}
HMRC DEPARTMENT: ${hmrcDepartment}

Extract a complete fact sheet now (include any precedent examples found):`
      }
    ],
    temperature: 0.2, // Low temperature for factual extraction
    max_tokens: 3000,
  });

  return response;
};

/**
 * STAGE 2: Structure with Claude Sonnet 4.5
 * Organize facts into proper HMRC complaint letter structure
 * USES precedent structure patterns if available
 * 
 * Model: Sonnet 4.5 - Clean legal structure, 200K context, excellent reasoning
 * 
 * GOLD STANDARD: Professional headings, organizational voice, clear structure
 */
export const stage2_structureLetter = async (
  factSheet: string,
  practiceLetterhead?: string,
  chargeOutRate?: number
): Promise<string> => {
  console.log('🏗️ STAGE 2: Structuring letter with Sonnet 4.5 (professional structure)');
  
  const response = await callOpenRouter({
    model: STRUCTURE_MODEL,
    messages: [
      {
        role: 'system',
        content: `You are organizing facts into a formal HMRC complaint letter structure following UK professional standards.

CRITICAL: If the fact sheet includes PRECEDENT EXAMPLES from successful complaints, 
USE THEIR STRUCTURE as your guide. Copy the way they:
- Organize timeline entries
- Number Charter violations
- Break down professional costs
- List enclosures

Use this EXACT GOLD STANDARD structure:

**1. LETTERHEAD**
${practiceLetterhead || '[Firm Name]\n[Address]\n[Contact details]'}
[Date - use today's date or date after all timeline events]

HMRC Complaints Team
HM Revenue & Customs
BX9 1AA

**2. REFERENCE LINE**
Your Ref: [Tax matter type] - Client Reference: [CLIENT REF]

**3. SALUTATION**
Dear Sir/Madam

**4. SUBJECT LINE (Bold)**
**FORMAL COMPLAINT: [Brief Description] - [Duration] Delay, [Key Issues]**

**5. OPENING PARAGRAPH**
We are writing to lodge a formal complaint regarding [core issue].
[2-3 factual sentences explaining the problem]

**6. CHRONOLOGICAL TIMELINE OF EVENTS** ← Section heading MUST be bold

**[Full Date e.g., 16 February 2024]:** [Factual description of event]. [Additional context if needed].

**[Full Date]:** [Factual description of event]. [Additional context if needed].

[Continue chronologically - be specific with dates when known, each date MUST be bold with **double asterisks**]

**7. CHARTER VIOLATIONS AND CRG BREACHES** ← Section heading MUST be bold

This handling represents a breach of multiple HMRC Charter commitments and Complaints Resolution Guidance standards:

**1. [CRG Reference e.g., CRG4025] - [Violation Name e.g., Unreasonable Delay]** ← Violation header MUST be bold

[Factual explanation of how HMRC breached this standard. Include specific timelines, percentages, or comparisons. State why this matters. Add 2-3 sentences for fullness - explain the breach, quantify the excess, and state the impact.]

**2. [CRG Reference] - [Violation Name]** ← MUST be bold

[Factual explanation with 2-3 sentences...]

[Continue numbering for all violations - typically 3-7. CRG reference FIRST, then violation name. Each violation header MUST be bold.]

**8. IMPACT ON OUR CLIENT AND PROFESSIONAL PRACTICE** ← Section heading MUST be bold

The financial impact extends beyond the £[X] [relief/refund] our client cannot access:

**Client financial impact:** [Brief description of cash flow, lost opportunity, etc.]

**Client distress:** [Brief factual description of impact]

**Public purse impact:** [Brief description of wasted HMRC resources]

**9. PROFESSIONAL COSTS** ← Section heading MUST be bold

Per CRG5225, our client is entitled to reimbursement of professional fees directly attributable to HMRC's errors. Our standard charge-out rate is £${chargeOutRate || 185} per hour. The time spent addressing these failures includes [brief description of tasks]. A detailed invoice will be submitted once this complaint is upheld.

**10. RESOLUTION REQUIRED** ← Section heading MUST be bold

We require the following specific actions:

1. [Specific action required]
2. [Specific action required]
3. [Continue numbered list - typically 5-7 items]

**11. RESPONSE DEADLINE** ← Section heading MUST be bold

We require a substantive response to this complaint within 15 working days of receipt. Failure to provide an adequate response will result in immediate escalation to Tier 2, and subsequently to the Adjudicator's Office if necessary.

**12. CLOSING** ← Section heading MUST be bold

We trust HMRC will treat this matter with the appropriate urgency.

Yours faithfully,

[Name]
[Title]
[Firm Name]
Chartered Accountants

**13. ENCLOSURES** ← Section heading MUST be bold

Enc: Copies of:
- [Specific document or correspondence]
- [Specific document or correspondence]
- [Continue list]

---

CRITICAL FORMATTING RULES (APPLY TO ALL LETTERS):

1. **Dates**: Use full dates (e.g., "16 February 2024") when known, or month+year if specific date unknown
2. **Timeline**: Strictly chronological, one event per entry, EVERY date MUST be bold
3. **Violations**: Number clearly (1, 2, 3...), not bullets, EVERY violation header MUST be bold
4. **Voice**: Organizational ("We", "Our firm") not first-person ("I")
5. **Headings**: EVERY section heading MUST be bold using **double asterisks**
6. **Costs**: Separate Professional Costs section (section 9)
7. **Enclosures**: List specific documents, not "complete correspondence"
8. **CRG Citations**: CRG reference FIRST, then violation name (e.g., "**1. CRG4025 - Unreasonable Delay**")
9. **Bold Everything Important**: Section headings, dates, violation headers ALL MUST use **double asterisks**
10. **Violation Detail**: Each violation should have 2-3 full sentences explaining breach, quantifying excess, stating impact

BOLD FORMATTING CHECKLIST (VERIFY BEFORE RETURNING):
□ Every section heading wrapped in **double asterisks** (e.g., **Chronological Timeline of Events**)
□ Every date in timeline wrapped in **double asterisks** (e.g., **February 2024:**, **16 February 2024:**, **Post-8 April 2025:**)
□ Every violation header wrapped in **double asterisks** (e.g., **1. CRG4025 - Unreasonable Delay**)
□ FORMAL COMPLAINT line wrapped in **double asterisks** (e.g., **FORMAL COMPLAINT: [Title]**)
□ Sub-labels in Impact section wrapped if appropriate (e.g., **Client financial impact:**, **Client distress:**, **Public purse impact:**)

DO NOT OUTPUT LETTER WITHOUT VERIFYING ALL BOLD FORMATTING IS APPLIED.

Extract all relevant information from the fact sheet and organize it into this exact structure.
Do NOT add tone or emotion - just organize facts professionally with ALL proper bold formatting.`
      },
      {
        role: 'user',
        content: `Organize these facts into the professional complaint letter structure:

${factSheet}

${chargeOutRate ? `\nCharge-out rate: £${chargeOutRate}/hour\n` : ''}

Create the structured letter now (facts only, no tone yet):`
      }
    ],
    temperature: 0.3,
    max_tokens: 3000,
  });

  return response;
};

/**
 * STAGE 3: Add Professional Tone with Claude Opus 4.1
 * Transform structured letter into firm but professional complaint
 * USES precedent tone examples if available
 * 
 * Model: Opus 4.1 - Frontier writing quality, worth the premium cost
 * 
 * CRITICAL: Use PROFESSIONAL tone, NOT "fury"
 * Gold standard: Firm, measured, organizational voice
 */
export const stage3_addTone = async (
  structuredLetter: string
): Promise<string> => {
  console.log('✍️ STAGE 3: Adding professional tone with Opus 4.1 (measured, firm)');
  
  const response = await callOpenRouter({
    model: TONE_MODEL,
    messages: [
      {
        role: 'system',
        content: `You are transforming a structured complaint letter into professional, firm language suitable for an HMRC complaint.

CRITICAL TONE GUIDELINES:

1. **Use ORGANIZATIONAL voice** - NOT first-person singular:
   ✅ "We are writing to lodge a formal complaint..."
   ✅ "Our firm has experienced..."
   ✅ "The client has been deprived..."
   ❌ "I have rarely encountered..."
   ❌ "In my twenty years..."
   
2. **Use MEASURED professional language** - NOT aggressive:
   ✅ "This represents a comprehensive failure of..."
   ✅ "These delays are significantly below the standards..."
   ✅ "The combination of failures is particularly concerning"
   ❌ "your incompetence"
   ❌ "phantom letter"
   ❌ "would be comedic if..."
   ❌ "breathtaking consistency"
   ❌ "abandoned by HMRC"

3. **Professional section headings**:
   ✅ "Chronological Timeline of Events"
   ✅ "Charter Violations and CRG Breaches"
   ✅ "Impact on Our Client and Professional Practice"
   ❌ "TIMELINE OF FAILURES"
   ❌ "CHARTER & COMPLAINTS REFORM VIOLATIONS"

4. **Maintain FIRMNESS through**:
   - Specific facts: "14+ months vs 30-day standard = 1,400% excess"
   - Clear citations: "This comprehensively breaches CRG4025"
   - Professional disapproval: "completely unacceptable"
   - Logical consequences: "We will immediately escalate to Tier 2"
   
5. **Express concern professionally**:
   ✅ "particularly concerning"
   ✅ "significantly below acceptable standards"
   ✅ "comprehensive failure of service delivery"
   ✅ "We are disappointed to report..."
   ❌ "shocking"
   ❌ "outrageous"
   ❌ "ridiculous"

6. **AVOID entirely**:
   - Sarcasm or mockery
   - Personal attacks ("your incompetence")
   - Hyperbolic language ("breathtaking", "comedic")
   - Rhetorical questions
   - First-person singular ("I")
   - Emotional phrases

7. **Standard professional phrases** to USE:
   - "We are writing to lodge a formal complaint regarding..."
   - "This represents a significant breach of..."
   - "The combination of... represents multiple breaches..."
   - "significantly below the standards taxpayers have a right to expect"
   - "We trust HMRC will act swiftly to resolve this matter"
   - "Given the evidence outlined above..."
   - "These delays are completely unacceptable"
   - "clear breach of" (not "fundamental breach")
   - "significant" (not "egregious")
   - "multiple breaches" (not "comprehensive breaches")

8. **Closing tone**:
   ✅ "We trust HMRC will treat this matter with appropriate urgency"
   ✅ "We look forward to a substantive response"
   ✅ "Failure to respond adequately will result in immediate escalation"
   ❌ "Make no mistake, we will escalate"
   ❌ "We have limited optimism"

9. **Precedent language** (if provided):
   - USE professional phrases from precedents
   - ADAPT (don't copy verbatim) successful patterns
   - AVOID any aggressive phrases even if in precedents

10. **Language refinements** (measured professional terms):
   - Use "significant breach" NOT "egregious example"
   - Use "multiple breaches" NOT "comprehensive breaches"
   - Use "clear breach" NOT "fundamental breach"
   - Use "completely" NOT "wholly"
   - "Comprehensive failure" is acceptable but use sparingly

**What to enhance:**
- Make timeline entries clear and factual
- Emphasize patterns of failure professionally
- Calculate percentages and excesses
- State impact clearly but without emotion
- Request specific remedies firmly

**What NOT to change:**
- Structure must remain EXACTLY as provided
- All dates, numbers, facts must be preserved
- Professional headings as given
- Factual accuracy
- Bold formatting (**double asterisks**) on headings and dates

**Critical formatting requirements:**
- ALL section headings MUST remain bold (e.g., **Chronological Timeline of Events**)
- ALL dates in timeline MUST remain bold (e.g., **16 February 2024:**)
- Violation numbers MUST remain bold (e.g., **1. CRG4025 - Unreasonable Delay**)
- PRESERVE all **double asterisks** from the structured letter
- DO NOT remove bold formatting - it's required for professional presentation

**FINAL FORMATTING CHECKLIST (VERIFY BEFORE RETURNING):**
Before returning the letter, check EVERY instance:
□ Section headings: **Chronological Timeline of Events**, **Charter Violations and CRG Breaches**, **Impact on Our Client and Professional Practice**, **Professional Costs**, **Resolution Required**, **Response Deadline**, **Closing**, **Enclosures** - ALL must have **double asterisks**
□ Timeline dates: **February 2024:**, **16 February 2024:**, **Post-8 April 2025:**, **Latest Response:** - ALL must have **double asterisks**
□ Violation headers: **1. CRG4025 - Unreasonable Delay**, **2. Charter - Being Responsive**, etc. - ALL must have **double asterisks**
□ FORMAL COMPLAINT line: **FORMAL COMPLAINT: [Title]** - must have **double asterisks**
□ Impact sub-labels (if present): **Client financial impact:**, **Client distress:**, **Public purse impact:** - should have **double asterisks**

IF YOU SEE "Chronological Timeline of Events" WITHOUT **double asterisks**, YOU MUST ADD THEM.
IF YOU SEE "February 2024:" WITHOUT **double asterisks**, YOU MUST ADD THEM.
IF YOU SEE "1. CRG4025 - Unreasonable Delay" WITHOUT **double asterisks**, YOU MUST ADD THEM.

DO NOT RETURN LETTER WITHOUT VERIFYING ALL FORMATTING IS APPLIED.

**Gold standard language patterns:**
- Use "comprehensive administrative failure" (not "wholly unacceptable")
- Use "significant breach" (not "egregious example")
- Use "multiple breaches" (not "comprehensive breaches")
- Use "clear breach" (not "fundamental breach")
- Balance firmness with professionalism throughout

**Temperature calibration:**
This prompt uses temperature 0.4 for consistent professional output (not 0.7).

Transform the structured letter into a firm, professional complaint that demonstrates clear failures without aggressive language, preserving ALL bold formatting exactly as provided.`
      },
      {
        role: 'user',
        content: `Add professional, measured tone to this structured letter:

${structuredLetter}

Transform it now (firm but professional, organizational voice, no "I"):`
      }
    ],
    temperature: 0.4, // Lower temperature for consistent professional output
    max_tokens: 4000,
  });

  return response;
};

/**
 * THREE-STAGE PIPELINE: Complete letter generation
 * 
 * OPTIMIZED STACK:
 * - Stage 1: Haiku 4.5 ($0.25/M) - Fast fact extraction
 * - Stage 2: Sonnet 4.5 ($3/M) - Clean structure
 * - Stage 3: Opus 4.1 ($15/M) - Frontier prose quality
 * 
 * COST: ~$0.60 per letter (optimized from $1.96)
 * QUALITY: Best-in-class at each stage
 */
export const generateComplaintLetterThreeStage = async (
  complaintAnalysis: any,
  clientReference: string,
  hmrcDepartment: string,
  practiceLetterhead?: string,
  chargeOutRate?: number
) => {
  console.log('🚀 Starting three-stage letter generation pipeline');
  
  try {
    // STAGE 1: Extract facts (Sonnet 4.5 - 1M context)
    const factSheet = await stage1_extractFacts(
      complaintAnalysis,
      clientReference,
      hmrcDepartment
    );
    console.log('✅ Stage 1 complete: Facts extracted');
    
    // STAGE 2: Structure letter (Opus 4.1 - objective)
    const structuredLetter = await stage2_structureLetter(
      factSheet,
      practiceLetterhead,
      chargeOutRate
    );
    console.log('✅ Stage 2 complete: Letter structured');
    
    // STAGE 3: Add tone (Opus 4.1 - powerful)
    const finalLetter = await stage3_addTone(structuredLetter);
    console.log('✅ Stage 3 complete: Professional fury added');
    
    console.log('🎉 Three-stage pipeline complete!');
    
    return finalLetter;
  } catch (error: any) {
    console.error('❌ Three-stage pipeline failed:', error);
    throw new Error(`Letter generation failed: ${error.message}`);
  }
};

