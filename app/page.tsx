'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Shield, Lock, FileText, BarChart3, Users, AlertTriangle, CheckCircle2, XCircle, ChevronRight } from 'lucide-react';
import RadarIcon from '@/components/RadarIcon';

const views = {
  employee: {
    icon: <Lock size={15} className="text-text-secondary" />,
    title: 'Employee View',
    description: 'Verify your prompts before sending them to external AI tools. Get immediate risk classifications, PII highlights, and clean alternatives.',
    links: [
      { href: '/employee/requests/new', label: 'Request AI Tool', desc: 'Submit a new AI tool for security review', icon: <Users size={14} /> },
      { href: '/employee/redress', label: 'Right to Explanation', desc: 'Understand AI-assisted safety classifications (EU AI Act Art. 86)', icon: <FileText size={14} /> },
    ],
  },
  admin: {
    icon: <Shield size={15} className="text-text-secondary" />,
    title: 'Admin View',
    description: 'Review tool request pipelines, inspect system detection logs, and set granular prompt filters.',
    links: [
      { href: '/admin/dashboard', label: 'System Dashboard', desc: 'Usage metrics, risk breakdowns, and trend charts', icon: <BarChart3 size={14} /> },
      { href: '/admin/tools', label: 'Tool Registry', desc: 'Registry of classified corporate AI tools', icon: <BarChart3 size={14} /> },
      { href: '/admin/requests', label: 'Access Requests', desc: 'Approve or deny employee requests with full audit trail', icon: <Users size={14} /> },
      { href: '/admin/logs', label: 'Security Audit Logs', desc: 'Historical stream of detected prompts and verdicts', icon: <FileText size={14} /> },
    ],
  },
};

const DEMO_TEMPLATES = [
  {
    label: 'PII Leak',
    text: 'Send offsite contact list: name, email alice@company.com, and phone +1-555-0188.',
    category: 'PII'
  },
  {
    label: 'Secret Leak',
    text: 'Draft python script connecting with apiKey sk-live-99a8b7c6d5e4.',
    category: 'Credentials'
  },
  {
    label: 'Internal Info',
    text: 'Summarise Q3 budget: $1.2M revenue with confidential internal salary details.',
    category: 'Business'
  },
  {
    label: 'Safe Prompt',
    text: 'Draft a friendly thank-you email to our project partner for their hard work.',
    category: 'Safe'
  }
];

