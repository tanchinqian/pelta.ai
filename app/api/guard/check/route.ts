import { NextRequest, NextResponse } from 'next/server';
import { scanWithRegex } from '@/lib/regexPatterns';
import { classifyPromptRisk, hasApiKey } from '@/lib/gemini';
import { addItem } from '@/lib/fileStore';
import { v4 as uuid } from 'uuid';

interface GuardLog {
  id: string;
  promptSnippet: string;
  verdict: 'allow' | 'flag' | 'block';
  riskLevel: 'none' | 'low' | 'medium' | 'high';
  reason: string;
  detectionMethod: 'regex' | 'llm';
  dataCategory: string;
  source?: string;
  tool?: string;
  timestamp: string;
}

interface HighlightSpan {
  start: number;
  end: number;
  pattern: string;
  severity: 'high' | 'medium' | 'low';
}

interface GuardResponse extends GuardLog {
  highlights: HighlightSpan[];
}

function inferDataCategory(prompt: string): string {
  const lower = prompt.toLowerCase();
  if (/\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/.test(prompt) || /ssn|social security|passport/.test(lower)) return 'PII';
  if (/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(prompt)) return 'PII';
  if (/revenue|financial|salary|payroll|compensation|budget|pipeline|q[1-4]\s/i.test(lower)) return 'Financial';
  if (/source code|function|class|import|require|module|api|endpoint|git|commit|pull request/i.test(lower)) return 'Source Code';
  return 'None';
}

export async function POST(req: NextRequest) {
  try {
    const { prompt, source, tool } = await req.json();
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
    }

    const truncated = prompt.length > 200 ? prompt.slice(0, 200) + '...' : prompt;

    // Step 1: Regex pass
    const regexResult = scanWithRegex(prompt);

    const dataCategory = inferDataCategory(prompt);

    // Build highlights from regex hits (positions in original prompt text)
    const highlights: HighlightSpan[] = regexResult.hits
      .map((h) => ({ start: h.index, end: h.end, pattern: h.label, severity: h.severity }))
      .sort((a, b) => a.start - b.start);

    const respond = (log: GuardLog): NextResponse => {
      const body: GuardResponse = { ...log, highlights };
      return NextResponse.json(body);
    };

    if (regexResult.hasHighSeverity) {
      const detail = regexResult.hits.filter((h) => h.severity === 'high').map((h) => h.label).join(', ');
      const log: GuardLog = {
        id: uuid(),
        promptSnippet: truncated,
        verdict: 'block',
        riskLevel: 'high',
        reason: `Regex detected high-severity patterns: ${detail}.`,
        detectionMethod: 'regex',
        dataCategory,
        source, tool,
        timestamp: new Date().toISOString(),
      };
      addItem('logs', log);
      return respond(log);
    }

    if (regexResult.hasMediumSeverity) {
      const detail = regexResult.hits.filter((h) => h.severity === 'medium').map((h) => h.label).join(', ');
      const log: GuardLog = {
        id: uuid(),
        promptSnippet: truncated,
        verdict: 'flag',
        riskLevel: 'medium',
        reason: `Regex detected medium-severity patterns: ${detail}.`,
        detectionMethod: 'regex',
        dataCategory,
        source, tool,
        timestamp: new Date().toISOString(),
      };
      addItem('logs', log);
      return respond(log);
    }

    // Step 2: If inconclusive but suspicious, escalate to LLM
    if (regexResult.inconclusiveButSuspicious) {

      if (hasApiKey()) {
        const llmResult = await classifyPromptRisk(prompt);
        const verdict = llmResult.riskLevel === 'high' ? 'block' : llmResult.riskLevel === 'medium' ? 'flag' : 'allow';
        const log: GuardLog = {
          id: uuid(),
          promptSnippet: truncated,
          verdict,
          riskLevel: llmResult.riskLevel,
          reason: `LLM assessment: ${llmResult.reason}`,
          detectionMethod: 'llm',
          dataCategory,
          source, tool,
          timestamp: new Date().toISOString(),
        };
        addItem('logs', log);
        return respond(log);
      }

      // Mock LLM fallback
      const keywords = regexResult.suspiciousKeywords.slice(0, 4).join(', ');
      const log: GuardLog = {
        id: uuid(),
        promptSnippet: truncated,
        verdict: 'flag',
        riskLevel: 'medium',
        reason: keywords
          ? `Suspicious keywords detected: ${keywords}. Recommend admin review.`
          : 'Text appears to contain business-sensitive context. Recommend admin review.',
        detectionMethod: 'llm',
        dataCategory,
        source, tool,
        timestamp: new Date().toISOString(),
      };
      addItem('logs', log);
      return respond(log);
    }

    // Step 3: Nothing suspicious — always None category for clean prompts
    const log: GuardLog = {
      id: uuid(),
      promptSnippet: truncated,
      verdict: 'allow',
      riskLevel: 'none',
      reason: 'No sensitive data detected by regex scan.',
      detectionMethod: 'regex',
      dataCategory: 'None',
      source, tool,
      timestamp: new Date().toISOString(),
    };
    addItem('logs', log);
    return respond(log);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? 'Guard check failed' },
      { status: 500 },
    );
  }
}
