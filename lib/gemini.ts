import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY || '';

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

export async function classifyPromptRisk(text: string): Promise<PromptRiskResponse> {
  const genAI = getClient();
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = `${PROMPT_CHECK_SYSTEM_PROMPT}\n\nText:\n"""\n${text.slice(0, 2000)}\n"""\n\nReturn ONLY valid JSON with riskLevel and reason.`;

  const result = await model.generateContent(prompt);
  const response = result.response;
  const text_ = response.text();

  try {
    return parseJson(text_) as PromptRiskResponse;
  } catch {
    return { riskLevel: 'medium', reason: 'Failed to parse LLM response; defaulting to medium risk.' };
  }
}

export async function classifyToolRisk(
  toolName: string,
  description: string,
): Promise<ToolRiskResponse> {
  const genAI = getClient();
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = `${SYSTEM_PROMPT}\n\nTool name: "${toolName}"\nDescription: "${description}"\n\nReturn ONLY valid JSON with the fields: riskTier, nistFunctions, dataCategories, justification, recommendedPolicy.`;

  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();

  try {
    return parseJson(text) as ToolRiskResponse;
  } catch {
    throw new Error(`Failed to parse Gemini response as JSON:\n${text}`);
  }
}
