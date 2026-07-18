'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, ChevronDown, ChevronUp, Copy, Check, Clock, ShieldAlert,
  History, CheckCircle2, XCircle, AlertCircle, ChevronRight,
  FileText, ScanLine, Gavel, Bell,
} from 'lucide-react';
import RadarIcon from '@/components/RadarIcon';
import { renderHighlightedText, listDetectedPatterns } from '@/lib/highlightUtils';

/* ── Types ──────────────────────────────────────────────── */

interface GuardLog {
  id: string;
  promptSnippet: string;
  verdict: 'allow' | 'flag' | 'block';
  riskLevel: 'none' | 'low' | 'medium' | 'high';
  reason: string;
  detectionMethod: 'regex' | 'llm';
  dataCategory: string;
  source?: string;
  tool?: string;
  timestamp: string;
}

interface AccessRequest {
  id: string;
  employeeName: string;
  sections: string[];
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  adminComment: string | null;
  logRef: string;
  type?: 'appeal' | 'access';
  requestedAt: string;
  decidedAt: string | null;
}

const VERDICT_COLOR: Record<string, string> = {
  block: 'var(--risk-high)',
  flag: 'var(--risk-medium)',
  allow: 'var(--risk-low)',
};

const NIST_COLORS: Record<string, string> = {
  Govern: 'var(--color-accent)', Map: '#7d9b9a', Measure: 'var(--color-risk-low)', Manage: '#c48b6c',
};

const REASON_SOFT_LIMIT = 500;

function buildTimeline(log: GuardLog) {
  const ts = new Date(log.timestamp);
  const t = (offsetSec: number) =>
    new Date(ts.getTime() + offsetSec * 1000).toLocaleTimeString('en-US', { hour12: false }) + ' UTC';

  const detected = listDetectedPatterns(log.promptSnippet);
  const patternSummary = detected.length > 0
    ? detected.map((p) => `${p.label}`).join(', ')
    : 'no hard pattern match';

  return [
    { icon: <FileText size={11} />, time: t(0), title: 'Prompt Submitted',
      description: `Employee submitted a prompt to ${log.tool ?? 'an AI tool'}${log.source === 'extension' ? ' via the pelta.ai browser extension' : ''}.`, badge: null },
    { icon: <ScanLine size={11} />, time: t(1), title: `Scan — ${log.detectionMethod.toUpperCase()}`,
      description: log.detectionMethod === 'regex'
        ? `Regex scan detected: ${patternSummary}.`
        : `Regex was inconclusive; escalated to LLM. ${log.reason.replace(/^LLM assessment:\s*/, '')}`,
      badge: { label: log.detectionMethod, color: 'text-accent border-accent/30 bg-accent-dim' } },
    { icon: <Gavel size={11} />, time: t(2), title: `Verdict: ${log.verdict === 'block' ? 'Blocked' : 'Flagged'}`,
      description: log.reason,
      badge: { label: log.verdict === 'block' ? 'Blocked' : 'Flagged',
        color: log.verdict === 'block' ? 'text-risk-high border-risk-high/30 bg-risk-high/10' : 'text-risk-medium border-risk-medium/30 bg-risk-medium/10' } },
    { icon: <FileText size={11} />, time: t(3), title: 'Logged to Audit Trail',
      description: `Event recorded. Ref: ${log.id.slice(0, 8)}.`, badge: null },
    { icon: <Bell size={11} />, time: t(5), title: 'Employee Notified',
      description: log.source === 'extension'
        ? 'Real-time overlay shown on the AI tool site.'
        : 'Explanation shown in pelta.ai.', badge: null },
  ];
}

