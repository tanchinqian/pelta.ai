export interface RegexMatch {
  pattern: string;
  label: string;
  match: string;       // masked, for display
  text: string;        // unmasked, for highlight spans
  index: number;       // start position
  end: number;         // end position (exclusive)
  severity: 'high' | 'medium' | 'low';
}

export interface RegexResult {
  hits: RegexMatch[];
  hasHighSeverity: boolean;
  hasMediumSeverity: boolean;
  hasLowSeverity: boolean;
  inconclusiveButSuspicious: boolean;
  suspiciousKeywords: string[];
}

const PATTERNS: { label: string; pattern: RegExp; severity: 'high' | 'medium' | 'low' }[] = [
  // High severity — definite PII or secrets
  { label: 'Email address', pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, severity: 'high' },
  { label: 'Credit card number', pattern: /\b(?:\d[ -]*?){13,16}\b/g, severity: 'high' },
  { label: 'API key (generic)', pattern: /\b(sk-|pk-|api[-_\s]?key|token|secret|bearer)[\s=:-]*[A-Za-z0-9_.~+/=-]{16,}\b/gi, severity: 'high' },
  { label: 'Social Security Number (US)', pattern: /\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/g, severity: 'high' },
  { label: 'Passport number', pattern: /\b[A-Z]{1,2}\d{6,9}\b/g, severity: 'high' },
  { label: 'Phone number', pattern: /\b(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, severity: 'high' },
  { label: 'IP address', pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, severity: 'medium' },
  { label: 'Bank account / routing number', pattern: /\b\d{8,17}\b/g, severity: 'high' },
  { label: 'JWT token', pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, severity: 'high' },
  { label: 'Date of birth', pattern: /\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/g, severity: 'medium' },
  { label: 'API key (high entropy token)', pattern: /\b[A-Za-z0-9_.~+/=-]{40,}\b/gi, severity: 'high' },
];

const SUSPICIOUS_KEYWORDS = [
  'confidential', 'salary', 'compensation', 'bonus', 'internal', 'proprietary',
  'trade secret', 'nda', 'non-disclosure', 'financial', 'revenue', 'acquisition',
  'merger', 'layoff', 'restructuring', 'insider', 'classified', 'sensitive',
  'password', 'credentials', 'pii', 'personally identifiable', 'patient',
  'health record', 'hipaa', 'gdpr', 'bank account', 'routing',
];

export function scanWithRegex(text: string): RegexResult {
  const hits: RegexMatch[] = [];

  for (const { label, pattern, severity } of PATTERNS) {
    const matches = text.matchAll(pattern);
    for (const m of matches) {
      const start = m.index ?? 0;
      const raw = m[0];
      hits.push({
        pattern: pattern.source,
        label,
        match: maskMatch(raw),
        text: raw,
        index: start,
        end: start + raw.length,
        severity,
      });
    }
  }

  const hasHighSeverity = hits.some((h) => h.severity === 'high');
  const hasMediumSeverity = hits.some((h) => h.severity === 'medium');
  const hasLowSeverity = hits.some((h) => h.severity === 'low');

  const lower = text.toLowerCase();
  const suspiciousKeywords = SUSPICIOUS_KEYWORDS.filter((kw) => lower.includes(kw));

  const inconclusiveButSuspicious =
    !hasHighSeverity &&
    !hasMediumSeverity &&
    suspiciousKeywords.length > 0 &&
    text.length > 60;

  return {
    hits,
    hasHighSeverity,
    hasMediumSeverity,
    hasLowSeverity,
    inconclusiveButSuspicious,
    suspiciousKeywords,
  };
}

function maskMatch(value: string): string {
  if (value.length <= 4) return value;
  const visible = 2;
  const masked = value.slice(visible, -visible).replace(/./g, '•');
  return value.slice(0, visible) + masked + value.slice(-visible);
}
