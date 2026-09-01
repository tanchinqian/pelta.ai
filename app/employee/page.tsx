'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Send, FileText, ShieldCheck, CheckCircle2, XCircle, Clock, History, Wrench } from 'lucide-react';
import RadarIcon from '@/components/RadarIcon';
import { RiskBadge, StatusBadge } from '@/components/Badge';
import { motion } from 'framer-motion';
import { DEMO_EMPLOYEE } from '@/lib/constants';

interface RequestRecord {
  id: string;
  employeeName: string;
  department: string;
  toolRequested: string;
  description?: string;
  status: 'pending' | 'approved' | 'denied';
  requestedAt: string;
  decidedAt: string | null;
}

interface ToolRecord {
  id: string;
  name: string;
  riskTier: 'Low' | 'Medium' | 'High' | null;
}

const RISK_COLOR: Record<string, string> = {
  Low: 'var(--risk-low)',
  Medium: 'var(--risk-medium)',
  High: 'var(--risk-high)',
};

const STATUS_BORDER_COLOR: Record<string, string> = {
  approved: 'var(--risk-low)',
  pending:  'var(--risk-medium)',
  denied:   'var(--risk-high)',
};

export default function EmployeeDashboard() {
  const [myRequests, setMyRequests] = useState<RequestRecord[]>([]);
  const [approvedTools, setApprovedTools] = useState<ToolRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      try {
        const [reqRes, toolRes] = await Promise.all([
          fetch('/api/requests', { cache: 'no-store' }).then((r) => r.json()),
          fetch('/api/tools', { cache: 'no-store' }).then((r) => r.json()),
        ]);
        if (!mounted) return;
        setMyRequests((reqRes as RequestRecord[]).filter((r) => r.employeeName === DEMO_EMPLOYEE));
        setApprovedTools((toolRes as ToolRecord[]).filter((t) => (t as any).status === 'approved'));
      } catch {}
      if (mounted) setLoading(false);
    };
    fetchData();
    const onVisibility = () => { if (document.visibilityState === 'visible') fetchData(); };
    const onRefetch = () => fetchData();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pelta:refetch-requests', onRefetch);
    return () => {
      mounted = false;
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pelta:refetch-requests', onRefetch);
    };
  }, []);

  const pending  = myRequests.filter((r) => r.status === 'pending');
  const approved = myRequests.filter((r) => r.status === 'approved');
  const recent   = [...myRequests]
    .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())
    .slice(0, 5);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <RadarIcon size={24} className="text-accent animate-radar-pulse" />
          <span className="text-sm text-text-tertiary font-mono">Loading workspace...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 lg:p-6 max-w-7xl mx-auto w-full space-y-6 text-text-primary">

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Link href="/employee/requests/new">
          <motion.div
            whileHover={{ y: -2 }}
            transition={{ duration: 0.15 }}
            className="panel border-l-2 px-3 py-3 cursor-pointer"
            style={{ borderLeftColor: 'var(--border)' }}
          >
            <p className="text-xs font-mono uppercase tracking-widest text-text-tertiary font-semibold">Total Requests</p>
            <p className="text-2xl font-bold font-mono mt-1 text-text-primary">{myRequests.length}</p>
          </motion.div>
        </Link>

        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          className="panel border-l-2 px-3 py-3"
          style={{ borderLeftColor: 'var(--risk-medium)' }}
        >
          <p className="text-xs font-mono uppercase tracking-widest text-text-tertiary font-semibold">Pending</p>
          <p className="text-2xl font-bold font-mono mt-1" style={{ color: 'var(--risk-medium)' }}>{pending.length}</p>
        </motion.div>

        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          className="panel border-l-2 px-3 py-3"
          style={{ borderLeftColor: 'var(--risk-low)' }}
        >
          <p className="text-xs font-mono uppercase tracking-widest text-text-tertiary font-semibold">Approved</p>
          <p className="text-2xl font-bold font-mono mt-1" style={{ color: 'var(--risk-low)' }}>{approved.length}</p>
        </motion.div>

        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          className="panel border-l-2 px-3 py-3"
          style={{ borderLeftColor: 'var(--accent)' }}
        >
          <p className="text-xs font-mono uppercase tracking-widest text-text-tertiary font-semibold">Tools Available</p>
          <p className="text-2xl font-bold font-mono mt-1 text-text-primary">{approvedTools.length}</p>
        </motion.div>
      </div>

      {/* ── Main panels ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="panel p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History size={14} className="text-text-tertiary" />
              <h2 className="text-lg font-serif font-semibold text-text-primary">Recent Requests</h2>
            </div>
            <Link href="/employee/requests/new" className="text-sm font-medium text-accent hover:text-accent-hover transition-colors flex items-center gap-1">
              <Send size={11} /> New Request
            </Link>
          </div>

          {recent.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
              <RadarIcon size={28} className="text-text-muted" />
              <p className="text-sm text-text-tertiary">No requests yet.</p>
              <Link
                href="/employee/requests/new"
                className="text-sm text-accent hover:text-accent-hover font-medium transition-colors flex items-center gap-1"
              >
                <Send size={11} /> Submit your first request
              </Link>
            </div>
          ) : (
            <div className="space-y-1.5">
              {recent.map((req) => (
                <div
                  key={req.id}
                  className="panel border-l-2 p-3 flex items-center justify-between gap-3 hover:bg-surface-hover transition-colors"
                  style={{ borderLeftColor: STATUS_BORDER_COLOR[req.status] ?? 'var(--border)' }}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{req.toolRequested}</p>
                    <p className="text-xs font-mono text-text-tertiary mt-0.5">
                      {new Date(req.requestedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {req.department && ` · ${req.department}`}
                    </p>
                  </div>
                  <StatusBadge status={req.status} icon={
                    req.status === 'approved' ? <CheckCircle2 size={9} /> :
                    req.status === 'denied'   ? <XCircle size={9} /> :
                    <Clock size={9} className="animate-pulse" />
                  } />
                </div>
              ))}
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="panel p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck size={14} className="text-risk-low" />
              <h2 className="text-lg font-serif font-semibold text-text-primary">Approved Tools</h2>
            </div>
            <Link href="/employee/redress" className="text-sm font-medium text-accent hover:text-accent-hover transition-colors flex items-center gap-1">
              <FileText size={11} /> Redress
            </Link>
          </div>

          {approvedTools.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
              <ShieldCheck size={28} className="text-text-muted" />
              <p className="text-sm text-text-tertiary">No approved tools yet.</p>
              <p className="text-xs text-text-muted">Your admin will provision tools as requests are reviewed.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
              {approvedTools.slice(0, 10).map((tool) => (
                <div
                  key={tool.id}
                  className="panel border-l-2 p-3 flex items-center justify-between gap-2 hover:bg-surface-hover transition-colors"
                  style={{ borderLeftColor: tool.riskTier ? RISK_COLOR[tool.riskTier] : 'var(--risk-low)' }}
                >
                  <span className="text-sm font-medium text-text-primary truncate">{tool.name}</span>
                  {tool.riskTier && <RiskBadge tier={tool.riskTier} />}
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* ── Quick nav cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link
          href="/employee/requests/new"
          className="panel p-5 hover:border-accent/40 transition-colors group"
        >
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-surface-hover border border-border group-hover:border-accent/30 transition-colors">
              <Wrench size={18} className="text-accent" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-text-primary group-hover:text-accent transition-colors">Request a New AI Tool</h3>
              <p className="text-sm text-text-tertiary mt-0.5">Submit an AI tool for security review. Fully classified with NIST AI RMF mapping.</p>
            </div>
          </div>
        </Link>

        <Link
          href="/employee/redress"
          className="panel p-5 hover:border-accent/40 transition-colors group"
        >
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-surface-hover border border-border group-hover:border-accent/30 transition-colors">
              <FileText size={18} className="text-accent" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-text-primary group-hover:text-accent transition-colors">Right to Explanation</h3>
              <p className="text-sm text-text-tertiary mt-0.5">EU AI Act Article 86 — view flagged events, understand decisions, and file redress appeals.</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
