import { GoogleGenerativeAI } from '@google/generative-ai';
import { NistRetrievalResult, retrieveNistContext, formatNistContextForPrompt } from './nistRetrieval';

const apiKey = process.env.GEMINI_API_KEY || '';

/** Try these in order — free-tier availability varies by project */
const MODEL_CANDIDATES = [
  'gemini-3.5-flash',
  'gemini-3.1-pro-preview',
  'gemini-3-flash-preview',
  'gemini-2.5-flash',
  'gemini-flash-latest',
];

function getClient(): GoogleGenerativeAI {
  return new GoogleGenerativeAI(apiKey);
}

function hasApiKey(): boolean {
  return !!apiKey;
}

function parseJson(text: string): any {
  const cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();
  return JSON.parse(cleaned);
}

export interface ToolRiskResponse {
  riskTier: 'Low' | 'Medium' | 'High';
  nistFunctions: Array<'Govern' | 'Map' | 'Measure' | 'Manage'>;
  dataCategories: Array<'PII' | 'Financial' | 'Source Code' | 'None'>;
  justification: string;
  recommendedPolicy: string;
  retrievedNistContext?: NistRetrievalResult[];
}

const SYSTEM_PROMPT = `You are an AI governance classification engine aligned with NIST AI RMF (Govern, Map, Measure, Manage) and EU AI Act principles.

Given an AI tool name and a short description of what it is used for, return a JSON object (and ONLY valid JSON — no markdown, no fences, no preamble) with these fields:
- "riskTier": "Low", "Medium", or "High"
- "nistFunctions": array of relevant NIST RMF functions from ["Govern","Map","Measure","Manage"]
- "dataCategories": array of likely data types touched, from ["PII","Financial","Source Code","None"]
- "justification": one-paragraph plain-English explanation of the classification
- "recommendedPolicy": a specific access policy recommendation

Be thorough but practical. Consider: data sent to third-party servers, access to source code, PII handling, and potential for misuse.`;

export { hasApiKey };

export interface PromptRiskResponse {
  riskLevel: 'none' | 'low' | 'medium' | 'high';
  reason: string;
}

const PROMPT_CHECK_SYSTEM_PROMPT = `You are a data-loss prevention (DLP) classifier. Given a text prompt that a user wants to send to an external AI tool, determine if it contains sensitive company or personal data.

Return ONLY valid JSON (no markdown, no fences, no preamble) with:
- "riskLevel": "none", "low", "medium", or "high"
- "reason": one-sentence explanation of your assessment

"none" = generic text with no sensitive data.
"low" = minor references that are not directly sensitive.
"medium" = contains business-sensitive context (financial figures, internal project names, etc.) but no hard PII.
"high" = contains definite PII, financial secrets, credentials, or legally protected data.`;

const SUGGEST_SYSTEM_PROMPT = `You are a data-loss prevention assistant helping an employee rephrase a prompt that was blocked for containing sensitive data.

Rewrite the prompt into exactly 3 safe alternatives that:
1. Preserve the user's original intent and request
2. Remove or generalise all sensitive data (no real emails, phone numbers, names, or identifiers)
3. Are ready to use as-is without further editing

Return ONLY a JSON array of exactly 3 strings. No markdown fences, no preamble, no explanation.`;

const SUGGEST_FALLBACK: string[] = [
  'Please help me draft a professional message to our internal contact about the project handover. I will add recipient details separately before sending.',
  'Write a concise handover update that I can personalise with the relevant contact information for the team member.',
  'Draft a project transition summary in a neutral tone that I can adapt and send to the appropriate stakeholder.',
];

async function generateWithFallback(prompt: string): Promise<string> {
  if (!apiKey) throw new Error('No GEMINI_API_KEY');
  const genAI = getClient();
  let lastErr: Error | null = null;

  for (const modelName of MODEL_CANDIDATES) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err: any) {
      lastErr = err;
      const msg = String(err?.message ?? err);
      // Try next model on quota / not found / rate limit
      if (/429|404|quota|rate|not found|RESOURCE_EXHAUSTED/i.test(msg)) {
        console.warn(`[gemini] ${modelName} failed, trying next:`, msg.slice(0, 120));
        continue;
      }
      throw err;
    }
  }
  throw lastErr ?? new Error('All Gemini models failed');
}

