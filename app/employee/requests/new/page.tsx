'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Building, Wrench, FileText, CheckCircle2, XCircle, Clock, History, ShieldCheck } from 'lucide-react';
import RadarIcon from '@/components/RadarIcon';
import { RiskBadge, StatusBadge } from '@/components/Badge';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { DEMO_EMPLOYEE } from '@/lib/constants';

const DEPARTMENTS = ['Engineering', 'Sales', 'Marketing', 'Finance', 'HR'];

interface RequestRecord {
  id: string;
  employeeName: string;
  department: string;
  toolRequested: string;
  description?: string;
  status: 'pending' | 'approved' | 'denied';
  denialReason?: string | null;
  requestedAt: string;
  decidedAt: string | null;
}

interface ToolRecord {
  id: string;
  name: string;
  description: string;
  status: string;
  riskTier: 'Low' | 'Medium' | 'High' | null;
  nistFunctions: string[];
  dataCategories: string[];
  justification: string;
  recommendedPolicy: string;
  createdAt: string;
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

export default function NewRequestPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [department, setDepartment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const [myRequests, setMyRequests] = useState<RequestRecord[]>([]);
  const [approvedTools, setApprovedTools] = useState<ToolRecord[]>([]);

  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      try {
        const [reqRes, toolRes] = await Promise.all([
          fetch('/api/requests', { cache: 'no-store' }).then((r) => r.json()) as Promise<RequestRecord[]>,
          fetch('/api/tools', { cache: 'no-store' }).then((r) => r.json()) as Promise<ToolRecord[]>,
        ]);
        if (!mounted) return;
        setMyRequests(reqRes.filter((r) => r.employeeName === DEMO_EMPLOYEE));
        setApprovedTools(toolRes.filter((t) => t.status === 'approved'));
      } catch {}
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

  // Inline hint: if the user types a name that matches an approved tool
  const approvedMatch = useMemo(() => {
    if (!name.trim()) return null;
    const lower = name.trim().toLowerCase();
    return approvedTools.find((t) => t.name.toLowerCase().includes(lower) || lower.includes(t.name.toLowerCase())) ?? null;
  }, [name, approvedTools]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeName: DEMO_EMPLOYEE,
          department,
          toolRequested: name.trim(),
          description: description.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Submission failed');
      }
      // Refresh my requests
      const reqRes = await fetch('/api/requests').then((r) => r.json()) as RequestRecord[];
      setMyRequests(reqRes.filter((r) => r.employeeName === DEMO_EMPLOYEE));
      setDone(true);
      toast.success('Request submitted successfully');
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message || 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-900 dark:text-zinc-100">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm rounded-xl p-8 max-w-sm w-full text-center space-y-4">
          <RadarIcon size={32} className="text-accent mx-auto" />
          <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Request Submitted</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Your request for <span className="font-medium text-zinc-900 dark:text-zinc-100">{name}</span> is pending admin review.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => { setDone(false); setName(''); setDescription(''); setDepartment(''); }}
              className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer"
            >
              Submit Another
            </button>
            <span className="text-zinc-400 dark:text-zinc-500">·</span>
            <button
              onClick={() => router.push('/employee/redress')}
              className="text-sm text-accent hover:text-accent-hover transition-colors cursor-pointer"
            >
              View Redress
            </button>
          </div>
        </div>
      </div>
    );
  }

  const pendingCount = myRequests.filter((r) => r.status === 'pending').length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.3 }}
      className="flex-1 p-4 max-w-7xl mx-auto w-full text-zinc-900 dark:text-zinc-100">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-2 text-sm font-mono text-zinc-500 dark:text-zinc-400">
          <span className="px-1.5 py-0.5 rounded bg-risk-low/10 text-risk-low">{approvedTools.length} approved</span>
          <span>·</span>
          <span className="px-1.5 py-0.5 rounded bg-risk-medium/10 text-risk-medium">{pendingCount} pending</span>
          <span>·</span>
          <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">{myRequests.length} total</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,400px)_minmax(0,1fr)] gap-4 items-start">
        {/* Left column: form + history */}
        <div className="space-y-4">
          {/* Form */}
          <div className="panel p-6 space-y-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <RadarIcon size={16} className="text-accent" />
                <h2 className="font-serif text-text-primary text-2xl font-bold tracking-tight">Request a New AI Tool</h2>
              </div>
              <p className="text-text-tertiary text-sm">
                Submit corporate AI tool requests and track approval statuses.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-mono uppercase tracking-widest text-text-secondary font-semibold flex items-center gap-1">
                  <Wrench size={10} /> Tool Name
                </label>
                <input
                  className="w-full bg-surface-hover border border-border text-text-primary placeholder-text-muted focus:border-accent focus:outline-none rounded-lg px-3 py-2 text-sm transition-colors"
                  placeholder="e.g. NotebookLM, Copilot"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={loading}
                />
                {approvedMatch && (
                  <p className="text-sm text-risk-low flex items-center gap-1 animate-slide-in">
                    <CheckCircle2 size={10} />
                    &ldquo;{approvedMatch.name}&rdquo; is already approved (risk: {approvedMatch.riskTier}). No request needed.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-mono uppercase tracking-widest text-text-secondary font-semibold flex items-center gap-1">
                  <FileText size={10} /> Intended Use Case
                </label>
                <input
                  className="w-full bg-surface-hover border border-border text-text-primary placeholder-text-muted focus:border-accent focus:outline-none rounded-lg px-3 py-2 text-sm transition-colors"
                  placeholder="e.g. AI note-taking for meeting summaries"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-mono uppercase tracking-widest text-text-secondary font-semibold flex items-center gap-1">
                  <Building size={10} /> Department
                </label>
                <select
                  className="w-full bg-surface-hover border border-border text-text-primary focus:border-accent focus:outline-none rounded-lg px-3 py-2 text-sm transition-colors cursor-pointer"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  required
                  disabled={loading}
                >
                  <option value="">Select department...</option>
                  {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              {error && (
                <div className="bg-risk-high/10 border border-risk-high/30 text-risk-high text-sm rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-1.5 text-sm text-white bg-accent hover:bg-accent-hover font-semibold rounded-lg py-2.5 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center gap-1.5 text-sm font-mono text-white/70">
                    <span className="relative inline-flex size-2">
                      <span className="absolute inset-0 rounded-full bg-white animate-ping opacity-40" />
                      <span className="relative inline-block size-2 rounded-full bg-white" />
                    </span>
                    Submitting
                  </span>
                ) : (
                  <><Send size={12} /> Submit Request</>
                )}
              </button>
            </form>
          </div>

          {/* Your Request History */}
          <div className="panel p-6 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <History size={13} className="text-text-tertiary" />
              <span className="font-serif text-text-primary text-lg font-bold tracking-tight">
                Your Request History
              </span>
              <span className="text-sm font-mono text-text-tertiary ml-auto">{myRequests.length}</span>
            </div>

            {myRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                <History size={24} className="text-text-muted" />
                <p className="text-sm text-text-tertiary">No previous requests.</p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[260px] overflow-y-auto">
                {[...myRequests]
                  .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())
                  .map((req) => (
                    <div
                      key={req.id}
                      className="panel border-l-2 p-3 hover:bg-surface-hover transition-colors"
                      style={{ borderLeftColor: STATUS_BORDER_COLOR[req.status] ?? 'var(--border)' }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-text-primary font-medium truncate">{req.toolRequested}</span>
                        <StatusBadge status={req.status} icon={
                          req.status === 'approved' ? <CheckCircle2 size={9} /> :
                          req.status === 'denied'   ? <XCircle size={9} /> :
                          <Clock size={9} className="animate-pulse" />
                        } />
                      </div>
                      <p className="text-text-tertiary text-sm font-mono mt-1">
                        {new Date(req.requestedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {req.department && ` · ${req.department}`}
                      </p>
                      {req.status === 'denied' && req.denialReason && (
                        <p className="text-text-tertiary text-sm italic mt-1 leading-relaxed">
                          Reason: {req.denialReason}
                        </p>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column: approved tools */}
        <div className="space-y-4">
          <div className="panel p-6 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck size={13} className="text-risk-low" />
              <span className="font-serif text-text-primary text-lg font-bold tracking-tight">
                Already Approved Tools
              </span>
              <span className="text-sm font-mono text-text-tertiary ml-auto">{approvedTools.length}</span>
            </div>

            {approvedTools.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                <ShieldCheck size={24} className="text-text-muted" />
                <p className="text-sm text-text-tertiary">No approved tools yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[420px] overflow-y-auto">
                {approvedTools
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((tool) => (
                    <div
                      key={tool.id}
                      className="panel border-l-2 p-3 hover:bg-surface-hover transition-colors"
                      style={{ borderLeftColor: tool.riskTier ? RISK_COLOR[tool.riskTier] : 'var(--risk-low)' }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-text-primary font-medium truncate">{tool.name}</span>
                        {tool.riskTier && <RiskBadge tier={tool.riskTier} />}
                      </div>
                      <p className="text-text-tertiary text-sm mt-1 line-clamp-2 leading-relaxed">{tool.description}</p>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