export default function LandingPage() {
  const [view, setView] = useState<'employee' | 'admin'>('employee');
  const [prompt, setPrompt] = useState('Type a prompt here to test, or click one of the templates below.');
  const active = views[view];

  // Live client-side prompt scanner
  const scanResult = useMemo(() => {
    const hits: { text: string; label: string; severity: 'high' | 'medium' }[] = [];
    
    // 1. Email check
    const emailRegex = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
    const emails = prompt.match(emailRegex);
    if (emails) {
      emails.forEach(e => hits.push({ text: e, label: 'Email Address', severity: 'high' }));
    }

    // 2. Phone check
    const phoneRegex = /\+?\d{1,3}[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
    const phones = prompt.match(phoneRegex);
    if (phones) {
      phones.forEach(p => {
        if (p.replace(/\D/g, '').length >= 7) {
          hits.push({ text: p, label: 'Phone Number', severity: 'high' });
        }
      });
    }

    // 3. API Key check
    const keyRegex = /(?:sk-|api[-_]?key|secret)[-_]?[A-Za-z0-9]{12,}/gi;
    const keys = prompt.match(keyRegex);
    if (keys) {
      keys.forEach(k => hits.push({ text: k, label: 'API Credentials', severity: 'high' }));
    }

    // 4. Keywords check
    const keywords = ['confidential', 'salary', 'budget', 'internal', 'nda', 'proprietary'];
    const lower = prompt.toLowerCase();
    keywords.forEach(kw => {
      if (lower.includes(kw)) {
        const regex = new RegExp(`\\b${kw}\\b`, 'gi');
        const matches = prompt.match(regex);
        if (matches) {
          matches.forEach(m => {
            if (!hits.some(h => h.text.toLowerCase() === m.toLowerCase())) {
              hits.push({ text: m, label: 'Confidential Business Info', severity: 'medium' });
            }
          });
        }
      }
    });

    const hasHigh = hits.some(h => h.severity === 'high');
    const hasMed = hits.some(h => h.severity === 'medium');

    let verdict: 'allow' | 'flag' | 'block' = 'allow';
    let risk: 'none' | 'medium' | 'high' = 'none';
    let reason = 'Safe prompt. No sensitive corporate or personal data detected.';

    if (hasHigh) {
      verdict = 'block';
      risk = 'high';
      reason = `Blocked: High-risk ${hits.filter(h => h.severity === 'high')[0]?.label || 'PII'} leakage detected.`;
    } else if (hasMed) {
      verdict = 'flag';
      risk = 'medium';
      reason = 'Warning: Contains internal business-sensitive keywords. Recommended review.';
    }

    return { hits, verdict, risk, reason };
  }, [prompt]);

  // Renderer for live highlighted preview
  const renderHighlighted = useMemo(() => {
    if (!prompt) return <span className="text-text-muted">Type something above...</span>;
    if (scanResult.hits.length === 0) return <span>{prompt}</span>;

    const sortedHits = [...scanResult.hits].sort((a, b) => b.text.length - a.text.length);
    const escaped = sortedHits.map(h => h.text.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
    const unique = Array.from(new Set(escaped));
    if (unique.length === 0) return <span>{prompt}</span>;

    const regex = new RegExp(`(${unique.join('|')})`, 'gi');
    const parts = prompt.split(regex);

    return (
      <>
        {parts.map((part, i) => {
          const hit = sortedHits.find(h => h.text.toLowerCase() === part.toLowerCase());
          if (hit) {
            const isHigh = hit.severity === 'high';
            return (
              <span 
                key={i} 
                className={`px-1 py-0.5 rounded font-medium text-[11px] font-mono mx-0.5 cursor-help ${
                  isHigh 
                    ? 'bg-risk-high-bg text-risk-high border border-risk-high/30' 
                    : 'bg-risk-medium-bg text-risk-medium border border-risk-medium/30'
                }`}
                title={hit.label}
              >
                {part}
              </span>
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </>
    );
  }, [prompt, scanResult.hits]);

  return (
    <div className="flex-1 flex flex-col bg-background text-text-primary">
      <div className="flex-1 max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center p-6 md:p-12">
        {/* Left Column: Brand, Editorial Intro & Simulator Sandbox */}
        <div className="lg:col-span-7 space-y-6 pr-0 lg:pr-4">
          <div className="flex items-center gap-3">
            <RadarIcon size={32} className="text-accent" />
            <h1 className="text-3xl tracking-tight font-serif">
              <span className="font-semibold">pelta</span>
              <span className="text-accent font-bold">.</span>
              <span className="font-light text-text-secondary">ai</span>
            </h1>
          </div>

          <div className="space-y-3">
            <h2 className="text-3xl md:text-4xl font-serif text-text-primary leading-tight font-light">
              Responsible AI Governance <br />
              <span className="italic text-text-secondary font-normal">for the modern enterprise.</span>
            </h2>
            <p className="text-sm md:text-base text-text-secondary leading-relaxed max-w-md">
              Pelta combines real-time prompt-risk proxy verification with compliance workflows to map, measure, and manage AI safety under the NIST AI RMF.
            </p>
          </div>

          {/* Dynamic Sandbox Widget */}
          <div className="panel p-4 space-y-3 border border-border/80 bg-surface/50 rounded-lg shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-widest text-text-secondary font-semibold flex items-center gap-1.5">
                <RadarIcon size={12} className="text-accent animate-radar-pulse" /> Live Prompt Guard Simulator
              </span>
              <span className="text-[9px] font-mono text-text-muted">client-side scan</span>
            </div>

            <textarea
              className="w-full bg-background border border-border rounded p-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors resize-none h-16 font-mono"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Type or paste any text to test local detection..."
            />

            {/* Template Chips */}
            <div className="flex flex-wrap gap-1.5">
              {DEMO_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.label}
                  onClick={() => setPrompt(tmpl.text)}
                  className="text-[9px] font-mono px-2 py-0.5 rounded border border-border hover:border-accent/40 bg-surface text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                >
                  {tmpl.label}
                </button>
              ))}
            </div>

            {/* Live Verdict Banner */}
            <div className={`p-2.5 rounded border text-[11px] flex items-start gap-2 ${
              scanResult.verdict === 'block' ? 'bg-risk-high-bg text-risk-high border-risk-high/30' :
              scanResult.verdict === 'flag' ? 'bg-risk-medium-bg text-risk-medium border-risk-medium/30' :
              'bg-risk-low-bg text-risk-low border-risk-low/30'
            }`}>
              <span className="mt-0.5 shrink-0">
                {scanResult.verdict === 'block' ? <XCircle size={12} /> :
                 scanResult.verdict === 'flag' ? <AlertTriangle size={12} /> :
                 <CheckCircle2 size={12} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold uppercase tracking-wider text-[9px] font-mono">
                  VERDICT: {scanResult.verdict}
                </p>
                <p className="mt-0.5 leading-snug text-[10px] text-text-secondary">
                  {scanResult.reason}
                </p>
              </div>
            </div>

            {/* Live Preview Highlighter */}
            <div className="p-2.5 bg-background border border-border rounded text-[11px] font-mono leading-relaxed break-all max-h-24 overflow-y-auto">
              <p className="text-[9px] text-text-tertiary uppercase tracking-widest mb-1.5">Real-time Redaction Preview</p>
              {renderHighlighted}
            </div>
          </div>
        </div>

        {/* Right Column: Interaction Hub */}
        <div className="lg:col-span-5 p-6 border border-border bg-surface rounded-lg space-y-6">
          <div className="space-y-1">
            <h3 className="text-[10px] font-mono uppercase tracking-widest text-text-tertiary font-semibold">Workspace Access</h3>
            <p className="text-sm text-text-secondary">Choose a perspective to explore the governance workflow.</p>
          </div>

          {/* Toggle */}
          <div className="flex items-center bg-background border border-border rounded p-0.5">
            <button
              onClick={() => setView('employee')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-sm font-medium transition-all cursor-pointer ${
                view === 'employee'
                  ? 'bg-surface text-text-primary border border-border/80 shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Lock size={13} className={view === 'employee' ? 'text-accent' : ''} />
              Employee View
            </button>
            <button
              onClick={() => setView('admin')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-sm font-medium transition-all cursor-pointer ${
                view === 'admin'
                  ? 'bg-surface text-text-primary border border-border/80 shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Shield size={13} className={view === 'admin' ? 'text-accent' : ''} />
              Admin View
            </button>
          </div>

          {/* View Description & Links */}
          <div className="space-y-4 animate-slide-in" key={view}>
            <p className="text-sm text-text-secondary leading-relaxed">
              {active.description}
            </p>

            <div className="space-y-2">
              {active.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center justify-between p-3.5 rounded border border-border hover:border-accent/40 hover:bg-surface-hover transition-all group"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <span className="mt-0.5 text-text-tertiary group-hover:text-accent transition-colors shrink-0">
                      {link.icon}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text-primary group-hover:text-accent transition-colors">
                        {link.label}
                      </p>
                      <p className="text-[10px] text-text-tertiary mt-0.5 truncate">{link.desc}</p>
                    </div>
                  </div>
                  <ChevronRight size={13} className="text-text-tertiary group-hover:text-accent transition-colors group-hover:translate-x-0.5" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-8 py-4 border-t border-border text-[9px] text-text-tertiary font-mono flex items-center justify-between">
        <span>Govern · Map · Measure · Manage</span>
        <span className="text-accent">pelta.ai v2.0</span>
      </div>
    </div>
  );
}
