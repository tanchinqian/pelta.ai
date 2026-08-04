'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlusCircle, Trash2, ToggleLeft, ToggleRight, ShieldAlert, CheckCircle2, AlertTriangle, Minus, FlaskConical } from 'lucide-react';
import { toast } from 'sonner';

interface DlpRule {
  id: string;
  name: string;
  pattern: string;
  severity: 'high' | 'medium' | 'low';
  category: string;
  enabled: boolean;
  createdAt: string;
}

const SEVERITY_COLOR: Record<string, string> = {
  high: 'var(--risk-high)',
  medium: 'var(--risk-medium)',
  low: 'var(--risk-low)',
};

const SEVERITY_BG: Record<string, string> = {
  high: 'var(--risk-high-bg, rgba(239,68,68,.12))',
  medium: 'var(--risk-medium-bg, rgba(234,179,8,.12))',
  low: 'var(--risk-low-bg, rgba(34,197,94,.12))',
};

function SeverityBadge({ s }: { s: string }) {
  return (
    <span
      className="text-xs font-mono font-semibold uppercase px-2 py-0.5 rounded"
      style={{ color: SEVERITY_COLOR[s] ?? '#888', background: SEVERITY_BG[s] ?? 'transparent' }}
    >
      {s}
    </span>
  );
}

function highlightMatches(text: string, pattern: string): { parts: { text: string; match: boolean }[] } {
  if (!pattern) return { parts: [{ text, match: false }] };
  try {
    const re = new RegExp(pattern, 'gi');
    const parts: { text: string; match: boolean }[] = [];
    let lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m.index > lastIndex) parts.push({ text: text.slice(lastIndex, m.index), match: false });
      parts.push({ text: m[0], match: true });
      lastIndex = re.lastIndex;
      if (m[0].length === 0) { re.lastIndex++; } // avoid infinite loop on empty match
    }
    if (lastIndex < text.length) parts.push({ text: text.slice(lastIndex), match: false });
    return { parts };
  } catch {
    return { parts: [{ text, match: false }] };
  }
}

