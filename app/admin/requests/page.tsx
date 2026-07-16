'use client';

import { useState, useEffect } from 'react';
import { ClipboardList, CheckCircle, XCircle } from 'lucide-react';
import RadarIcon from '@/components/RadarIcon';

interface RequestRecord {
  id: string; employeeName: string; department: string;
  toolRequested: string; status: string;
  requestedAt: string; decidedAt: string | null;
}

const STATUS_COLOR: Record<string, string> = {
  approved: 'var(--risk-low)', denied: 'var(--risk-high)', pending: 'var(--risk-medium)',
};

export default function RequestsPage() {
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    const res = await fetch('/api/requests');
    if (res.ok) setRequests(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchRequests(); }, []);

  const updateStatus = async (id: string, status: 'approved' | 'denied') => {
    setRequests((prev) => prev.map((r) =>
      r.id === id ? { ...r, status, decidedAt: new Date().toISOString() } : r
    ));
    await fetch('/api/requests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
  };

  const pending = requests.filter((r) => r.status === 'pending');
  const decided = requests.filter((r) => r.status !== 'pending');

  return (
    <div className="flex-1 p-4 max-w-4xl mx-auto w-full space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <RadarIcon size={14} className="text-accent" />
        <span className="text-sm font-semibold text-text-primary">Approval Requests</span>
        <span className="text-[10px] font-mono text-text-tertiary">/ {pending.length} pending</span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <StatMini label="Pending" value={pending.length} color={STATUS_COLOR.pending} />
        <StatMini label="Approved" value={decided.filter((r) => r.status === 'approved').length} color={STATUS_COLOR.approved} />
        <StatMini label="Denied" value={decided.filter((r) => r.status === 'denied').length} color={STATUS_COLOR.denied} />
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <RadarIcon size={24} className="text-accent animate-radar-pulse" />
          <span className="text-xs text-text-tertiary font-mono">Loading requests...</span>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">Pending</span>
              {pending.map((req) => (
                <RequestRow key={req.id} req={req} onAction={updateStatus} />
              ))}
            </div>
          )}

          {decided.length > 0 && (
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">Decided</span>
              {decided.map((req, i) => (
                <div key={req.id} className={`panel px-4 py-2.5 flex items-center justify-between ${i % 2 === 1 ? 'bg-surface-hover/20' : ''}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-text-primary">{req.employeeName}</span>
                    <span className="text-[10px] font-mono text-text-tertiary">{req.department}</span>
                    <span className="text-[10px] font-mono text-text-secondary">→ {req.toolRequested}</span>
                  </div>
                  <span className="text-[10px] font-bold font-mono uppercase" style={{ color: STATUS_COLOR[req.status] }}>
                    {req.status}
                  </span>
                </div>
              ))}
            </div>
          )}

          {requests.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 border border-dashed border-border rounded-lg gap-3">
              <RadarIcon size={24} className="text-accent animate-radar-pulse" />
              <span className="text-xs text-text-tertiary">No requests yet.</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function RequestRow({ req, onAction }: { req: RequestRecord; onAction: (id: string, status: 'approved' | 'denied') => void }) {
  return (
    <div className="panel px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-text-primary">{req.employeeName}</span>
        <span className="text-[10px] font-mono text-text-tertiary">{req.department}</span>
        <span className="text-[10px] font-mono text-text-secondary">→ {req.toolRequested}</span>
        <span className="text-[10px] font-mono text-text-muted">
          {new Date(req.requestedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onAction(req.id, 'approved')}
          className="flex items-center gap-1 text-[10px] font-semibold text-risk-low bg-risk-low/10 hover:bg-risk-low/20 border border-risk-low/30 rounded px-2.5 py-1 transition-colors cursor-pointer"
        >
          <CheckCircle size={11} /> Approve
        </button>
        <button
          onClick={() => onAction(req.id, 'denied')}
          className="flex items-center gap-1 text-[10px] font-semibold text-risk-high bg-risk-high/10 hover:bg-risk-high/20 border border-risk-high/30 rounded px-2.5 py-1 transition-colors cursor-pointer"
        >
          <XCircle size={11} /> Deny
        </button>
      </div>
    </div>
  );
}

function StatMini({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="panel px-3 py-2">
      <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">{label}</p>
      <p className="text-lg font-bold font-mono mt-0.5" style={{ color }}>{value}</p>
    </div>
  );
}
