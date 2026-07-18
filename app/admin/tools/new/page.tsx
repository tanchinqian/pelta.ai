'use client';

import { useState, useEffect } from 'react';
import { Lightbulb, Search, ArrowUpDown, ArrowUp, ArrowDown, X, Trash2, Download, Printer, RotateCw, ChevronRight } from 'lucide-react';
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

function SortTh({ label, sortKey: key, active, dir, onToggle, align = 'left' }: {
  label: string; sortKey: SortKey; active: SortKey; dir: SortDir; onToggle: (k: SortKey) => void; align?: 'left' | 'center' | 'right';
}) {
  const isActive = active === key;
  const alignmentClass = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left';
  const flexAlignmentClass = align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start';
  return (
    <th className={`py-2.5 px-4 font-semibold text-zinc-800 dark:text-zinc-200 cursor-pointer select-none hover:text-accent transition-colors ${alignmentClass}`} onClick={() => onToggle(key)}>
      <span className={`flex items-center gap-1 ${flexAlignmentClass}`}>
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
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [flyoutTool, setFlyoutTool] = useState<ToolRecord | null>(null);
  const [reclassifyingId, setReclassifyingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, riskFilter, statusFilter, sortKey, sortDir]);

  const autocompleteSuggestions = name.trim()
    ? tools.filter(
      (t) =>
        t.name.toLowerCase().startsWith(name.toLowerCase()) &&
        t.name.toLowerCase() !== name.toLowerCase()
    )
    : [];

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

  const exportToJson = (record: ToolRecord) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(record, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${record.name.toLowerCase().replace(/\s+/g, '_')}_risk_assessment.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handlePrintReport = (record: ToolRecord) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>${record.name} - AI Risk Assessment Report</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              color: #1a1918;
              padding: 40px;
              max-width: 800px;
              margin: 0 auto;
              line-height: 1.6;
            }
            .header {
              border-bottom: 2px solid #a07820;
              padding-bottom: 20px;
              margin-bottom: 30px;
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
            }
            .title {
              margin: 0;
              font-size: 28px;
              font-weight: 800;
              color: #1a1918;
            }
            .tagline {
              font-size: 14px;
              color: #5c5a55;
              margin-top: 5px;
            }
            .badge {
              font-family: monospace;
              text-transform: uppercase;
              font-size: 12px;
              font-weight: bold;
              padding: 6px 12px;
              border-radius: 4px;
              background: #f0efeb;
            }
            .risk-High { color: #dc2626; background: rgba(220,38,38,0.1); }
            .risk-Medium { color: #d97706; background: rgba(217,119,6,0.1); }
            .risk-Low { color: #16a34a; background: rgba(22,163,74,0.1); }
            
            .section {
              margin-bottom: 25px;
            }
            .section-title {
              font-size: 12px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              color: #5c5a55;
              margin-bottom: 8px;
              border-bottom: 1px solid #e2e0db;
              padding-bottom: 4px;
            }
            .pill {
              display: inline-block;
              font-family: monospace;
              font-size: 11px;
              padding: 3px 8px;
              background: #f0efeb;
              border: 1px solid #e2e0db;
              border-radius: 3px;
              margin-right: 6px;
              margin-bottom: 6px;
              color: #5c5a55;
            }
            .meta-grid {
              display: grid;
              grid-template-cols: 1fr 1fr;
              gap: 20px;
              margin-bottom: 30px;
            }
            .footer {
              margin-top: 50px;
              border-top: 1px solid #e2e0db;
              padding-top: 15px;
              font-size: 10px;
              color: #8e8b84;
              display: flex;
              justify-content: space-between;
            }
            @media print {
              body { padding: 0; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="title">${record.name}</h1>
              <div class="tagline">${record.description}</div>
            </div>
            <span class="badge risk-${record.riskTier}">${record.riskTier} Risk</span>
          </div>

          <div class="meta-grid">
            <div class="section">
              <div class="section-title">NIST AI RMF Functions</div>
              <div>
                ${record.nistFunctions.map(f => `<span class="pill">${f}</span>`).join('')}
              </div>
            </div>
            <div class="section">
              <div class="section-title">Data Categories Scope</div>
              <div>
                ${record.dataCategories.map(c => `<span class="pill">${c}</span>`).join('')}
              </div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Governance Justification</div>
            <p>${record.justification}</p>
          </div>

          <div class="section">
            <div class="section-title">Recommended Access Policy</div>
            <p>${record.recommendedPolicy}</p>
          </div>

          <div class="footer">
            <span>Generated by pelta.ai Compliance Portal</span>
            <span>Assessment Date: ${new Date(record.createdAt).toLocaleDateString()}</span>
          </div>

          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() {
                window.close();
              };
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleReclassify = async (tool: ToolRecord) => {
    setReclassifyingId(tool.id);
    try {
      const res = await fetch('/api/tools/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: tool.name, description: tool.description, existingId: tool.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
        fetchTools();
        if (flyoutTool?.id === tool.id) setFlyoutTool(data);
      }
    } catch { }
    finally { setReclassifyingId(null); }
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

    let av: string | number;
    let bv: string | number;

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

  const totalItems = displayedTools.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedTools = displayedTools.slice((page - 1) * pageSize, page * pageSize);
  const startItem = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalItems);

  // eslint-disable-next-line react-hooks/set-state-in-effect
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full text-text-primary">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-border dark:border-[#27272a] gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <RadarIcon size={16} className="text-accent" />
            <h1 className="text-lg font-serif font-semibold text-text-primary">Tool Classification Intelligence</h1>
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">Govern, assess, and audit artificial intelligence applications across the enterprise.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-wider bg-accent-dim/60 text-accent px-2.5 py-1 rounded border border-accent/20">
            NIST AI RMF Compliant
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Request & Classify Tool Panel */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm rounded-lg p-5 space-y-5">
            <div className="space-y-1">
              <h2 className="text-sm font-serif font-semibold text-zinc-900 dark:text-zinc-100">Classify New AI Tool</h2>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Submit an AI service name and its corporate use case. Gemini will automatically classify its risk tier, data categories, and NIST functions.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-mono uppercase tracking-widest text-zinc-700 dark:text-zinc-200 font-semibold">Tool Name</label>
                <div className="relative">
                  <input
                    className="w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-lg pl-3 pr-8 py-2 text-xs placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none focus:border-accent transition-colors"
                    placeholder="e.g. Grammarly, GitHub Copilot"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    required
                    disabled={loading}
                  />
                  {name && !loading && (
                    <button
                      type="button"
                      onClick={() => {
                        setName('');
                        setShowSuggestions(false);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-text-primary cursor-pointer p-0.5 rounded hover:bg-surface-hover transition-colors"
                      title="Clear Tool Name"
                    >
                      <X size={12} />
                    </button>
                  )}

                  {/* Autocomplete suggestions dropdown */}
                  {showSuggestions && autocompleteSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 z-50 mt-1 bg-surface border border-border dark:border-[#27272a] rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {autocompleteSuggestions.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setName(t.name);
                            setDescription(t.description);
                            setShowSuggestions(false);
                          }}
                          className="w-full text-left px-3 py-2 text-xs text-text-primary hover:bg-surface-hover transition-colors cursor-pointer border-b border-border/30 last:border-b-0"
                        >
                          <span className="font-semibold">{t.name}</span>
                          <span className="text-[10px] text-zinc-500 dark:text-zinc-400 ml-2 block sm:inline truncate max-w-[250px]">{t.description}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-mono uppercase tracking-widest text-zinc-700 dark:text-zinc-200 font-semibold">Intended Use Case</label>
                <div className="relative">
                  <input
                    className="w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-lg pl-3 pr-8 py-2 text-xs placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none focus:border-accent transition-colors"
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
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-text-primary cursor-pointer p-0.5 rounded hover:bg-surface-hover transition-colors"
                      title="Clear description"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Preset suggestions */}
              <div className="space-y-2">
                <span className="block text-[9px] font-mono uppercase tracking-widest text-zinc-500 dark:text-zinc-400 font-semibold">Quick Suggestions</span>
                <div className="flex flex-wrap gap-1.5">
                  {PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => {
                        setName(preset.name);
                        setDescription(preset.description);
                      }}
                      disabled={loading}
                      className="px-2.5 py-1 rounded-full text-[10px] font-mono bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-accent hover:border-accent transition-colors cursor-pointer disabled:opacity-30"
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-accent hover:bg-accent-hover rounded-lg px-4 py-2.5 transition-colors cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <><div className="size-3 border border-white border-t-transparent rounded-full animate-spin" /> Classifying Tool...</>
                ) : (
                  <><Search size={12} /> Classify Tool</>
                )}
              </button>
            </form>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-risk-high/10 border border-risk-high/30 text-risk-high text-xs rounded-lg px-3 py-2 animate-slide-in">
              {error}
            </div>
          )}

          {/* Result Card — styled success panel */}
          {result && (
            <div className="animate-slide-in bg-accent-dim/30 border border-accent/20 rounded-lg p-5 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="text-[9px] font-mono uppercase tracking-widest text-accent font-semibold">Latest Classification</span>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mt-1">{result.name}</p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">{result.description}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider ${result.riskTier === 'High' ? 'bg-risk-high-bg text-risk-high border border-risk-high/15' :
                      result.riskTier === 'Medium' ? 'bg-risk-medium-bg text-risk-medium border border-risk-medium/15' :
                        'bg-risk-low-bg text-risk-low border border-risk-low/15'
                    }`}>
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
                  <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-1">NIST Functions</p>
                  <div className="flex flex-wrap gap-1">
                    {result.nistFunctions.length > 0 ? result.nistFunctions.map((f) => (
                      <span key={f} className="px-1.5 py-0.5 rounded bg-background border border-border text-zinc-700 dark:text-zinc-300 text-[9px] font-mono">{f}</span>
                    )) : <span className="text-text-muted">—</span>}
                  </div>
                </div>
                <div>
                  <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-1">Data Categories</p>
                  <div className="flex flex-wrap gap-1">
                    {result.dataCategories.length > 0 ? result.dataCategories.map((c) => (
                      <span key={c} className="px-1.5 py-0.5 rounded bg-background border border-border text-zinc-700 dark:text-zinc-300 text-[9px] font-mono">{c}</span>
                    )) : <span className="text-text-muted">—</span>}
                  </div>
                </div>
              </div>

              <div className="text-xs space-y-2.5 pt-3 border-t border-border">
                <div>
                  <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-0.5">Justification</p>
                  <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed font-serif text-[11px]">{result.justification}</p>
                </div>
                <div>
                  <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-0.5">Recommended Policy</p>
                  <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed font-serif text-[11px] italic">&ldquo;{result.recommendedPolicy}&rdquo;</p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => exportToJson(result)}
                  className="flex items-center gap-1 text-[10px] font-medium text-zinc-700 dark:text-zinc-100 hover:text-accent bg-background border border-border rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer"
                >
                  <Download size={10} />
                  Export JSON
                </button>
                <button
                  type="button"
                  onClick={() => handlePrintReport(result)}
                  className="flex items-center gap-1 text-[10px] font-medium text-zinc-700 dark:text-zinc-100 hover:text-accent bg-background border border-border rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer"
                >
                  <Printer size={10} />
                  Print Report
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: "Tool Registry" Management Panel */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm rounded-lg overflow-hidden">
            {/* Filter bar & table header */}
            <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <h2 className="text-sm font-serif font-semibold text-zinc-900 dark:text-zinc-100">Enterprise Registry Matrix</h2>
                <p className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                  Showing {displayedTools.length} of {tools.length} audited applications
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Search field */}
                <div className="relative">
                  <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input
                    type="text"
                    placeholder="Search registry..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-lg pl-7 pr-3 py-1 text-xs placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none focus:border-accent w-40 transition-colors"
                  />
                </div>

                {/* Risks Dropdown */}
                <select
                  value={riskFilter}
                  onChange={(e) => setRiskFilter(e.target.value)}
                  className="bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-accent cursor-pointer transition-colors"
                >
                  <option value="all">All Risks</option>
                  <option value="Low">Low Risk</option>
                  <option value="Medium">Medium Risk</option>
                  <option value="High">High Risk</option>
                </select>

                {/* Statuses Dropdown */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-accent cursor-pointer transition-colors"
                >
                  <option value="all">All Statuses</option>
                  <option value="approved">Accept</option>
                  <option value="pending">Pending</option>
                  <option value="blocked">Decline</option>
                </select>
              </div>
            </div>

            {/* Registry Data Grid Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800">
                    <SortTh label="Name" sortKey="name" active={sortKey} dir={sortDir} onToggle={toggleSort} />
                    <SortTh label="Risk Tier" sortKey="riskTier" active={sortKey} dir={sortDir} onToggle={toggleSort} />
                    <th className="py-2.5 px-4 font-semibold text-zinc-800 dark:text-zinc-200 text-center">NIST Matrix</th>
                    <SortTh label="Policy Actions" sortKey="status" active={sortKey} dir={sortDir} onToggle={toggleSort} align="center" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/80">
                  {displayedTools.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-12 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <RadarIcon size={24} className="text-accent animate-radar-pulse" />
                          <span className="text-text-tertiary text-xs">No tools found matching your filters.</span>
                        </div>
                      </td>
                    </tr>
                  )}
                  {paginatedTools.map((t, i) => {
                    const isSelected = result?.id === t.id;
                    return (
                      <tr
                        key={t.id}
                        className={`transition-colors hover:bg-surface-hover/50 dark:hover:bg-white/[0.03] ${isSelected ? 'bg-accent-dim/20 dark:bg-accent-dim/10 border-l-2 border-l-accent font-medium' : ''
                          }`}
                      >
                        {/* Name column */}
                        <td className="py-3 px-4">
                          <button
                            onClick={(e) => { e.stopPropagation(); setFlyoutTool(t); }}
                            className="text-left group cursor-pointer"
                          >
                            <p className="font-semibold text-zinc-800 dark:text-white flex items-center gap-1 group-hover:text-accent transition-colors">
                              {t.name}
                              <ChevronRight size={10} className="text-text-muted group-hover:text-accent transition-transform group-hover:translate-x-0.5" />
                            </p>
                            <p className="text-[10px] text-zinc-600 dark:text-zinc-400 truncate max-w-[220px] mt-0.5 leading-normal pb-2" title={t.description}>
                              {t.description}
                            </p>
                          </button>
                        </td>

                        {/* Risk Tier column */}
                        <td className="py-3 px-4">
                          {t.riskTier ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider ${t.riskTier === 'High' ? 'bg-risk-high-bg dark:bg-rose-950/20 text-risk-high dark:text-rose-400 border border-risk-high/15 dark:border-rose-500/25' :
                                t.riskTier === 'Medium' ? 'bg-risk-medium-bg dark:bg-amber-950/20 text-risk-medium dark:text-amber-400 border border-risk-medium/15 dark:border-amber-500/25' :
                                  'bg-risk-low-bg dark:bg-emerald-950/20 text-risk-low dark:text-emerald-400 border border-risk-low/15 dark:border-emerald-500/25'
                              }`}>
                              {t.riskTier}
                            </span>
                          ) : (
                            <span className="text-text-muted">—</span>
                          )}
                        </td>

                        {/* NIST functions list */}
                        <td className="py-3 px-4 text-[10px] font-mono text-text-tertiary text-center">
                          <div className="flex flex-wrap gap-1 justify-center">
                            {t.nistFunctions.map((f) => (
                              <span key={f} className="px-1.5 py-0.5 rounded bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/60 text-[9px] text-zinc-700 dark:text-zinc-300">
                                {f.slice(0, 3)}
                              </span>
                            ))}
                            {t.nistFunctions.length === 0 && <span className="text-text-muted">—</span>}
                          </div>
                        </td>

                        {/* Policy actions */}
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center gap-2 justify-center">
                            <select
                                value={t.status}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  handleStatusChange(t.id, e.target.value as 'approved' | 'pending' | 'blocked');
                                }}
                                className={`rounded-lg px-2 py-1 text-[10px] font-mono font-bold uppercase focus:outline-none focus:border-accent transition-colors cursor-pointer bg-zinc-50 dark:bg-zinc-950 border ${
                                  t.status === 'approved'
                                    ? 'text-risk-low dark:text-emerald-400 border-risk-low/30 dark:border-emerald-500/30'
                                    : t.status === 'blocked'
                                    ? 'text-risk-high dark:text-rose-400 border-risk-high/30 dark:border-rose-500/30'
                                    : 'text-risk-medium dark:text-amber-400 border-risk-medium/30 dark:border-amber-400/30'
                                }`}
                              >
                                <option value="pending" className="text-risk-medium bg-background">Pending</option>
                                <option value="approved" className="text-risk-low bg-background">Approved</option>
                                <option value="blocked" className="text-risk-high bg-background">Blocked</option>
                              </select>

                            {/* Additional paired actions */}
                            <div className="flex items-center gap-1 ml-auto">
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleReclassify(t); }}
                                title="Re-classify with Gemini"
                                disabled={reclassifyingId === t.id}
                                className="text-text-secondary hover:text-accent p-1 rounded hover:bg-surface-hover transition-colors cursor-pointer flex items-center justify-center disabled:opacity-40"
                              >
                                <RotateCw size={12} className={reclassifyingId === t.id ? 'animate-spin' : ''} />
                              </button>
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
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Pagination Footer */}
            <div className="px-5 pb-4">
              <div className="w-full flex items-center justify-between pt-4 mt-2 border-t border-zinc-100 dark:border-zinc-800 text-sm text-zinc-500 dark:text-zinc-400">
                <div className="flex items-center">
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    className="inline-flex items-center gap-1 border border-zinc-200 dark:border-zinc-700 px-2 py-1 rounded bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 ml-1 cursor-pointer focus:outline-none text-xs"
                  >
                    <option value={5}>Rows per page: 5</option>
                    <option value={10}>Rows per page: 10</option>
                    <option value={20}>Rows per page: 20</option>
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs">{startItem} - {endItem} of {totalItems}</span>
                  <div className="flex items-center gap-1 font-mono text-xs">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className={`px-2 py-1 transition-colors ${page === 1 ? 'opacity-35 cursor-not-allowed' : 'hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer'}`}
                      title="Previous Page"
                    >
                      &lt;
                    </button>
                    {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pNum) => {
                      const isActive = pNum === page;
                      return (
                        <button
                          key={pNum}
                          onClick={() => setPage(pNum)}
                          className={isActive
                            ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium px-2.5 py-1 rounded-md cursor-default"
                            : "hover:text-zinc-800 dark:hover:text-zinc-200 px-2 py-1 cursor-pointer transition-colors"
                          }
                        >
                          {pNum}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className={`px-2 py-1 transition-colors ${page === totalPages ? 'opacity-35 cursor-not-allowed' : 'hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer'}`}
                      title="Next Page"
                    >
                      &gt;
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tool Detail Flyout */}
      {flyoutTool && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(1px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setFlyoutTool(null); }}
        >
          <div className="bg-surface border-l border-border h-full w-[420px] overflow-y-auto animate-slide-in p-6 space-y-6 shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-border">
              <div className="min-w-0">
                <h3 className="text-base font-serif font-semibold text-text-primary truncate">{flyoutTool.name}</h3>
                <p className="text-[10px] font-mono text-text-muted mt-0.5">ID: {flyoutTool.id}</p>
              </div>
              <button
                onClick={() => setFlyoutTool(null)}
                className="text-zinc-750 dark:text-zinc-100 hover:text-accent transition-colors cursor-pointer mt-0.5 px-2 py-1 rounded hover:bg-surface-hover text-xs font-mono"
              >
                CLOSE
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto space-y-5 pr-1">
              <div>
                <h4 className="text-[10px] font-mono uppercase tracking-widest text-zinc-700 dark:text-zinc-200">Description</h4>
                <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed mt-1">{flyoutTool.description}</p>
              </div>

              <div className="flex items-center gap-6">
                <div>
                  <h4 className="text-[10px] font-mono uppercase tracking-widest text-zinc-700 dark:text-zinc-200">Risk Assessment</h4>
                  <div className="mt-1">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider ${flyoutTool.riskTier === 'High' ? 'bg-risk-high-bg text-risk-high border border-risk-high/15' :
                        flyoutTool.riskTier === 'Medium' ? 'bg-risk-medium-bg text-risk-medium border border-risk-medium/15' :
                          'bg-risk-low-bg text-risk-low border border-risk-low/15'
                      }`}>
                      {flyoutTool.riskTier}
                    </span>
                  </div>
                </div>
                <div>
                  <h4 className="text-[10px] font-mono uppercase tracking-widest text-zinc-700 dark:text-zinc-200">Governance Status</h4>
                  <div className="mt-1">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[9px] font-mono font-bold uppercase tracking-wider ${flyoutTool.status === 'approved' ? 'border-risk-low/15 bg-risk-low-bg text-risk-low' :
                        flyoutTool.status === 'blocked' ? 'border-risk-high/15 bg-risk-high-bg text-risk-high' :
                          'border-risk-medium/15 bg-risk-medium-bg text-risk-medium'
                      }`}>
                      {flyoutTool.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* NIST functions & Data categories */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-[10px] font-mono uppercase tracking-widest text-zinc-700 dark:text-zinc-200 mb-1.5">NIST Functions</h4>
                  <div className="flex flex-wrap gap-1">
                    {flyoutTool.nistFunctions.map(f => (
                      <span key={f} className="px-1.5 py-0.5 rounded bg-background border border-border text-zinc-700 dark:text-zinc-300 text-[9px] font-mono">{f}</span>
                    ))}
                    {flyoutTool.nistFunctions.length === 0 && <span className="text-text-muted text-[10px]">—</span>}
                  </div>
                </div>
                <div>
                  <h4 className="text-[10px] font-mono uppercase tracking-widest text-zinc-700 dark:text-zinc-200 mb-1.5">Data Categories</h4>
                  <div className="flex flex-wrap gap-1">
                    {flyoutTool.dataCategories.map(c => (
                      <span key={c} className="px-1.5 py-0.5 rounded bg-background border border-border text-zinc-700 dark:text-zinc-300 text-[9px] font-mono">{c}</span>
                    ))}
                    {flyoutTool.dataCategories.length === 0 && <span className="text-text-muted text-[10px]">—</span>}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-[10px] font-mono uppercase tracking-widest text-zinc-700 dark:text-zinc-200">Risk Justification</h4>
                <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed bg-background border border-border rounded-lg p-3 mt-1.5 font-serif">{flyoutTool.justification || '—'}</p>
              </div>

              <div>
                <h4 className="text-[10px] font-mono uppercase tracking-widest text-zinc-700 dark:text-zinc-200">Recommended Policy</h4>
                <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed bg-background border border-border rounded-lg p-3 mt-1.5 font-serif italic">&ldquo;{flyoutTool.recommendedPolicy || '—'}&rdquo;</p>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-auto pt-4 border-t border-border flex items-center justify-between text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
              <span>Added {new Date(flyoutTool.createdAt).toLocaleDateString()}</span>
              <button
                onClick={() => handleReclassify(flyoutTool)}
                disabled={reclassifyingId === flyoutTool.id}
                className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-700 dark:text-zinc-100 hover:text-accent border border-border rounded px-3 py-1.5 hover:bg-surface-hover transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <RotateCw size={11} className={reclassifyingId === flyoutTool.id ? 'animate-spin' : ''} />
                Re-classify
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
