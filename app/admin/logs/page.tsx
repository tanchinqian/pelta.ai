'use client';

import { useState, useEffect, useMemo, Fragment } from 'react';
import { Filter, Search, ChevronDown, ChevronUp, Download, RefreshCw } from 'lucide-react';
import RadarIcon from '@/components/RadarIcon';
import { renderHighlightedText, listDetectedPatterns } from '@/lib/highlightUtils';

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

const VERDICT_COLOR: Record<string, string> = {
  allow: 'var(--risk-low)',
  flag: 'var(--risk-medium)',
  block: 'var(--risk-high)',
};

const DATA_CAT_COLOR: Record<string, string> = {
  PII: '#818cf8',
  Financial: '#c084fc',
  'Source Code': '#22d3ee',
  None: '#64748b',
};

export default function LogsPage() {
  const [logs, setLogs] = useState<GuardLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filterVerdict, setFilterVerdict] = useState<string>('all');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [filterRisk, setFilterRisk] = useState<string>('all');
  const [filterTool, setFilterTool] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  const fetchLogs = async () => {
    const res = await fetch('/api/logs');
    if (res.ok) setLogs(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchLogs(); }, []);

  const tools = useMemo(() => {
    const names = new Set<string>();
    logs.forEach((l) => { if (l.tool) names.add(l.tool); });
    return [...names].sort();
  }, [logs]);

  const filtered = useMemo(() => {
    const fromTs = dateFrom ? new Date(dateFrom).getTime() : 0;
    const toTs = dateTo ? new Date(dateTo).getTime() + 24 * 60 * 60 * 1000 : Infinity;
    return [...logs]
      .reverse()
      .filter((l) => filterVerdict === 'all' || l.verdict === filterVerdict)
      .filter((l) => filterSource === 'all' || (l.source ?? 'manual') === filterSource)
      .filter((l) => filterRisk === 'all' || l.riskLevel === filterRisk)
      .filter((l) => filterTool === 'all' || l.tool === filterTool)
      .filter((l) => {
        const ts = new Date(l.timestamp).getTime();
        return ts >= fromTs && ts <= toTs;
      })
      .filter((l) => !search || l.promptSnippet.toLowerCase().includes(search.toLowerCase()) || l.reason.toLowerCase().includes(search.toLowerCase()));
  }, [logs, filterVerdict, filterSource, filterRisk, filterTool, dateFrom, dateTo, search]);

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [filterVerdict, filterSource, filterRisk, filterTool, dateFrom, dateTo, search]);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pelta-logs-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <RadarIcon size={32} className="text-accent animate-radar-pulse" />
        <span className="text-xs text-text-tertiary font-mono">Loading audit trail...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 max-w-[1400px] mx-auto w-full space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RadarIcon size={14} className="text-accent" />
          <span className="text-sm font-semibold text-text-primary">Detection Logs</span>
          <span className="text-[10px] font-mono text-text-tertiary">/ {logs.length} events</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportJson} className="flex items-center gap-1 text-[10px] font-mono text-text-secondary hover:text-text-primary border border-border rounded px-2 py-1 transition-colors cursor-pointer">
            <Download size={11} /> Export
          </button>
          <button onClick={fetchLogs} className="p-1.5 rounded border border-border hover:bg-surface-hover transition-colors cursor-pointer">
            <RefreshCw size={12} className="text-text-secondary" />
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="panel p-2 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 text-[10px] font-mono text-text-tertiary">
            <Filter size={11} /> Filters:
          </div>
          <select value={filterVerdict} onChange={(e) => setFilterVerdict(e.target.value)} className="text-[10px] font-mono bg-background border border-border rounded px-2 py-1 text-text-primary focus:outline-none focus:border-accent cursor-pointer">
            <option value="all">All verdicts</option>
            <option value="allow">Allow</option>
            <option value="flag">Flag</option>
            <option value="block">Block</option>
          </select>
          <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} className="text-[10px] font-mono bg-background border border-border rounded px-2 py-1 text-text-primary focus:outline-none focus:border-accent cursor-pointer">
            <option value="all">All sources</option>
            <option value="extension">Extension</option>
            <option value="manual">Manual</option>
          </select>
          <select value={filterRisk} onChange={(e) => setFilterRisk(e.target.value)} className="text-[10px] font-mono bg-background border border-border rounded px-2 py-1 text-text-primary focus:outline-none focus:border-accent cursor-pointer">
            <option value="all">All risks</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="none">None</option>
          </select>
          <select value={filterTool} onChange={(e) => setFilterTool(e.target.value)} className="text-[10px] font-mono bg-background border border-border rounded px-2 py-1 text-text-primary focus:outline-none focus:border-accent cursor-pointer">
            <option value="all">All tools</option>
            {tools.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <div className="flex items-center gap-1 ml-auto">
            <Search size={11} className="text-text-muted" />
            <input
              type="text"
              placeholder="Search snippet or reason..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-[11px] bg-background border border-border rounded px-2 py-1 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent w-56"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-2">
          <span className="text-[10px] font-mono text-text-tertiary">Date range:</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="text-[10px] font-mono bg-background border border-border rounded px-2 py-1 text-text-primary focus:outline-none focus:border-accent cursor-pointer"
          />
          <span className="text-[10px] text-text-muted">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="text-[10px] font-mono bg-background border border-border rounded px-2 py-1 text-text-primary focus:outline-none focus:border-accent cursor-pointer"
          />
          {(filterVerdict !== 'all' || filterSource !== 'all' || filterRisk !== 'all' || filterTool !== 'all' || dateFrom || dateTo || search) && (
            <button
              onClick={() => {
                setFilterVerdict('all');
                setFilterSource('all');
                setFilterRisk('all');
                setFilterTool('all');
                setDateFrom('');
                setDateTo('');
                setSearch('');
              }}
              className="text-[10px] font-mono text-text-secondary hover:text-text-primary ml-auto transition-colors cursor-pointer"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Log table */}
      <div className="panel overflow-hidden">
        <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 270px)' }}>
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-surface z-10">
              <tr className="text-left text-text-secondary border-b border-border">
                <th className="px-3 py-2 font-medium">Time</th>
                <th className="px-3 py-2 font-medium">Verdict</th>
                <th className="px-3 py-2 font-medium">Risk</th>
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 font-medium hidden md:table-cell">Tool</th>
                <th className="px-3 py-2 font-medium hidden md:table-cell">Method</th>
                <th className="px-3 py-2 font-medium hidden lg:table-cell">Category</th>
                <th className="px-3 py-2 font-medium">Snippet</th>
                <th className="px-3 py-2 font-medium w-8"></th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 && (
                <tr><td colSpan={9} className="py-12 text-center text-text-tertiary">No log entries match filters.</td></tr>
              )}
              {paginated.map((l, i) => (
                <Fragment key={l.id}>
                  <tr
                    onClick={() => setExpanded(expanded === l.id ? null : l.id)}
                    className={`border-b border-border/40 hover:bg-surface-hover/50 transition-colors cursor-pointer ${i % 2 === 1 ? 'bg-surface-hover/20' : ''} ${expanded === l.id ? 'bg-surface-hover/30' : ''}`}
                  >
                    <td className="px-3 py-2 text-[10px] font-mono text-text-tertiary whitespace-nowrap">
                      {new Date(l.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-[10px] font-bold font-mono uppercase" style={{ color: VERDICT_COLOR[l.verdict] }}>{l.verdict}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-[10px] font-mono uppercase" style={{ color: VERDICT_COLOR[l.verdict] }}>{l.riskLevel}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`text-[10px] font-mono ${l.source === 'extension' ? 'text-accent' : 'text-text-tertiary'}`}>
                        {l.source ?? 'manual'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[10px] font-mono text-text-secondary hidden md:table-cell">{l.tool ?? '—'}</td>
                    <td className="px-3 py-2 text-[10px] font-mono text-text-tertiary hidden md:table-cell">{l.detectionMethod}</td>
                    <td className="px-3 py-2 hidden lg:table-cell">
                      <span className="text-[10px] font-mono" style={{ color: DATA_CAT_COLOR[l.dataCategory] ?? '#64748b' }}>{l.dataCategory}</span>
                    </td>
                    <td className="px-3 py-2 text-[10px] font-mono text-text-tertiary truncate max-w-[260px]">{l.promptSnippet}</td>
                    <td className="px-3 py-2 text-text-muted">
                      {expanded === l.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </td>
                  </tr>
                  {expanded === l.id && (
                    <tr className="bg-surface-hover/20">
                      <td colSpan={9} className="px-4 py-3">
                        <ExpandedDetail log={l} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-surface/40">
          <span className="text-[10px] font-mono text-text-tertiary">
            {filtered.length === 0 ? '0 results' : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)} of ${filtered.length}`}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="text-[10px] font-mono px-2 py-1 rounded border border-border hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              Previous
            </button>
            <span className="text-[10px] font-mono text-text-secondary px-2">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="text-[10px] font-mono px-2 py-1 rounded border border-border hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExpandedDetail({ log }: { log: GuardLog }) {
  const patterns = listDetectedPatterns(log.promptSnippet);
  return (
    <div className="space-y-3 animate-slide-in">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <DetailField label="Log ID" value={log.id.slice(0, 8)} mono />
        <DetailField label="Timestamp" value={new Date(log.timestamp).toLocaleString()} mono />
        <DetailField label="Source" value={log.source ?? 'manual'} mono />
        <DetailField label="Tool" value={log.tool ?? '—'} mono />
      </div>

      <div>
        <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-1">Reason</p>
        <p className="text-xs text-text-secondary leading-relaxed">{log.reason}</p>
      </div>

      {patterns.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-1">Detected Patterns</p>
          <div className="flex flex-wrap gap-1.5">
            {patterns.map((p, i) => (
              <span
                key={i}
                className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                  p.severity === 'high'
                    ? 'text-risk-high border-risk-high/30 bg-risk-high/10'
                    : 'text-risk-medium border-risk-medium/30 bg-risk-medium/10'
                }`}
              >
                {p.label} · {p.severity}
              </span>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-1">Prompt Snippet</p>
        <div className="bg-background border border-border rounded-lg p-3">
          <p className="text-[11px] font-mono text-text-secondary leading-relaxed break-all">
            {renderHighlightedText(log.promptSnippet)}
          </p>
        </div>
      </div>
    </div>
  );
}

function DetailField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[9px] font-semibold text-text-tertiary uppercase tracking-wider">{label}</p>
      <p className={`text-[11px] text-text-secondary mt-0.5 ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}
