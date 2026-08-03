'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Building, Wrench, FileText, CheckCircle2, XCircle, Clock, History, ShieldCheck } from 'lucide-react';
import RadarIcon from '@/components/RadarIcon';
import { toast } from 'sonner';

const DEPARTMENTS = ['Engineering', 'Sales', 'Marketing', 'Finance', 'HR'];

// Demo employee — single implicit user (no real auth in this app)
const DEMO_EMPLOYEE = 'Alice Chen';

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
    (async () => {
      try {
        const [reqRes, toolRes] = await Promise.all([
          fetch('/api/requests').then((r) => r.json()) as Promise<RequestRecord[]>,
          fetch('/api/tools').then((r) => r.json()) as Promise<ToolRecord[]>,
        ]);
        setMyRequests(reqRes.filter((r) => r.employeeName === DEMO_EMPLOYEE));
        setApprovedTools(toolRes.filter((t) => t.status === 'approved'));
      } catch {}
    })();
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
    <div className="flex-1 p-4 max-w-7xl mx-auto w-full text-zinc-900 dark:text-zinc-100">
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
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm rounded-xl p-6 space-y-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <RadarIcon size={16} className="text-accent" />
                <h2 className="font-serif text-zinc-900 dark:text-zinc-100 text-2xl font-bold tracking-tight">Request a New AI Tool</h2>
              </div>
              <p className="text-zinc-600 dark:text-zinc-400 text-sm">
                Submit corporate AI tool requests and track approval statuses.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-mono uppercase tracking-widest text-zinc-700 dark:text-zinc-200 font-semibold flex items-center gap-1">
                  <Wrench size={10} /> Tool Name
                </label>
                <input
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-500 dark:placeholder-zinc-400 focus:border-accent focus:outline-none rounded-lg px-3 py-2 text-sm transition-colors"
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
                <label className="text-sm font-mono uppercase tracking-widest text-zinc-700 dark:text-zinc-200 font-semibold flex items-center gap-1">
                  <FileText size={10} /> Intended Use Case
                </label>
                <input
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-500 dark:placeholder-zinc-400 focus:border-accent focus:outline-none rounded-lg px-3 py-2 text-sm transition-colors"
                  placeholder="e.g. AI note-taking for meeting summaries"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-mono uppercase tracking-widest text-zinc-700 dark:text-zinc-200 font-semibold flex items-center gap-1">
                  <Building size={10} /> Department
                </label>
                <select
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-500 dark:placeholder-zinc-400 focus:border-accent focus:outline-none rounded-lg px-3 py-2 text-sm transition-colors cursor-pointer"
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
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm rounded-xl p-6 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <History size={13} className="text-zinc-500 dark:text-zinc-400" />
              <span className="font-serif text-zinc-900 dark:text-zinc-100 text-lg font-bold tracking-tight">
                Your Request History
              </span>
              <span className="text-sm font-mono text-zinc-500 dark:text-zinc-400 ml-auto">{myRequests.length}</span>
            </div>

            {myRequests.length === 0 ? (
              <p className="text-base text-zinc-500 dark:text-zinc-400 text-center py-4">No previous requests.</p>
            ) : (
              <div className="space-y-1.5 max-h-[260px] overflow-y-auto">
                {[...myRequests]
                  .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())
                  .map((req) => (
                    <div key={req.id} className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-zinc-900 dark:text-zinc-100 font-medium truncate">{req.toolRequested}</span>
                        <span
                          className={`text-sm font-bold font-mono uppercase shrink-0 flex items-center gap-1 ${
                            req.status === 'approved' ? 'text-risk-low' :
                            req.status === 'denied' ? 'text-risk-high' : 'text-risk-medium'
                          }`}
                        >
                          {req.status === 'approved' && <CheckCircle2 size={9} />}
                          {req.status === 'denied' && <XCircle size={9} />}
                          {req.status === 'pending' && <Clock size={9} className="animate-pulse" />}
                          {req.status}
                        </span>
                      </div>
                      <p className="text-zinc-500 dark:text-zinc-400 text-sm font-mono mt-1">
                        {new Date(req.requestedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {req.department && ` · ${req.department}`}
                      </p>
                      {req.status === 'denied' && req.denialReason && (
                        <p className="text-zinc-500 dark:text-zinc-400 text-sm italic mt-1 leading-relaxed">
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
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm rounded-xl p-6 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck size={13} className="text-risk-low" />
              <span className="font-serif text-zinc-900 dark:text-zinc-100 text-lg font-bold tracking-tight">
                Already Approved Tools
              </span>
              <span className="text-sm font-mono text-zinc-500 dark:text-zinc-400 ml-auto">{approvedTools.length}</span>
            </div>

            {approvedTools.length === 0 ? (
              <p className="text-base text-zinc-500 dark:text-zinc-400 text-center py-4">No approved tools yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[420px] overflow-y-auto">
                {approvedTools
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((tool) => (
                    <div key={tool.id} className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-zinc-900 dark:text-zinc-100 font-medium truncate">{tool.name}</span>
                        {tool.riskTier && (
                          <span
                            className="text-sm font-bold font-mono uppercase shrink-0 px-1.5 py-0.5 rounded"
                            style={{ color: RISK_COLOR[tool.riskTier], background: `${RISK_COLOR[tool.riskTier]}15` }}
                          >
                            {tool.riskTier}
                          </span>
                        )}
                      </div>
                      <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1 line-clamp-2 leading-relaxed">{tool.description}</p>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
