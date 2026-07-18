'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Building, Wrench, FileText, CheckCircle2, XCircle, Clock, History, ShieldCheck } from 'lucide-react';
import RadarIcon from '@/components/RadarIcon';

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
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="panel p-6 max-w-sm w-full text-center space-y-3">
          <RadarIcon size={32} className="text-accent mx-auto" />
          <p className="text-sm font-semibold text-text-primary">Request Submitted</p>
          <p className="text-xs text-text-secondary">
            Your request for <span className="font-medium text-text-primary">{name}</span> is pending admin review.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => { setDone(false); setName(''); setDescription(''); setDepartment(''); }}
              className="text-xs text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
            >
              Submit Another
            </button>
            <span className="text-text-muted">·</span>
            <button
              onClick={() => router.push('/employee/redress')}
              className="text-xs text-accent hover:text-accent-hover transition-colors cursor-pointer"
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
    <div className="flex-1 p-4 max-w-6xl mx-auto w-full">
      {/* Quick status bar */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-center gap-2 text-[10px] font-mono text-text-tertiary">
          <span className="px-1.5 py-0.5 rounded bg-risk-low/10 text-risk-low">{approvedTools.length} approved</span>
          <span>·</span>
          <span className="px-1.5 py-0.5 rounded bg-risk-medium/10 text-risk-medium">{pendingCount} pending</span>
          <span>·</span>
          <span className="px-1.5 py-0.5 rounded bg-surface text-text-secondary">{myRequests.length} total</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,400px)_minmax(0,1fr)] gap-3 items-start">
        {/* Left column: form + history */}
        <div className="space-y-3">
          {/* Form */}
          <div className="panel p-4 space-y-3">
            <div className="flex items-center gap-2">
              <RadarIcon size={14} className="text-accent" />
              <h2 className="text-base font-serif font-semibold text-text-primary">Request a New AI Tool</h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-2.5">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-1">
                  <Wrench size={10} /> Tool Name
                </label>
                <input
                  className="w-full bg-background border border-border rounded px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
                  placeholder="e.g. NotebookLM, Copilot"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={loading}
                />
                {approvedMatch && (
                  <p className="text-[10px] text-risk-low flex items-center gap-1 animate-slide-in">
                    <CheckCircle2 size={10} />
                    &ldquo;{approvedMatch.name}&rdquo; is already approved (risk: {approvedMatch.riskTier}). No request needed.
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-1">
                  <FileText size={10} /> What will you use it for?
                </label>
                <input
                  className="w-full bg-background border border-border rounded px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
                  placeholder="e.g. AI note-taking for meeting summaries"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-1">
                  <Building size={10} /> Department
                </label>
                <select
                  className="w-full bg-background border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors"
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
                <div className="bg-risk-high/10 border border-risk-high/30 text-risk-high text-xs rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-text-primary bg-surface-hover hover:bg-surface border border-border rounded px-4 py-2 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center gap-1.5 text-text-tertiary text-xs font-mono">
                    <span className="relative inline-flex size-2">
                      <span className="absolute inset-0 rounded-full bg-accent animate-ping opacity-40" />
                      <span className="relative inline-block size-2 rounded-full bg-accent" />
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
          <div className="panel p-3">
            <div className="flex items-center gap-2 mb-2">
              <History size={12} className="text-text-tertiary" />
              <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                Your Request History
              </span>
              <span className="text-[10px] font-mono text-text-tertiary ml-auto">{myRequests.length}</span>
            </div>

            {myRequests.length === 0 ? (
              <p className="text-[11px] text-text-tertiary text-center py-4">No previous requests.</p>
            ) : (
              <div className="space-y-1.5 max-h-[260px] overflow-y-auto">
                {[...myRequests]
                  .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())
                  .map((req) => (
                    <div key={req.id} className="bg-background border border-border rounded-lg p-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-text-primary font-medium truncate">{req.toolRequested}</span>
                        <span
                          className={`text-[9px] font-bold font-mono uppercase shrink-0 flex items-center gap-1 ${
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
                      <p className="text-[9px] text-text-muted font-mono mt-0.5">
                        {new Date(req.requestedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {req.department && ` · ${req.department}`}
                      </p>
                      {req.status === 'denied' && req.denialReason && (
                        <p className="text-[10px] text-text-tertiary italic mt-1 leading-relaxed">
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
        <div className="space-y-3">
          <div className="panel p-3">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck size={12} className="text-risk-low" />
              <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                Already Approved Tools
              </span>
              <span className="text-[10px] font-mono text-text-tertiary ml-auto">{approvedTools.length}</span>
            </div>

            {approvedTools.length === 0 ? (
              <p className="text-[11px] text-text-tertiary text-center py-4">No approved tools yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[420px] overflow-y-auto">
                {approvedTools
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((tool) => (
                    <div key={tool.id} className="bg-background border border-border rounded-lg p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-text-primary font-medium truncate">{tool.name}</span>
                        {tool.riskTier && (
                          <span
                            className="text-[9px] font-bold font-mono uppercase shrink-0 px-1.5 py-0.5 rounded"
                            style={{ color: RISK_COLOR[tool.riskTier], background: `${RISK_COLOR[tool.riskTier]}15` }}
                          >
                            {tool.riskTier}
                          </span>
                        )}
                      </div>
                      <p className="text-[9px] text-text-muted mt-0.5 line-clamp-2 leading-relaxed">{tool.description}</p>
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
