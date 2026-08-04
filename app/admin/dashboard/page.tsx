'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
  LineChart, Line, CartesianGrid, Legend,
} from 'recharts';
import { RefreshCw, ArrowUpDown, ArrowUp, ArrowDown, Clock, ChevronDown, ChevronUp, ShieldAlert, ShieldCheck, Globe } from 'lucide-react';
import Link from 'next/link';
import RadarIcon from '@/components/RadarIcon';
import { motion, animate } from 'framer-motion';
import { useRef } from 'react';

/* ── Types ──────────────────────────────────────────────── */

interface ToolRecord {
  id: string; name: string; description: string; status: string;
  riskTier: string | null; nistFunctions: string[]; dataCategories: string[];
  justification: string; recommendedPolicy: string; createdAt: string;
}
interface GuardLog {
  id: string; promptSnippet: string; verdict: string;
  riskLevel: string; reason: string; detectionMethod: string;
  dataCategory: string; source?: string; tool?: string; timestamp: string;
}
interface RequestRecord {
  id: string; employeeName: string; department: string;
  toolRequested: string; status: string;
  requestedAt: string; decidedAt: string | null;
}


/* ── Color palette (semantic — same in both themes) ────── */

const VERDICT = { allow: 'var(--color-risk-low)', flag: 'var(--color-risk-medium)', block: 'var(--color-risk-high)' };
const RISK    = { low: 'var(--color-risk-low)', medium: 'var(--color-risk-medium)', high: 'var(--color-risk-high)' };

const DATA_CAT: Record<string, string> = {
  PII: 'var(--data-pii)', Financial: 'var(--data-financial)', 'Source Code': 'var(--data-source-code)', None: 'var(--data-none)',
};

const DETECTION = { regex: 'var(--data-source-code)', llm: 'var(--data-financial)' };

const NIST_COLORS: Record<string, string> = {
  Govern: 'var(--nist-govern)', Map: 'var(--nist-map)', Measure: 'var(--nist-measure)', Manage: 'var(--nist-manage)',
};

const DEPT_PALETTE = ['var(--nist-govern)', 'var(--nist-map)', 'var(--nist-manage)', 'var(--data-none)', 'var(--data-pii)', 'var(--data-source-code)'];

/* ── Helpers ────────────────────────────────────────────── */

type SortDir = 'asc' | 'desc' | null;
type SortKey = 'name' | 'riskTier' | 'status' | null;

function riskColor(tier: string) {
  if (tier === 'High' || tier === 'high') return RISK.high;
  if (tier === 'Medium' || tier === 'medium') return RISK.medium;
  return RISK.low;
}

function getTipStyle(): React.CSSProperties {
  if (typeof window === 'undefined') return { background: '#111113', border: '1px solid #27272a', borderRadius: 6, fontSize: 11, fontFamily: 'monospace' };
  const s = getComputedStyle(document.documentElement);
  return {
    background: s.getPropertyValue('--chart-tooltip-bg').trim(),
    border: `1px solid ${s.getPropertyValue('--chart-tooltip-border').trim()}`,
    borderRadius: 6,
    fontSize: 11,
    fontFamily: 'monospace',
    color: s.getPropertyValue('--text-primary').trim(),
  };
}

/* ── Center label for donuts ────────────────────────────── */

function DonutCenter({ label, sub }: { label: string; sub?: string }) {
  return (
    <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="pointer-events-none">
      <tspan x="50%" dy="-4" fill="var(--text-primary)" fontSize="18" fontWeight="700" fontFamily="monospace">{label}</tspan>
      {sub && <tspan x="50%" dy="18" fill="var(--text-tertiary)" fontSize="10" fontFamily="monospace">{sub}</tspan>}
    </text>
  );
}

/* ── Page ───────────────────────────────────────────────── */

