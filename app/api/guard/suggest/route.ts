import { NextRequest, NextResponse } from 'next/server';
import { suggestSafePrompts, hasApiKey } from '@/lib/gemini';

const FALLBACK_SUGGESTIONS = [
  'Please help me draft a professional message to our internal contact about the project handover. I will add recipient details separately before sending.',
  'Write a concise handover update that I can personalise with the relevant contact information for the team member.',
  'Draft a project transition summary in a neutral tone that I can adapt and send to the appropriate stakeholder.',
];

export async function POST(req: NextRequest) {
  try {
    const { prompt, detectedPatterns } = await req.json();
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
    }

    if (!hasApiKey()) {
      return NextResponse.json({ suggestions: FALLBACK_SUGGESTIONS });
    }

    const suggestions = await suggestSafePrompts(
      prompt,
      Array.isArray(detectedPatterns) ? detectedPatterns : [],
    );
    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: FALLBACK_SUGGESTIONS });
  }
}
