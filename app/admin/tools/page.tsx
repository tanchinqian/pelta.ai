'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Search, Filter, Plus, ArrowUpDown, ArrowUp, ArrowDown, Shield,
  RefreshCw, Clock, CheckCircle2, XCircle, Layers,
} from 'lucide-react';
import RadarIcon from '@/components/RadarIcon';

/* ── Types ──────────────────────────────────────────────── */

interface ToolRecord {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'approved' | 'blocked';
  riskTier: 'Low' | 'Medium' | 'High' | null;
  nistFunctions: string[];
  dataCategories: string[];
  justification: string;
  recommendedPolicy: string;
  createdAt: string;
}

/* ── Constants ──────────────────────────────────────────── */

const NIST_FUNCTIONS = ['Govern', 'Map', 'Measure', 'Manage'];
const DATA_CATS = ['PII', 'Financial', 'Source Code', 'None'];

const RISK_STYLE: Record<string, { color: string; bg: string }> = {
  Low:    { color: 'var(--risk-low)',    bg: 'var(--risk-low-bg)' },
  Medium: { color: 'var(--risk-medium)', bg: 'var(--risk-medium-bg)' },
  High:   { color: 'var(--risk-high)',   bg: 'var(--risk-high-bg)' },
};

const STATUS_STYLE: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode }> = {
  approved: {
    color: 'var(--risk-low)',
    bg: 'var(--risk-low-bg)',
    border: 'rgba(34,197,94,0.25)',
    icon: <CheckCircle2 size={10} />,
  },
  pending: {
    color: 'var(--risk-medium)',
    bg: 'var(--risk-medium-bg)',
    border: 'rgba(245,158,11,0.25)',
    icon: <Clock size={10} className="animate-pulse" />,
  },
  blocked: {
    color: 'var(--risk-high)',
    bg: 'var(--risk-high-bg)',
    border: 'rgba(239,68,68,0.25)',
    icon: <XCircle size={10} />,
  },
};

/* ── Badge components ───────────────────────────────────── */

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.pending;
  return (
    <span
      className="inline-flex items-center gap-1 text-[9px] font-bold font-mono uppercase px-1.5 py-0.5 rounded border"
      style={{ color: s.color, background: s.bg, borderColor: s.border }}
    >
      {s.icon}
      {status}
    </span>
  );
}

function RiskBadge({ tier }: { tier: string | null }) {
  if (!tier) return <span className="text-[10px] text-text-muted">—</span>;
  const s = RISK_STYLE[tier] ?? RISK_STYLE.Low;
  return (
    <span
      className="text-[9px] font-bold font-mono uppercase px-1.5 py-0.5 rounded"
      style={{ color: s.color, background: s.bg }}
    >
      {tier}
    </span>
  );
}

function NistTag({ label }: { label: string }) {
  return (
    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-background border border-border text-text-secondary">
      {label}
    </span>
  );
}

function DataTag({ label }: { label: string }) {
  const color = label === 'PII' ? '#818cf8' : label === 'Financial' ? '#c084fc' : label === 'Source Code' ? '#22d3ee' : '#64748b';
  return (
    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ color, background: `${color}15` }}>
      {label}
    </span>
  );
}

/* ── Sort helpers ───────────────────────────────────────── */

type SortKey = 'name' | 'riskTier' | 'status' | 'createdAt';

const RISK_ORDER: Record<string, number> = { High: 3, Medium: 2, Low: 1, '': 0 };
const STATUS_ORDER: Record<string, number> = { pending: 1, approved: 2, blocked: 3 };

function SortTh({
  label, sortKey, active, dir, onToggle,
}: {
  label: string; sortKey: SortKey; active: SortKey; dir: 'asc' | 'desc'; onToggle: (k: SortKey) => void;
}) {
  const isActive = active === sortKey;
  return (
    <th
      className="pb-2 pr-3 font-medium cursor-pointer select-none hover:text-text-primary transition-colors"
      onClick={() => onToggle(sortKey)}
    >
      <span className="flex items-center gap-1">
        {label}
        {isActive ? (dir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />) : <ArrowUpDown size={10} className="text-text-muted" />}
      </span>
    </th>
  );
}

