/**
 * Generate embedding for text using OpenRouter
 * Using openai/text-embedding-3-large via OpenRouter API
 */
export const generateEmbedding = async (text: string): Promise<number[]> => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://lightpoint.app',
        'X-Title': 'Lightpoint HMRC Complaint System',
      },
      body: JSON.stringify({
        model: 'openai/text-embedding-3-large',
        input: text,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new Error('Failed to generate embedding');
  }
};

/**
 * Generate embeddings for multiple texts in batch
 */
export const generateEmbeddingsBatch = async (texts: string[]): Promise<number[][]> => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://lightpoint.app',
        'X-Title': 'Lightpoint HMRC Complaint System',
      },
      body: JSON.stringify({
        model: 'openai/text-embedding-3-large',
        input: texts,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.data.map((item: any) => item.embedding);
  } catch (error) {
    console.error('Error generating embeddings:', error);
    throw new Error('Failed to generate embeddings');
  }
};

