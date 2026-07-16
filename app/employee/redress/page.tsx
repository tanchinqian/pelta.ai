'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { X, ChevronDown, ChevronUp, Copy, Check, Clock } from 'lucide-react';
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

const NIST_COLORS: Record<string, string> = {
  Govern: '#3b82f6',
  Map: '#06b6d4',
  Measure: '#22c55e',
  Manage: '#a855f7',
};

export default function RedressPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSections, setSelectedSections] = useState<string[]>(['email', 'phone']);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [accessRequest, setAccessRequest] = useState<AccessRequest | null>(null);

  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

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

  const toggleSection = (id: string) => {
    setSelectedSections((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  const handleSubmitRequest = async () => {
    if (!reason.trim() || selectedSections.length === 0) return;
    setSubmitting(true);
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
      setAccessRequest(data);
      setModalOpen(false);
      setReason('');
      startPolling(data.id);
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

  const copyToClipboard = async (text: string, index: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const showActionButtons =
    !accessRequest || accessRequest.status === 'rejected';

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
      </div>

      {/* Timeline */}
      <div className="space-y-0">
        <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider block mb-3">
          Decision Timeline
        </span>
        <div className="relative pl-8 border-l-2 border-border space-y-5">
          <TimelineStep
            time="14:23:05 UTC"
            title="Prompt Submitted"
            description="Employee pasted a message containing internal contact details into ChatGPT."
          />
          <TimelineStep
            time="14:23:06 UTC"
            title="Regex Scan — Match Found"
            description="Prompt Guard matched 1 high-severity pattern: email address, 1 medium-severity pattern: phone number."
            badge={{ label: 'Regex', color: 'text-accent border-accent/30 bg-accent-dim' }}
          />
          <TimelineStep
            time="14:23:07 UTC"
            title="Verdict: Blocked"
            description="High-severity regex match triggered automatic block. The prompt was not sent to the external AI tool."
            badge={{ label: 'Blocked', color: 'text-risk-high border-risk-high/30 bg-risk-high/10' }}
          />
          <TimelineStep
            time="14:23:08 UTC"
            title="Logged to Audit Trail"
            description="Event recorded with verdict, risk level, detection method, and truncated prompt snippet for review."
          />
          <TimelineStep
            time="14:23:10 UTC"
            title="Employee Notified"
            description="Real-time explanation showing why the prompt was blocked, which patterns were detected, and how to remediate."
          />
        </div>
      </div>

      {/* What the Employee Saw */}
      <div className="panel p-4 space-y-3">
        <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider block">
          What the Employee Saw
        </span>

        {/* Notification card */}
        <div className="bg-background border border-risk-high/30 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-risk-high">Prompt Blocked</span>
            <span className="text-[10px] text-text-tertiary font-mono">pelta.ai Prompt Guard</span>
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
          <div className="pt-2 border-t border-border text-[10px] text-text-tertiary font-mono">
            method: regex · ref: log_a1b2c3d4
          </div>
        </div>

        {/* Access request status banner */}
        {accessRequest && (
          <div
            className={`rounded-lg border px-3 py-2.5 text-xs animate-slide-in ${
              accessRequest.status === 'pending'
                ? 'border-border bg-surface-hover/30 text-text-secondary'
                : accessRequest.status === 'approved'
                ? 'border-risk-low/30 bg-risk-low/5 text-risk-low'
                : 'border-risk-high/30 bg-risk-high/5 text-risk-high'
            }`}
          >
            {accessRequest.status === 'pending' && (
              <span className="flex items-center gap-2 font-mono text-[11px]">
                <Clock size={11} className="animate-pulse shrink-0" />
                Request submitted · Pending admin review · est. 5 min · ref:{' '}
                {accessRequest.id.slice(0, 8)}
              </span>
            )}
            {accessRequest.status === 'approved' && (
              <span className="font-medium">
                Access Granted — Your request was approved. You may proceed.
              </span>
            )}
            {accessRequest.status === 'rejected' && (
              <span>
                <span className="font-medium">Request Denied</span>
                {accessRequest.adminComment ? ` — ${accessRequest.adminComment}` : ''}
              </span>
            )}
          </div>
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

            {/* Reason textarea */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">
                Reason for Access
              </label>
              <textarea
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors resize-none leading-relaxed"
                placeholder="Explain why you need to use this content with an AI tool..."
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
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
                disabled={submitting || !reason.trim() || selectedSections.length === 0}
                className="flex items-center gap-1.5 text-xs font-medium text-text-primary bg-surface-hover hover:bg-surface border border-border rounded px-4 py-1.5 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {submitting ? (
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

function TimelineStep({
  time,
  title,
  description,
  badge,
}: {
  time: string;
  title: string;
  description: string;
  badge?: { label: string; color: string };
}) {
  return (
    <div className="relative">
      <div className="absolute -left-[25px] mt-1.5 size-3 rounded-full bg-accent border-2 border-background" />
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
