'use client';

import { useState, useEffect } from 'react';
import { Lightbulb, Search } from 'lucide-react';
import RadarIcon from '@/components/RadarIcon';

interface ToolRecord {
  id: string; name: string; description: string; status: string;
  riskTier: string | null; nistFunctions: string[]; dataCategories: string[];
  justification: string; recommendedPolicy: string; createdAt: string;
}

const RISK: Record<string, string> = { Low: 'var(--risk-low)', Medium: 'var(--risk-medium)', High: 'var(--risk-high)' };

export default function ClassifyToolPage() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ToolRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tools, setTools] = useState<ToolRecord[]>([]);

  const fetchTools = async () => {
    const res = await fetch('/api/tools');
    if (res.ok) setTools(await res.json());
  };

  useEffect(() => { fetchTools(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch('/api/tools/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Classification failed');
      setResult(data);
      setName('');
      setDescription('');
      fetchTools();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 p-4 max-w-5xl mx-auto w-full space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <RadarIcon size={14} className="text-accent" />
        <span className="text-sm font-semibold text-text-primary">Classify a New AI Tool</span>
        <span className="text-[10px] font-mono text-text-tertiary">/ gemini-powered risk assessment</span>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="panel p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-1">Tool Name</label>
            <input
              className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
              placeholder="e.g. Grammarly, GitHub Copilot"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-1">What is it used for?</label>
            <input
              className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
              placeholder="e.g. AI writing assistant for customer emails"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              disabled={loading}
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-text-tertiary">Result persists to tool registry</span>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-medium text-text-primary bg-surface-hover hover:bg-surface border border-border rounded px-4 py-2 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {loading ? (
              <><div className="size-3 border border-text-tertiary border-t-text-primary rounded-full animate-spin" /> Classifying</>
            ) : (
              <><Search size={12} /> Classify</>
            )}
          </button>
        </div>
      </form>

      {/* Error */}
      {error && (
        <div className="bg-risk-high/10 border border-risk-high/30 text-risk-high text-xs rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* Result Card — accent panel */}
      {result && (
        <div className="animate-slide-in panel-primary p-4 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-text-primary">{result.name}</p>
              <p className="text-xs text-text-secondary mt-0.5">{result.description}</p>
            </div>
            <span className="shrink-0 text-[10px] font-bold font-mono uppercase px-2 py-0.5 rounded"
              style={{ color: RISK[result.riskTier ?? 'Low'], background: `color-mix(in srgb, ${RISK[result.riskTier ?? 'Low']} 10%, transparent)` }}
            >
              {result.riskTier ?? 'Unclassified'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-1">NIST Functions</p>
              <div className="flex flex-wrap gap-1">
                {result.nistFunctions.length > 0 ? result.nistFunctions.map((f) => (
                  <span key={f} className="px-1.5 py-0.5 rounded bg-background border border-border text-text-secondary text-[10px] font-mono">{f}</span>
                )) : <span className="text-text-muted">—</span>}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-1">Data Categories</p>
              <div className="flex flex-wrap gap-1">
                {result.dataCategories.length > 0 ? result.dataCategories.map((c) => (
                  <span key={c} className="px-1.5 py-0.5 rounded bg-background border border-border text-text-secondary text-[10px] font-mono">{c}</span>
                )) : <span className="text-text-muted">—</span>}
              </div>
            </div>
          </div>

          <div className="text-xs space-y-2 pt-2 border-t border-border">
            <div>
              <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-0.5">Justification</p>
              <p className="text-text-secondary leading-relaxed">{result.justification}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-0.5">Recommended Policy</p>
              <p className="text-text-secondary leading-relaxed">{result.recommendedPolicy}</p>
            </div>
          </div>
        </div>
      )}

      {/* Registry Table */}
      <div className="panel">
        <div className="px-4 py-2 border-b border-border">
          <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
            Tool Registry <span className="text-text-tertiary font-normal">({tools.length})</span>
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-text-secondary border-b border-border">
                <th className="py-2 px-4 font-medium">Name</th>
                <th className="py-2 px-4 font-medium">Risk</th>
                <th className="py-2 px-4 font-medium hidden sm:table-cell">NIST</th>
                <th className="py-2 px-4 font-medium hidden md:table-cell">Data</th>
                <th className="py-2 px-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {tools.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <RadarIcon size={24} className="text-accent animate-radar-pulse" />
                    <span className="text-text-tertiary text-xs">No tools classified yet — submit one for assessment.</span>
                  </div>
                </td></tr>
              )}
              {tools.map((t, i) => (
                <tr key={t.id} className={`border-b border-border/40 hover:bg-surface-hover/50 transition-colors ${i % 2 === 1 ? 'bg-surface-hover/20' : ''}`}>
                  <td className="py-2 px-4">
                    <p className="font-medium text-text-primary">{t.name}</p>
                    <p className="text-[10px] text-text-tertiary truncate max-w-[200px]">{t.description}</p>
                  </td>
                  <td className="py-2 px-4">
                    {t.riskTier ? (
                      <span className="text-[10px] font-bold font-mono uppercase" style={{ color: RISK[t.riskTier] }}>{t.riskTier}</span>
                    ) : <span className="text-text-muted">—</span>}
                  </td>
                  <td className="py-2 px-4 text-[10px] font-mono text-text-tertiary hidden sm:table-cell">{t.nistFunctions.join(', ') || '—'}</td>
                  <td className="py-2 px-4 text-[10px] font-mono text-text-tertiary hidden md:table-cell">{t.dataCategories.join(', ') || '—'}</td>
                  <td className="py-2 px-4">
                    <span className={`text-[10px] font-mono uppercase ${
                      t.status === 'approved' ? 'text-risk-low' :
                      t.status === 'blocked' ? 'text-risk-high' : 'text-risk-medium'
                    }`}>{t.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
