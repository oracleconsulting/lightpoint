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
 */
export const stage2_structureLetter = async (
  factSheet: string,
  practiceLetterhead?: string,
  chargeOutRate?: number
): Promise<string> => {
  console.log('🏗️ STAGE 2: Structuring letter with Sonnet 4.5 (clean legal structure)');
  
  const response = await callOpenRouter({
    model: STRUCTURE_MODEL,
    messages: [
      {
        role: 'system',
        content: `You are a legal secretary organizing facts into a formal HMRC complaint letter structure.

CRITICAL: If the fact sheet includes PRECEDENT EXAMPLES from successful complaints, 
USE THEIR STRUCTURE as your guide. Copy the way they:
- Organize timeline entries
- Number Charter violations
- Break down professional costs
- List enclosures

Use this EXACT structure:

**LETTERHEAD**
[Practice details]
[Date - after all timeline events]

HMRC Complaints Team
HM Revenue & Customs
BX9 1AA

**FORMAL COMPLAINT - [BRIEF SUMMARY]**
**Client Reference: [REF]**
**Complaint Category: [CATEGORIES]**

Dear Sir/Madam,

**OPENING PARAGRAPH**
State the core issue factually in 3-4 sentences.

**TIMELINE OF FAILURES**
**[Date]:** Description
**[Date]:** Description
[Continue chronologically]

**CHARTER & COMPLAINTS REFORM VIOLATIONS**
Your handling violates multiple Charter commitments and CRG standards:

**1. [CRG/Charter] - [Type] ([Severity])**
[Factual description]

**2. [CRG/Charter] - [Type] ([Severity])**
[Factual description]

[Continue for all violations]

**IMPACT & COSTS**
The financial impact extends beyond the £[X] relief my client cannot access:

- **Professional time wasted:** [X] hours at £${chargeOutRate || 185}/hour = £[Y]
  - [Task]: [X] hours
  - [Task]: [X] hours
  
- **Client distress:** [Description]
- **Public purse:** [Description]

These costs continue mounting daily.

**RESOLUTION REQUIRED**
Given the severity and duration of failures, I require:

1. **[Action]**
2. **[Action]**
[Continue numbered list]

**ESCALATION WARNING**
[State 15-day deadline and escalation path]

**RESPONSE REQUIRED BY: [DATE]**
[State expectations and consequences]

Yours faithfully,

[Name]
[Title]
[Firm]

**Enclosed:**
- [Specific document]
- [Specific document]

${practiceLetterhead ? `\nUSE THIS LETTERHEAD EXACTLY:\n${practiceLetterhead}\n` : 'Generate realistic UK accountancy firm details'}

Be objective and factual. No emotional language yet - that comes in Stage 3.
Focus on getting dates, numbers, and structure perfect.`
      },
      {
        role: 'user',
        content: `Organize these facts into a structured complaint letter:

FACTS:
${factSheet}

CHARGE-OUT RATE: £${chargeOutRate || 185}/hour

Create the structured letter now (objective tone, perfect structure):`
      }
    ],
    temperature: 0.3, // Low temperature for structural consistency
    max_tokens: 4000,
  });

  return response;
};

/**
 * STAGE 3: Add Professional Fury with Claude Opus 4.1
 * Transform structured letter into powerful, authentic complaint
 * USES precedent tone examples if available
 * 
 * Model: Opus 4.1 - Frontier writing quality, worth the premium cost
 */
export const stage3_addTone = async (
  structuredLetter: string
): Promise<string> => {
  console.log('🔥 STAGE 3: Adding professional fury with Opus 4.1 (frontier writing)');
  
  const response = await callOpenRouter({
    model: TONE_MODEL,
    messages: [
      {
        role: 'system',
        content: `You are a senior partner with 20 years of experience, personally frustrated by HMRC's incompetence.

Take the structured letter and enhance it with authentic professional fury while keeping the EXACT structure.

CRITICAL: If the structured letter mentions PRECEDENT TONE EXAMPLES from successful complaints,
USE THEIR LANGUAGE as inspiration. Notice how they:
- Express frustration professionally
- Use memorable phrases
- Cite personal experience
- Create vivid imagery
- Show specific counts

**What to add:**

1. **Opening punch** - Start with impact, not bureaucracy:
   "In twenty years of practice, I have rarely encountered such comprehensive failure..."

2. **Memorable phrases** - Make failures vivid:
   - "phantom letter" (for lost correspondence)
   - "would be comedic if the consequences weren't so serious"
   - "The left hand has no idea what the right hand instructed"
   - "This isn't a delay - it's an abandonment"
   
3. **Specific frustration** - Count everything:
   - "Four separate attempts" not "multiple attempts"
   - "Each promised callback never materialised"
   - "Nine months of absolute silence"
   
4. **Personal authority** - Use your experience:
   - "In twenty years of handling HMRC matters..."
   - "I have rarely encountered..."
   - "One of the most severe examples..."
   
5. **Power calculations** - Make numbers sting:
   - "1,400% excess over reasonable timescales"
   - "180 working days beyond your Charter promise"
   
6. **Escalation confidence** - No doubt:
   - "The Adjudicator routinely upholds complaints with far shorter delays"
   - "The evidence here is incontrovertible"
   
**What NOT to change:**
- DON'T change the structure
- DON'T change dates, numbers, or facts
- DON'T add sarcasm or excessive editorializing
- DON'T make it apologetic or tentative

**Tone guide:**
- Professional but genuinely angry
- Specific, not generic
- Confident, not arrogant
- Direct, not rambling

Transform this into a letter that makes HMRC sit up and take notice.`
      },
      {
        role: 'user',
        content: `Add authentic professional fury to this structured letter:

${structuredLetter}

Transform it now (keep structure, add power):`
      }
    ],
    temperature: 0.7, // Higher temperature for creative language
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

