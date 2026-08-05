import { NextRequest, NextResponse } from 'next/server';
import { scanWithRegex } from '@/lib/regexPatterns';
import { classifyPromptRisk, hasApiKey } from '@/lib/gemini';
import { addItem, readStore } from '@/lib/fileStore';
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

interface DlpRule {
  id: string;
  name: string;
  pattern: string;
  severity: 'high' | 'medium' | 'low';
  category: string;
  enabled: boolean;
  createdAt: string;
}

function inferDataCategory(prompt: string): string {
  const lower = prompt.toLowerCase();
  if (/\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/.test(prompt) || /ssn|social security|passport/.test(lower)) return 'PII';
  if (/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(prompt)) return 'PII';
  if (/revenue|financial|salary|payroll|compensation|budget|pipeline|q[1-4]\s/i.test(lower)) return 'Financial';
  if (/source code|function|class|import|require|module|api|endpoint|git|commit|pull request/i.test(lower)) return 'Source Code';
  return 'None';
}

function expandBase64(prompt: string): string {
  // Match base64 blobs ≥ 32 chars (long enough to hide a real secret)
  const B64 = /\b([A-Za-z0-9+/]{32,}={0,2})\b/g;
  let expanded = prompt;
  let m: RegExpExecArray | null;
  while ((m = B64.exec(prompt)) !== null) {
    try {
      const decoded = Buffer.from(m[1], 'base64').toString('utf8');
      // Only include if decoded text is printable ASCII (not binary garbage)
      if (/^[\x20-\x7E\n\r\t]{10,}$/.test(decoded)) {
        expanded += `\n[base64 decoded]: ${decoded}`;
      }
    } catch { /* not valid base64 — skip */ }
  }
  return expanded;
}

function extractUrlParams(prompt: string): string {
  const URL_RE = /https?:\/\/[^\s"']+/g;
  const extras: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = URL_RE.exec(prompt)) !== null) {
    try {
      const url = new URL(m[0]);
      url.searchParams.forEach((value, key) => {
        // Only flag values that look like secrets (long, high entropy)
        if (value.length >= 16) {
          extras.push(`url_param:${key}=${value}`);
        }
      });
    } catch { /* malformed URL */ }
  }
  return extras.length > 0 ? `${prompt}\n[url params]: ${extras.join(' ')}` : prompt;
}

/* ── Run enabled custom DLP rules against prompt ───────────── */
function scanWithCustomRules(
  prompt: string,
  rules: DlpRule[],
): { hasHighSeverity: boolean; hasMediumSeverity: boolean; hits: { label: string; severity: string }[]; highlights: HighlightSpan[] } {
  const customHighlights: HighlightSpan[] = [];
  const hits: { label: string; severity: string }[] = [];
  let hasHighSeverity = false;
  let hasMediumSeverity = false;

  for (const rule of rules) {
    if (!rule.enabled) continue;
    let regex: RegExp;
    try {
      regex = new RegExp(rule.pattern, 'gi');
    } catch {
      continue; // skip invalid patterns
    }
    let m: RegExpExecArray | null;
    while ((m = regex.exec(prompt)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      customHighlights.push({ start, end, pattern: rule.name, severity: rule.severity });
      hits.push({ label: rule.name, severity: rule.severity });
      if (rule.severity === 'high') hasHighSeverity = true;
      if (rule.severity === 'medium') hasMediumSeverity = true;
    }
  }

  return { hasHighSeverity, hasMediumSeverity, hits, highlights: customHighlights };
}

export async function POST(req: NextRequest) {
  try {
    const { prompt, source, tool } = await req.json();
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
    }

    const truncated = prompt.length > 200 ? prompt.slice(0, 200) + '...' : prompt;

    // Step 1: Regex pass (on enriched prompt)
    const enrichedPrompt = extractUrlParams(expandBase64(prompt));
    const regexResult = scanWithRegex(enrichedPrompt);

    // Step 1b: Custom DLP rules pass
    const customRules = readStore<DlpRule>('dlp-rules');
    const customResult = scanWithCustomRules(prompt, customRules);

    const dataCategory = inferDataCategory(prompt);

    // Merge highlights from base regex + custom rules
    const highlights: HighlightSpan[] = [
      ...regexResult.hits
        .filter((h) => h.index < prompt.length)
        .map((h) => ({ start: h.index, end: Math.min(h.end, prompt.length), pattern: h.label, severity: h.severity })),
      ...customResult.highlights.filter((h) => h.start < prompt.length),
    ].sort((a, b) => a.start - b.start);

    const respond = (log: GuardLog): NextResponse => {
      const body: GuardResponse = { ...log, highlights };
      return NextResponse.json(body);
    };

    if (regexResult.hasHighSeverity || customResult.hasHighSeverity) {
      const baseDetail = regexResult.hits.filter((h) => h.severity === 'high').map((h) => h.label);
      const customDetail = customResult.hits.filter((h) => h.severity === 'high').map((h) => h.label);
      const detail = [...baseDetail, ...customDetail].join(', ');
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

    if (regexResult.hasMediumSeverity || customResult.hasMediumSeverity) {
      const baseDetail = regexResult.hits.filter((h) => h.severity === 'medium').map((h) => h.label);
      const customDetail = customResult.hits.filter((h) => h.severity === 'medium').map((h) => h.label);
      const detail = [...baseDetail, ...customDetail].join(', ');
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
