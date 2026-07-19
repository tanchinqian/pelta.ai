'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Shield, Lock, FileText, BarChart3, Users, AlertTriangle, CheckCircle2, XCircle, ChevronRight, Activity, ShieldCheck, Cpu, Database, ArrowRight, BookOpen, Scale, Globe, Eye, Send, Search, Layers } from 'lucide-react';
import { motion } from 'framer-motion';
import RadarIcon from '@/components/RadarIcon';

const views = {
  employee: {
    icon: <Lock size={16} className="text-text-secondary" />,
    title: 'Employee View',
    description: 'Request access to AI tools or check decisions. Prompt guard proxy monitors compliance automatically.',
    links: [
      { href: '/employee/requests/new', label: 'Request Tool', desc: 'Submit a new AI tool for security approval', icon: <Send size={14} /> },
      { href: '/employee/redress', label: 'Right to Explanation', desc: 'EU AI Act Article 86 — understand why a request was decided', icon: <FileText size={14} /> },
    ],
  },
  admin: {
    icon: <Shield size={16} className="text-text-secondary" />,
    title: 'Admin View',
    description: 'Classify tools, monitor usage, and manage approvals. Every logged event is explainable and auditable.',
    links: [
      { href: '/admin/dashboard', label: 'System Dashboard', desc: 'Usage metrics, risk breakdowns, and trend charts', icon: <BarChart3 size={14} /> },
      { href: '/admin/tools/new', label: 'Classify Tool', desc: 'Classify a tool and assess risks using Gemini LLM', icon: <Search size={14} /> },
      { href: '/admin/tools', label: 'Tool Registry', desc: 'Registry of classified corporate AI tools', icon: <Layers size={14} /> },
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
    <div className="flex-1 flex flex-col bg-background text-text-primary overflow-y-auto overflow-x-hidden">
      {/* ── Hero Section ── */}
      <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center p-6 md:p-12 lg:min-h-[85vh]">
        {/* Left Column: Brand, Editorial Intro & Simulator Sandbox */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="lg:col-span-7 space-y-6 pr-0 lg:pr-4"
        >
          <div className="flex items-center gap-3">
            <RadarIcon size={32} className="text-accent" />
            <h1 className="text-3xl tracking-tight font-serif">
              <span className="font-semibold">pelta</span>
              <span className="text-accent font-bold">.</span>
              <span className="font-light text-text-secondary">ai</span>
            </h1>
          </div>

          <div className="space-y-3">
            <h2 className="text-3xl md:text-5xl font-serif text-text-primary leading-tight font-light">
              Responsible AI Governance <br />
              <span className="italic text-text-secondary font-normal">for the modern enterprise.</span>
            </h2>
            <p className="text-sm md:text-base text-text-secondary leading-relaxed max-w-md">
              Pelta combines real-time prompt-risk proxy verification with compliance workflows to map, measure, and manage AI safety under the NIST AI RMF.
            </p>
          </div>

          {/* Dynamic Sandbox Widget */}
          <div className="panel p-4 space-y-3 border border-border/80 bg-surface/50 rounded-lg shadow-sm backdrop-blur-sm">
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
        </motion.div>

        {/* Right Column: Interaction Hub */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="lg:col-span-5 p-6 border border-border bg-surface rounded-lg space-y-6 shadow-xl"
        >
          <div className="space-y-1">
            <h3 className="text-[10px] font-mono uppercase tracking-widest text-text-tertiary font-semibold">Workspace Access</h3>
            <p className="text-sm text-text-secondary">Choose a perspective to explore the governance workflow.</p>
          </div>

          {/* Toggle */}
          <div className="flex items-center bg-surface border border-border rounded-lg p-0.5">
            <button
              onClick={() => setView('employee')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-sm font-medium transition-all cursor-pointer ${
                view === 'employee'
                  ? 'bg-surface-hover text-text-primary shadow-sm'
                  : 'text-text-tertiary hover:text-text-secondary'
              }`}
            >
              <Lock size={13} className={view === 'employee' ? 'text-accent' : ''} />
              Employee
            </button>
            <button
              onClick={() => setView('admin')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-sm font-medium transition-all cursor-pointer ${
                view === 'admin'
                  ? 'bg-surface-hover text-text-primary shadow-sm'
                  : 'text-text-tertiary hover:text-text-secondary'
              }`}
            >
              <Shield size={13} className={view === 'admin' ? 'text-accent' : ''} />
              Admin
            </button>
          </div>

          {/* Content */}
          <div className="space-y-4 animate-slide-in" key={view}>
            <p className="text-sm text-text-secondary leading-relaxed">
              {active.description}
            </p>

            <div className="space-y-1">
              {active.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-accent/30 hover:bg-accent-dim transition-all group"
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
                </Link>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── NIST AI RMF Capabilities Section ── */}
      <div className="border-t border-border bg-surface-hover/30">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            className="text-center max-w-2xl mx-auto space-y-4 mb-16"
          >
            <h2 className="text-3xl font-serif text-text-primary">Aligned with the NIST AI RMF</h2>
            <p className="text-base text-text-secondary leading-relaxed">
              Pelta is built directly on top of the NIST Artificial Intelligence Risk Management Framework, ensuring your organization maps, measures, and manages AI risks effectively.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { title: 'Govern', icon: <Scale size={24} />, desc: 'Establish and enforce corporate AI policies, restricting unauthorized tool access.', delay: 0.1 },
              { title: 'Map', icon: <Globe size={24} />, desc: 'Classify AI tools automatically, understanding data flow and context of use.', delay: 0.2 },
              { title: 'Measure', icon: <Activity size={24} />, desc: 'Real-time proxy evaluation of prompt data to detect PII and credential leakage.', delay: 0.3 },
              { title: 'Manage', icon: <ShieldCheck size={24} />, desc: 'Block or flag risky prompts and maintain a comprehensive audit trail for compliance.', delay: 0.4 },
            ].map((feature, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: feature.delay }}
                className="panel p-6 border border-border/60 hover:border-accent/40 bg-background/50 hover:bg-surface transition-all group"
              >
                <div className="h-12 w-12 rounded-full bg-surface flex items-center justify-center text-text-tertiary group-hover:text-accent group-hover:bg-accent/10 transition-colors mb-4 border border-border/50">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-text-primary mb-2">{feature.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Workflow Section ── */}
      <div className="border-t border-border">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-6"
            >
              <h2 className="text-3xl font-serif text-text-primary">How Pelta Works</h2>
              <div className="space-y-8">
                {[
                  { step: '01', title: 'Request & Classify', desc: 'Employees request access to new AI tools. Pelta uses LLMs to automatically classify the tool\'s risk tier and applicable data categories.' },
                  { step: '02', title: 'Approve & Provision', desc: 'Admins review the automated risk profile and approve the tool. Access is provisioned safely within the enterprise boundary.' },
                  { step: '03', title: 'Real-time Proxy', desc: 'As employees use approved tools, Pelta intercepts prompts to redact sensitive info and flag policy violations instantly.' }
                ].map((w, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <span className="text-xl font-mono font-light text-accent/50 shrink-0">{w.step}</span>
                    <div>
                      <h4 className="text-base font-semibold text-text-primary mb-1">{w.title}</h4>
                      <p className="text-sm text-text-secondary leading-relaxed">{w.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="relative rounded-lg border border-border bg-surface p-8 shadow-2xl flex flex-col items-center justify-center min-h-[300px]"
            >
              {/* Abstract visualization of the proxy */}
              <div className="flex items-center gap-4 text-text-tertiary">
                <div className="p-4 bg-background border border-border rounded shadow-sm flex flex-col items-center gap-2">
                  <Users size={24} />
                  <span className="text-[10px] font-mono uppercase tracking-widest">Employee</span>
                </div>
                <ArrowRight size={20} className="text-accent animate-pulse" />
                <div className="p-4 bg-accent/10 border border-accent/30 text-accent rounded-full shadow-sm flex flex-col items-center gap-2 relative">
                  <RadarIcon size={32} className="animate-radar-pulse" />
                  <span className="absolute -bottom-6 text-[10px] font-mono uppercase tracking-widest font-bold whitespace-nowrap">Pelta Proxy</span>
                </div>
                <ArrowRight size={20} className="text-accent animate-pulse" />
                <div className="p-4 bg-background border border-border rounded shadow-sm flex flex-col items-center gap-2">
                  <Cpu size={24} />
                  <span className="text-[10px] font-mono uppercase tracking-widest">LLM API</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* ── Mocked Metrics Section ── */}
      <div className="border-t border-border bg-surface-hover/20">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 divide-x divide-border/50 text-center">
            {[
              { val: '24/7', label: 'Real-time Scanning' },
              { val: '<50ms', label: 'Proxy Latency' },
              { val: '100%', label: 'Audit Traceability' },
              { val: 'EU AI Act', label: 'Compliance Ready' },
            ].map((m, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="space-y-1"
              >
                <div className="text-3xl font-serif text-text-primary">{m.val}</div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-text-tertiary">{m.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Comprehensive Footer (Local to Home Page) ── */}
      <footer className="border-t border-border bg-background py-12 mt-auto">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="space-y-4 md:col-span-2">
            <div className="flex items-center gap-2">
              <RadarIcon size={20} className="text-accent" />
              <span className="text-lg font-serif font-semibold text-text-primary">pelta.ai</span>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed max-w-sm">
              Bridging the gap between AI innovation and enterprise compliance. Built to map, measure, and manage AI risks.
            </p>
            <div className="flex items-center gap-2 mt-4 text-[10px] font-mono text-text-tertiary">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-risk-low opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-risk-low"></span>
              </span>
              System Status: All Systems Operational
            </div>
          </div>
          
          <div className="space-y-4">
            <h4 className="text-[10px] font-mono uppercase tracking-widest text-text-primary font-semibold">Frameworks</h4>
            <ul className="space-y-2 text-sm text-text-secondary">
              <li><span className="flex items-center gap-2 hover:text-accent transition-colors"><BookOpen size={14}/> NIST AI RMF</span></li>
              <li><span className="flex items-center gap-2 hover:text-accent transition-colors"><Scale size={14}/> EU AI Act</span></li>
              <li><span className="flex items-center gap-2 hover:text-accent transition-colors"><ShieldCheck size={14}/> ISO 42001</span></li>
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="text-[10px] font-mono uppercase tracking-widest text-text-primary font-semibold">Quick Links</h4>
            <ul className="space-y-2 text-sm text-text-secondary">
              <li><Link href="/admin/dashboard" className="hover:text-accent transition-colors">Admin Dashboard</Link></li>
              <li><Link href="/admin/tools" className="hover:text-accent transition-colors">Tool Registry</Link></li>
              <li><Link href="/employee/redress" className="hover:text-accent transition-colors">Right to Explanation</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto px-6 mt-12 pt-6 border-t border-border/50 flex flex-col md:flex-row items-center justify-between gap-4 text-[10px] font-mono text-text-tertiary">
          <span>&copy; {new Date().getFullYear()} Pelta AI Governance. All rights reserved.</span>
          <span className="text-accent bg-accent/10 px-2 py-1 rounded">v1.0</span>
        </div>
      </footer>
    </div>
  );
}
