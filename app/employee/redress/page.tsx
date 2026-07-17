'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  X,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Clock,
  ShieldAlert,
  History,
  CheckCircle2,
  XCircle,
  AlertCircle,

  ChevronRight,
} from 'lucide-react';
import RadarIcon from '@/components/RadarIcon';

interface AccessRequest {
  id: string;
  employeeName: string;
  sections: string[];
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  adminComment: string | null;
  logRef: string;
  requestedAt: string;
  decidedAt: string | null;
}

const DETECTED_SECTIONS = [
  { id: 'email', label: 'Email address', severity: 'high' as const },
  { id: 'phone', label: 'Phone number', severity: 'medium' as const },
];

const SCENARIO_PROMPT =
  'Please help me draft a follow-up message to john.doe@company.com (+65 9123 4567) regarding the internal project handover. CC manager@corp.sg for sign-off.';

// Spans to highlight within the prompt
const SENSITIVE_SPANS = [
  { text: 'john.doe@company.com', type: 'high', label: 'Email' },
  { text: '+65 9123 4567', type: 'medium', label: 'Phone' },
  { text: 'manager@corp.sg', type: 'high', label: 'Email' },
];

const NIST_COLORS: Record<string, string> = {
  Govern: '#3b82f6',
  Map: '#06b6d4',
  Measure: '#22c55e',
  Manage: '#a855f7',
};

const TIMELINE_STEPS = [
  {
    time: '14:23:05 UTC',
    title: 'Prompt Submitted',
    description: 'Employee pasted a message containing internal contact details into ChatGPT.',
    badge: null,
  },
  {
    time: '14:23:06 UTC',
    title: 'Regex Scan — Match Found',
    description:
      'Prompt Guard matched 1 high-severity pattern: email address, 1 medium-severity pattern: phone number.',
    badge: { label: 'Regex', color: 'text-accent border-accent/30 bg-accent-dim' },
  },
  {
    time: '14:23:07 UTC',
    title: 'Verdict: Blocked',
    description:
      'High-severity regex match triggered automatic block. The prompt was not sent to the external AI tool.',
    badge: { label: 'Blocked', color: 'text-risk-high border-risk-high/30 bg-risk-high/10' },
  },
  {
    time: '14:23:08 UTC',
    title: 'Logged to Audit Trail',
    description:
      'Event recorded with verdict, risk level, detection method, and truncated prompt snippet for review.',
    badge: null,
  },
  {
    time: '14:23:10 UTC',
    title: 'Employee Notified',
    description:
      'Real-time explanation showing why the prompt was blocked, which patterns were detected, and how to remediate.',
    badge: null,
  },
];

const REASON_SOFT_LIMIT = 500;