function mockToolRisk(toolName: string, description: string): ToolRiskResponse {
  const lower = `${toolName} ${description}`.toLowerCase();
  let riskTier: ToolRiskResponse['riskTier'] = 'Medium';
  let dataCategories: ToolRiskResponse['dataCategories'] = ['None'];
  let nistFunctions: ToolRiskResponse['nistFunctions'] = ['Govern', 'Map'];

  if (/code|copilot|cursor|replit|source|dev|sdk|api/.test(lower)) {
    riskTier = 'High';
    dataCategories = ['Source Code'];
    nistFunctions = ['Govern', 'Map', 'Measure', 'Manage'];
  } else if (/email|chat|customer|pii|hr|recruit|resume|legal/.test(lower)) {
    riskTier = 'Medium';
    dataCategories = ['PII'];
    nistFunctions = ['Govern', 'Map', 'Manage'];
  } else if (/finance|payroll|invoice|budget|banking/.test(lower)) {
    riskTier = 'High';
    dataCategories = ['Financial', 'PII'];
    nistFunctions = ['Govern', 'Map', 'Measure', 'Manage'];
  } else if (/grammar|translate|note|summar|writing|image|design/.test(lower)) {
    riskTier = 'Low';
    dataCategories = ['None'];
    nistFunctions = ['Govern', 'Measure'];
  }

  return {
    riskTier,
    nistFunctions,
    dataCategories,
    justification: `Heuristic assessment (LLM unavailable): "${toolName}" — ${description}. Classified ${riskTier} based on description keywords. Re-run when Gemini quota is available for a full NIST-aligned analysis.`,
    recommendedPolicy:
      riskTier === 'High'
        ? 'Restrict to approved teams. Block file upload and sensitive data categories. Quarterly review required.'
        : riskTier === 'Medium'
          ? 'Allow for non-sensitive tasks only. Review data retention policy before full rollout.'
          : 'Allow for general productivity use. Review annually.',
  };
}

function mockPromptRisk(text: string): PromptRiskResponse {
  const lower = text.toLowerCase();
  if (/confidential|salary|internal|budget|financial|secret|nda|proprietary/.test(lower) || text.length > 200) {
    return {
      riskLevel: 'medium',
      reason: 'LLM unavailable — heuristic: business-sensitive keywords or long text detected.',
    };
  }
  return {
    riskLevel: 'none',
    reason: 'LLM unavailable — heuristic: no sensitive patterns detected.',
  };
}

export async function suggestSafePrompts(
  blockedPrompt: string,
  detectedPatterns: string[],
): Promise<string[]> {
  if (!apiKey) return SUGGEST_FALLBACK;
  try {
    const patternList = detectedPatterns.length > 0 ? detectedPatterns.join(', ') : 'sensitive data';
    const prompt = `${SUGGEST_SYSTEM_PROMPT}\n\nDetected sensitive patterns: ${patternList}\n\nOriginal blocked prompt:\n"""\n${blockedPrompt.slice(0, 1000)}\n"""\n\nReturn ONLY a JSON array of exactly 3 strings.`;

    const text = await generateWithFallback(prompt);

    try {
      const parsed = parseJson(text);
      if (Array.isArray(parsed) && parsed.length >= 3) return parsed.slice(0, 3) as string[];
      throw new Error('Response was not an array of 3');
    } catch {
      return SUGGEST_FALLBACK;
    }
  } catch (err: any) {
    console.warn('[gemini] suggestSafePrompts fallback:', err?.message);
    return SUGGEST_FALLBACK;
  }
}

export async function classifyPromptRisk(text: string): Promise<PromptRiskResponse> {
  if (!apiKey) return mockPromptRisk(text);
  try {
    const prompt = `${PROMPT_CHECK_SYSTEM_PROMPT}\n\nText:\n"""\n${text.slice(0, 2000)}\n"""\n\nReturn ONLY valid JSON with riskLevel and reason.`;
    const text_ = await generateWithFallback(prompt);
    try {
      return parseJson(text_) as PromptRiskResponse;
    } catch {
      return { riskLevel: 'medium', reason: 'Failed to parse LLM response; defaulting to medium risk.' };
    }
  } catch (err: any) {
    console.warn('[gemini] classifyPromptRisk fallback:', err?.message);
    return mockPromptRisk(text);
  }
}

export async function classifyToolRisk(
  toolName: string,
  description: string,
): Promise<ToolRiskResponse> {
  if (!apiKey) return mockToolRisk(toolName, description);
  try {
    const nistContext = retrieveNistContext(toolName, description);
    const contextBlock = formatNistContextForPrompt(nistContext);

    const prompt = `${SYSTEM_PROMPT}\n\n${contextBlock}\n\nTool name: "${toolName}"\nDescription: "${description}"\n\nReturn ONLY valid JSON with the fields: riskTier, nistFunctions, dataCategories, justification, recommendedPolicy.`;
    const text = await generateWithFallback(prompt);
    try {
      const parsed = parseJson(text) as ToolRiskResponse;
      return { ...parsed, retrievedNistContext: nistContext };
    } catch {
      console.warn('[gemini] parse failed, using heuristic mock');
      return mockToolRisk(toolName, description);
    }
  } catch (err: any) {
    console.warn('[gemini] classifyToolRisk fallback:', err?.message);
    return mockToolRisk(toolName, description);
  }
}
