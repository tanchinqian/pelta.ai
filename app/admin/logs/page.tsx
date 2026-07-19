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
  PII: 'var(--data-pii)',
  Financial: 'var(--data-financial)',
  'Source Code': 'var(--data-source-code)',
  None: 'var(--data-none)',
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
        <span className="text-sm text-text-tertiary font-mono">Loading audit trail...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 lg:p-6 max-w-7xl mx-auto w-full space-y-4 text-zinc-900 dark:text-zinc-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800 gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <RadarIcon size={16} className="text-accent" />
            <h1 className="text-xl font-serif font-semibold text-zinc-900 dark:text-zinc-100">Detection Logs</h1>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{logs.length} audit events tracked across the governance system.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportJson} className="flex items-center gap-1 text-base font-medium text-zinc-700 dark:text-zinc-100 hover:text-accent bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-1.5 transition-colors cursor-pointer">
            <Download size={12} /> Export
          </button>
          <button onClick={fetchLogs} className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 hover:bg-surface-hover transition-colors cursor-pointer">
            <RefreshCw size={13} className="text-zinc-600 dark:text-zinc-400" />
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm rounded-lg p-3 space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 text-sm font-mono text-zinc-500 dark:text-zinc-400">
            <Filter size={12} /> Filters:
          </div>
          <select value={filterVerdict} onChange={(e) => setFilterVerdict(e.target.value)} className="text-sm font-mono bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1 focus:outline-none focus:border-accent cursor-pointer transition-colors">
            <option value="all">All verdicts</option>
            <option value="allow">Allow</option>
            <option value="flag">Flag</option>
            <option value="block">Block</option>
          </select>
          <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} className="text-sm font-mono bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1 focus:outline-none focus:border-accent cursor-pointer transition-colors">
            <option value="all">All sources</option>
            <option value="extension">Extension</option>
            <option value="manual">Manual</option>
          </select>
          <select value={filterRisk} onChange={(e) => setFilterRisk(e.target.value)} className="text-sm font-mono bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1 focus:outline-none focus:border-accent cursor-pointer transition-colors">
            <option value="all">All risks</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="none">None</option>
          </select>
          <select value={filterTool} onChange={(e) => setFilterTool(e.target.value)} className="text-sm font-mono bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1 focus:outline-none focus:border-accent cursor-pointer transition-colors">
            <option value="all">All tools</option>
            {tools.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <div className="flex items-center gap-1.5 ml-auto">
            <Search size={12} className="text-zinc-400 dark:text-zinc-500" />
            <input
              type="text"
              placeholder="Search snippet or reason..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-base bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-lg pl-3 pr-3 py-1 placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none focus:border-accent w-56 transition-colors"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-zinc-200 dark:border-zinc-800 pt-2.5">
          <span className="text-sm font-mono text-zinc-500 dark:text-zinc-400">Date range:</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="text-sm font-mono bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1 focus:outline-none focus:border-accent cursor-pointer transition-colors"
          />
          <span className="text-sm text-zinc-500 dark:text-zinc-400">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="text-sm font-mono bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1 focus:outline-none focus:border-accent cursor-pointer transition-colors"
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
              className="text-sm font-mono text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 ml-auto transition-colors cursor-pointer"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Log table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm rounded-lg overflow-hidden">
        <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 270px)' }}>
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-zinc-100 dark:bg-zinc-800 z-10">
              <tr className="text-left text-zinc-700 dark:text-zinc-200 border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-3 py-2.5 font-semibold">Time</th>
                <th className="px-3 py-2.5 font-semibold">Verdict</th>
                <th className="px-3 py-2.5 font-semibold">Risk</th>
                <th className="px-3 py-2.5 font-semibold">Source</th>
                <th className="px-3 py-2.5 font-semibold hidden md:table-cell">Tool</th>
                <th className="px-3 py-2.5 font-semibold hidden md:table-cell">Method</th>
                <th className="px-3 py-2.5 font-semibold hidden lg:table-cell">Category</th>
                <th className="px-3 py-2.5 font-semibold">Snippet</th>
                <th className="px-3 py-2.5 font-semibold w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/80">
              {paginated.length === 0 && (
                <tr><td colSpan={9} className="py-12 text-center text-zinc-500 dark:text-zinc-400">No log entries match filters.</td></tr>
              )}
              {paginated.map((l, i) => (
                <Fragment key={l.id}>
                  <tr
                    onClick={() => setExpanded(expanded === l.id ? null : l.id)}
                    className={`hover:bg-zinc-50 dark:hover:bg-white/[0.03] transition-colors cursor-pointer ${i % 2 === 1 ? 'bg-zinc-50/50 dark:bg-white/[0.02]' : ''} ${expanded === l.id ? 'bg-zinc-100 dark:bg-white/[0.04]' : ''}`}
                  >
                    <td className="px-3 py-2 text-sm font-mono text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                      {new Date(l.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-sm font-bold font-mono uppercase" style={{ color: VERDICT_COLOR[l.verdict] }}>{l.verdict}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-sm font-mono uppercase" style={{ color: VERDICT_COLOR[l.verdict] }}>{l.riskLevel}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`text-sm font-mono ${l.source === 'extension' ? 'text-accent' : 'text-zinc-500 dark:text-zinc-400'}`}>
                        {l.source ?? 'manual'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-sm font-mono text-zinc-600 dark:text-zinc-300 hidden md:table-cell">{l.tool ?? '—'}</td>
                    <td className="px-3 py-2 text-sm font-mono text-zinc-500 dark:text-zinc-400 hidden md:table-cell">{l.detectionMethod}</td>
                    <td className="px-3 py-2 hidden lg:table-cell">
                      <span className="text-sm font-mono" style={{ color: DATA_CAT_COLOR[l.dataCategory] ?? '#64748b' }}>{l.dataCategory}</span>
                    </td>
                    <td className="px-3 py-2 text-sm font-mono text-zinc-500 dark:text-zinc-400 truncate max-w-[260px]">{l.promptSnippet}</td>
                    <td className="px-3 py-2 text-zinc-400 dark:text-zinc-500">
                      {expanded === l.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </td>
                  </tr>
                  {expanded === l.id && (
                    <tr className="bg-zinc-50/50 dark:bg-white/[0.02]">
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
        <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-white/[0.02]">
          <span className="text-sm font-mono text-zinc-500 dark:text-zinc-400">
            {filtered.length === 0 ? '0 results' : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)} of ${filtered.length}`}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="text-sm font-mono px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              Previous
            </button>
            <span className="text-sm font-mono text-zinc-600 dark:text-zinc-300 px-2">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="text-sm font-mono px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
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
        <p className="text-sm font-mono uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-1">Reason</p>
        <p className="text-base text-zinc-600 dark:text-zinc-300 leading-relaxed">{log.reason}</p>
      </div>

      {patterns.length > 0 && (
        <div>
          <p className="text-sm font-mono uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-1">Detected Patterns</p>
          <div className="flex flex-wrap gap-1.5">
            {patterns.map((p, i) => (
              <span
                key={i}
                className={`text-sm font-mono px-1.5 py-0.5 rounded border ${
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
        <p className="text-sm font-mono uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-1">Prompt Snippet</p>
        <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3">
          <p className="text-base font-mono text-zinc-600 dark:text-zinc-300 leading-relaxed break-all">
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
      <p className="text-sm font-mono uppercase tracking-widest text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className={`text-base text-zinc-600 dark:text-zinc-300 mt-0.5 ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}
