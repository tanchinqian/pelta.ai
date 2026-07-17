'use client';

import { useState, useRef, useCallback } from 'react';
import { Lock, Search, AlertTriangle, CheckCircle, XCircle, Eye } from 'lucide-react';
import RadarIcon from '@/components/RadarIcon';

interface GuardResult {
  id: string;
  promptSnippet: string;
  verdict: 'allow' | 'flag' | 'block';
  riskLevel: 'none' | 'low' | 'medium' | 'high';
  reason: string;
  detectionMethod: 'regex' | 'llm';
  dataCategory: string;
  timestamp: string;
}

const V = {
  allow: { icon: <CheckCircle size={14} />, label: 'Allowed', color: 'var(--risk-low)' },
  flag: { icon: <AlertTriangle size={14} />, label: 'Flagged', color: 'var(--risk-medium)' },
  block: { icon: <XCircle size={14} />, label: 'Blocked', color: 'var(--risk-high)' },
};

const DATA_CAT: Record<string, string> = {
  PII: '#818cf8', Financial: '#c084fc', 'Source Code': '#22d3ee', None: '#64748b',
};

export default function PromptGuardPage() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GuardResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setError(null);
    setResult(null);
    setShowResult(false);
    setLoading(true);
    try {
      const res = await fetch('/api/guard/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Check failed');
      setResult(data);
      setTimeout(() => setShowResult(true), 50);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [prompt]);

  const renderHighlighted = (text: string) => {
    const patterns = [
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
      /\b(?:\d[ -]*?){13,16}\b/g,
      /\b(sk-|pk-|api[-_]?key|token|secret)[-_]?[A-Za-z0-9]{16,}\b/gi,
      /\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/g,
      /\b(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
      /\b[A-Z]{1,2}\d{6,9}\b/g,
      /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
      /\b\d{8,17}\b/g,
      /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
      /\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/g,
    ];
    let result = text;
    for (const pattern of patterns) {
      result = result.replace(pattern, (m) => `__HL__${m}__/HL__`);
    }
    const parts = result.split(/(__HL__|__\/HL__)/g);
    const els: React.ReactNode[] = [];
    let inHL = false;
    for (const p of parts) {
      if (p === '__HL__') { inHL = true; continue; }
      if (p === '__\/HL__') { inHL = false; continue; }
      if (p) els.push(inHL ? <span key={els.length} className="sensitive-highlight">{p}</span> : <span key={els.length}>{p}</span>);
    }
    return els;
  };

  const v = result ? V[result.verdict] : null;

  return (
    <div className="flex-1 flex h-[calc(100vh-48px)]">
      {/* Left: Input */}
      <div className="flex-1 flex flex-col border-r border-border">
        <div className="flex items-center gap-2 px-4 h-9 border-b border-border bg-surface/30">
          <RadarIcon size={12} className="text-accent" />
          <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">Prompt Guard</span>
          <span className="ml-auto text-[10px] font-mono text-text-tertiary">regex + llm</span>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              className="w-full h-full resize-none bg-transparent p-4 text-sm font-mono text-text-primary placeholder:text-text-muted focus:outline-none leading-relaxed"
              placeholder="Paste the text you're about to send to an AI tool..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="flex items-center justify-between px-4 h-9 border-t border-border bg-surface/30">
            <div className="text-[10px] font-mono text-text-tertiary">
              {prompt.length} chars
              {result && (
                <span className="ml-3" style={{ color: v?.color }}>
                  last: {result.verdict.toUpperCase()}
                </span>
              )}
            </div>
            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              className="flex items-center gap-1.5 text-xs font-medium text-text-primary bg-surface-hover hover:bg-surface border border-border rounded px-3 py-1.5 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {loading ? (
                <><div className="size-3 border border-text-tertiary border-t-text-primary rounded-full animate-spin" /> Scanning</>
              ) : (
                <><Search size={12} /> Scan</>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Right: Result */}
      <div className="w-[360px] flex flex-col bg-surface/30">
        <div className="flex items-center gap-2 px-4 h-9 border-b border-border">
          <Eye size={12} className="text-text-secondary" />
          <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">Result</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!result && !loading && (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
              <RadarIcon size={32} className="text-accent mb-3 animate-radar-pulse" />
              <p className="text-xs text-text-tertiary">Submit a prompt to scan for sensitive data.</p>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
              <div className="relative size-12 mb-4">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="text-accent animate-radar">
                  <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
                  <path d="M12 7a5 5 0 0 1 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
                  <path d="M12 11a1 1 0 0 1 1 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
                  <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                </svg>
              </div>
              <p className="text-xs text-text-tertiary font-mono">Scanning for sensitive patterns...</p>
            </div>
          )}

          {result && showResult && (
            <div className="animate-slide-in space-y-3 p-4">
              {/* Verdict */}
              <div className="flex items-center gap-2" style={{ color: v?.color }}>
                {v?.icon}
                <span className="text-sm font-bold">{v?.label}</span>
              </div>

              <p className="text-xs text-text-secondary leading-relaxed">{result.reason}</p>

              {/* Meta grid */}
              <div className="grid grid-cols-3 gap-2">
                <MetaBox label="Risk" value={result.riskLevel} color={
                  result.riskLevel === 'high' ? 'var(--risk-high)' :
                  result.riskLevel === 'medium' ? 'var(--risk-medium)' : 'var(--risk-low)'
                } />
                <MetaBox label="Method" value={result.detectionMethod} />
                <MetaBox label="Category" value={result.dataCategory} color={DATA_CAT[result.dataCategory]} />
              </div>

              {/* Scanned text */}
              <div className="border border-border rounded-lg p-3">
                <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-1.5">Scanned text</p>
                <p className="text-[11px] font-mono text-text-secondary leading-relaxed break-all">
                  {renderHighlighted(result.promptSnippet)}
                </p>
              </div>

              {/* Audit trail */}
              <div className="flex items-center justify-between text-[10px] font-mono text-text-tertiary pt-2 border-t border-border">
                <span>logged to audit trail</span>
                <span className="text-accent">{result.id.slice(0, 8)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetaBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-surface border border-border rounded p-2">
      <p className="text-[9px] font-semibold text-text-secondary uppercase tracking-wider">{label}</p>
      <p className="text-[11px] font-mono font-medium mt-0.5" style={{ color: color ?? 'var(--text-primary)' }}>{value}</p>
    </div>
  );
}