/* ── Page ───────────────────────────────────────────────── */

export default function ToolsRegistryPage() {
  const [tools, setTools] = useState<ToolRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [nistFilter, setNistFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const fetchTools = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tools');
      if (res.ok) setTools(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTools(); }, []);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'createdAt' ? 'desc' : 'asc');
    }
  };

  const filtered = useMemo(() => {
    return tools
      .filter((t) => statusFilter === 'all' || t.status === statusFilter)
      .filter((t) => riskFilter === 'all' || t.riskTier === riskFilter)
      .filter((t) => nistFilter === 'all' || t.nistFunctions.includes(nistFilter))
      .filter((t) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return t.name.toLowerCase().includes(q)
          || t.description.toLowerCase().includes(q)
          || t.justification.toLowerCase().includes(q)
          || t.recommendedPolicy.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        let cmp = 0;
        switch (sortKey) {
          case 'name': cmp = a.name.localeCompare(b.name); break;
          case 'riskTier': cmp = (RISK_ORDER[a.riskTier ?? ''] ?? 0) - (RISK_ORDER[b.riskTier ?? ''] ?? 0); break;
          case 'status': cmp = (STATUS_ORDER[a.status] ?? 0) - (STATUS_ORDER[b.status] ?? 0); break;
          case 'createdAt': cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); break;
        }
        return sortDir === 'asc' ? cmp : -cmp;
      });
  }, [tools, statusFilter, riskFilter, nistFilter, search, sortKey, sortDir]);

  const counts = useMemo(() => ({
    total: tools.length,
    approved: tools.filter((t) => t.status === 'approved').length,
    pending: tools.filter((t) => t.status === 'pending').length,
    blocked: tools.filter((t) => t.status === 'blocked').length,
    high: tools.filter((t) => t.riskTier === 'High').length,
  }), [tools]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <RadarIcon size={32} className="text-accent animate-radar-pulse" />
        <span className="text-xs text-text-tertiary font-mono">Loading tool registry...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 max-w-[1400px] mx-auto w-full space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RadarIcon size={14} className="text-accent" />
          <span className="text-sm font-semibold text-text-primary">Tool Registry</span>
          <span className="text-[10px] font-mono text-text-tertiary">/ {counts.total} tools</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/tools/new"
            className="flex items-center gap-1 text-[10px] font-semibold text-text-primary bg-accent/10 hover:bg-accent/20 border border-accent/30 text-accent rounded px-2.5 py-1.5 transition-colors"
          >
            <Plus size={11} /> Classify New Tool
          </Link>
          <button
            onClick={fetchTools}
            className="p-1.5 rounded border border-border hover:bg-surface-hover transition-colors cursor-pointer"
          >
            <RefreshCw size={12} className="text-text-secondary" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-2">
        <StatCard label="Total" value={counts.total} icon={<Layers size={10} />} />
        <StatCard label="Approved" value={counts.approved} color="var(--risk-low)" />
        <StatCard label="Pending" value={counts.pending} color="var(--risk-medium)" />
        <StatCard label="Blocked" value={counts.blocked} color="var(--risk-high)" />
        <StatCard label="High Risk" value={counts.high} color="var(--risk-high)" />
      </div>

      {/* Filters */}
      <div className="panel p-2 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 text-[10px] font-mono text-text-tertiary">
          <Filter size={11} /> Filters:
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-[10px] font-mono bg-background border border-border rounded px-2 py-1 text-text-primary focus:outline-none focus:border-accent cursor-pointer"
        >
          <option value="all">All statuses</option>
          <option value="approved">Approved</option>
          <option value="pending">Pending</option>
          <option value="blocked">Blocked</option>
        </select>
        <select
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value)}
          className="text-[10px] font-mono bg-background border border-border rounded px-2 py-1 text-text-primary focus:outline-none focus:border-accent cursor-pointer"
        >
          <option value="all">All risk tiers</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
        <select
          value={nistFilter}
          onChange={(e) => setNistFilter(e.target.value)}
          className="text-[10px] font-mono bg-background border border-border rounded px-2 py-1 text-text-primary focus:outline-none focus:border-accent cursor-pointer"
        >
          <option value="all">All NIST functions</option>
          {NIST_FUNCTIONS.map((fn) => <option key={fn} value={fn}>{fn}</option>)}
        </select>
        <div className="flex items-center gap-1 ml-auto">
          <Search size={11} className="text-text-muted" />
          <input
            type="text"
            placeholder="Search tools, policies, justification..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-[11px] bg-background border border-border rounded px-2 py-1 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent w-56"
          />
        </div>
      </div>

      {/* Table */}
      <div className="panel p-0 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <RadarIcon size={24} className="text-accent animate-radar-pulse" />
            <span className="text-xs text-text-tertiary">No tools match the current filters.</span>
          </div>
        ) : (
          <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-surface z-10">
                <tr className="text-left text-text-secondary border-b border-border">
                  <SortTh label="Tool" sortKey="name" active={sortKey} dir={sortDir} onToggle={toggleSort} />
                  <th className="pb-2 pr-3 font-medium hidden md:table-cell">Description</th>
                  <SortTh label="Risk" sortKey="riskTier" active={sortKey} dir={sortDir} onToggle={toggleSort} />
                  <SortTh label="Status" sortKey="status" active={sortKey} dir={sortDir} onToggle={toggleSort} />
                  <th className="pb-2 pr-3 font-medium hidden lg:table-cell">NIST</th>
                  <th className="pb-2 pr-3 font-medium hidden lg:table-cell">Data Categories</th>
                  <th className="pb-2 pr-3 font-medium hidden xl:table-cell">Recommended Policy</th>
                  <SortTh label="Added" sortKey="createdAt" active={sortKey} dir={sortDir} onToggle={toggleSort} />
                </tr>
              </thead>
              <tbody>
                {filtered.map((t, i) => (
                  <tr
                    key={t.id}
                    className={`border-b border-border/40 hover:bg-surface-hover/50 transition-colors ${i % 2 === 1 ? 'bg-surface-hover/20' : ''}`}
                  >
                    <td className="px-3 py-2 align-top">
                      <p className="font-medium text-text-primary whitespace-nowrap">{t.name}</p>
                      <p className="text-[10px] font-mono text-text-tertiary mt-0.5">{t.id.slice(0, 8)}…</p>
                    </td>
                    <td className="pr-3 py-2 align-top hidden md:table-cell">
                      <p className="text-[11px] text-text-secondary leading-relaxed max-w-[240px] line-clamp-2">{t.description}</p>
                    </td>
                    <td className="pr-3 py-2 align-top whitespace-nowrap">
                      <RiskBadge tier={t.riskTier} />
                    </td>
                    <td className="pr-3 py-2 align-top whitespace-nowrap">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="pr-3 py-2 align-top hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {t.nistFunctions.map((fn) => <NistTag key={fn} label={fn} />)}
                        {t.nistFunctions.length === 0 && <span className="text-text-muted">—</span>}
                      </div>
                    </td>
                    <td className="pr-3 py-2 align-top hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {t.dataCategories.map((c) => <DataTag key={c} label={c} />)}
                        {t.dataCategories.length === 0 && <span className="text-text-muted">—</span>}
                      </div>
                    </td>
                    <td className="pr-3 py-2 align-top hidden xl:table-cell">
                      <p className="text-[11px] text-text-secondary leading-relaxed max-w-[280px] line-clamp-2">{t.recommendedPolicy}</p>
                    </td>
                    <td className="pr-3 py-2 align-top whitespace-nowrap text-[10px] font-mono text-text-tertiary">
                      {new Date(t.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="flex items-center gap-1.5 text-[10px] font-mono text-text-tertiary">
        <Shield size={10} />
        <span>NIST AI RMF — Govern · Map · Manage</span>
      </div>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────── */

function StatCard({ label, value, color, icon }: { label: string; value: number; color?: string; icon?: React.ReactNode }) {
  return (
    <div className="panel px-3 py-2">
      <div className="flex items-center gap-1">
        {icon && <span className="text-text-tertiary">{icon}</span>}
        <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-lg font-bold font-mono mt-0.5" style={{ color: color ?? 'var(--text-primary)' }}>{value}</p>
    </div>
  );
}
