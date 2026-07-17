'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Building, Wrench, FileText } from 'lucide-react';
import RadarIcon from '@/components/RadarIcon';

const DEPARTMENTS = ['Engineering', 'Sales', 'Marketing', 'Finance', 'HR'];

export default function NewRequestPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [department, setDepartment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeName: name,
          department,
          toolRequested: description,
          description,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Submission failed');
      }
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
            Your request for <span className="font-medium text-text-primary">{description}</span> is pending admin review.
          </p>
          <button
            onClick={() => router.push('/employee/prompt-guard')}
            className="text-xs text-accent hover:text-accent-hover transition-colors cursor-pointer"
          >
            Back to Prompt Guard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="panel p-5 max-w-md w-full space-y-4">
        <div className="flex items-center gap-2">
          <RadarIcon size={14} className="text-accent" />
          <span className="text-sm font-semibold text-text-primary">Request a New AI Tool</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <label className="block text-[10px] font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-1">
              <Wrench size={10} /> Tool Name
            </label>
            <input
              className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
              placeholder="e.g. NotebookLM, Copilot"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-1">
              <FileText size={10} /> What will you use it for?
            </label>
            <input
              className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
              placeholder="e.g. AI note-taking for meeting summaries"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-1">
              <Building size={10} /> Department
            </label>
            <select
              className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              required
              disabled={loading}
            >
              <option value="">Select department...</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
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
    </div>
  );
}
