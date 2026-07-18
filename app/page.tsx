'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Shield, Lock, FileText, BarChart3, Users } from 'lucide-react';
import RadarIcon from '@/components/RadarIcon';

const views = {
  employee: {
    icon: <Lock size={16} className="text-text-secondary" />,
    title: 'Employee View',
    description: 'Guard your prompts before they leave the organisation. Real-time regex + LLM detection for PII, secrets, and confidential business data.',
    links: [
      { href: '/employee/redress', label: 'Right to Explanation', desc: 'EU AI Act Article 86 — understand why a prompt was blocked', icon: <FileText size={14} /> },
    ],
  },
  admin: {
    icon: <Shield size={16} className="text-text-secondary" />,
    title: 'Admin View',
    description: 'Classify tools, monitor usage, and manage approvals. Every logged event is explainable and auditable.',
    links: [
      { href: '/admin/tools/new', label: 'Classify a Tool', desc: 'Submit an AI tool for Gemini-powered risk assessment', icon: <BarChart3 size={14} /> },
      { href: '/admin/dashboard', label: 'Dashboard', desc: 'Usage charts, tool registry, prompt guard logs', icon: <BarChart3 size={14} /> },
      { href: '/admin/approvals', label: 'Approvals', desc: 'Review access requests and tool requests — approve or decline with full audit trail', icon: <Shield size={14} /> },
    ],
  },
};

export default function LandingPage() {
  const [view, setView] = useState<'employee' | 'admin'>('employee');
  const active = views[view];

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-lg space-y-8">
          {/* Wordmark */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <RadarIcon size={28} className="text-accent" />
              <h1 className="text-3xl tracking-tight">
                <span className="font-bold text-text-primary">pelta</span>
                <span className="text-accent font-bold">.</span>
                <span className="font-light text-text-secondary">ai</span>
              </h1>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed">
              AI governance platform — classify, monitor, and control AI tool usage across your organisation.
            </p>
            <p className="text-xs text-text-tertiary font-mono">
              NIST AI RMF · EU AI Act · Hybrid regex + LLM detection
            </p>
          </div>

          {/* Toggle */}
          <div className="flex items-center bg-surface border border-border rounded-lg p-0.5">
            <button
              onClick={() => setView('employee')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-medium transition-all cursor-pointer ${
                view === 'employee'
                  ? 'bg-surface-hover text-text-primary shadow-sm'
                  : 'text-text-tertiary hover:text-text-secondary'
              }`}
            >
              <Lock size={13} />
              Employee
            </button>
            <button
              onClick={() => setView('admin')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-medium transition-all cursor-pointer ${
                view === 'admin'
                  ? 'bg-surface-hover text-text-primary shadow-sm'
                  : 'text-text-tertiary hover:text-text-secondary'
              }`}
            >
              <Shield size={13} />
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
                  <span className="mt-0.5 text-text-tertiary group-hover:text-accent transition-colors">
                    {link.icon}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-text-primary group-hover:text-accent transition-colors">
                      {link.label}
                    </p>
                    <p className="text-xs text-text-tertiary mt-0.5">{link.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 border-t border-border text-[10px] text-text-tertiary font-mono flex items-center justify-between">
        <span>Govern · Map · Measure · Manage</span>
        <span className="text-accent">pelta.ai</span>
      </div>
    </div>
  );
}
