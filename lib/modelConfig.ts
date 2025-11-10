/**
 * Best-in-Class AI Model Configuration
 * Optimized for quality over cost, using OpenRouter where possible
 * 
 * Strategy:
 * - Anthropic Claude: Analysis, reasoning, writing (strength: large context, synthesis)
 * - OpenAI GPT-4o: Structured JSON outputs (strength: schema enforcement)
 * - Google Gemini Pro 1.5: Extreme context cases >200K (strength: 2M context)
 * - Cohere/Voyage: Reranking (strength: precision@k improvement)
 */

export const MODEL_CONFIG = {
  // STAGE 0A: Text → Vector Embeddings
  embeddings: {
    primary: {
      model: 'openai/text-embedding-3-large',
      provider: 'openrouter',
      dimensions: 3072,
      cost_per_1m: 0.13,
      notes: 'Best retrieval performance, fully OpenRouter native'
    },
    costEfficient: {
      model: 'openai/text-embedding-3-small',
      provider: 'openrouter',
      dimensions: 1536,
      cost_per_1m: 0.02,
      notes: '6.5x cheaper, use with reranker for best cost/quality'
    },
    domainSpecific: {
      model: 'voyage-law-2',
      provider: 'voyage',
      dimensions: 1024,
      cost_per_1m: 0.12,
      notes: 'Legal-tuned, tops legal retrieval benchmarks (requires Voyage API)'
    }
  },

  // STAGE 0B: Individual Document Extraction (JSON-first, 200K context)
  documentExtraction: {
    primary: {
      model: 'anthropic/claude-haiku-4.5',
      provider: 'openrouter',
      context: 200_000,
      temperature: 0.2,
      cost_per_1m_in: 0.25,
      cost_per_1m_out: 1.25,
      notes: 'Fast, 200K context, excellent structured extraction'
    },
    hugeContext: {
      model: 'google/gemini-pro-1.5',
      provider: 'openrouter',
      context: 2_000_000,
      temperature: 0.2,
      cost_per_1m_in: 1.25,
      cost_per_1m_out: 5.0,
      notes: 'When doc + annexes exceed 200K'
    },
    strictJson: {
      model: 'openai/gpt-4o',
      provider: 'openrouter',
      context: 128_000,
      temperature: 0.2,
      cost_per_1m_in: 2.5,
      cost_per_1m_out: 10.0,
      useStructuredOutputs: true,
      notes: 'Use when 100% JSON validity crucial'
    }
  },

  // STAGE 1: Retrieval Reranking
  reranking: {
    primary: {
      model: 'cohere/rerank-3.5',
      provider: 'cohere',
      cost_per_1k_searches: 1.0,
      notes: 'Best precision@k, cross-encoder (requires Cohere API)'
    },
    alternative: {
      model: 'voyage/rerank-2.5',
      provider: 'voyage',
      cost_per_1k_searches: 0.5,
      notes: 'Excellent precision, cheaper than Cohere'
    },
    openrouterFallback: {
      model: 'openai/gpt-4o-mini',
      provider: 'openrouter',
      context: 128_000,
      temperature: 0.1,
      cost_per_1m_in: 0.15,
      notes: 'Not as strong as dedicated rerankers but better than pure cosine'
    }
  },

  // STAGE 2: Complaint-Level Analysis (200K+ context, JSON)
  complaintAnalysis: {
    primary: {
      model: 'anthropic/claude-sonnet-4.5',
      provider: 'openrouter',
      context: 200_000,
      temperature: 0.3,
      cost_per_1m_in: 3.0,
      cost_per_1m_out: 15.0,
      notes: 'Hybrid reasoning, built for large contexts and synthesis'
    },
    strictJson: {
      model: 'openai/gpt-4o',
      provider: 'openrouter',
      context: 128_000,
      temperature: 0.3,
      cost_per_1m_in: 2.5,
      cost_per_1m_out: 10.0,
      useStructuredOutputs: true,
      notes: 'Guaranteed schema when downstream depends on exact JSON'
    },
    giantContext: {
      model: 'google/gemini-pro-1.5',
      provider: 'openrouter',
      context: 2_000_000,
      temperature: 0.3,
      cost_per_1m_in: 1.25,
      cost_per_1m_out: 5.0,
      notes: 'Avoid chunking entirely, stuff everything in'
    }
  },

  // STAGE 3A: Letter Fact Extraction (extraction, terse, deterministic)
  letterFacts: {
    primary: {
      model: 'anthropic/claude-haiku-4.5',
      provider: 'openrouter',
      context: 200_000,
      temperature: 0.2,
      cost_per_1m_in: 0.25,
      cost_per_1m_out: 1.25,
      notes: 'Fast, 200K context, perfect for factual extraction'
    },
    ultraLowLatency: {
      model: 'openai/gpt-4o-mini',
      provider: 'openrouter',
      context: 128_000,
      temperature: 0.2,
      cost_per_1m_in: 0.15,
      cost_per_1m_out: 0.6,
      useStructuredOutputs: true,
      notes: 'Strict schema and ultra-low latency at scale'
    }
  },

  // STAGE 3B: Letter Structure (legal scaffolding, headings, citations)
  letterStructure: {
    primary: {
      model: 'anthropic/claude-sonnet-4.5',
      provider: 'openrouter',
      context: 200_000,
      temperature: 0.3,
      cost_per_1m_in: 3.0,
      cost_per_1m_out: 15.0,
      notes: 'Clean, consistent legal structure on long contexts'
    },
    schemaDriven: {
      model: 'openai/gpt-4o',
      provider: 'openrouter',
      context: 128_000,
      temperature: 0.3,
      cost_per_1m_in: 2.5,
      cost_per_1m_out: 10.0,
      useStructuredOutputs: true,
      notes: 'Section JSON schema → identical section ordering every time'
    }
  },

  // STAGE 3C: Letter Tone (polished "professional fury", best prose)
  letterTone: {
    primary: {
      model: 'anthropic/claude-opus-4.1',
      provider: 'openrouter',
      context: 200_000,
      temperature: 0.7,
      cost_per_1m_in: 15.0,
      cost_per_1m_out: 75.0,
      notes: 'Frontier writing/reasoning - worth the cost for quality'
    },
    excellentCheaper: {
      model: 'openai/gpt-4o',
      provider: 'openrouter',
      context: 128_000,
      temperature: 0.7,
      cost_per_1m_in: 2.5,
      cost_per_1m_out: 10.0,
      notes: 'Still excellent prose, 6x cheaper than Opus'
    }
  }
} as const;

