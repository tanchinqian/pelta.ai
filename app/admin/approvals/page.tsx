'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle, XCircle, ChevronDown, ChevronUp, FileText, Shield,
  Briefcase, ShieldAlert,
} from 'lucide-react';
import RadarIcon from '@/components/RadarIcon';

/* ── Types ──────────────────────────────────────────────── */

interface AccessRequest {
  id: string;
  employeeName: string;
  sections: string[];
  riskLevel: 'low' | 'medium' | 'high' | null;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  adminComment: string | null;
  reviewerName: string | null;
  logRef: string;
  requestedAt: string;
  decidedAt: string | null;
}

interface ToolRequest {
  id: string;
  employeeName: string;
  department: string;
  toolRequested: string;
  status: 'pending' | 'approved' | 'denied';
  requestedAt: string;
  decidedAt: string | null;
}

interface AuditEntry {
  id: string;
  requestId: string;
  employeeName: string;
  action: 'approved' | 'rejected';
  reviewerName: string;
  adminComment: string | null;
  sections: string[];
  riskLevel: string | null;
  timestamp: string;
}

/* ── Helpers ────────────────────────────────────────────── */

const RISK_COLOR: Record<string, string> = {
  high: 'var(--risk-high)',
  medium: 'var(--risk-medium)',
  low: 'var(--risk-low)',
};
const RISK_BG: Record<string, string> = {
  high: 'var(--risk-high-bg)',
  medium: 'var(--risk-medium-bg)',
  low: 'var(--risk-low-bg)',
};
const STATUS_COLOR: Record<string, string> = {
  approved: 'var(--risk-low)',
  rejected: 'var(--risk-high)',
  denied: 'var(--risk-high)',
  pending: 'var(--risk-medium)',
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function RiskBadge({ level }: { level: string | null }) {
  const l = (level ?? 'low').toLowerCase();
  return (
    <span
      className="text-[9px] font-bold font-mono uppercase px-1.5 py-0.5 rounded"
      style={{ color: RISK_COLOR[l] ?? RISK_COLOR.low, background: RISK_BG[l] ?? RISK_BG.low }}
    >
      {l}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className="text-[9px] font-bold font-mono uppercase px-1.5 py-0.5 rounded border"
      style={{
        color: STATUS_COLOR[status] ?? 'var(--text-secondary)',
        borderColor: `${STATUS_COLOR[status] ?? 'var(--border)'}40`,
        background: `${STATUS_COLOR[status] ?? 'transparent'}0d`,
      }}
    >
      {status}
    </span>
  );
}

function SectionTag({ label }: { label: string }) {
  return (
    <span className="text-[9px] font-medium font-mono px-1.5 py-0.5 rounded bg-background border border-border text-text-secondary">
      {label}
    </span>
  );
}

/* ── Redress Appeal Detail Modal ────────────────────────── */

function AppealDetailModal({
  req, onClose, onApprove, onStartReject,
  rejectingId, rejectionDraft, onRejectionChange, onSendRejection, onCancelReject,
}: {
  req: AccessRequest; onClose: () => void;
  onApprove: (id: string) => void; onStartReject: (id: string) => void;
  rejectingId: string | null; rejectionDraft: string;
  onRejectionChange: (v: string) => void;
  onSendRejection: (id: string) => void; onCancelReject: () => void;
}) {
  const isRejecting = rejectingId === req.id;
  const isPending = req.status === 'pending';
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="panel w-full max-w-lg animate-slide-in" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <ShieldAlert size={13} className="text-accent" />
            <span className="text-sm font-semibold text-text-primary">Redress Appeal</span>
          </div>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer text-xs font-mono px-2 py-1 rounded hover:bg-surface-hover">ESC</button>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-text-primary">{req.employeeName}</p>
              <p className="text-[10px] font-mono text-text-tertiary mt-0.5">ID: {req.id.slice(0, 16)}…</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <StatusBadge status={req.status} />
              {req.riskLevel && <RiskBadge level={req.riskLevel} />}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-1.5">Requested Data Categories</p>
            <div className="flex flex-wrap gap-1">{req.sections.map((s) => <SectionTag key={s} label={s} />)}</div>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-1.5">Reason for Access</p>
            <p className="text-xs text-text-secondary leading-relaxed bg-background border border-border rounded p-2.5">{req.reason}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-background border border-border rounded p-2.5">
              <p className="text-[9px] font-semibold text-text-tertiary uppercase tracking-wider">Submitted</p>
              <p className="text-[11px] font-mono text-text-secondary mt-0.5">{fmt(req.requestedAt)}</p>
            </div>
            <div className="bg-background border border-border rounded p-2.5">
              <p className="text-[9px] font-semibold text-text-tertiary uppercase tracking-wider">Decided</p>
              <p className="text-[11px] font-mono text-text-secondary mt-0.5">{req.decidedAt ? fmt(req.decidedAt) : '—'}</p>
            </div>
          </div>
          {req.reviewerName && (
            <div>
              <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-1">Reviewed by</p>
              <p className="text-xs font-mono text-text-secondary">{req.reviewerName}</p>
            </div>
          )}
          {req.adminComment && (
            <div>
              <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-1">Admin Comment</p>
              <p className="text-xs text-text-secondary leading-relaxed bg-background border border-border rounded p-2.5">{req.adminComment}</p>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-text-tertiary border-t border-border pt-3">
            <Shield size={10} />
            <span>NIST AI RMF — Govern · Manage &nbsp;|&nbsp; Audit trail logged</span>
          </div>
          {isPending && (
            <div>
              {!isRejecting ? (
                <div className="flex items-center gap-2">
                  <button id={`approve-modal-${req.id}`} onClick={() => onApprove(req.id)}
                    className="flex items-center gap-1.5 text-[11px] font-semibold text-risk-low bg-risk-low/10 hover:bg-risk-low/20 border border-risk-low/30 rounded px-3 py-1.5 transition-colors cursor-pointer">
                    <CheckCircle size={12} /> Approve
                  </button>
                  <button id={`reject-modal-${req.id}`} onClick={() => onStartReject(req.id)}
                    className="flex items-center gap-1.5 text-[11px] font-semibold text-risk-high bg-risk-high/10 hover:bg-risk-high/20 border border-risk-high/30 rounded px-3 py-1.5 transition-colors cursor-pointer">
                    <XCircle size={12} /> Decline
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <textarea
                    className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-[11px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors resize-none"
                    placeholder="Reason for declining (required)..."
                    rows={3} value={rejectionDraft}
                    onChange={(e) => onRejectionChange(e.target.value)} autoFocus
                  />
                  <div className="flex items-center gap-2">
                    <button onClick={() => onSendRejection(req.id)} disabled={!rejectionDraft.trim()}
                      className="text-[11px] font-semibold text-risk-high bg-risk-high/10 hover:bg-risk-high/20 border border-risk-high/30 rounded px-3 py-1.5 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">
                      Confirm Decline
                    </button>
                    <button onClick={onCancelReject} className="text-[11px] text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Tool Request Detail Modal ──────────────────────────── */

function ToolDetailModal({
  req, onClose, onApprove, onDeny,
}: {
  req: ToolRequest; onClose: () => void;
  onApprove: (id: string) => void; onDeny: (id: string) => void;
}) {
  const isPending = req.status === 'pending';
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="panel w-full max-w-md animate-slide-in">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Briefcase size={13} className="text-accent" />
            <span className="text-sm font-semibold text-text-primary">Tool Request</span>
          </div>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer text-xs font-mono px-2 py-1 rounded hover:bg-surface-hover">ESC</button>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-text-primary">{req.employeeName}</p>
              <p className="text-[10px] font-mono text-text-tertiary mt-0.5">{req.department}</p>
            </div>
            <StatusBadge status={req.status} />
          </div>
          <div className="bg-background border border-border rounded p-3">
            <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1">Requested Tool</p>
            <p className="text-sm font-medium text-text-primary">{req.toolRequested}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-background border border-border rounded p-2.5">
              <p className="text-[9px] font-semibold text-text-tertiary uppercase tracking-wider">Submitted</p>
              <p className="text-[11px] font-mono text-text-secondary mt-0.5">{fmt(req.requestedAt)}</p>
            </div>
            <div className="bg-background border border-border rounded p-2.5">
              <p className="text-[9px] font-semibold text-text-tertiary uppercase tracking-wider">Decided</p>
              <p className="text-[11px] font-mono text-text-secondary mt-0.5">{req.decidedAt ? fmt(req.decidedAt) : '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-text-tertiary border-t border-border pt-3">
            <Shield size={10} />
            <span>NIST AI RMF — Govern · Map</span>
          </div>
          {isPending && (
            <div className="flex items-center gap-2">
              <button onClick={() => onApprove(req.id)}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-risk-low bg-risk-low/10 hover:bg-risk-low/20 border border-risk-low/30 rounded px-3 py-1.5 transition-colors cursor-pointer">
                <CheckCircle size={12} /> Approve
              </button>
              <button onClick={() => onDeny(req.id)}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-risk-high bg-risk-high/10 hover:bg-risk-high/20 border border-risk-high/30 rounded px-3 py-1.5 transition-colors cursor-pointer">
                <XCircle size={12} /> Deny
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Stat mini ──────────────────────────────────────────── */

function StatMini({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="panel px-3 py-2">
      <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">{label}</p>
      <p className="text-lg font-bold font-mono mt-0.5" style={{ color }}>{value}</p>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────── */

type Tab = 'appeals' | 'tools';
type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected';
type ToolFilterStatus = 'all' | 'pending' | 'approved' | 'denied';

export default function RequestsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('appeals');

  // ── Redress Appeals state ──
  const [appeals, setAppeals] = useState<AccessRequest[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [selectedAppeal, setSelectedAppeal] = useState<AccessRequest | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionDraft, setRejectionDraft] = useState('');
  const [showAudit, setShowAudit] = useState(false);
  const [appealFilter, setAppealFilter] = useState<FilterStatus>('all');

  // ── Tool Requests state ──
  const [toolReqs, setToolReqs] = useState<ToolRequest[]>([]);
  const [selectedTool, setSelectedTool] = useState<ToolRequest | null>(null);
  const [toolFilter, setToolFilter] = useState<ToolFilterStatus>('all');

  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [reqs, audit, tools] = await Promise.all([
      fetch('/api/access-requests').then((r) => r.json()),
      fetch('/api/audit-log').then((r) => r.json()),
      fetch('/api/requests').then((r) => r.json()),
    ]);
    setAppeals(Array.isArray(reqs) ? reqs : []);
    setAuditLog(Array.isArray(audit) ? audit : []);
    setToolReqs(Array.isArray(tools) ? tools : []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setSelectedAppeal(null); setSelectedTool(null); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // ── Appeal actions ──
  const updateAppeal = async (id: string, status: 'approved' | 'rejected', adminComment?: string) => {
    const now = new Date().toISOString();
    const patch = { status, adminComment: adminComment ?? null, reviewerName: 'Admin', decidedAt: now };
    setAppeals((prev) => prev.map((r) => r.id === id ? { ...r, ...patch } : r));
    setSelectedAppeal((prev) => prev && prev.id === id ? { ...prev, ...patch } : prev);
    await fetch('/api/access-requests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status, adminComment, reviewerName: 'Admin' }),
    });
    setRejectingId(null); setRejectionDraft('');
    const audit = await fetch('/api/audit-log').then((r) => r.json());
    setAuditLog(Array.isArray(audit) ? audit : []);
  };

  // ── Tool request actions ──
  const updateToolReq = async (id: string, status: 'approved' | 'denied') => {
    setToolReqs((prev) => prev.map((r) => r.id === id ? { ...r, status, decidedAt: new Date().toISOString() } : r));
    setSelectedTool((prev) => prev && prev.id === id ? { ...prev, status, decidedAt: new Date().toISOString() } : prev);
    await fetch('/api/requests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
  };

  // ── Derived ──
  const pendingAppeals = appeals.filter((r) => r.status === 'pending');
  const pendingTools = toolReqs.filter((r) => r.status === 'pending');
  const totalPending = pendingAppeals.length + pendingTools.length;

  const filteredAppeals = appealFilter === 'all' ? appeals : appeals.filter((r) => r.status === appealFilter);
  const filteredTools = toolFilter === 'all' ? toolReqs : toolReqs.filter((r) => r.status === toolFilter);

  const sortedAppeals = [...filteredAppeals].sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;
    return new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime();
  });

  const sortedTools = [...filteredTools].sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;
    return new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime();
  });

  const searchedAppeals = sortedAppeals.filter((r) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      r.employeeName.toLowerCase().includes(q) ||
      r.reason.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q) ||
      (r.riskLevel || '').toLowerCase().includes(q)
    );
  });

  const searchedTools = sortedTools.filter((r) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      r.employeeName.toLowerCase().includes(q) ||
      r.toolRequested.toLowerCase().includes(q) ||
      r.department.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <RadarIcon size={24} className="text-accent animate-radar-pulse" />
        <span className="text-xs text-text-tertiary font-mono">Loading requests...</span>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 p-4 max-w-5xl mx-auto w-full space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RadarIcon size={14} className="text-accent" />
            <span className="text-sm font-semibold text-text-primary">Requests</span>
            <span className="text-[10px] font-mono text-text-tertiary">/ admin only</span>
            {totalPending > 0 && (
              <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded"
                style={{ color: STATUS_COLOR.pending, background: `${STATUS_COLOR.pending}15` }}>
                {totalPending} pending
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-text-tertiary">
            <Shield size={10} />
            <span>NIST AI RMF — Govern · Manage</span>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          <StatMini label="Pending Appeals" value={pendingAppeals.length} color={STATUS_COLOR.pending} />
          <StatMini label="Approved Appeals" value={appeals.filter(r => r.status === 'approved').length} color={STATUS_COLOR.approved} />
          <StatMini label="Rejected Appeals" value={appeals.filter(r => r.status === 'rejected').length} color={STATUS_COLOR.rejected} />
          <StatMini label="Pending Tools" value={pendingTools.length} color={STATUS_COLOR.pending} />
          <StatMini label="Approved Tools" value={toolReqs.filter(r => r.status === 'approved').length} color={STATUS_COLOR.approved} />
          <StatMini label="Denied Tools" value={toolReqs.filter(r => r.status === 'denied').length} color={STATUS_COLOR.rejected} />
        </div>

        {/* Tabs */}
        <div className="flex items-center border-b border-border gap-0">
          <TabButton
            active={activeTab === 'appeals'} onClick={() => { setActiveTab('appeals'); setSearchQuery(''); }}
            label="Redress Appeals" badge={pendingAppeals.length}
            icon={<ShieldAlert size={11} />}
          />
          <TabButton
            active={activeTab === 'tools'} onClick={() => { setActiveTab('tools'); setSearchQuery(''); }}
            label="Tool Requests" badge={pendingTools.length}
            icon={<Briefcase size={11} />}
          />
        </div>

        {/* ── Tab: Redress Appeals ──────────────────────────── */}
        {activeTab === 'appeals' && (
          <div className="space-y-3 animate-slide-in">
            {/* Filter tabs + Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface/30 p-2 rounded border border-border/60">
              <div className="flex items-center gap-1 text-[11px] font-medium flex-wrap">
                {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => {
                  const count = f === 'all' ? appeals.length : appeals.filter((r) => r.status === f).length;
                  return (
                    <button key={f} id={`appeal-filter-${f}`} onClick={() => setAppealFilter(f)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded capitalize transition-colors cursor-pointer ${
                        appealFilter === f ? 'bg-surface-hover text-text-primary border border-border/80' : 'text-text-tertiary border border-transparent hover:text-text-secondary hover:bg-surface-hover/50'
                      }`}>
                      {f}
                      <span className={`text-[9px] font-mono px-1 py-0.5 rounded leading-none ${appealFilter === f ? 'bg-background text-text-secondary' : 'bg-surface text-text-tertiary'}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
              <input
                type="text"
                placeholder="Search appeals..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-background border border-border rounded px-2.5 py-1 text-[11px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent w-full sm:w-48 transition-colors"
              />
            </div>

            {/* Table */}
            <div className="panel p-0 overflow-hidden">
              {searchedAppeals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <RadarIcon size={24} className="text-accent animate-radar-pulse" />
                  <span className="text-xs text-text-tertiary">
                    {searchQuery ? 'No matching appeals found.' : appealFilter === 'all' ? 'No appeals yet.' : `No ${appealFilter} appeals.`}
                  </span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-text-secondary border-b border-border bg-surface/60">
                        <th className="py-2 px-3 font-medium">Employee</th>
                        <th className="py-2 pr-3 font-medium hidden sm:table-cell">Request ID</th>
                        <th className="py-2 pr-3 font-medium hidden md:table-cell">Data Categories</th>
                        <th className="py-2 pr-3 font-medium">Risk</th>
                        <th className="py-2 pr-3 font-medium hidden lg:table-cell">Reason</th>
                        <th className="py-2 pr-3 font-medium hidden lg:table-cell">Submitted</th>
                        <th className="py-2 pr-3 font-medium">Status</th>
                        <th className="py-2 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {searchedAppeals.map((req, i) => (
                        <tr key={req.id} className={`border-b border-border/40 hover:bg-surface-hover/50 transition-colors ${i % 2 === 1 ? 'bg-surface-hover/20' : ''}`}>
                          <td className="py-2 px-3 font-medium text-text-primary whitespace-nowrap">{req.employeeName}</td>
                          <td className="py-2 pr-3 text-[10px] font-mono text-text-tertiary whitespace-nowrap hidden sm:table-cell">{req.id.slice(0, 8)}…</td>
                          <td className="py-2 pr-3 hidden md:table-cell">
                            <div className="flex flex-wrap gap-1">{req.sections.map((s) => <SectionTag key={s} label={s} />)}</div>
                          </td>
                          <td className="py-2 pr-3 whitespace-nowrap"><RiskBadge level={req.riskLevel} /></td>
                          <td className="py-2 pr-3 text-[10px] text-text-tertiary max-w-[160px] truncate hidden lg:table-cell">{req.reason}</td>
                          <td className="py-2 pr-3 text-[10px] font-mono text-text-tertiary whitespace-nowrap hidden lg:table-cell">{fmt(req.requestedAt)}</td>
                          <td className="py-2 pr-3 whitespace-nowrap"><StatusBadge status={req.status} /></td>
                          <td className="py-2">
                            <div className="flex items-center gap-1.5">
                              <button id={`view-appeal-${req.id}`} onClick={() => setSelectedAppeal(req)}
                                className="text-[10px] font-mono text-text-tertiary hover:text-text-primary transition-colors cursor-pointer px-1.5 py-0.5 rounded hover:bg-surface-hover">
                                View
                              </button>
                              {req.status === 'pending' && (
                                <>
                                  <button id={`approve-appeal-${req.id}`} onClick={() => updateAppeal(req.id, 'approved')}
                                    className="flex items-center gap-1 text-[10px] font-semibold text-risk-low bg-risk-low/10 hover:bg-risk-low/20 border border-risk-low/30 rounded px-2 py-0.5 transition-colors cursor-pointer">
                                    <CheckCircle size={10} /> Approve
                                  </button>
                                  <button id={`decline-appeal-${req.id}`} onClick={() => { setRejectingId(req.id); setSelectedAppeal(req); }}
                                    className="flex items-center gap-1 text-[10px] font-semibold text-risk-high bg-risk-high/10 hover:bg-risk-high/20 border border-risk-high/30 rounded px-2 py-0.5 transition-colors cursor-pointer">
                                    <XCircle size={10} /> Decline
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Audit log accordion */}
            <div className="panel overflow-hidden">
              <button id="toggle-audit-log" onClick={() => setShowAudit((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-surface-hover/50 transition-colors cursor-pointer">
                <div className="flex items-center gap-2">
                  <FileText size={12} className="text-text-tertiary" />
                  <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">Audit Trail</span>
                  <span className="text-[10px] font-mono text-text-tertiary">({auditLog.length} entries)</span>
                </div>
                {showAudit ? <ChevronUp size={13} className="text-text-tertiary" /> : <ChevronDown size={13} className="text-text-tertiary" />}
              </button>
              {showAudit && (
                <div className="border-t border-border">
                  {auditLog.length === 0 ? (
                    <p className="text-[11px] text-text-tertiary text-center py-4">No audit entries yet.</p>
                  ) : (
                    <div className="overflow-x-auto" style={{ maxHeight: 280 }}>
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-surface">
                          <tr className="text-left text-text-secondary border-b border-border">
                            <th className="py-1.5 px-3 font-medium">Timestamp</th>
                            <th className="py-1.5 pr-3 font-medium">Employee</th>
                            <th className="py-1.5 pr-3 font-medium">Action</th>
                            <th className="py-1.5 pr-3 font-medium hidden sm:table-cell">Reviewer</th>
                            <th className="py-1.5 pr-3 font-medium hidden md:table-cell">Categories</th>
                            <th className="py-1.5 pr-3 font-medium hidden md:table-cell">Risk</th>
                            <th className="py-1.5 font-medium hidden lg:table-cell">Comment</th>
                          </tr>
                        </thead>
                        <tbody>
                          {auditLog.map((entry, i) => (
                            <tr key={entry.id} className={`border-b border-border/40 ${i % 2 === 1 ? 'bg-surface-hover/20' : ''}`}>
                              <td className="py-1.5 px-3 text-[10px] font-mono text-text-tertiary whitespace-nowrap">{fmt(entry.timestamp)}</td>
                              <td className="py-1.5 pr-3 text-[11px] font-medium text-text-primary whitespace-nowrap">{entry.employeeName}</td>
                              <td className="py-1.5 pr-3 whitespace-nowrap">
                                <span className="text-[9px] font-bold font-mono uppercase"
                                  style={{ color: entry.action === 'approved' ? 'var(--risk-low)' : 'var(--risk-high)' }}>
                                  {entry.action}
                                </span>
                              </td>
                              <td className="py-1.5 pr-3 text-[10px] font-mono text-text-secondary hidden sm:table-cell whitespace-nowrap">{entry.reviewerName}</td>
                              <td className="py-1.5 pr-3 hidden md:table-cell">
                                <div className="flex flex-wrap gap-1">{entry.sections.map((s) => <SectionTag key={s} label={s} />)}</div>
                              </td>
                              <td className="py-1.5 pr-3 hidden md:table-cell whitespace-nowrap"><RiskBadge level={entry.riskLevel} /></td>
                              <td className="py-1.5 text-[10px] text-text-tertiary truncate max-w-[160px] hidden lg:table-cell">{entry.adminComment ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Tab: Tool Requests ───────────────────────────── */}
        {activeTab === 'tools' && (
          <div className="space-y-3 animate-slide-in">
            {/* Filter tabs + Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface/30 p-2 rounded border border-border/60">
              <div className="flex items-center gap-1 text-[11px] font-medium flex-wrap">
                {(['all', 'pending', 'approved', 'denied'] as const).map((f) => {
                  const count = f === 'all' ? toolReqs.length : toolReqs.filter((r) => r.status === f).length;
                  return (
                    <button key={f} id={`tool-filter-${f}`} onClick={() => setToolFilter(f)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded capitalize transition-colors cursor-pointer ${
                        toolFilter === f ? 'bg-surface-hover text-text-primary border border-border/80' : 'text-text-tertiary border border-transparent hover:text-text-secondary hover:bg-surface-hover/50'
                      }`}>
                      {f}
                      <span className={`text-[9px] font-mono px-1 py-0.5 rounded leading-none ${toolFilter === f ? 'bg-background text-text-secondary' : 'bg-surface text-text-tertiary'}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
              <input
                type="text"
                placeholder="Search tool requests..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-background border border-border rounded px-2.5 py-1 text-[11px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent w-full sm:w-48 transition-colors"
              />
            </div>

            {/* Table */}
            <div className="panel p-0 overflow-hidden">
              {searchedTools.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <RadarIcon size={24} className="text-accent animate-radar-pulse" />
                  <span className="text-xs text-text-tertiary">
                    {searchQuery ? 'No matching tool requests found.' : toolFilter === 'all' ? 'No tool requests yet.' : `No ${toolFilter} tool requests.`}
                  </span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-text-secondary border-b border-border bg-surface/60">
                        <th className="py-2 px-3 font-medium">Employee</th>
                        <th className="py-2 pr-3 font-medium hidden sm:table-cell">Department</th>
                        <th className="py-2 pr-3 font-medium">Tool Requested</th>
                        <th className="py-2 pr-3 font-medium hidden lg:table-cell">Submitted</th>
                        <th className="py-2 pr-3 font-medium">Status</th>
                        <th className="py-2 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {searchedTools.map((req, i) => (
                        <tr key={req.id} className={`border-b border-border/40 hover:bg-surface-hover/50 transition-colors ${i % 2 === 1 ? 'bg-surface-hover/20' : ''}`}>
                          <td className="py-2 px-3 font-medium text-text-primary whitespace-nowrap">{req.employeeName}</td>
                          <td className="py-2 pr-3 text-[10px] font-mono text-text-tertiary whitespace-nowrap hidden sm:table-cell">{req.department}</td>
                          <td className="py-2 pr-3 font-medium text-text-primary">{req.toolRequested}</td>
                          <td className="py-2 pr-3 text-[10px] font-mono text-text-tertiary whitespace-nowrap hidden lg:table-cell">{fmt(req.requestedAt)}</td>
                          <td className="py-2 pr-3 whitespace-nowrap"><StatusBadge status={req.status} /></td>
                          <td className="py-2">
                            <div className="flex items-center gap-1.5">
                              <button id={`view-tool-${req.id}`} onClick={() => setSelectedTool(req)}
                                className="text-[10px] font-mono text-text-tertiary hover:text-text-primary transition-colors cursor-pointer px-1.5 py-0.5 rounded hover:bg-surface-hover">
                                View
                              </button>
                              {req.status === 'pending' && (
                                <>
                                  <button id={`approve-tool-${req.id}`} onClick={() => updateToolReq(req.id, 'approved')}
                                    className="flex items-center gap-1 text-[10px] font-semibold text-risk-low bg-risk-low/10 hover:bg-risk-low/20 border border-risk-low/30 rounded px-2 py-0.5 transition-colors cursor-pointer">
                                    <CheckCircle size={10} /> Approve
                                  </button>
                                  <button id={`deny-tool-${req.id}`} onClick={() => updateToolReq(req.id, 'denied')}
                                    className="flex items-center gap-1 text-[10px] font-semibold text-risk-high bg-risk-high/10 hover:bg-risk-high/20 border border-risk-high/30 rounded px-2 py-0.5 transition-colors cursor-pointer">
                                    <XCircle size={10} /> Deny
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Appeal Detail Modal */}
      {selectedAppeal && (
        <AppealDetailModal
          req={selectedAppeal}
          onClose={() => { setSelectedAppeal(null); setRejectingId(null); setRejectionDraft(''); }}
          onApprove={(id) => updateAppeal(id, 'approved')}
          onStartReject={(id) => setRejectingId(id)}
          rejectingId={rejectingId}
          rejectionDraft={rejectionDraft}
          onRejectionChange={setRejectionDraft}
          onSendRejection={(id) => updateAppeal(id, 'rejected', rejectionDraft)}
          onCancelReject={() => { setRejectingId(null); setRejectionDraft(''); }}
        />
      )}

      {/* Tool Detail Modal */}
      {selectedTool && (
        <ToolDetailModal
          req={selectedTool}
          onClose={() => setSelectedTool(null)}
          onApprove={(id) => { updateToolReq(id, 'approved'); setSelectedTool(null); }}
          onDeny={(id) => { updateToolReq(id, 'denied'); setSelectedTool(null); }}
        />
      )}
    </>
  );
}

/* ── TabButton ──────────────────────────────────────────── */

function TabButton({ active, onClick, label, badge, icon }: {
  active: boolean; onClick: () => void;
  label: string; badge: number; icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
        active
          ? 'border-accent text-text-primary'
          : 'border-transparent text-text-tertiary hover:text-text-secondary hover:border-border'
      }`}
    >
      {icon}
      {label}
      {badge > 0 && (
        <span className="text-[9px] font-bold font-mono px-1 py-0.5 rounded leading-none"
          style={{ color: 'var(--risk-medium)', background: 'rgba(245,158,11,0.12)' }}>
          {badge}
        </span>
      )}
    </button>
  );
}
