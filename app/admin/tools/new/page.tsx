'use client';

import { useState, useEffect } from 'react';
import { Lightbulb, Search, ArrowUpDown, ArrowUp, ArrowDown, X, Trash2 } from 'lucide-react';
import RadarIcon from '@/components/RadarIcon';

interface ToolRecord {
  id: string; name: string; description: string; status: string;
  riskTier: string | null; nistFunctions: string[]; dataCategories: string[];
  justification: string; recommendedPolicy: string; createdAt: string;
}

const RISK: Record<string, string> = { Low: 'var(--risk-low)', Medium: 'var(--risk-medium)', High: 'var(--risk-high)' };

const PRESETS = [
  { name: 'DeepSeek Coder', description: 'Open-source code completion model used in local IDEs for software development' },
  { name: 'v0 by Vercel', description: 'Generative UI system to build frontends from natural language prompts' },
  { name: 'Jasper AI', description: 'Marketing copywriter tool for drafting blog posts, social media, and ad copy' },
  { name: 'Claude 3.5 Sonnet', description: 'Advanced conversational LLM used for brainstorming and complex analysis' }
];

type SortDir = 'asc' | 'desc' | null;
type SortKey = 'name' | 'riskTier' | 'status' | null;

function SortTh({ label, sortKey: key, active, dir, onToggle }: {
  label: string; sortKey: SortKey; active: SortKey; dir: SortDir; onToggle: (k: SortKey) => void;
}) {
  const isActive = active === key;
  return (
    <th className="py-2 px-4 font-medium cursor-pointer select-none hover:text-text-primary transition-colors text-left" onClick={() => onToggle(key)}>
      <span className="flex items-center gap-1">
        {label}
        {isActive ? (dir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />) : <ArrowUpDown size={10} className="text-text-muted" />}
      </span>
    </th>
  );
}