export default function DashboardPage() {
  const [tools, setTools] = useState<ToolRecord[]>([]);
  const [logs, setLogs] = useState<GuardLog[]>([]);
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [tipStyle, setTipStyle] = useState<React.CSSProperties>({});
  const [showToolRegistry, setShowToolRegistry] = useState(false);


  const fetchData = useCallback(async () => {
    const [t, l, r] = await Promise.all([
      fetch('/api/tools').then((r) => r.json()),
      fetch('/api/logs').then((r) => r.json()),
      fetch('/api/requests').then((r) => r.json()),
    ]);
    setTools(t); setLogs(l); setRequests(r);
    setLastUpdated(new Date());
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const h = () => { if (document.visibilityState === 'visible') fetchData(); };
    document.addEventListener('visibilitychange', h);
    return () => document.removeEventListener('visibilitychange', h);
  }, [fetchData]);

  // Theme-aware tooltip
  useEffect(() => {
    const update = () => setTipStyle(getTipStyle());
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      if (sortDir === 'asc') setSortDir('desc');
      else if (sortDir === 'desc') { setSortKey(null); setSortDir(null); }
    } else { setSortKey(key); setSortDir('asc'); }
  };



  const sortedTools = [...tools].sort((a, b) => {
    if (!sortKey || !sortDir) return 0;
    const av = sortKey === 'riskTier' ? (a.riskTier ?? 'ZZZ') : a[sortKey];
    const bv = sortKey === 'riskTier' ? (b.riskTier ?? 'ZZZ') : b[sortKey];
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  /* ── Derived data ─────────────────────────────────────── */

  const verdictCounts = [
    { name: 'Allow', value: logs.filter((l) => l.verdict === 'allow').length, fill: VERDICT.allow },
    { name: 'Flag', value: logs.filter((l) => l.verdict === 'flag').length, fill: VERDICT.flag },
    { name: 'Block', value: logs.filter((l) => l.verdict === 'block').length, fill: VERDICT.block },
  ];

  const riskDist = [
    { name: 'Low', value: tools.filter((t) => t.riskTier === 'Low').length, fill: RISK.low },
    { name: 'Medium', value: tools.filter((t) => t.riskTier === 'Medium').length, fill: RISK.medium },
    { name: 'High', value: tools.filter((t) => t.riskTier === 'High').length, fill: RISK.high },
  ];

  const dataCatCounts = Object.entries(DATA_CAT).map(([cat, fill]) => ({
    name: cat,
    value: logs.filter((l) => l.dataCategory === cat).length,
    fill,
  })).filter((d) => d.value > 0);

  const detectionSplit = [
    { name: 'Regex', value: logs.filter((l) => l.detectionMethod === 'regex').length, fill: DETECTION.regex },
    { name: 'LLM', value: logs.filter((l) => l.detectionMethod === 'llm').length, fill: DETECTION.llm },
  ];

  const nistFunctions = ['Govern', 'Map', 'Measure', 'Manage'];
  const nistCoverage = nistFunctions.map((fn) => ({
    name: fn,
    value: tools.filter((t) => t.status === 'approved' && t.nistFunctions.includes(fn)).length,
    fill: NIST_COLORS[fn],
  }));

  const trendMap = new Map<string, { allow: number; flag: number; block: number }>();
  logs.forEach((l) => {
    const day = l.timestamp.slice(0, 10);
    if (!trendMap.has(day)) trendMap.set(day, { allow: 0, flag: 0, block: 0 });
    const d = trendMap.get(day)!;
    if (l.verdict in d) (d as any)[l.verdict]++;
  });
  const verdictTrend = [...trendMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-7)
    .map(([date, counts]) => ({ date: date.slice(5), ...counts }));

  const deptMap = new Map<string, number>();
  requests.forEach((r) => deptMap.set(r.department, (deptMap.get(r.department) ?? 0) + 1));
  const deptBreakdown = [...deptMap.entries()]
    .map(([dept, count], i) => ({ name: dept, value: count, fill: DEPT_PALETTE[i % DEPT_PALETTE.length] }))
    .sort((a, b) => b.value - a.value);

  const decided = requests.filter((r) => r.decidedAt);
  const avgHours = decided.length > 0
    ? Math.round(decided.reduce((sum, r) => {
        const ms = new Date(r.decidedAt!).getTime() - new Date(r.requestedAt).getTime();
        return sum + ms / 3600000;
      }, 0) / decided.length)
    : 0;

  const visibleLogs = [...logs].reverse().slice(0, 5);

  /* ── Business impact derived data ─────────────────────── */
  const blockedLogs = logs.filter((l) => l.verdict === 'block');
  const piiBlocked = blockedLogs.filter((l) => l.dataCategory === 'PII').length;
  const financialBlocked = blockedLogs.filter((l) => l.dataCategory === 'Financial').length;
  const sourceBlocked = blockedLogs.filter((l) => l.dataCategory === 'Source Code').length;
  const extensionScans = logs.filter((l) => l.source === 'extension').length;
  const extensionPct = logs.length > 0 ? Math.round((extensionScans / logs.length) * 100) : 0;

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <div className="relative size-12">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="text-accent animate-radar">
            <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
            <path d="M12 7a5 5 0 0 1 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
            <path d="M12 11a1 1 0 0 1 1 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" />
          </svg>
        </div>
        <span className="text-sm text-text-tertiary font-mono">Initializing governance feed...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 space-y-3 max-w-[1400px] mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RadarIcon size={14} className="text-accent" />
          <h2 className="text-lg font-serif font-semibold text-text-primary">Dashboard</h2>
          <span className="text-sm font-mono text-text-tertiary">/ overview</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-mono text-text-tertiary">
            updated {lastUpdated.toLocaleTimeString()}
          </span>
          <button onClick={fetchData} className="p-1.5 rounded border border-border hover:bg-surface-hover transition-colors cursor-pointer">
            <RefreshCw size={12} className="text-text-secondary" />
          </button>
        </div>
      </div>

      {/* Stat Row */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2"
      >
        <Link href="/admin/logs" className="block hover:opacity-80 transition-opacity"><StatCard label="Total Scans" value={logs.length} color="var(--text-primary)" /></Link>
        <StatCard label="Scans Flagged" value={logs.filter(l => l.verdict === 'flag').length} color={VERDICT.flag} />
        <StatCard label="Scans Blocked" value={logs.filter(l => l.verdict === 'block').length} color={VERDICT.block} />
        <Link href="/admin/tools" className="block hover:opacity-80 transition-opacity"><StatCard label="Total Tools" value={tools.length} color="var(--text-primary)" /></Link>
        <Link href="/admin/requests" className="block hover:opacity-80 transition-opacity"><StatCard label="Pending Tools" value={tools.filter((t) => t.status === 'pending').length} color={RISK.medium} /></Link>
        <StatCard label="High Risk Tools" value={tools.filter((t) => t.riskTier === 'High').length} color={RISK.high} />
      </motion.div>

      {/* ── Governance Impact ──────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.3 }}
        className="panel p-4 space-y-3"
      >
        <div className="flex items-center gap-2">
          <ShieldAlert size={12} className="text-accent" />
          <span className="text-xs font-mono uppercase tracking-widest text-text-secondary font-semibold">Governance Impact</span>
          <span className="text-[10px] font-mono text-text-tertiary ml-auto">since Prompt Guard adoption</span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-2xl font-bold font-mono" style={{ color: 'var(--risk-high)' }}>
                <AnimatedNumber value={blockedLogs.length} />
              </span>
            </div>
            <p className="text-xs font-mono uppercase tracking-widest text-text-secondary font-semibold">Incidents Caught</p>
            <p className="text-[10px] text-text-tertiary leading-relaxed">
              Prompts blocked before reaching third‑party AI APIs — preventing data leakage of sensitive enterprise content.
            </p>
            <div className="flex items-center gap-3 text-[10px] font-mono text-text-tertiary pt-1">
              <span className="flex items-center gap-1">
                <span className="size-1.5 rounded-sm" style={{ background: 'var(--data-pii)' }} />
                PII · {piiBlocked}
              </span>
              <span className="flex items-center gap-1">
                <span className="size-1.5 rounded-sm" style={{ background: 'var(--data-financial)' }} />
                Financial · {financialBlocked}
              </span>
              <span className="flex items-center gap-1">
                <span className="size-1.5 rounded-sm" style={{ background: 'var(--data-source-code)' }} />
                Source · {sourceBlocked}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-2xl font-bold font-mono" style={{ color: 'var(--data-pii)' }}>
                <AnimatedNumber value={piiBlocked} />
              </span>
            </div>
            <p className="text-xs font-mono uppercase tracking-widest text-text-secondary font-semibold">PII Exposures Averted</p>
            <p className="text-[10px] text-text-tertiary leading-relaxed">
              HIPAA / GDPR compliance risk mitigated — employee PII, customer data, and personal credentials intercepted before transmission.
            </p>
            <div className="flex items-center gap-1.5 text-[10px] font-mono pt-1">
              <ShieldCheck size={10} className="text-risk-low" />
              <span className="text-risk-low">compliance-safe</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-2xl font-bold font-mono" style={{ color: 'var(--accent)' }}>
                {extensionPct}<span className="text-sm">%</span>
              </span>
            </div>
            <p className="text-xs font-mono uppercase tracking-widest text-text-secondary font-semibold">Shadow IT Coverage</p>
            <p className="text-[10px] text-text-tertiary leading-relaxed">
              {extensionScans} of {logs.length} scans originated from the browser extension — protecting ChatGPT, Gemini, Claude, Copilot, and DeepSeek outside the corporate portal.
            </p>
            <div className="flex items-center gap-1.5 text-[10px] font-mono pt-1">
              <Globe size={10} className="text-accent" />
              <span className="text-accent">multi‑platform guard</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Section 1: Prompt Security ───────────────────────────────── */}
      <div className="pt-4 pb-1 border-b border-border/50">
        <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Prompt Security & Detections</h3>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.3 }}
        className="grid grid-cols-12 gap-3"
      >
        {/* Verdict Trend — 8 cols */}
        <div className="col-span-12 lg:col-span-8 panel p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-base font-semibold text-text-secondary uppercase tracking-wider">Verdict Trend</span>
            <span className="text-sm font-mono text-text-tertiary">last 7 days</span>
          </div>
          <div style={{ width: '100%', height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={verdictTrend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: 'var(--text-tertiary)', fontSize: 10, fontFamily: 'monospace' }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-tertiary)', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tipStyle} />
                <Legend
                  iconType="circle"
                  iconSize={6}
                  wrapperStyle={{ fontSize: 10, fontFamily: 'monospace', paddingTop: 4 }}
                  formatter={(value: string) => <span style={{ color: 'var(--text-secondary)' }}>{value}</span>}
                />
                <Line type="monotone" dataKey="allow" name="Allow" stroke={VERDICT.allow} strokeWidth={2} dot={{ r: 3, fill: VERDICT.allow }} />
                <Line type="monotone" dataKey="flag" name="Flag" stroke={VERDICT.flag} strokeWidth={2} dot={{ r: 3, fill: VERDICT.flag }} />
                <Line type="monotone" dataKey="block" name="Block" stroke={VERDICT.block} strokeWidth={2} dot={{ r: 3, fill: VERDICT.block }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Verdicts — 4 cols */}
        <div className="col-span-12 lg:col-span-4">
          <ChartPanel title="Verdicts" subtitle={`${logs.length} total`}>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={verdictCounts} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 10, fontFamily: 'monospace' }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-tertiary)', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tipStyle} cursor={{ fill: 'var(--accent-dim)' }} />
                <Bar dataKey="value" radius={[3, 3, 0, 0]} barSize={36}>
                  {verdictCounts.map((e) => <Cell key={e.name} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartPanel>
        </div>

        {/* Data Categories — 4 cols */}
        <div className="col-span-12 lg:col-span-4">
          <ChartPanel title="Data Categories" subtitle="by scan">
            <div style={{ width: '100%', height: 160, position: 'relative' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={dataCatCounts} cx="50%" cy="50%" innerRadius={50} outerRadius={70} dataKey="value" stroke="none" paddingAngle={2}>
                    {dataCatCounts.map((e) => <Cell key={e.name} fill={e.fill} />)}
                  </Pie>
                  <Tooltip contentStyle={tipStyle} />
                  <DonutCenter label={String(logs.length)} sub="scans" />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <LegendRow items={dataCatCounts} />
          </ChartPanel>
        </div>

        {/* Detection Method — 8 cols */}
        <div className="col-span-12 lg:col-span-8 panel p-3 flex flex-col">
          <span className="text-base font-semibold text-text-secondary uppercase tracking-wider mb-4">Detection Method</span>
          <div className="flex-1 flex items-center justify-around w-full">
            {detectionSplit.map((d) => {
              const pct = logs.length > 0 ? Math.round((d.value / logs.length) * 100) : 0;
              return (
                <div key={d.name} className="flex flex-col items-center">
                  <div className="text-4xl font-bold font-mono" style={{ color: d.fill }}>{pct}%</div>
                  <div className="text-base text-text-tertiary mt-1">{d.name} Engine</div>
                  <div className="text-sm font-mono text-text-secondary mt-0.5">{d.value} scans</div>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* ── Section 2: AI Tool Governance ────────────────────────────── */}
      <div className="pt-4 pb-1 border-b border-border/50">
        <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">AI Tool Governance</h3>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.3 }}
        className="grid grid-cols-12 gap-3"
      >
        {/* Risk Distribution — 4 cols */}
        <div className="col-span-12 lg:col-span-4">
          <ChartPanel title="Risk Distribution" subtitle={`${tools.length} tools`}>
            <div style={{ width: '100%', height: 160, position: 'relative' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={riskDist} cx="50%" cy="50%" innerRadius={50} outerRadius={70} dataKey="value" stroke="none" paddingAngle={2}>
                    {riskDist.map((e) => <Cell key={e.name} fill={e.fill} />)}
                  </Pie>
                  <Tooltip contentStyle={tipStyle} />
                  <DonutCenter label={String(tools.length)} sub="tools" />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <LegendRow items={riskDist} />
          </ChartPanel>
        </div>

        {/* NIST RMF Coverage — 4 cols */}
        <div className="col-span-12 lg:col-span-4 panel p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-base font-semibold text-text-secondary uppercase tracking-wider">NIST RMF</span>
            <span className="text-sm font-mono text-text-tertiary">approved</span>
          </div>
          <div style={{ width: '100%', height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={nistCoverage} layout="vertical" margin={{ top: 4, right: 30, left: 8, bottom: 0 }}>
                <XAxis type="number" tick={{ fill: 'var(--text-tertiary)', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} width={60} />
                <Tooltip contentStyle={tipStyle} cursor={{ fill: 'var(--accent-dim)' }} />
                <Bar dataKey="value" radius={[0, 3, 3, 0]} barSize={18} label={{ position: 'right', fill: 'var(--text-secondary)', fontSize: 10, fontFamily: 'monospace' }}>
                  {nistCoverage.map((e) => <Cell key={e.name} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Requests by Department — 4 cols */}
        <div className="col-span-12 lg:col-span-4 panel p-3 flex flex-col">
          <div className="flex items-center justify-between mb-1">
            <span className="text-base font-semibold text-text-secondary uppercase tracking-wider">Requests by Dept</span>
            <span className="text-sm font-mono text-text-tertiary">{requests.length} total</span>
          </div>
          <div className="flex-1 min-h-0" style={{ width: '100%', height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deptBreakdown} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 10, fontFamily: 'monospace' }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-tertiary)', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tipStyle} cursor={{ fill: 'var(--accent-dim)' }} />
                <Bar dataKey="value" radius={[3, 3, 0, 0]} barSize={28}>
                  {deptBreakdown.map((e) => <Cell key={e.name} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </motion.div>

      {/* ── Section 3: Tables ────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.3 }}
        className="grid grid-cols-12 gap-3 pb-8"
      >
        <div className="col-span-12 lg:col-span-6 flex flex-col min-h-[300px]">
          {/* Tool Registry Table */}
          <div className="panel p-3 flex-1 flex flex-col">
            <button
              onClick={() => setShowToolRegistry((v) => !v)}
              className="flex items-center justify-between mb-3 w-full text-left hover:text-text-primary transition-colors cursor-pointer"
            >
              <span className="text-base font-semibold text-text-secondary uppercase tracking-wider">
                Tool Registry <span className="text-text-tertiary font-normal">({tools.length})</span>
              </span>
              {showToolRegistry ? <ChevronUp size={13} className="text-text-tertiary shrink-0" /> : <ChevronDown size={13} className="text-text-tertiary shrink-0" />}
            </button>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-text-secondary border-b border-border">
                    <SortTh label="Name" sortKey="name" active={sortKey} dir={sortDir} onToggle={toggleSort} />
                    <SortTh label="Risk" sortKey="riskTier" active={sortKey} dir={sortDir} onToggle={toggleSort} />
                    <SortTh label="Status" sortKey="status" active={sortKey} dir={sortDir} onToggle={toggleSort} />
                    <th className="pb-1.5 pl-3 font-medium hidden lg:table-cell">NIST</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTools.length === 0 && (
                    <tr><td colSpan={4} className="py-4 text-center text-text-tertiary">No tools.</td></tr>
                  )}
                  {(showToolRegistry ? sortedTools : sortedTools.slice(0, 5)).map((t, i) => (
                    <tr key={t.id} className={`border-b border-border/40 hover:bg-surface-hover/50 transition-colors ${i % 2 === 1 ? 'bg-surface-hover/20' : ''}`}>
                      <td className="py-2 pr-3 text-text-primary font-medium">{t.name}</td>
                       <td className="py-2 pr-3">
                        {t.riskTier
                          ? <span style={{ color: riskColor(t.riskTier) }} className="text-sm font-bold font-mono uppercase cursor-help" title={`Why: ${(t.justification ?? '').slice(0, 150)}${(t.justification ?? '').length > 150 ? '…' : ''}`}>{t.riskTier}</span>
                          : <span className="text-text-muted">—</span>}
                      </td>
                      <td className="py-2 pr-3">
                        <span className={`text-sm font-mono uppercase ${
                          t.status === 'approved' ? 'text-risk-low' :
                          t.status === 'blocked' ? 'text-risk-high' : 'text-risk-medium'
                        }`}>{t.status}</span>
                      </td>
                      <td className="py-2 pl-3 text-sm font-mono text-text-tertiary hidden lg:table-cell">{t.nistFunctions.join(', ') || '—'}</td>
                    </tr>
                  ))}
                  {!showToolRegistry && sortedTools.length > 5 && (
                    <tr>
                      <td colSpan={4} className="py-3 text-center">
                        <span className="text-xs font-mono text-text-tertiary">
                          +{sortedTools.length - 5} more entries — expand to view all
                        </span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-6 flex flex-col min-h-[300px]">
          {/* Recent Detections Log Table */}
          <div className="panel p-3 flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <span className="text-base font-semibold text-text-secondary uppercase tracking-wider">
                Recent Detections <span className="text-text-tertiary font-normal">({logs.length})</span>
              </span>
              <Link
                href="/admin/logs"
                className="text-sm font-mono text-accent hover:text-accent-hover transition-colors"
              >
                View all logs →
              </Link>
            </div>
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-text-secondary border-b border-border">
                    <th className="pb-1.5 pr-3 font-medium">Verdict</th>
                    <th className="pb-1.5 pr-3 font-medium hidden sm:table-cell">Risk</th>
                    <th className="pb-1.5 pr-3 font-medium hidden md:table-cell">Source</th>
                    <th className="pb-1.5 font-medium">Snippet</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleLogs.map((l, i) => (
                    <tr key={l.id} className={`border-b border-border/40 hover:bg-surface-hover/50 transition-colors ${i % 2 === 1 ? 'bg-surface-hover/20' : ''}`}>
                      <td className="py-2 pr-3">
                        <span className={`text-sm font-bold font-mono uppercase ${
                          l.verdict === 'allow' ? 'text-risk-low' : l.verdict === 'flag' ? 'text-risk-medium' : 'text-risk-high'
                        }`}>{l.verdict}</span>
                      </td>
                      <td className="py-2 pr-3 hidden sm:table-cell">
                        <span style={{ color: riskColor(l.riskLevel === 'none' ? 'Low' : l.riskLevel) }} className="text-sm font-mono uppercase">{l.riskLevel}</span>
                      </td>
                      <td className="py-2 pr-3 hidden md:table-cell">
                        <span className={`text-sm font-mono ${l.source === 'extension' ? 'text-accent' : 'text-text-tertiary'}`}>{l.source ?? 'manual'}</span>
                      </td>
                      <td className="py-2 text-sm font-mono text-text-tertiary truncate max-w-[140px]">{l.promptSnippet}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </motion.div>

    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────── */

function AnimatedNumber({ value }: { value: number }) {
  const nodeRef = useRef<HTMLSpanElement>(null);
  
  useEffect(() => {
    const node = nodeRef.current;
    if (node) {
      const controls = animate(0, value, {
        duration: 1.5,
        ease: "easeOut",
        onUpdate(v) {
          node.textContent = Math.round(v).toString();
        }
      });
      return () => controls.stop();
    }
  }, [value]);

  return <span ref={nodeRef}>{value}</span>;
}

function StatCard({ label, value, color, icon, accent }: {
  label: string; value: string | number; color?: string; icon?: React.ReactNode; accent?: boolean;
}) {
  return (
    <div className={`panel px-3 py-2 ${accent ? 'panel-accent' : ''}`}>
      <div className="flex items-center gap-1">
        {icon && <span className="text-text-tertiary">{icon}</span>}
        <p className="text-sm font-semibold text-text-secondary uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-xl font-bold font-mono mt-0.5" style={{ color: color ?? 'var(--text-primary)' }}>
        {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
      </p>
    </div>
  );
}

function ChartPanel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="panel p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-base font-semibold text-text-secondary uppercase tracking-wider">{title}</span>
        {subtitle && <span className="text-sm font-mono text-text-tertiary">{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}

function LegendRow({ items }: { items: { name: string; value: number; fill: string }[] }) {
  return (
    <div className="flex items-center gap-3 mt-1 pt-1 border-t border-border/50">
      {items.map((item) => (
        <span key={item.name} className="flex items-center gap-1 text-sm">
          <span className="size-1.5 rounded-sm" style={{ background: item.fill }} />
          <span className="text-text-tertiary">{item.name}</span>
          <span className="font-mono text-text-secondary">{item.value}</span>
        </span>
      ))}
    </div>
  );
}

function SortTh({ label, sortKey: key, active, dir, onToggle }: {
  label: string; sortKey: SortKey; active: SortKey; dir: SortDir; onToggle: (k: SortKey) => void;
}) {
  const isActive = active === key;
  return (
    <th className="pb-1.5 pr-3 font-medium cursor-pointer select-none hover:text-text-primary transition-colors" onClick={() => onToggle(key)}>
      <span className="flex items-center gap-1">
        {label}
        {isActive ? (dir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />) : <ArrowUpDown size={10} className="text-text-muted" />}
      </span>
    </th>
  );
}