export default function RedressPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSections, setSelectedSections] = useState<string[]>(['email', 'phone']);
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

  // Staggered timeline reveal
  const [visibleSteps, setVisibleSteps] = useState(0);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  const startPolling = useCallback(
    (id: string) => {
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch('/api/access-requests');
          const data: AccessRequest[] = await res.json();
          const found = data.find((r) => r.id === id);
          if (found) {
            setAccessRequest(found);
            if (found.status !== 'pending') stopPolling();
          }
        } catch {}
      }, 10000);
    },
    [stopPolling],
  );

  useEffect(() => () => stopPolling(), [stopPolling]);

  // Stagger timeline steps in on mount
  useEffect(() => {
    let step = 0;
    const interval = setInterval(() => {
      step++;
      setVisibleSteps(step);
      if (step >= TIMELINE_STEPS.length) clearInterval(interval);
    }, 220);
    return () => clearInterval(interval);
  }, []);

  const toggleSection = (id: string) => {
    setSelectedSections((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  const handleSubmitRequest = async () => {
    if (!reason.trim() || selectedSections.length === 0) return;
    setSubmitting(true);
    setSubmitSuccess(false);
    try {
      const res = await fetch('/api/access-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeName: 'Demo Employee',
          sections: selectedSections.map(
            (id) => DETECTED_SECTIONS.find((s) => s.id === id)?.label ?? id,
          ),
          reason: reason.trim(),
          logRef: 'log_a1b2c3d4',
        }),
      });
      const data: AccessRequest = await res.json();
      setSubmitSuccess(true);
      // Brief success flash then close
      setTimeout(() => {
        setAccessRequest(data);
        setModalOpen(false);
        setReason('');
        setSubmitSuccess(false);
        startPolling(data.id);
      }, 800);
    } catch {}
    finally { setSubmitting(false); }
  };

  const handleToggleSuggest = async () => {
    if (suggestOpen) { setSuggestOpen(false); return; }
    setSuggestOpen(true);
    if (suggestions.length > 0) return;
    setLoadingSuggestions(true);
    try {
      const res = await fetch('/api/guard/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: SCENARIO_PROMPT,
          detectedPatterns: ['Email address', 'Phone number'],
        }),
      });
      const data = await res.json();
      setSuggestions(data.suggestions ?? []);
    } catch {
      setSuggestions([
        'Please help me draft a professional message to our internal contact about the project handover. I will add recipient details separately before sending.',
        'Write a concise handover update that I can personalise with contact information for the relevant team member.',
        'Draft a project transition summary in a neutral tone that I can adapt and send to the appropriate stakeholder.',
      ]);
    } finally { setLoadingSuggestions(false); }
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
    } catch {}
    finally { setLoadingHistory(false); }
  };

  const copyToClipboard = async (text: string, index: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const copyRef = async () => {
    await navigator.clipboard.writeText('log_a1b2c3d4');
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  const showActionButtons =
    !accessRequest || accessRequest.status === 'rejected';

  const reasonLength = reason.length;
  const reasonNearLimit = reasonLength > REASON_SOFT_LIMIT * 0.8;
  const reasonOverLimit = reasonLength > REASON_SOFT_LIMIT;
  const reasonTooShort = reason.trim().length > 0 && reason.trim().length < 20;

  return (
    <div className="flex-1 p-4 max-w-4xl mx-auto w-full space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <RadarIcon size={14} className="text-accent" />
        <span className="text-[10px] font-mono text-text-tertiary">EU AI Act</span>
        <span className="text-[10px] font-mono text-text-tertiary">·</span>
        <span className="text-sm font-semibold text-text-primary">Right to Explanation</span>
        <span className="text-[10px] font-mono text-text-tertiary">· Article 86</span>
      </div>

      {/* Scenario */}
      <div className="panel p-4 space-y-2">
        <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Example Scenario</span>
        <p className="text-xs text-text-secondary leading-relaxed">
          An employee&apos;s access to{' '}
          <span className="text-text-primary font-medium">ChatGPT (GPT-4)</span> was automatically
          blocked by pelta.ai&apos;s Prompt Guard after it detected a prompt containing what appeared to be
          PII (email address + phone number). Under the{' '}
          <span className="text-text-primary font-medium">EU AI Act</span>,
          the employee has the right to an explanation of this decision.
        </p>

        {/* Highlighted prompt preview */}
        <div className="mt-1 bg-background border border-border rounded-lg p-3">
          <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1.5">Submitted Prompt</p>
          <HighlightedPrompt text={SCENARIO_PROMPT} spans={SENSITIVE_SPANS} />
          <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-border">
            {SENSITIVE_SPANS.map((s, i) => (
              <span
                key={i}
                className={`inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                  s.type === 'high'
                    ? 'text-risk-high border-risk-high/30 bg-risk-high/10'
                    : 'text-risk-medium border-risk-medium/30 bg-risk-medium/10'
                }`}
              >
                <span className={`size-1 rounded-full ${s.type === 'high' ? 'bg-risk-high' : 'bg-risk-medium'}`} />
                {s.text} · {s.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-0">
        <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider block mb-3">
          Decision Timeline
        </span>
        <div className="relative pl-8 border-l-2 border-border space-y-5">
          {TIMELINE_STEPS.map((step, i) => (
            <div
              key={i}
              className="transition-all duration-500"
              style={{
                opacity: visibleSteps > i ? 1 : 0,
                transform: visibleSteps > i ? 'translateY(0)' : 'translateY(10px)',
              }}
            >
              <TimelineStep {...step} isLast={i === TIMELINE_STEPS.length - 1} />
            </div>
          ))}
        </div>
      </div>

      {/* What the Employee Saw */}
      <div className="panel p-4 space-y-3">
        <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider block">
          What the Employee Saw
        </span>

        {/* Notification card */}
        <div className="bg-background border border-risk-high/30 rounded-lg p-3 space-y-2.5">
          {/* Severity bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <ShieldAlert size={12} className="text-risk-high" />
              <span className="text-[10px] font-bold uppercase text-risk-high">Prompt Blocked</span>
            </div>
            <span className="text-[10px] text-text-tertiary font-mono">pelta.ai Prompt Guard</span>
          </div>

          {/* Risk level bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[9px] font-mono text-text-tertiary">
              <span>Risk Level</span>
              <span className="text-risk-high font-semibold">HIGH</span>
            </div>
            <div className="h-1 rounded-full bg-border overflow-hidden">
              <div className="h-full w-full bg-gradient-to-r from-risk-medium via-risk-high to-risk-high rounded-full animate-pulse" />
            </div>
          </div>

          <p className="text-xs text-text-secondary leading-relaxed">
            Your prompt was <span className="text-risk-high font-medium">blocked</span> because it
            contains data patterns that may include personal or sensitive information:
          </p>
          <ul className="text-xs space-y-1">
            <li className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-risk-high" />
              <span className="text-text-primary font-medium">Email address</span>
              <span className="text-text-tertiary">(high severity)</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-risk-medium" />
              <span className="text-text-primary font-medium">Phone number</span>
              <span className="text-text-tertiary">(medium severity)</span>
            </li>
          </ul>
          <p className="text-xs text-text-secondary leading-relaxed">
            To proceed, remove or redact the flagged information and resubmit. If you believe this was
            a false positive, contact your administrator.
          </p>
          <div className="pt-2 border-t border-border flex items-center justify-between">
            <span className="text-[10px] text-text-tertiary font-mono">method: regex · ref: log_a1b2c3d4</span>
            <button
              onClick={copyRef}
              title="Copy audit reference"
              className="flex items-center gap-1 text-[9px] text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
            >
              {copiedRef ? <Check size={9} className="text-risk-low" /> : <Copy size={9} />}
              {copiedRef ? 'Copied' : 'Copy ref'}
            </button>
          </div>
        </div>

        {/* Access request status card */}
        {accessRequest && (
          <AccessStatusCard request={accessRequest} />
        )}

        {/* Action buttons */}
        {showActionButtons && (
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => {
                if (accessRequest?.status === 'rejected') setAccessRequest(null);
                setModalOpen(true);
              }}
              className="flex items-center gap-1.5 text-[11px] font-medium text-text-primary bg-surface-hover hover:bg-surface border border-border rounded px-3 py-1.5 transition-colors cursor-pointer"
            >
              {accessRequest?.status === 'rejected' ? 'Submit New Request' : 'Request for Access'}
            </button>
            <button
              onClick={handleToggleSuggest}
              className={`flex items-center gap-1.5 text-[11px] font-medium border border-border rounded px-3 py-1.5 transition-colors cursor-pointer ${
                suggestOpen
                  ? 'text-text-primary bg-surface-hover'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {suggestOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              Suggest Safe Prompt
            </button>
          </div>
        )}

        {/* Suggestion panel */}
        {suggestOpen && (
          <div className="animate-slide-in border border-border rounded-lg p-3 space-y-2">
            <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">
              Safe Alternatives
            </p>
            {loadingSuggestions ? (
              <div className="flex items-center gap-2 py-2">
                <RadarIcon size={12} className="text-accent animate-radar-pulse" />
                <span className="text-[11px] text-text-tertiary font-mono">
                  Generating safe alternatives...
                </span>
              </div>
            ) : (
              <div className="space-y-1.5">
                {suggestions.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 bg-background border border-border rounded p-2.5"
                  >
                    <span className="text-[10px] font-mono text-text-muted shrink-0 mt-0.5">
                      {i + 1}.
                    </span>
                    <p className="flex-1 text-[11px] font-mono text-text-secondary leading-relaxed">
                      {s}
                    </p>
                    <button
                      onClick={() => copyToClipboard(s, i)}
                      title="Copy to clipboard"
                      className="shrink-0 text-text-tertiary hover:text-text-primary transition-colors cursor-pointer mt-0.5"
                    >
                      {copiedIndex === i ? (
                        <Check size={11} className="text-risk-low" />
                      ) : (
                        <Copy size={11} />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* EU AI Act note */}
        <div className="text-[11px] text-text-secondary leading-relaxed border-t border-border pt-2">
          <p className="font-semibold text-text-secondary mb-0.5">
            Why this matters (EU AI Act Article 86)
          </p>
          <p className="text-text-tertiary">
            Individuals have the right to clear and meaningful information about the role of AI
            systems in decisions that affect them. pelta.ai provides this through real-time verdict
            explanations, logged audit trails, and the ability to appeal decisions via an
            administrator.
          </p>
        </div>
      </div>

      {/* NIST RMF */}
      <div className="panel p-4">
        <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider block mb-2">
          NIST AI RMF Alignment
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <RmfCard func="Govern" desc="Organisational policies for AI tool approval" />
          <RmfCard func="Map" desc="Contextual risk assessment of each tool" />
          <RmfCard func="Measure" desc="Quantitative risk scoring and metrics" />
          <RmfCard func="Manage" desc="Automated response: block, flag, or allow" />
        </div>
      </div>

      {/* Request History */}
      <div className="panel overflow-hidden">
        <button
          onClick={handleToggleHistory}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-hover/50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <History size={12} className="text-text-tertiary" />
            <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
              Request History
            </span>
          </div>
          <ChevronRight
            size={12}
            className={`text-text-tertiary transition-transform duration-200 ${historyOpen ? 'rotate-90' : ''}`}
          />
        </button>

        {historyOpen && (
          <div className="border-t border-border animate-slide-in">
            {loadingHistory ? (
              <div className="flex items-center gap-2 p-4">
                <RadarIcon size={12} className="text-accent animate-radar-pulse" />
                <span className="text-[11px] text-text-tertiary font-mono">Loading history...</span>
              </div>
            ) : history.length === 0 ? (
              <div className="p-4 text-center">
                <p className="text-[11px] text-text-tertiary">No prior requests found.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {history.map((req) => (
                  <HistoryRow key={req.id} req={req} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="text-center pb-4">
        <Link
          href="/employee/prompt-guard"
          className="text-xs text-accent hover:text-accent-hover transition-colors"
        >
          ← Try the Prompt Guard
        </Link>
      </div>

      {/* ── Request for Access Modal ─────────────────────── */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}
        >
          <div className="bg-surface border border-border rounded-xl w-full max-w-md mx-4 p-5 space-y-4 shadow-xl animate-slide-in">
            {/* Modal header */}
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  Request Access to Flagged Content
                </p>
                <p className="text-[10px] font-mono text-text-tertiary mt-0.5">
                  EU AI Act Article 86 — Right to Explanation
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-text-tertiary hover:text-text-primary transition-colors cursor-pointer mt-0.5"
              >
                <X size={14} />
              </button>
            </div>

            {/* Section checkboxes */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">
                Flagged Sections
              </p>
              <p className="text-[10px] text-text-tertiary">
                Select the data categories you need access to
              </p>
              <div className="space-y-1.5 mt-1">
                {DETECTED_SECTIONS.map((section) => (
                  <label
                    key={section.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg border border-border hover:bg-surface-hover transition-colors cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSections.includes(section.id)}
                      onChange={() => toggleSection(section.id)}
                      className="accent-accent cursor-pointer"
                    />
                    <span className="flex-1 text-xs text-text-primary">{section.label}</span>
                    <span
                      className={`text-[9px] font-bold uppercase font-mono ${
                        section.severity === 'high' ? 'text-risk-high' : 'text-risk-medium'
                      }`}
                    >
                      {section.severity}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Reason textarea with char counter */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">
                  Reason for Access
                </label>
                <span
                  className={`text-[9px] font-mono transition-colors ${
                    reasonOverLimit
                      ? 'text-risk-high'
                      : reasonNearLimit
                      ? 'text-risk-medium'
                      : 'text-text-muted'
                  }`}
                >
                  {reasonLength}/{REASON_SOFT_LIMIT}
                </span>
              </div>
              <textarea
                className={`w-full bg-background border rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none transition-colors resize-none leading-relaxed ${
                  reasonOverLimit
                    ? 'border-risk-high/50 focus:border-risk-high'
                    : 'border-border focus:border-accent'
                }`}
                placeholder="Explain why you need to use this content with an AI tool..."
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              {reasonTooShort && (
                <p className="text-[10px] text-risk-medium flex items-center gap-1 animate-slide-in">
                  <AlertCircle size={10} />
                  Please provide more detail (at least 20 characters)
                </p>
              )}
            </div>

            {/* Modal actions */}
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => setModalOpen(false)}
                className="text-[11px] text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitRequest}
                disabled={submitting || submitSuccess || !reason.trim() || reason.trim().length < 20 || selectedSections.length === 0}
                className={`flex items-center gap-1.5 text-xs font-medium border rounded px-4 py-1.5 transition-all cursor-pointer disabled:cursor-not-allowed ${
                  submitSuccess
                    ? 'text-risk-low bg-risk-low/10 border-risk-low/30'
                    : 'text-text-primary bg-surface-hover hover:bg-surface border-border disabled:opacity-30'
                }`}
              >
                {submitSuccess ? (
                  <>
                    <Check size={12} className="text-risk-low" />
                    Submitted
                  </>
                ) : submitting ? (
                  <>
                    <div className="size-3 border border-text-tertiary border-t-text-primary rounded-full animate-spin" />
                    Submitting
                  </>
                ) : (
                  'Submit Request'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────── */

function HighlightedPrompt({
  text,
  spans,
}: {
  text: string;
  spans: { text: string; type: string; label: string }[];
}) {
  // Build segments: split text around known sensitive spans
  type Segment = { text: string; sensitive: boolean; type?: string };
  const segments: Segment[] = [];
  let remaining = text;
  const sortedSpans = [...spans].sort((a, b) => text.indexOf(a.text) - text.indexOf(b.text));

  for (const span of sortedSpans) {
    const idx = remaining.indexOf(span.text);
    if (idx === -1) continue;
    if (idx > 0) segments.push({ text: remaining.slice(0, idx), sensitive: false });
    segments.push({ text: span.text, sensitive: true, type: span.type });
    remaining = remaining.slice(idx + span.text.length);
  }
  if (remaining) segments.push({ text: remaining, sensitive: false });

  return (
    <p className="text-[11px] font-mono text-text-secondary leading-relaxed break-all">
      {segments.map((seg, i) =>
        seg.sensitive ? (
          <span
            key={i}
            className={`px-0.5 rounded-sm border-b-2 ${
              seg.type === 'high'
                ? 'bg-risk-high/15 border-risk-high text-risk-high'
                : 'bg-risk-medium/15 border-risk-medium text-risk-medium'
            }`}
          >
            {seg.text}
          </span>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </p>
  );
}

function AccessStatusCard({ request }: { request: AccessRequest }) {
  const isPending = request.status === 'pending';
  const isApproved = request.status === 'approved';

  return (
    <div
      className={`rounded-lg border p-3.5 space-y-4 animate-slide-in ${
        isPending
          ? 'border-border bg-surface-hover/20'
          : isApproved
          ? 'border-risk-low/30 bg-risk-low/5'
          : 'border-risk-high/30 bg-risk-high/5'
      }`}
    >
      <div className="flex items-center gap-2">
        {isPending && <Clock size={12} className="text-text-tertiary animate-pulse shrink-0" />}
        {isApproved && <CheckCircle2 size={12} className="text-risk-low shrink-0" />}
        {!isPending && !isApproved && <XCircle size={12} className="text-risk-high shrink-0" />}

        <span
          className={`text-xs font-semibold ${
            isPending ? 'text-text-secondary' : isApproved ? 'text-risk-low' : 'text-risk-high'
          }`}
        >
          {isPending && 'Appeal Pending Review'}
          {isApproved && 'Access Granted'}
          {!isPending && !isApproved && 'Request Denied'}
        </span>

        <span className="ml-auto text-[9px] font-mono text-text-muted">
          ref: {request.id.slice(0, 8)}
        </span>
      </div>

      {isPending && (
        <div className="space-y-3">
          <div className="flex justify-between items-center text-[9px] font-mono text-text-tertiary">
            <span>Submitted</span>
            <span>Reviewing</span>
            <span>Deciding</span>
          </div>
          <div className="h-1 bg-background rounded-full overflow-hidden flex">
            <div className="w-1/3 bg-accent" />
            <div className="w-1/3 bg-accent/50 animate-pulse" />
            <div className="w-1/3 bg-border" />
          </div>
          <div className="flex items-center gap-2 bg-background border border-border/60 rounded px-2.5 py-1.5">
            <span className="size-1.5 rounded-full bg-accent shrink-0 animate-pulse" />
            <p className="text-[10px] text-text-tertiary leading-relaxed">
              You will be notified at{' '}
              <span className="font-mono text-text-secondary">demo@corp.sg</span>{' '}
              when a decision is made.
            </p>
          </div>
        </div>
      )}

      {/* Sections */}
      <div className="flex flex-wrap gap-1">
        {request.sections.map((s) => (
          <span
            key={s}
            className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-border text-text-tertiary bg-background"
          >
            {s}
          </span>
        ))}
      </div>

      {isApproved && (
        <p className="text-[10px] text-text-secondary leading-relaxed">
          Your appeal was approved. You may proceed using the requested data categories with the approved AI tool.
          {request.adminComment && (
            <span className="block mt-1 text-text-tertiary italic">"{request.adminComment}"</span>
          )}
        </p>
      )}

      {!isPending && !isApproved && request.adminComment && (
        <div className="bg-background rounded border border-risk-high/20 px-2.5 py-2">
          <p className="text-[10px] text-text-tertiary uppercase font-semibold tracking-wider mb-0.5">
            Admin Comment
          </p>
          <p className="text-[11px] text-text-secondary leading-relaxed">{request.adminComment}</p>
        </div>
      )}
    </div>
  );
}

function HistoryRow({ req }: { req: AccessRequest }) {
  const [expanded, setExpanded] = useState(false);
  const isApproved = req.status === 'approved';
  const isRejected = req.status === 'rejected';

  return (
    <div className={`border-l-2 ${isApproved ? 'border-risk-low/40' : isRejected ? 'border-risk-high/40' : 'border-border'}`}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-hover/40 transition-colors cursor-pointer text-left"
      >
        {isApproved && <CheckCircle2 size={11} className="text-risk-low shrink-0" />}
        {isRejected && <XCircle size={11} className="text-risk-high shrink-0" />}
        {!isApproved && !isRejected && <Clock size={11} className="text-text-tertiary shrink-0" />}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-text-primary font-medium">
              {req.sections.join(', ')}
            </span>
            <span
              className={`text-[9px] font-bold uppercase font-mono ${
                isApproved ? 'text-risk-low' : isRejected ? 'text-risk-high' : 'text-text-tertiary'
              }`}
            >
              {req.status}
            </span>
          </div>
          <p className="text-[10px] text-text-muted font-mono">
            {new Date(req.requestedAt).toLocaleDateString('en-SG', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
            {req.decidedAt &&
              ` · decided ${new Date(req.decidedAt).toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit' })}`}
          </p>
        </div>

        <ChevronRight
          size={11}
          className={`text-text-muted transition-transform duration-200 shrink-0 ${expanded ? 'rotate-90' : ''}`}
        />
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-2 animate-slide-in">
          <div className="bg-background border border-border rounded-lg p-2.5 space-y-1.5">
            <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">
              Your Reason
            </p>
            <p className="text-[11px] text-text-secondary leading-relaxed">{req.reason}</p>
          </div>
          {req.adminComment && (
            <div className={`rounded-lg border px-2.5 py-2 space-y-1 ${isRejected ? 'border-risk-high/20 bg-risk-high/5' : 'border-risk-low/20 bg-risk-low/5'}`}>
              <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">
                Admin Comment
              </p>
              <p className="text-[11px] text-text-secondary leading-relaxed italic">{req.adminComment}</p>
            </div>
          )}
          <p className="text-[9px] text-text-muted font-mono">ref: {req.logRef}</p>
        </div>
      )}
    </div>
  );
}

function TimelineStep({
  time,
  title,
  description,
  badge,
  isLast,
}: {
  time: string;
  title: string;
  description: string;
  badge?: { label: string; color: string } | null;
  isLast?: boolean;
}) {
  return (
    <div className="relative">
      <div className={`absolute -left-[25px] mt-1.5 size-3 rounded-full border-2 border-background ${isLast ? 'bg-accent' : 'bg-accent'}`} />
      <p className="text-[10px] text-text-tertiary font-mono">{time}</p>
      <div className="flex items-center gap-2 mt-0.5">
        <p className="text-xs font-medium text-text-primary">{title}</p>
        {badge && (
          <span
            className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full border ${badge.color}`}
          >
            {badge.label}
          </span>
        )}
      </div>
      <p className="text-xs text-text-tertiary mt-0.5 leading-relaxed">{description}</p>
    </div>
  );
}

function RmfCard({ func, desc }: { func: string; desc: string }) {
  return (
    <div className="bg-background border border-border rounded-lg p-2">
      <p
        className="text-[10px] font-bold uppercase"
        style={{ color: NIST_COLORS[func] ?? 'var(--accent)' }}
      >
        {func}
      </p>
      <p className="text-[10px] text-text-tertiary leading-relaxed mt-0.5">{desc}</p>
    </div>
  );
}
