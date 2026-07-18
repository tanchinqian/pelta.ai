/*
 * NIST AI RMF keyword-based retrieval for Tool Risk Classification.
 *
 * This is a scoped, static retrieval layer — no embeddings, no vector DB.
 * It loads the derived reference file `data/nist_ai_rmf_functions.json`
 * (built from the full NIST AI RMF playbook) and scores each function by
 * simple case-insensitive keyword overlap with the tool name + description.
 *
 * Tradeoff: keyword matching is fast, fully offline, and sufficient for a
 * hackathon demo. A natural next step is replacing this with a vector-embedding
 * retriever over the same curated playbook.
 */

import nistFunctions from '@/data/nist_ai_rmf_functions.json';

export interface NistFunctionRef {
  function: 'Govern' | 'Map' | 'Measure' | 'Manage';
  definition: string;
  concerns: string[];
  keywords: string[];
  sourceCount: number;
}

export interface NistRetrievalResult {
  function: NistFunctionRef['function'];
  definition: string;
  concerns: string[];
  score: number;
  matchedKeywords: string[];
}

const FUNCTIONS: NistFunctionRef[] = nistFunctions as NistFunctionRef[];

const FUNCTION_ORDER: NistFunctionRef['function'][] = ['Govern', 'Map', 'Measure', 'Manage'];

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Score each NIST function by keyword matches against the query.
 * Returns top functions sorted by relevance.
 */
export function retrieveNistContext(
  toolName: string,
  description: string,
  options: { topK?: number; minScore?: number } = {},
): NistRetrievalResult[] {
  const { topK = 3, minScore = 1 } = options;
  const query = normalize(`${toolName} ${description}`);

  const scored = FUNCTIONS.map((fn) => {
    const matchedKeywords: string[] = [];
    let score = 0;

    for (const kw of fn.keywords) {
      const normalizedKw = normalize(kw);
      if (!normalizedKw) continue;

      // Match whole phrases (e.g. "risk tolerance") or single tokens.
      if (query.includes(normalizedKw)) {
        matchedKeywords.push(kw);
        // Phrases get higher weight than single words.
        score += normalizedKw.includes(' ') ? 3 : 1;
      }
    }

    return {
      function: fn.function,
      definition: fn.definition,
      concerns: fn.concerns,
      score,
      matchedKeywords,
    };
  });

  const relevant = scored
    .filter((r) => r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  // Fallback: if nothing matches strongly, return short definitions for all four functions.
  if (relevant.length === 0) {
    return FUNCTIONS.map((fn) => ({
      function: fn.function,
      definition: fn.definition,
      concerns: [],
      score: 0,
      matchedKeywords: [],
    }));
  }

  return relevant;
}

/**
 * Format retrieved context for injection into a Gemini prompt.
 */
export function formatNistContextForPrompt(results: NistRetrievalResult[]): string {
  if (results.length === 0) return '';

  const lines = results.map((r) => {
    const concernText = r.concerns.length > 0
      ? `\n  Concerns: ${r.concerns.slice(0, 3).join(' ')}`
      : '';
    return `- ${r.function}: ${r.definition}${concernText}`;
  });

  return [
    'Relevant NIST AI RMF context for this classification:',
    ...lines,
    'Use this context to inform which NIST functions apply and why. Only include functions genuinely implicated by the tool.',
  ].join('\n');
}

/**
 * Convenience: get the names of the top retrieved functions.
 */
export function topNistFunctions(results: NistRetrievalResult[]): NistFunctionRef['function'][] {
  return results.map((r) => r.function);
}
