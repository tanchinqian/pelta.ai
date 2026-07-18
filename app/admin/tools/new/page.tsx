'use client';

import { useState, useEffect } from 'react';
import { Lightbulb, Search, ArrowUpDown, ArrowUp, ArrowDown, X, Trash2, Download, Printer, RotateCw, ChevronRight, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import RadarIcon from '@/components/RadarIcon';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

interface ToolRecord {
  id: string; name: string; description: string; status: string;
  riskTier: string | null; nistFunctions: string[]; dataCategories: string[];
  justification: string; recommendedPolicy: string; createdAt: string;
  retrievedNistContext?: {
    function: string;
    definition: string;
    concerns: string[];
    score: number;
    matchedKeywords: string[];
  }[];
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

const isHeuristic = (justification: string) => {
  return /heuristic|llm unavailable/i.test(justification || '');
};

const formSchema = z.object({
  name: z.string().min(1, 'Tool name is required'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
});
type FormValues = z.infer<typeof formSchema>;

export default function ClassifyToolPage() {
  const { register, handleSubmit, setValue, watch, formState: { errors }, clearErrors } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', description: '' },
  });
  const name = watch('name');
  const description = watch('description');

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
  const [showGrounded, setShowGrounded] = useState(false);

  const autocompleteSuggestions = (name || '').trim()
    ? tools.filter(
        (t) =>
          t.name.toLowerCase().startsWith((name || '').toLowerCase()) &&
          t.name.toLowerCase() !== (name || '').toLowerCase()
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
      toast.success(`Status updated to ${newStatus}`);
      fetchTools();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update status');
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
      toast.success('Tool deleted successfully');
      fetchTools();
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete tool');
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
        toast.success(`${tool.name} re-classified successfully`);
        if (flyoutTool?.id === tool.id) setFlyoutTool(data);
      } else {
        toast.error(data.error ?? 'Re-classification failed');
      }
    } catch (err) {
      toast.error('Failed to re-classify tool');
    }
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

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchTools(); }, []);

  const onSubmit = async (data: FormValues) => {
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch('/api/tools/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: data.name.trim(), description: data.description.trim() }),
      });
      const responseData = await res.json();
      if (!res.ok) throw new Error(responseData.error ?? 'Classification failed');
      setResult(responseData);
      setValue('name', '');
      setValue('description', '');
      clearErrors();
      fetchTools();
      toast.success(`${responseData.name} classified successfully`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      toast.error(msg);
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
      <form onSubmit={handleSubmit(onSubmit)} className="panel p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-1">Tool Name</label>
            <div className="relative">
              <input
                {...register('name', {
                  onChange: () => setShowSuggestions(true),
                  onBlur: () => setTimeout(() => setShowSuggestions(false), 200)
                })}
                className={`w-full bg-background border rounded pl-3 pr-8 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none transition-colors ${errors.name ? 'border-risk-high focus:border-risk-high' : 'border-border focus:border-accent'}`}
                placeholder="e.g. Grammarly, GitHub Copilot"
                disabled={loading}
              />
              {name && !loading && (
                <button
                  type="button"
                  onClick={() => {
                    setValue('name', '');
                    setShowSuggestions(false);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary cursor-pointer p-0.5 rounded hover:bg-surface-hover transition-colors"
                  title="Clear Tool Name"
                >
                  <X size={12} />
                </button>
              )}
              {errors.name && <p className="text-[10px] text-risk-high mt-1">{errors.name.message}</p>}

              {/* Autocomplete suggestions dropdown */}
              {showSuggestions && autocompleteSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 z-50 mt-1 bg-surface border border-border rounded shadow-md max-h-48 overflow-y-auto">
                  {autocompleteSuggestions.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setValue('name', t.name);
                        setValue('description', t.description);
                        clearErrors();
                        setShowSuggestions(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs text-text-primary hover:bg-surface-hover transition-colors cursor-pointer border-b border-border/30 last:border-b-0"
                    >
                      <span className="font-semibold">{t.name}</span>
                      <span className="text-[10px] text-text-tertiary ml-2 block sm:inline truncate max-w-[250px]">{t.description}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-1">What is it used for?</label>
            <div className="relative">
              <input
                {...register('description')}
                className={`w-full bg-background border rounded pl-3 pr-8 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none transition-colors ${errors.description ? 'border-risk-high focus:border-risk-high' : 'border-border focus:border-accent'}`}
                placeholder="e.g. AI writing assistant for customer emails"
                disabled={loading}
              />
              {description && !loading && (
                <button
                  type="button"
                  onClick={() => setValue('description', '')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary cursor-pointer p-0.5 rounded hover:bg-surface-hover transition-colors"
                  title="Clear description"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            {errors.description && <p className="text-[10px] text-risk-high mt-1">{errors.description.message}</p>}
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
                setValue('name', preset.name);
                setValue('description', preset.description);
                clearErrors();
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
              {result.justification && (
                <span className={`text-[9px] font-semibold font-mono px-1.5 py-0.5 rounded border ${
                  isHeuristic(result.justification) ? 'bg-background border-border text-text-tertiary' : 'bg-accent/15 border-accent/25 text-accent'
                }`}>
                  {isHeuristic(result.justification) ? '≈ Heuristic' : '⚡ Gemini AI'}
                </span>
              )}
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

          {/* Grounded in NIST AI RMF */}
          {result.retrievedNistContext && result.retrievedNistContext.length > 0 && (
            <div className="border-t border-border pt-2">
              <button
                type="button"
                onClick={() => setShowGrounded((v) => !v)}
                className="w-full flex items-center justify-between text-left hover:bg-surface-hover/50 rounded px-2 py-1.5 -mx-2 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  <BookOpen size={12} className="text-accent" />
                  <span className="text-[11px] font-semibold text-text-secondary">Grounded in NIST AI RMF</span>
                  <span className="text-[10px] font-mono text-text-tertiary">
                    ({result.retrievedNistContext.length} retrieved)
                  </span>
                </div>
                {showGrounded ? <ChevronUp size={12} className="text-text-tertiary" /> : <ChevronDown size={12} className="text-text-tertiary" />}
              </button>

              {showGrounded && (
                <div className="space-y-2 mt-2 animate-slide-in">
                  {result.retrievedNistContext.map((ctx) => (
                    <div key={ctx.function} className="bg-background border border-border rounded p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold font-mono text-text-primary">{ctx.function}</span>
                        {ctx.score > 0 && (
                          <span className="text-[9px] font-mono text-text-tertiary">
                            score {ctx.score} · {ctx.matchedKeywords.slice(0, 3).join(', ')}
                            {ctx.matchedKeywords.length > 3 && ` +${ctx.matchedKeywords.length - 3}`}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-text-secondary leading-relaxed mt-1">{ctx.definition}</p>
                      {ctx.concerns.length > 0 && (
                        <p className="text-[10px] text-text-tertiary italic mt-1 line-clamp-2">
                          {ctx.concerns[0]}
                        </p>
                      )}
                    </div>
                  ))}
                  <p className="text-[9px] text-text-tertiary font-mono">
                    Source: NIST AI RMF Playbook (via keyword retrieval over derived function reference).
                    {' '}
                    <a
                      href="https://www.nist.gov/itl/ai-risk-management-framework"
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent hover:text-accent-hover"
                    >
                      NIST AI RMF ↗
                    </a>
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 pt-3 border-t border-border/60">
            <button
              type="button"
              onClick={() => exportToJson(result)}
              className="flex items-center gap-1 text-[10px] font-medium text-text-secondary hover:text-text-primary bg-background border border-border rounded px-2.5 py-1.5 transition-colors cursor-pointer"
            >
              <Download size={10} />
              Export JSON
            </button>
            <button
              type="button"
              onClick={() => handlePrintReport(result)}
              className="flex items-center gap-1 text-[10px] font-medium text-text-secondary hover:text-text-primary bg-background border border-border rounded px-2.5 py-1.5 transition-colors cursor-pointer"
            >
              <Printer size={10} />
              Print Report
            </button>
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
                    className={`border-b border-border/40 hover:bg-surface-hover/70 transition-colors ${
                      isSelected ? 'bg-[var(--accent-dim)] border-l-2 border-l-[var(--accent)] font-medium' : i % 2 === 1 ? 'bg-surface-hover/20' : ''
                    }`}
                  >
                    <td className="py-2 px-4">
                      <button
                        onClick={(e) => { e.stopPropagation(); setFlyoutTool(t); }}
                        className="text-left hover:underline decoration-border"
                      >
                        <div className="font-medium text-text-primary flex items-center gap-1.5 flex-wrap">
                          <span>{t.name}</span>
                          {t.justification && (
                            <span className={`text-[8px] font-semibold font-mono px-1 rounded-sm border leading-none py-0.5 ${
                              isHeuristic(t.justification) ? 'bg-surface border-border text-text-tertiary' : 'bg-accent/10 border-accent/20 text-accent'
                            }`}>
                              {isHeuristic(t.justification) ? 'Heuristic' : 'Gemini'}
                            </span>
                          )}
                          <ChevronRight size={10} className="text-text-muted" />
                        </div>
                        <p className="text-[10px] text-text-tertiary truncate max-w-[200px]">{t.description}</p>
                      </button>
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
                            handleStatusChange(t.id, e.target.value as 'approved' | 'pending' | 'blocked');
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
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tool Detail Flyout */}
      {flyoutTool && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(1px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setFlyoutTool(null); }}
        >
          <div className="bg-surface border-l border-border h-full w-full max-w-sm overflow-y-auto animate-slide-in p-5 space-y-4 shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-text-primary truncate">{flyoutTool.name}</p>
                <p className="text-[11px] text-text-tertiary mt-0.5 leading-relaxed">{flyoutTool.description}</p>
              </div>
              <button onClick={() => setFlyoutTool(null)} className="text-text-tertiary hover:text-text-primary transition-colors cursor-pointer mt-0.5 shrink-0">
                <X size={14} />
              </button>
            </div>

            {/* Risk + Status */}
            <div className="flex items-center gap-2">
              {flyoutTool.riskTier && (
                <span className="text-[10px] font-bold font-mono uppercase px-2 py-0.5 rounded"
                  style={{ color: RISK[flyoutTool.riskTier], background: `color-mix(in srgb, ${RISK[flyoutTool.riskTier]} 10%, transparent)` }}>
                  {flyoutTool.riskTier} Risk
                </span>
              )}
              <span className={`text-[10px] font-bold font-mono uppercase px-2 py-0.5 rounded border ${
                flyoutTool.status === 'approved' ? 'text-risk-low border-risk-low/30 bg-risk-low/10' :
                flyoutTool.status === 'blocked' ? 'text-risk-high border-risk-high/30 bg-risk-high/10' :
                'text-risk-medium border-risk-medium/30 bg-risk-medium/10'
              }`}>
                {flyoutTool.status}
              </span>
              {flyoutTool.justification && (
                <span className={`text-[9px] font-semibold font-mono px-1.5 py-0.5 rounded border ${
                  isHeuristic(flyoutTool.justification) ? 'bg-surface border-border text-text-tertiary' : 'bg-accent/15 border-accent/25 text-accent'
                }`}>
                  {isHeuristic(flyoutTool.justification) ? '≈ Heuristic' : '⚡ Gemini AI'}
                </span>
              )}
            </div>

            {/* NIST + Data */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-1.5">NIST Functions</p>
                <div className="flex flex-wrap gap-1">
                  {flyoutTool.nistFunctions.length > 0
                    ? flyoutTool.nistFunctions.map((f) => (
                        <span key={f} className="px-1.5 py-0.5 rounded bg-background border border-border text-text-secondary text-[10px] font-mono">{f}</span>
                      ))
                    : <span className="text-text-muted text-[10px]">—</span>}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-1.5">Data Categories</p>
                <div className="flex flex-wrap gap-1">
                  {flyoutTool.dataCategories.length > 0
                    ? flyoutTool.dataCategories.map((c) => (
                        <span key={c} className="px-1.5 py-0.5 rounded bg-background border border-border text-text-secondary text-[10px] font-mono">{c}</span>
                      ))
                    : <span className="text-text-muted text-[10px]">—</span>}
                </div>
              </div>
            </div>

            {/* Justification */}
            <div>
              <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-1.5">Justification</p>
              <p className="text-xs text-text-secondary leading-relaxed bg-background border border-border rounded p-2.5">{flyoutTool.justification || '—'}</p>
            </div>

            {/* Recommended Policy */}
            <div>
              <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-1.5">Recommended Policy</p>
              <p className="text-xs text-text-secondary leading-relaxed bg-background border border-border rounded p-2.5">{flyoutTool.recommendedPolicy || '—'}</p>
            </div>

            {/* Footer */}
            <div className="mt-auto pt-4 border-t border-border flex items-center justify-between">
              <span className="text-[10px] font-mono text-text-muted">
                Added {new Date(flyoutTool.createdAt).toLocaleDateString('en-SG', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              <button
                onClick={() => handleReclassify(flyoutTool)}
                disabled={reclassifyingId === flyoutTool.id}
                className="flex items-center gap-1.5 text-[11px] font-medium text-text-secondary hover:text-text-primary border border-border rounded px-3 py-1.5 hover:bg-surface-hover transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
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
