'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Send, FileText, ShieldCheck, CheckCircle2, XCircle, Clock, History, Wrench } from 'lucide-react';
import RadarIcon from '@/components/RadarIcon';
import { RiskBadge, StatusBadge } from '@/components/Badge';
import { motion } from 'framer-motion';

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

const DEMO_EMPLOYEE = 'Alice Chen';

const RISK_COLOR: Record<string, string> = {
  Low: 'var(--risk-low)',
  Medium: 'var(--risk-medium)',
  High: 'var(--risk-high)',
};

export default function EmployeeDashboard() {
  const [myRequests, setMyRequests] = useState<RequestRecord[]>([]);
  const [approvedTools, setApprovedTools] = useState<ToolRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [reqRes, toolRes] = await Promise.all([
          fetch('/api/requests').then((r) => r.json()),
          fetch('/api/tools').then((r) => r.json()),
        ]);
        setMyRequests((reqRes as RequestRecord[]).filter((r) => r.employeeName === DEMO_EMPLOYEE));
        setApprovedTools((toolRes as ToolRecord[]).filter((t) => (t as any).status === 'approved'));
      } catch {}
      setLoading(false);
    })();
  }, []);

  const pending = myRequests.filter((r) => r.status === 'pending');
  const approved = myRequests.filter((r) => r.status === 'approved');
  const denied = myRequests.filter((r) => r.status === 'denied');
  const recent = [...myRequests]
    .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())
    .slice(0, 5);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <RadarIcon size={24} className="text-accent animate-radar-pulse" />
          <span className="text-sm text-zinc-500 dark:text-zinc-400 font-mono">Loading workspace...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 lg:p-6 max-w-7xl mx-auto w-full space-y-6 text-zinc-900 dark:text-zinc-100">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800 gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <RadarIcon size={16} className="text-accent" />
            <h1 className="text-xl font-serif font-semibold text-zinc-900 dark:text-zinc-100">Employee Workspace</h1>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Welcome back, {DEMO_EMPLOYEE}. Monitor your AI tool requests and governance status.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm rounded-lg px-3 py-2.5">
          <p className="text-sm font-mono uppercase tracking-widest text-zinc-500 dark:text-zinc-400 font-semibold">Total Requests</p>
          <p className="text-xl font-bold font-mono mt-0.5 text-zinc-900 dark:text-zinc-100">{myRequests.length}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm rounded-lg px-3 py-2.5">
          <p className="text-sm font-mono uppercase tracking-widest text-zinc-500 dark:text-zinc-400 font-semibold">Pending</p>
          <p className="text-xl font-bold font-mono mt-0.5" style={{ color: 'var(--risk-medium)' }}>{pending.length}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm rounded-lg px-3 py-2.5">
          <p className="text-sm font-mono uppercase tracking-widest text-zinc-500 dark:text-zinc-400 font-semibold">Approved</p>
          <p className="text-xl font-bold font-mono mt-0.5" style={{ color: 'var(--risk-low)' }}>{approved.length}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm rounded-lg px-3 py-2.5">
          <p className="text-sm font-mono uppercase tracking-widest text-zinc-500 dark:text-zinc-400 font-semibold">Tools Available</p>
          <p className="text-xl font-bold font-mono mt-0.5 text-zinc-900 dark:text-zinc-100">{approvedTools.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History size={14} className="text-zinc-500 dark:text-zinc-400" />
              <h2 className="text-lg font-serif font-semibold text-zinc-900 dark:text-zinc-100">Recent Requests</h2>
            </div>
            <Link href="/employee/requests/new" className="text-sm font-medium text-accent hover:text-accent-hover transition-colors flex items-center gap-1">
              <Send size={11} /> New Request
            </Link>
          </div>

          {recent.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-6">No requests yet. Submit your first AI tool request to get started.</p>
          ) : (
            <div className="space-y-1.5">
              {recent.map((req) => (
                <div key={req.id} className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{req.toolRequested}</p>
                    <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {new Date(req.requestedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {req.department && ` · ${req.department}`}
                    </p>
                  </div>
                  <StatusBadge status={req.status} icon={
                    req.status === 'approved' ? <CheckCircle2 size={9} /> :
                    req.status === 'denied' ? <XCircle size={9} /> :
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
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck size={14} className="text-risk-low" />
              <h2 className="text-lg font-serif font-semibold text-zinc-900 dark:text-zinc-100">Approved Tools</h2>
            </div>
            <Link href="/employee/redress" className="text-sm font-medium text-accent hover:text-accent-hover transition-colors flex items-center gap-1">
              <FileText size={11} /> Redress
            </Link>
          </div>

          {approvedTools.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-6">No approved tools yet. Your admin will provision tools as requests are reviewed.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
              {approvedTools.slice(0, 10).map((tool) => (
                <div key={tool.id} className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{tool.name}</span>
                  {tool.riskTier && (
                    <RiskBadge tier={tool.riskTier} />
                  )}
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link
          href="/employee/requests/new"
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm rounded-xl p-5 hover:border-accent/50 transition-colors group"
        >
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 group-hover:border-accent/30 transition-colors">
              <Wrench size={18} className="text-accent" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-accent transition-colors">Request a New AI Tool</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">Submit an AI tool for security review. Fully classified with NIST AI RMF mapping.</p>
            </div>
          </div>
        </Link>

        <Link
          href="/employee/redress"
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm rounded-xl p-5 hover:border-accent/50 transition-colors group"
        >
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 group-hover:border-accent/30 transition-colors">
              <FileText size={18} className="text-accent" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-accent transition-colors">Right to Explanation</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">EU AI Act Article 86 — view flagged events, understand decisions, and file redress appeals.</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
