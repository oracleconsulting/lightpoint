/**
 * OpenRouter API client for Claude Opus 4.1 integration
 */

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
// Using Claude Opus 4.1 (latest as of Nov 2024)
const DEFAULT_MODEL = 'anthropic/claude-opus-4-20250514';

/**
 * Call OpenRouter API with Claude Opus 4.1
 */
export const callOpenRouter = async (
  request: OpenRouterRequest
): Promise<string> => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }

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
        model: request.model || DEFAULT_MODEL,
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
 */
export const analyzeComplaint = async (
  documentData: string,
  relevantGuidance: string,
  similarCases: string
) => {
  const response = await callOpenRouter({
    model: DEFAULT_MODEL,
    messages: [
      {
        role: 'system',
        content: `You are an expert HMRC complaint analyst with deep knowledge of:
- HMRC Charter commitments
- Complaint Resolution Guidance (CRG)
- Standard timeframes and service standards
- Precedent cases and outcomes

Analyze documents for:
1. Specific Charter violations
2. Unreasonable delays (beyond standard timeframes)
3. CRG guidance breaches
4. Applicable precedents

Provide analysis in JSON format with:
{
  "hasGrounds": boolean,
  "violations": [{ "type": string, "description": string, "citation": string }],
  "actions": [string],
  "successRate": number (0-100),
  "reasoning": string
}

CRITICAL: Never process or include personal data. All data should be pre-anonymized.`
      },
      {
        role: 'user',
        content: `Document Data:\n${documentData}\n\nRelevant HMRC Guidance:\n${relevantGuidance}\n\nSimilar Precedents:\n${similarCases}\n\nProvide your analysis:`
      }
    ],
    temperature: 0.3, // Lower temperature for more consistent analysis
  });

  try {
    return JSON.parse(response);
  } catch (error) {
    console.error('Failed to parse OpenRouter response:', error);
    throw new Error('Invalid analysis response format');
  }
};

/**
 * Generate formal complaint letter
 */
export const generateComplaintLetter = async (
  complaintAnalysis: any,
  clientReference: string,
  hmrcDepartment: string
) => {
  const response = await callOpenRouter({
    model: DEFAULT_MODEL,
    messages: [
      {
        role: 'system',
        content: `You are an expert at drafting formal HMRC complaint letters.

Letter Structure:
1. Subject line: "FORMAL COMPLAINT - [Department] - Ref: [Reference]"
2. Opening paragraph: Clear statement this is a formal complaint
3. Background: Chronological timeline of events
4. Specific violations: Reference Charter commitments and CRG guidance
5. Impact statement: Professional impact on accountant/client relationship
6. Required remedies: Specific actions requested
7. Timeframe: Reference 28-day response requirement
8. Fee recovery: Statement of intention to recover professional fees
9. Escalation: Reference to Adjudicator if unresolved

Tone: Professional, assertive, evidence-based, not emotional.

Use UK English and formal business letter format.`
      },
      {
        role: 'user',
        content: `Generate a formal complaint letter based on this analysis:

Analysis: ${JSON.stringify(complaintAnalysis)}
Client Reference: ${clientReference}
HMRC Department: ${hmrcDepartment}

Generate the complete letter:`
      }
    ],
    temperature: 0.7,
    max_tokens: 3000,
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

  const response = await callOpenRouter({
    model: DEFAULT_MODEL,
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

