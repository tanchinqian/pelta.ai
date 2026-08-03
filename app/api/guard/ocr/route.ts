import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const apiKey = process.env.LLM_API_KEY || process.env.GEMINI_API_KEY || '';

// Same model list as lib/gemini.ts — these are known to work with this API key
const MODEL_CANDIDATES = [
  'gemini-3.5-flash',
  'gemini-3.1-pro-preview',
  'gemini-3-flash-preview',
  'gemini-2.5-flash',
  'gemini-flash-latest',
];

const OCR_PROMPT =
  'You are an OCR tool. Extract ALL visible text from this image exactly as it appears. ' +
  'Return ONLY the raw extracted text with no commentary, no formatting, no markdown.';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { image, mimeType } = body as { image: string; mimeType?: string };

    if (!image || typeof image !== 'string') {
      return NextResponse.json({ error: 'Missing image field' }, { status: 400, headers: CORS_HEADERS });
    }

    if (!apiKey) {
      return NextResponse.json({ error: 'No GEMINI_API_KEY configured' }, { status: 500, headers: CORS_HEADERS });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const resolvedMime = (mimeType || 'image/png') as 'image/png' | 'image/jpeg' | 'image/webp';
    const imagePart = { inlineData: { data: image, mimeType: resolvedMime } };

    let text = '';
    let lastErr: Error | null = null;

    for (const modelName of MODEL_CANDIDATES) {
      try {
        console.log(`[pelta/ocr] trying ${modelName}...`);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent([OCR_PROMPT, imagePart]);
        text = result.response.text().trim();
        console.log(`[pelta/ocr] ${modelName} extracted ${text.length} chars`);
        break;
      } catch (err: any) {
        lastErr = err;
        const msg = String(err?.message ?? err);
        if (/429|404|quota|rate|not found|RESOURCE_EXHAUSTED|not supported/i.test(msg)) {
          console.warn(`[pelta/ocr] ${modelName} unavailable, trying next:`, msg.slice(0, 120));
          continue;
        }
        throw err;
      }
    }

    if (!text && lastErr) throw lastErr;

    return NextResponse.json({ text }, { headers: CORS_HEADERS });
  } catch (err) {
    console.error('[pelta/ocr] failed:', err);
    return NextResponse.json(
      { error: 'OCR failed', detail: String(err) },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