export default function DlpRulesPage() {
  const [rules, setRules] = useState<DlpRule[]>([]);
  const [loading, setLoading] = useState(true);

  // Add rule form
  const [newName, setNewName] = useState('');
  const [newPattern, setNewPattern] = useState('');
  const [newSeverity, setNewSeverity] = useState<'high' | 'medium' | 'low'>('high');
  const [newCategory, setNewCategory] = useState('Custom');
  const [patternError, setPatternError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Live tester
  const [testText, setTestText] = useState('');

  async function fetchRules() {
    setLoading(true);
    try {
      const res = await fetch('/api/dlp-rules');
      setRules(await res.json());
    } catch { toast.error('Failed to load rules'); }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchRules(); }, []);

  function validatePattern(p: string): boolean {
    if (!p) { setPatternError('Pattern is required'); return false; }
    try { new RegExp(p, 'gi'); setPatternError(''); return true; }
    catch (e: any) { setPatternError(`Invalid regex: ${e.message}`); return false; }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) { toast.error('Name is required'); return; }
    if (!validatePattern(newPattern)) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/dlp-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, pattern: newPattern, severity: newSeverity, category: newCategory }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Failed to add rule'); return; }
      setRules((prev) => [...prev, data]);
      setNewName(''); setNewPattern(''); setNewSeverity('high'); setNewCategory('Custom');
      toast.success('Rule added successfully');
    } catch { toast.error('Network error'); }
    finally { setSubmitting(false); }
  }

  async function handleToggle(rule: DlpRule) {
    try {
      const res = await fetch(`/api/dlp-rules/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !rule.enabled }),
      });
      const data = await res.json();
      setRules((prev) => prev.map((r) => (r.id === rule.id ? data : r)));
      toast.success(`Rule ${!rule.enabled ? 'enabled' : 'disabled'}`);
    } catch { toast.error('Failed to update rule'); }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete rule "${name}"? This cannot be undone.`)) return;
    try {
      await fetch(`/api/dlp-rules/${id}`, { method: 'DELETE' });
      setRules((prev) => prev.filter((r) => r.id !== id));
      toast.success('Rule deleted');
    } catch { toast.error('Failed to delete rule'); }
  }

  const testHighlights = useMemo(() => highlightMatches(testText, newPattern), [testText, newPattern]);
  const enabledCount = rules.filter((r) => r.enabled).length;

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex-1 p-4 max-w-[1400px] mx-auto w-full space-y-4 overflow-y-auto">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-text-primary tracking-tight">Custom DLP Rules</h2>
            <p className="text-sm text-text-secondary mt-0.5">
              Define regex-based patterns to detect and block custom sensitive keywords across all AI tools.
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm font-mono text-text-tertiary">
            <span>{rules.length} rules</span>
            <span>·</span>
            <span style={{ color: 'var(--risk-low)' }}>{enabledCount} active</span>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-4">

          {/* Left — Add Rule Form */}
          <div className="col-span-12 lg:col-span-5 panel p-4 space-y-4">
            <div className="flex items-center gap-2">
              <PlusCircle size={15} className="text-accent" />
              <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">Add New Rule</h3>
            </div>

            <form onSubmit={handleAdd} className="space-y-3">
              {/* Name */}
              <div>
                <label className="block text-xs font-mono text-text-tertiary mb-1 uppercase tracking-wider">Rule Name</label>
                <input
                  className="w-full bg-panel-secondary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent transition-colors"
                  placeholder="e.g. Project Phoenix"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>

              {/* Pattern */}
              <div>
                <label className="block text-xs font-mono text-text-tertiary mb-1 uppercase tracking-wider">Regex Pattern</label>
                <input
                  className={`w-full bg-panel-secondary border rounded-lg px-3 py-2 text-sm font-mono text-text-primary placeholder-text-tertiary focus:outline-none transition-colors ${patternError ? 'border-red-500' : 'border-border focus:border-accent'}`}
                  placeholder="e.g. \bProject\s+Phoenix\b"
                  value={newPattern}
                  onChange={(e) => { setNewPattern(e.target.value); if (patternError) validatePattern(e.target.value); }}
                />
                {patternError && (
                  <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                    <AlertTriangle size={11} /> {patternError}
                  </p>
                )}
              </div>

              {/* Severity + Category row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-text-tertiary mb-1 uppercase tracking-wider">Severity</label>
                  <select
                    className="w-full bg-panel-secondary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors"
                    value={newSeverity}
                    onChange={(e) => setNewSeverity(e.target.value as any)}
                  >
                    <option value="high">High — Block</option>
                    <option value="medium">Medium — Flag</option>
                    <option value="low">Low — Allow</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-mono text-text-tertiary mb-1 uppercase tracking-wider">Category</label>
                  <input
                    className="w-full bg-panel-secondary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent transition-colors"
                    placeholder="e.g. IP, HR, Finance"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                  />
                </div>
              </div>

              {/* Live tester */}
              <div>
                <label className="block text-xs font-mono text-text-tertiary mb-1 uppercase tracking-wider flex items-center gap-1.5">
                  <FlaskConical size={11} /> Live Pattern Tester
                </label>
                <textarea
                  className="w-full bg-panel-secondary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent transition-colors resize-none font-mono"
                  placeholder="Type sample text here to test your pattern..."
                  rows={3}
                  value={testText}
                  onChange={(e) => setTestText(e.target.value)}
                />
                {testText && (
                  <div className="mt-1.5 p-2 bg-panel-secondary border border-border rounded-lg text-sm font-mono leading-relaxed break-all">
                    {testHighlights.parts.map((p, i) =>
                      p.match
                        ? <mark key={i} className="rounded px-0.5" style={{ background: `${SEVERITY_COLOR[newSeverity]}30`, color: SEVERITY_COLOR[newSeverity] }}>{p.text}</mark>
                        : <span key={i}>{p.text}</span>
                    )}
                    {testHighlights.parts.every(p => !p.match) && testText && (
                      <span className="text-text-tertiary">No matches found</span>
                    )}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 text-sm font-semibold py-2 rounded-lg transition-all"
                style={{ background: 'var(--accent)', color: 'white', opacity: submitting ? 0.7 : 1 }}
              >
                {submitting ? 'Adding...' : <><PlusCircle size={14} /> Add Rule</>}
              </button>
            </form>
          </div>

          {/* Right — Rules Table */}
          <div className="col-span-12 lg:col-span-7 panel overflow-hidden flex flex-col">
            <div className="p-4 border-b border-border/50">
              <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">Active Rules</h3>
            </div>
            {loading ? (
              <div className="flex-1 flex items-center justify-center text-text-tertiary text-sm">Loading...</div>
            ) : rules.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 text-text-tertiary p-8">
                <ShieldAlert size={32} className="opacity-30" />
                <p className="text-sm font-mono">No custom rules yet.</p>
                <p className="text-xs">Add your first rule on the left to get started.</p>
              </div>
            ) : (
              <div className="overflow-auto flex-1">
                <table className="w-full text-sm min-w-[500px]">
                  <thead>
                    <tr className="text-xs font-mono text-text-tertiary uppercase tracking-wider border-b border-border/50">
                      <th className="text-left px-4 py-2.5">Name</th>
                      <th className="text-left px-4 py-2.5">Pattern</th>
                      <th className="text-left px-4 py-2.5">Severity</th>
                      <th className="text-center px-4 py-2.5">Active</th>
                      <th className="px-4 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {rules.map((rule) => (
                        <motion.tr
                          key={rule.id}
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          className="border-b border-border/30 hover:bg-panel-secondary/50 transition-colors"
                          style={{ opacity: rule.enabled ? 1 : 0.5 }}
                        >
                          <td className="px-4 py-2.5 font-semibold text-text-primary whitespace-nowrap">{rule.name}</td>
                          <td className="px-4 py-2.5 font-mono text-xs text-text-tertiary max-w-[180px] truncate" title={rule.pattern}>
                            {rule.pattern}
                          </td>
                          <td className="px-4 py-2.5">
                            <SeverityBadge s={rule.severity} />
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <button
                              onClick={() => handleToggle(rule)}
                              className="transition-colors"
                              title={rule.enabled ? 'Click to disable' : 'Click to enable'}
                            >
                              {rule.enabled
                                ? <ToggleRight size={22} style={{ color: 'var(--risk-low)' }} />
                                : <ToggleLeft size={22} className="text-text-tertiary" />}
                            </button>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <button
                              onClick={() => handleDelete(rule.id, rule.name)}
                              className="text-text-tertiary hover:text-red-400 transition-colors"
                              title="Delete rule"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