export default function ClassifyToolPage() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ToolRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tools, setTools] = useState<ToolRecord[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchTools = async () => {
    const res = await fetch('/api/tools');
    if (res.ok) setTools(await res.json());
  };

  const handleStatusChange = async (id: string, newStatus: 'approved' | 'pending' | 'blocked') => {
    setTools((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t))
    );
    if (result && result.id === id) {
      setResult((prev) => prev ? { ...prev, status: newStatus } : null);
    }
    try {
      const res = await fetch('/api/tools', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (!res.ok) {
        throw new Error('Failed to update status');
      }
      fetchTools();
    } catch (err) {
      console.error(err);
      fetchTools();
    }
  };

  const handleDeleteTool = async (id: string) => {
    if (!confirm('Are you sure you want to delete this tool?')) return;
    
    setTools((prev) => prev.filter((t) => t.id !== id));
    if (result && result.id === id) {
      setResult(null);
    }
    try {
      const res = await fetch(`/api/tools?id=${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        throw new Error('Failed to delete tool');
      }
      fetchTools();
    } catch (err) {
      console.error(err);
      fetchTools();
    }
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      if (sortDir === 'asc') setSortDir('desc');
      else if (sortDir === 'desc') { setSortKey(null); setSortDir(null); }
    } else { setSortKey(key); setSortDir('asc'); }
  };

  const RISK_ORDER: Record<string, number> = { Low: 1, Medium: 2, High: 3 };

  const filteredTools = tools.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.justification ?? '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRisk = riskFilter === 'all' || t.riskTier === riskFilter;
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;

    return matchesSearch && matchesRisk && matchesStatus;
  });

  const displayedTools = [...filteredTools].sort((a, b) => {
    if (!sortKey || !sortDir) return 0;
    
    let av: any;
    let bv: any;
    
    if (sortKey === 'riskTier') {
      av = RISK_ORDER[a.riskTier ?? ''] ?? 0;
      bv = RISK_ORDER[b.riskTier ?? ''] ?? 0;
    } else {
      av = (a[sortKey] ?? '').toLowerCase();
      bv = (b[sortKey] ?? '').toLowerCase();
    }
    
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

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
            <div className="relative">
              <input
                className="w-full bg-background border border-border rounded pl-3 pr-8 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
                placeholder="e.g. Grammarly, GitHub Copilot"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={loading}
              />
              {name && !loading && (
                <button
                  type="button"
                  onClick={() => setName('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary cursor-pointer p-0.5 rounded hover:bg-surface-hover transition-colors"
                  title="Clear Tool Name"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-1">What is it used for?</label>
            <div className="relative">
              <input
                className="w-full bg-background border border-border rounded pl-3 pr-8 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
                placeholder="e.g. AI writing assistant for customer emails"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                disabled={loading}
              />
              {description && !loading && (
                <button
                  type="button"
                  onClick={() => setDescription('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary cursor-pointer p-0.5 rounded hover:bg-surface-hover transition-colors"
                  title="Clear description"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* Preset suggestions */}
        <div className="flex items-center gap-2 flex-wrap text-[10px] pt-1">
          <span className="text-text-tertiary uppercase font-semibold tracking-wider font-mono">Suggestions:</span>
          {PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => {
                setName(preset.name);
                setDescription(preset.description);
              }}
              disabled={loading}
              className="px-2 py-1 rounded bg-background border border-border text-text-secondary hover:text-text-primary hover:border-accent transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {preset.name}
            </button>
          ))}
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
        <div className="animate-slide-in panel-primary p-4 space-y-3 relative">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-text-primary">{result.name}</p>
              <p className="text-xs text-text-secondary mt-0.5">{result.description}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] font-bold font-mono uppercase px-2 py-0.5 rounded"
                style={{ color: RISK[result.riskTier ?? 'Low'], background: `color-mix(in srgb, ${RISK[result.riskTier ?? 'Low']} 10%, transparent)` }}
              >
                {result.riskTier ?? 'Unclassified'}
              </span>
              <button
                type="button"
                onClick={() => setResult(null)}
                className="text-text-secondary hover:text-text-primary p-1 rounded hover:bg-surface-hover transition-colors cursor-pointer"
                title="Dismiss details"
              >
                <X size={12} />
              </button>
            </div>
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
        <div className="px-4 py-2 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider shrink-0">
            Tool Registry <span className="text-text-tertiary font-normal">({displayedTools.length} of {tools.length})</span>
          </span>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-background border border-border rounded px-2.5 py-1 text-[11px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent w-full sm:w-36 transition-colors"
            />
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="bg-background border border-border rounded px-2 py-1 text-[11px] text-text-secondary focus:outline-none focus:border-accent cursor-pointer transition-colors"
            >
              <option value="all">All Risks</option>
              <option value="Low">Low Risk</option>
              <option value="Medium">Medium Risk</option>
              <option value="High">High Risk</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-background border border-border rounded px-2 py-1 text-[11px] text-text-secondary focus:outline-none focus:border-accent cursor-pointer transition-colors"
            >
              <option value="all">All Statuses</option>
              <option value="approved">Accept</option>
              <option value="pending">Pending</option>
              <option value="blocked">Decline</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-text-secondary border-b border-border">
                <SortTh label="Name" sortKey="name" active={sortKey} dir={sortDir} onToggle={toggleSort} />
                <SortTh label="Risk" sortKey="riskTier" active={sortKey} dir={sortDir} onToggle={toggleSort} />
                <th className="py-2 px-4 font-medium hidden sm:table-cell">NIST</th>
                <th className="py-2 px-4 font-medium hidden md:table-cell">Data</th>
                <SortTh label="Status" sortKey="status" active={sortKey} dir={sortDir} onToggle={toggleSort} />
              </tr>
            </thead>
            <tbody>
              {displayedTools.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <RadarIcon size={24} className="text-accent animate-radar-pulse" />
                    <span className="text-text-tertiary text-xs">No tools found matching your filters.</span>
                  </div>
                </td></tr>
              )}
              {displayedTools.map((t, i) => {
                const isSelected = result?.id === t.id;
                return (
                  <tr
                    key={t.id}
                    onClick={() => setResult(t)}
                    className={`border-b border-border/40 hover:bg-surface-hover/70 transition-colors cursor-pointer ${
                      isSelected ? 'bg-[var(--accent-dim)] border-l-2 border-l-[var(--accent)] font-medium' : i % 2 === 1 ? 'bg-surface-hover/20' : ''
                    }`}
                  >
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
                      <div className="flex items-center gap-1.5 justify-end sm:justify-start">
                        <select
                          value={t.status}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleStatusChange(t.id, e.target.value as any);
                          }}
                          className={`bg-background border border-border rounded px-1.5 py-0.5 text-[10px] font-mono uppercase focus:outline-none focus:border-accent transition-colors cursor-pointer ${
                            t.status === 'approved' ? 'text-risk-low border-risk-low/30' :
                            t.status === 'blocked' ? 'text-risk-high border-risk-high/30' : 'text-risk-medium border-risk-medium/30'
                          }`}
                        >
                          <option value="approved" className="text-risk-low bg-background">Accept</option>
                          <option value="pending" className="text-risk-medium bg-background">Pending</option>
                          <option value="blocked" className="text-risk-high bg-background">Decline</option>
                        </select>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTool(t.id);
                          }}
                          className="text-text-secondary hover:text-risk-high p-1 rounded hover:bg-surface-hover transition-colors cursor-pointer flex items-center justify-center"
                          title="Delete tool"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