/**
 * Get the active model for a given stage
 * Can be overridden via environment variables for A/B testing
 */
export const getModel = (stage: keyof typeof MODEL_CONFIG) => {
  const config = MODEL_CONFIG[stage];
  
  // Check for environment override
  const envOverride = process.env[`MODEL_${stage.toUpperCase()}`];
  if (envOverride && envOverride in config) {
    return config[envOverride as keyof typeof config];
  }
  
  // Default to primary
  return config.primary;
};

/**
 * Cost estimation helper
 */
export const estimateCost = (
  stage: keyof typeof MODEL_CONFIG,
  inputTokens: number,
  outputTokens: number = 0
): number => {
  const model = getModel(stage);
  
  if ('cost_per_1m_in' in model) {
    const inputCost = (inputTokens / 1_000_000) * model.cost_per_1m_in;
    const outputCost = (outputTokens / 1_000_000) * (model.cost_per_1m_out || 0);
    return inputCost + outputCost;
  }
  
  if ('cost_per_1m' in model) {
    return (inputTokens / 1_000_000) * model.cost_per_1m;
  }
  
  return 0;
};

/**
 * Get OpenRouter request configuration for structured outputs
 */
export const getStructuredOutputConfig = (jsonSchema: any) => {
  return {
    response_format: {
      type: 'json_schema',
      json_schema: jsonSchema
    }
  };
};

/**
 * Provider routing hints for OpenRouter
 */
export const PROVIDER_ROUTING = {
  // Pin Anthropic for analysis stages
  anthropic: {
    require_parameters: false,
    data_collection: 'deny'
  },
  
  // Pin OpenAI for strict JSON
  openai: {
    require_parameters: false
  },
  
  // Auto-route for uptime/latency
  auto: {}
} as const;

/**
 * Recommended model selection by use case
 */
export const MODEL_RECOMMENDATIONS = {
  // When you need the absolute best quality (letter tone)
  bestQuality: MODEL_CONFIG.letterTone.primary,
  
  // When you need strict JSON schema adherence
  strictJson: MODEL_CONFIG.documentExtraction.strictJson,
  
  // When context exceeds 200K tokens
  hugeContext: MODEL_CONFIG.documentExtraction.hugeContext,
  
  // When you need fastest response time
  fastestResponse: MODEL_CONFIG.letterFacts.ultraLowLatency,
  
  // When cost is a major concern (but still good quality)
  costEfficient: MODEL_CONFIG.embeddings.costEfficient,
  
  // When legal domain expertise matters most
  legalSpecialist: MODEL_CONFIG.embeddings.domainSpecific
} as const;

/**
 * Feature flags for optional external APIs
 */
export const EXTERNAL_APIS = {
  // Enable Voyage API for legal-tuned embeddings
  useVoyageEmbeddings: process.env.VOYAGE_API_KEY !== undefined,
  
  // Enable Cohere for reranking
  useCohereRerank: process.env.COHERE_API_KEY !== undefined,
  
  // Enable Voyage for reranking
  useVoyageRerank: process.env.VOYAGE_API_KEY !== undefined
} as const;

