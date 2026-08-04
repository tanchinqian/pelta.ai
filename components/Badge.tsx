import React from 'react';

/* ── Shared badge primitives ───────────────────────────── */

const RISK: Record<string, { text: string; bg: string; border: string }> = {
  low:    { text: 'text-risk-low', bg: 'bg-risk-low-bg', border: 'border-risk-low/15' },
  medium: { text: 'text-risk-medium', bg: 'bg-risk-medium-bg', border: 'border-risk-medium/15' },
  high:   { text: 'text-risk-high', bg: 'bg-risk-high-bg', border: 'border-risk-high/15' },
};

const STATUS: Record<string, { text: string; bg: string; border: string }> = {
  approved:  { text: 'text-risk-low', bg: 'bg-risk-low-bg', border: 'border-risk-low/15' },
  blocked:   { text: 'text-risk-high', bg: 'bg-risk-high-bg', border: 'border-risk-high/15' },
  rejected:  { text: 'text-risk-high', bg: 'bg-risk-high-bg', border: 'border-risk-high/15' },
  denied:    { text: 'text-risk-high', bg: 'bg-risk-high-bg', border: 'border-risk-high/15' },
  pending:   { text: 'text-risk-medium', bg: 'bg-risk-medium-bg', border: 'border-risk-medium/15' },
};

const VERDICT: Record<string, { text: string; bg: string; border: string }> = {
  allow: { text: 'text-risk-low', bg: 'bg-risk-low-bg', border: 'border-risk-low/15' },
  flag:  { text: 'text-risk-medium', bg: 'bg-risk-medium-bg', border: 'border-risk-medium/15' },
  block: { text: 'text-risk-high', bg: 'bg-risk-high-bg', border: 'border-risk-high/15' },
};

const DATA_CAT: Record<string, string> = {
  PII: 'var(--data-pii)',
  Financial: 'var(--data-financial)',
  'Source Code': 'var(--data-source-code)',
  None: 'var(--data-none)',
};

/* ── RiskBadge — Low / Medium / High ──────────────────── */

export function RiskBadge({
  tier,
}: {
  tier: string | null;
}) {
  if (!tier) return <span className="text-sm text-zinc-500 dark:text-zinc-400">—</span>;
  const s = RISK[tier.toLowerCase()] ?? RISK.low;
  return (
    <span className={`inline-flex items-center text-xs font-bold font-mono uppercase px-1.5 py-0.5 rounded ${s.text} ${s.bg} ${s.border} border`}>
      {tier}
    </span>
  );
}

/* ── StatusBadge — approved / pending / blocked / denied ─ */

export function StatusBadge({
  status,
  icon,
}: {
  status: string;
  icon?: React.ReactNode;
}) {
  const s = STATUS[status] ?? STATUS.pending;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold font-mono uppercase px-1.5 py-0.5 rounded border ${s.text} ${s.bg} ${s.border}`}>
      {icon}
      {status}
    </span>
  );
}

/* ── VerdictBadge — allow / flag / block ───────────────── */

export function VerdictBadge({
  verdict,
}: {
  verdict: string;
}) {
  const v = VERDICT[verdict] ?? VERDICT.allow;
  return (
    <span className={`inline-flex items-center text-xs font-bold font-mono uppercase px-1.5 py-0.5 rounded ${v.text} ${v.bg} ${v.border} border`}>
      {verdict}
    </span>
  );
}

/* ── DataCategoryBadge — PII / Financial / Source Code ── */

export function DataCategoryBadge({
  category,
}: {
  category: string;
}) {
  const color = DATA_CAT[category] ?? 'var(--data-none)';
  return (
    <span className="inline-flex items-center text-xs font-mono px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700" style={{ color, background: `${color}12` }}>
      {category}
    </span>
  );
}
