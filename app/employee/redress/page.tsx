import Link from 'next/link';
import RadarIcon from '@/components/RadarIcon';

export default function RedressPage() {
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
          An employee&apos;s access to <span className="text-text-primary font-medium">ChatGPT (GPT-4)</span> was automatically
          blocked by peris.ai&apos;s Prompt Guard after it detected a prompt containing what appeared to be
          PII (email address + phone number). Under the <span className="text-text-primary font-medium">EU AI Act</span>,
          the employee has the right to an explanation of this decision.
        </p>
      </div>

      {/* Timeline */}
      <div className="space-y-0">
        <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider block mb-3">Decision Timeline</span>
        <div className="relative pl-8 border-l-2 border-border space-y-5">
          <TimelineStep
            time="14:23:05 UTC"
            title="Prompt Submitted"
            description="Employee pasted a message containing internal contact details into ChatGPT."
          />
          <TimelineStep
            time="14:23:05 UTC"
            title="Regex Scan — Match Found"
            description="Prompt Guard matched 1 high-severity pattern: email address, 1 medium-severity pattern: phone number."
            badge={{ label: 'Regex', color: 'text-accent border-accent/30 bg-accent-dim' }}
          />
          <TimelineStep
            time="14:23:06 UTC"
            title="Verdict: Blocked"
            description="High-severity regex match triggered automatic block. The prompt was not sent to the external AI tool."
            badge={{ label: 'Blocked', color: 'text-risk-high border-risk-high/30 bg-risk-high/10' }}
          />
          <TimelineStep
            time="14:23:07 UTC"
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

      {/* What the employee saw */}
      <div className="panel p-4 space-y-3">
        <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider block">What the Employee Saw</span>

        <div className="bg-background border border-risk-high/30 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-risk-high">Prompt Blocked</span>
            <span className="text-[10px] text-text-tertiary font-mono">peris.ai Prompt Guard</span>
          </div>
          <p className="text-xs text-text-secondary leading-relaxed">
            Your prompt was <span className="text-risk-high font-medium">blocked</span> because it contains
            data patterns that may include personal or sensitive information:
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
            To proceed, remove or redact the flagged information and resubmit.
            If you believe this was a false positive, contact your administrator.
          </p>
          <div className="pt-2 border-t border-border text-[10px] text-text-tertiary font-mono">
            method: regex · ref: log_a1b2c3d4
          </div>
        </div>

        <div className="text-[11px] text-text-secondary leading-relaxed border-t border-border pt-2">
          <p className="font-semibold text-text-secondary mb-0.5">Why this matters (EU AI Act Article 86)</p>
          <p className="text-text-tertiary">
            Individuals have the right to clear and meaningful information about the role of AI systems
            in decisions that affect them. peris.ai provides this through real-time verdict explanations,
            logged audit trails, and the ability to appeal decisions via an administrator.
          </p>
        </div>
      </div>

      {/* NIST RMF */}
      <div className="panel p-4">
        <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider block mb-2">NIST AI RMF Alignment</span>
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
    </div>
  );
}

function TimelineStep({
  time, title, description, badge,
}: {
  time: string; title: string; description: string; badge?: { label: string; color: string };
}) {
  return (
    <div className="relative">
      <div className="absolute -left-[25px] mt-1.5 size-3 rounded-full bg-accent border-2 border-background" />
      <p className="text-[10px] text-text-tertiary font-mono">{time}</p>
      <div className="flex items-center gap-2 mt-0.5">
        <p className="text-xs font-medium text-text-primary">{title}</p>
        {badge && (
          <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full border ${badge.color}`}>
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
      <p className="text-[10px] font-bold text-accent uppercase">{func}</p>
      <p className="text-[10px] text-text-tertiary leading-relaxed mt-0.5">{desc}</p>
    </div>
  );
}