export default function RedressPage() {
  const [logs, setLogs] = useState<GuardLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [selectedLog, setSelectedLog] = useState<GuardLog | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const [accessRequest, setAccessRequest] = useState<AccessRequest | null>(null);

  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedRef, setCopiedRef] = useState(false);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<AccessRequest[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [visibleSteps, setVisibleSteps] = useState(0);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  const startPolling = useCallback((id: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/access-requests');
        const data: AccessRequest[] = await res.json();
        const found = data.find((r) => r.id === id);
        if (found) { setAccessRequest(found); if (found.status !== 'pending') stopPolling(); }
      } catch {}
    }, 10000);
  }, [stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/logs');
        const data: GuardLog[] = await res.json();
        const flagged = data.filter((l) => l.verdict === 'block' || l.verdict === 'flag');
        setLogs(flagged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
        if (flagged.length > 0 && !selectedLog) setSelectedLog(flagged[0]);
      } catch {}
      setLoadingLogs(false);
    })();
  }, []);

  useEffect(() => {
    if (!selectedLog) return;
    setVisibleSteps(0);
    let step = 0;
    const interval = setInterval(() => { step++; setVisibleSteps(step); if (step >= 5) clearInterval(interval); }, 220);
    return () => clearInterval(interval);
  }, [selectedLog]);

  useEffect(() => {
    if (!selectedLog) return;
    setAccessRequest(null);
    setSuggestOpen(false);
    setSuggestions([]);
    (async () => {
      try {
        const res = await fetch('/api/access-requests');
        const data: AccessRequest[] = await res.json();
        const found = data.find((r) => r.logRef === selectedLog.id);
        if (found) setAccessRequest(found);
      } catch {}
    })();
  }, [selectedLog]);

  const detectedPatterns = selectedLog ? listDetectedPatterns(selectedLog.promptSnippet) : [];

  const handleSubmitRequest = async () => {
    if (!reason.trim() || selectedSections.length === 0 || !selectedLog) return;
    setSubmitting(true);
    setSubmitSuccess(false);
    try {
      const res = await fetch('/api/access-requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeName: 'Demo Employee', sections: selectedSections, reason: reason.trim(), logRef: selectedLog.id, type: 'appeal' }),
      });
      const data = await res.json();
      setSubmitSuccess(true);
      setTimeout(() => { setAccessRequest(data); setModalOpen(false); setReason(''); setSelectedSections([]); setSubmitSuccess(false); startPolling(data.id); }, 800);
    } catch {}
    finally { setSubmitting(false); }
  };

  const handleToggleSuggest = async () => {
    if (!selectedLog) return;
    if (suggestOpen) { setSuggestOpen(false); return; }
    setSuggestOpen(true);
    if (suggestions.length > 0) return;
    setLoadingSuggestions(true);
    try {
      const res = await fetch('/api/guard/suggest', { method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: selectedLog.promptSnippet, detectedPatterns: detectedPatterns.map((p) => p.label) }),
      });
      const data = await res.json();
      setSuggestions(data.suggestions ?? []);
    } catch { setSuggestions(['Please help me draft a professional message to our internal contact. I will add recipient details separately.', 'Write a concise update that I can personalise with contact information.', 'Draft a transition summary in a neutral tone that I can adapt and send.']); }
    finally { setLoadingSuggestions(false); }
  };

  const handleToggleHistory = async () => {
    if (historyOpen) { setHistoryOpen(false); return; }
    setHistoryOpen(true);
    if (history.length > 0) return;
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/access-requests');
      const data: AccessRequest[] = await res.json();
      setHistory(data.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()));
    } catch {} finally { setLoadingHistory(false); }
  };

  const copyToClipboard = async (text: string, index: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const copyRef = async () => {
    if (!selectedLog) return;
    await navigator.clipboard.writeText(selectedLog.id.slice(0, 8));
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  const showActionButtons = !accessRequest || accessRequest.status === 'rejected';

  const reasonLength = reason.length;
  const reasonNearLimit = reasonLength > REASON_SOFT_LIMIT * 0.8;
  const reasonOverLimit = reasonLength > REASON_SOFT_LIMIT;
  const reasonTooShort = reason.trim().length > 0 && reason.trim().length < 20;

  const timeline = selectedLog ? buildTimeline(selectedLog) : [];

  return (
    <div className="flex-1 flex min-h-0">
      {/* ── Left: Event list ── */}
      <div className="w-[340px] shrink-0 border-r border-border flex flex-col bg-surface/10">
        <div className="flex items-center gap-2 px-4 h-9 border-b border-border shrink-0">
          <ShieldAlert size={12} className="text-accent" />
          <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Flagged Events</span>
          <span className="text-[10px] font-mono text-text-tertiary ml-auto">{logs.length}</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingLogs ? (
            <div className="p-4 flex items-center gap-2">
              <RadarIcon size={11} className="text-accent animate-radar-pulse" />
              <span className="text-[10px] text-text-tertiary font-mono">Loading...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-[10px] text-text-tertiary">No flagged events.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {logs.map((log) => (
                <button
                  key={log.id}
                  onClick={() => setSelectedLog(log)}
                  className={`w-full text-left px-3 py-2.5 hover:bg-surface-hover/50 transition-colors cursor-pointer ${
                    selectedLog?.id === log.id ? 'bg-accent-dim/40 border-l border-accent font-medium' : 'border-l border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[9px] font-bold font-mono uppercase shrink-0 px-1 py-0.5 rounded" style={{ color: VERDICT_COLOR[log.verdict], background: `${VERDICT_COLOR[log.verdict]}15` }}>
                      {log.verdict}
                    </span>
                    <span className="text-[9px] font-mono uppercase" style={{ color: VERDICT_COLOR[log.verdict] }}>{log.riskLevel}</span>
                  </div>
                  <p className="text-[11px] text-text-primary leading-snug line-clamp-2">{log.promptSnippet}</p>
                  <p className="text-[9px] text-text-muted font-mono mt-1">
                    {new Date(log.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {log.source === 'extension' && ' · ext'}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Right: Detail view ── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Right header */}
        <div className="flex items-center gap-2 px-4 h-9 border-b border-border shrink-0 bg-surface/5">
          <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Event Detail</span>
          {selectedLog && (
            <span className="text-[10px] font-mono text-text-tertiary ml-auto">{selectedLog.id.slice(0, 8)}</span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {!selectedLog ? (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center gap-3">
              <RadarIcon size={32} className="text-accent animate-radar-pulse" />
              <p className="text-xs text-text-tertiary">Select a flagged event from the left panel to view its audit trail and submit an appeal.</p>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {/* Context */}
              <div className="panel p-4 space-y-2">
                <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Event Context</span>
                <p className="text-xs text-text-secondary leading-relaxed">
                  This prompt was{' '}
                  <span className="font-medium" style={{ color: VERDICT_COLOR[selectedLog.verdict] }}>{selectedLog.verdict === 'block' ? 'blocked' : 'flagged'}</span>{' '}
                  by pelta.ai after detecting <span className="text-text-primary font-medium">{selectedLog.dataCategory}</span> data.
                  Under the EU AI Act, you have the right to an explanation.
                </p>
                <div className="bg-background border border-border rounded-lg p-3">
                  <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1.5">Submitted Prompt</p>
                  <p className="text-[11px] font-mono text-text-secondary leading-relaxed break-all">
                    {renderHighlightedText(selectedLog.promptSnippet)}
                  </p>
                  {detectedPatterns.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-border">
                      {detectedPatterns.map((p, i) => (
                        <span key={i} className={`inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                          p.severity === 'high' ? 'text-risk-high border-risk-high/30 bg-risk-high/10' : 'text-risk-medium border-risk-medium/30 bg-risk-medium/10'
                        }`}>
                          <span className={`size-1 rounded-full ${p.severity === 'high' ? 'bg-risk-high' : 'bg-risk-medium'}`} />{p.label} · {p.severity}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Timeline */}
              <div className="panel p-4 space-y-0">
                <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-1.5 mb-4">
                  <Clock size={11} /> Decision Timeline
                </span>
                <div className="relative pl-8 border-l-2 border-border space-y-4">
                  {timeline.map((step, i) => (
                    <div key={i} className="transition-all duration-500" style={{ opacity: visibleSteps > i ? 1 : 0, transform: visibleSteps > i ? 'translateY(0)' : 'translateY(10px)' }}>
                      <TimelineStep {...step} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Action panel */}
              <div className="panel p-4 space-y-3">
                <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                  <Gavel size={11} /> Actions
                </span>

                <div className={`bg-background border rounded-lg p-3 space-y-2.5 ${
                  selectedLog.verdict === 'block' ? 'border-risk-high/30' : 'border-risk-medium/30'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <ShieldAlert size={12} style={{ color: VERDICT_COLOR[selectedLog.verdict] }} />
                      <span className="text-[10px] font-bold uppercase" style={{ color: VERDICT_COLOR[selectedLog.verdict] }}>
                        {selectedLog.verdict === 'block' ? 'Blocked' : 'Flagged'}
                      </span>
                    </div>
                    <span className="text-[10px] text-text-tertiary font-mono">pelta.ai</span>
                  </div>
                  <p className="text-xs text-text-secondary">{selectedLog.reason}</p>
                  <div className="pt-2 border-t border-border flex items-center justify-between">
                    <span className="text-[10px] text-text-tertiary font-mono">ref: {selectedLog.id.slice(0, 8)}</span>
                    <button onClick={copyRef} className="flex items-center gap-1 text-[9px] text-text-tertiary hover:text-text-primary transition-colors cursor-pointer">
                      {copiedRef ? <Check size={9} className="text-risk-low" /> : <Copy size={9} />}{copiedRef ? 'Copied' : 'Copy ref'}
                    </button>
                  </div>
                </div>

                {accessRequest && <AccessStatusCard request={accessRequest} />}

                {showActionButtons && (
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => { setSelectedSections(detectedPatterns.map((p) => p.label)); setModalOpen(true); }}
                      className="flex items-center gap-1.5 text-[11px] font-medium text-text-primary bg-surface-hover hover:bg-surface border border-border rounded px-3 py-1.5 transition-colors cursor-pointer"
                    >Submit Appeal</button>
                    <button onClick={handleToggleSuggest} className={`flex items-center gap-1.5 text-[11px] font-medium border border-border rounded px-3 py-1.5 transition-colors cursor-pointer ${suggestOpen ? 'text-text-primary bg-surface-hover' : 'text-text-secondary hover:text-text-primary'}`}>
                      {suggestOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />} Suggest Safe Prompt
                    </button>
                  </div>
                )}

                {suggestOpen && (
                  <div className="animate-slide-in border border-border rounded-lg p-3 space-y-2">
                    <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Safe Alternatives</p>
                    {loadingSuggestions ? (
                      <div className="flex items-center gap-2 py-2"><RadarIcon size={12} className="text-accent animate-radar-pulse" /><span className="text-[11px] text-text-tertiary font-mono">Generating...</span></div>
                    ) : (
                      <div className="space-y-1.5">
                        {suggestions.map((s, i) => (
                          <div key={i} className="flex items-start gap-2 bg-background border border-border rounded p-2.5">
                            <span className="text-[10px] font-mono text-text-muted shrink-0 mt-0.5">{i + 1}.</span>
                            <p className="flex-1 text-[11px] font-mono text-text-secondary leading-relaxed">{s}</p>
                            <button onClick={() => copyToClipboard(s, i)} title="Copy" className="shrink-0 text-text-tertiary hover:text-text-primary transition-colors cursor-pointer mt-0.5">
                              {copiedIndex === i ? <Check size={11} className="text-risk-low" /> : <Copy size={11} />}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* NIST RMF */}
              <div className="panel p-4">
                <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-2 block">NIST AI RMF</span>
                <div className="grid grid-cols-4 gap-2">
                  <RmfCard func="Govern" desc="Org policies for AI tool approval" />
                  <RmfCard func="Map" desc="Contextual risk assessment" />
                  <RmfCard func="Measure" desc="Quantitative risk metrics" />
                  <RmfCard func="Manage" desc="Automated block/flag/allow" />
                </div>
              </div>

              {/* Appeal History */}
              <div className="panel overflow-hidden">
                <button onClick={handleToggleHistory} className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-hover/50 transition-colors cursor-pointer">
                  <div className="flex items-center gap-2"><History size={12} className="text-text-tertiary" /><span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Appeal History</span></div>
                  <ChevronRight size={12} className={`text-text-tertiary transition-transform duration-200 ${historyOpen ? 'rotate-90' : ''}`} />
                </button>
                {historyOpen && (
                  <div className="border-t border-border animate-slide-in">
                    {loadingHistory ? (
                      <div className="p-3 flex items-center gap-2"><RadarIcon size={11} className="text-accent animate-radar-pulse" /><span className="text-[10px] text-text-tertiary font-mono">Loading...</span></div>
                    ) : history.length === 0 ? (
                      <p className="p-3 text-[10px] text-text-tertiary text-center">No prior appeals.</p>
                    ) : (
                      <div className="divide-y divide-border">
                        {history.map((req) => <HistoryRow key={req.id} req={req} />)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Appeal Modal ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <div className="bg-surface border border-border rounded-xl w-full max-w-md mx-4 p-5 space-y-4 shadow-xl animate-slide-in">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-text-primary">Submit Appeal</p>
                <p className="text-[10px] font-mono text-text-tertiary mt-0.5">EU AI Act Article 86</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"><X size={14} /></button>
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Flagged Sections</p>
              <div className="space-y-1.5 mt-1">
                {detectedPatterns.length === 0 ? (
                  <p className="text-[10px] text-text-muted italic">No specific patterns — describe in your reason.</p>
                ) : detectedPatterns.map((p) => (
                  <label key={p.label} className="flex items-center gap-3 p-2.5 rounded-lg border border-border hover:bg-surface-hover transition-colors cursor-pointer">
                    <input type="checkbox" checked={selectedSections.includes(p.label)} onChange={() => setSelectedSections((prev) => prev.includes(p.label) ? prev.filter((s) => s !== p.label) : [...prev, p.label])} className="accent-accent cursor-pointer" />
                    <span className="flex-1 text-xs text-text-primary">{p.label}</span>
                    <span className={`text-[9px] font-bold uppercase font-mono ${p.severity === 'high' ? 'text-risk-high' : 'text-risk-medium'}`}>{p.severity}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Reason</label>
                <span className={`text-[9px] font-mono transition-colors ${reasonOverLimit ? 'text-risk-high' : reasonNearLimit ? 'text-risk-medium' : 'text-text-muted'}`}>{reasonLength}/{REASON_SOFT_LIMIT}</span>
              </div>
              <textarea className={`w-full bg-background border rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none transition-colors resize-none leading-relaxed ${reasonOverLimit ? 'border-risk-high/50' : 'border-border focus:border-accent'}`} placeholder="Explain why you believe this was a false positive..." rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
              {reasonTooShort && <p className="text-[10px] text-risk-medium flex items-center gap-1"><AlertCircle size={10} />At least 20 characters required</p>}
            </div>
            <div className="flex items-center justify-between pt-1">
              <button onClick={() => setModalOpen(false)} className="text-[11px] text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer">Cancel</button>
              <button onClick={handleSubmitRequest} disabled={submitting || submitSuccess || !reason.trim() || reason.trim().length < 20 || selectedSections.length === 0} className={`flex items-center gap-1.5 text-xs font-medium border rounded px-4 py-1.5 transition-all cursor-pointer disabled:cursor-not-allowed ${submitSuccess ? 'text-risk-low bg-risk-low/10 border-risk-low/30' : 'text-text-primary bg-surface-hover hover:bg-surface border-border disabled:opacity-30'}`}>
                {submitSuccess ? <><Check size={12} className="text-risk-low" /> Submitted</> : submitting ? <><div className="size-3 border border-text-tertiary border-t-text-primary rounded-full animate-spin" /> Submitting</> : 'Submit Appeal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────── */

function AccessStatusCard({ request }: { request: AccessRequest }) {
  const isPending = request.status === 'pending';
  const isApproved = request.status === 'approved';
  return (
    <div className={`rounded-lg border p-3 space-y-3 animate-slide-in ${isPending ? 'border-border bg-surface-hover/20' : isApproved ? 'border-risk-low/30 bg-risk-low/5' : 'border-risk-high/30 bg-risk-high/5'}`}>
      <div className="flex items-center gap-2">
        {isPending && <Clock size={11} className="text-text-tertiary animate-pulse shrink-0" />}
        {isApproved && <CheckCircle2 size={11} className="text-risk-low shrink-0" />}
        {!isPending && !isApproved && <XCircle size={11} className="text-risk-high shrink-0" />}
        <span className={`text-[11px] font-semibold ${isPending ? 'text-text-secondary' : isApproved ? 'text-risk-low' : 'text-risk-high'}`}>
          {isPending && 'Appeal Pending Review'}
          {isApproved && 'Appeal Approved'}
          {!isPending && !isApproved && 'Appeal Denied'}
        </span>
      </div>
      {isApproved && request.adminComment && <p className="text-[10px] text-text-tertiary italic">&ldquo;{request.adminComment}&rdquo;</p>}
      {!isPending && !isApproved && request.adminComment && (
        <div className="bg-background rounded border border-risk-high/20 px-2.5 py-2"><p className="text-[9px] text-text-tertiary uppercase font-semibold tracking-wider mb-0.5">Admin Comment</p><p className="text-[10px] text-text-secondary leading-relaxed">{request.adminComment}</p></div>
      )}
    </div>
  );
}

function HistoryRow({ req }: { req: AccessRequest }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`border-l-2 ${req.status === 'approved' ? 'border-risk-low/40' : req.status === 'rejected' ? 'border-risk-high/40' : 'border-border'}`}>
      <button onClick={() => setExpanded((v) => !v)} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-surface-hover/40 transition-colors cursor-pointer text-left">
        <span className="text-[10px] text-text-primary font-medium truncate flex-1">{req.sections.join(', ')}</span>
        <span className={`text-[9px] font-bold uppercase font-mono ${req.status === 'approved' ? 'text-risk-low' : req.status === 'rejected' ? 'text-risk-high' : 'text-text-tertiary'}`}>{req.status}</span>
        <ChevronRight size={10} className={`text-text-muted transition-transform shrink-0 ${expanded ? 'rotate-90' : ''}`} />
      </button>
      {expanded && (
        <div className="px-4 pb-2 space-y-1 animate-slide-in">
          <p className="text-[10px] text-text-secondary leading-relaxed">{req.reason}</p>
          {req.adminComment && <p className="text-[10px] text-text-tertiary italic">{req.adminComment}</p>}
          <p className="text-[9px] text-text-muted font-mono">ref: {req.logRef.slice(0, 8)}</p>
        </div>
      )}
    </div>
  );
}

function TimelineStep({ time, title, description, badge, icon }: {
  time: string; title: string; description: string; badge?: { label: string; color: string } | null; icon?: React.ReactNode;
}) {
  return (
    <div className="relative">
      <div className="absolute -left-[25px] mt-0.5 size-3 rounded-full border-2 border-background bg-accent" />
      <p className="text-[9px] text-text-tertiary font-mono">{time}</p>
      <div className="flex items-center gap-2 mt-0.5">
        {icon && <span className="text-accent shrink-0">{icon}</span>}
        <p className="text-[11px] font-medium text-text-primary">{title}</p>
        {badge && <span className={`text-[8px] font-bold uppercase px-1 py-0.5 rounded-full border ${badge.color}`}>{badge.label}</span>}
      </div>
      <p className="text-[10px] text-text-tertiary mt-0.5 leading-relaxed">{description}</p>
    </div>
  );
}

function RmfCard({ func, desc }: { func: string; desc: string }) {
  return (
    <div className="bg-background border border-border rounded p-2">
      <p className="text-[9px] font-bold uppercase" style={{ color: NIST_COLORS[func] ?? 'var(--accent)' }}>{func}</p>
      <p className="text-[9px] text-text-tertiary leading-relaxed mt-0.5">{desc}</p>
    </div>
  );
}
