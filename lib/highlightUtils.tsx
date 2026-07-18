/* ── Shared highlight utility for sensitive data spans ─────
 *   Used by /admin/logs (expanded log rows), /employee/redress
 *   (sensitive prompt preview in timeline), and indirectly by
 *   the extension (which receives spans from the API response).
 * ─────────────────────────────────────────────────────────── */

import React from 'react';

export interface HighlightSpan {
  start: number;
  end: number;
  pattern: string;
  severity: 'high' | 'medium' | 'low';
}

/** The standard PII/secret detection patterns. Kept in sync with lib/regexPatterns.ts. */
export const HIGHLIGHT_PATTERNS: { pattern: RegExp; severity: 'high' | 'medium' | 'low' }[] = [
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, severity: 'high' },
  { pattern: /\b(?:\d[ -]*?){13,16}\b/g, severity: 'high' },
  { pattern: /\b(sk-|pk-|api[-_]?key|token|secret)[-_]?[A-Za-z0-9]{16,}\b/gi, severity: 'high' },
  { pattern: /\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/g, severity: 'high' },
  { pattern: /\b(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, severity: 'high' },
  { pattern: /\b[A-Z]{1,2}\d{6,9}\b/g, severity: 'high' },
  { pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, severity: 'medium' },
  { pattern: /\b\d{8,17}\b/g, severity: 'high' },
  { pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, severity: 'high' },
  { pattern: /\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/g, severity: 'medium' },
];

/** Scan text and return highlight spans (positions of sensitive matches). */
export function findHighlightSpans(text: string): HighlightSpan[] {
  const spans: HighlightSpan[] = [];
  for (const { pattern, severity } of HIGHLIGHT_PATTERNS) {
    const re = new RegExp(pattern.source, pattern.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m.index === undefined) continue;
      spans.push({
        start: m.index,
        end: m.index + m[0].length,
        pattern: pattern.source,
        severity,
      });
      if (m[0].length === 0) re.lastIndex++;
    }
  }
  // Sort by start position; on overlap, keep the earlier/longer span
  spans.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
  // Remove overlapping spans (keep first)
  const cleaned: HighlightSpan[] = [];
  let lastEnd = -1;
  for (const s of spans) {
    if (s.start >= lastEnd) {
      cleaned.push(s);
      lastEnd = s.end;
    }
  }
  return cleaned;
}

/** Render text with sensitive spans highlighted. React version for web app pages. */
export function renderHighlightedText(text: string): React.ReactNode[] {
  const spans = findHighlightSpans(text);
  if (spans.length === 0) return [text];

  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  spans.forEach((span, i) => {
    if (span.start > cursor) {
      nodes.push(text.slice(cursor, span.start));
    }
    nodes.push(
      <span
        key={`hl-${i}`}
        className={span.severity === 'high' ? 'sensitive-highlight' : 'sensitive-highlight-medium'}
      >
        {text.slice(span.start, span.end)}
      </span>,
    );
    cursor = span.end;
  });
  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }
  return nodes;
}

/** Build a list of detected pattern labels for a text (e.g. ["Email address", "Phone number"]). */
export function listDetectedPatterns(text: string): { label: string; severity: 'high' | 'medium' | 'low' }[] {
  const labels: { label: string; severity: 'high' | 'medium' | 'low' }[] = [];
  const checks: { re: RegExp; label: string; severity: 'high' | 'medium' | 'low' }[] = [
    { re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/, label: 'Email address', severity: 'high' },
    { re: /\b(?:\d[ -]*?){13,16}\b/, label: 'Credit card number', severity: 'high' },
    { re: /\b(sk-|pk-|api[-_]?key|token|secret)[-_]?[A-Za-z0-9]{16,}\b/i, label: 'API key', severity: 'high' },
    { re: /\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/, label: 'SSN', severity: 'high' },
    { re: /\b(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/, label: 'Phone number', severity: 'high' },
    { re: /\b[A-Z]{1,2}\d{6,9}\b/, label: 'Passport number', severity: 'high' },
    { re: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/, label: 'IP address', severity: 'medium' },
    { re: /\b\d{8,17}\b/, label: 'Bank/routing number', severity: 'high' },
    { re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/, label: 'JWT token', severity: 'high' },
    { re: /\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/, label: 'Date of birth', severity: 'medium' },
  ];
  for (const { re, label, severity } of checks) {
    if (re.test(text)) labels.push({ label, severity });
  }
  return labels;
}
