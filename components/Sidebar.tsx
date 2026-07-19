'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Send,
  ShieldAlert,
  BarChart3,
  Search,
  ClipboardList,
  FileText,
  RefreshCw,
  Layers,
} from 'lucide-react';

/* ── Types ──────────────────────────────────────────────── */

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  matchPaths: string[];
  exact?: boolean;
}

/* ── Static nav items ──────────────────────────────────── */

const EMPLOYEE_ITEMS: NavItem[] = [
  { href: '/employee/requests/new', label: 'Request Tool', icon: <Send size={15} />, matchPaths: ['/employee/requests'] },
  { href: '/employee/redress', label: 'Redress', icon: <ShieldAlert size={15} />, matchPaths: ['/employee/redress'] },
];

const ADMIN_ITEMS: NavItem[] = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: <BarChart3 size={15} />, matchPaths: ['/admin/dashboard'] },
  { href: '/admin/tools/new', label: 'Classify', icon: <Search size={15} />, matchPaths: ['/admin/tools/new'] },
  { href: '/admin/tools', label: 'Tools', icon: <Layers size={15} />, matchPaths: ['/admin/tools'], exact: true },
  { href: '/admin/requests', label: 'Requests', icon: <ClipboardList size={15} />, matchPaths: ['/admin/requests'] },
  { href: '/admin/logs', label: 'Logs', icon: <FileText size={15} />, matchPaths: ['/admin/logs'] },
];

/* ── Page title map ────────────────────────────────────── */

const PAGE_TITLES: Record<string, { title: string; crumb: string }> = {
  '/': { title: 'pelta.ai', crumb: 'AI Governance Platform' },
  '/employee/requests/new': { title: 'Request Tool', crumb: 'Request a new AI tool' },
  '/employee/redress': { title: 'Redress', crumb: 'Right to Explanation · EU AI Act' },
  '/admin/dashboard': { title: 'Dashboard', crumb: 'Overview' },
  '/admin/tools/new': { title: 'Classify', crumb: 'LLM-powered risk assessment' },
  '/admin/tools': { title: 'Tools', crumb: 'AI tool registry' },
  '/admin/requests': { title: 'Requests', crumb: 'Approve or deny submissions' },
  '/admin/logs': { title: 'Logs', crumb: 'Detection audit trail' },
};

/* ── Components ────────────────────────────────────────── */

function ThemeToggleMini() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem('pelta-theme') as 'dark' | 'light' | null;
    if (stored) {
      setTheme(stored);
      document.documentElement.setAttribute('data-theme', stored);
      document.documentElement.classList.toggle('dark', stored === 'dark');
    } else {
      const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
      const initial = prefersLight ? 'light' : 'dark';
      setTheme(initial);
      document.documentElement.setAttribute('data-theme', initial);
      document.documentElement.classList.toggle('dark', initial === 'dark');
    }
  }, []);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('pelta-theme', next);
    document.documentElement.setAttribute('data-theme', next);
    document.documentElement.classList.toggle('dark', next === 'dark');
  };

  if (!mounted) return <div className="h-8" />;

  return (
    <button
      onClick={toggle}
      className="w-full flex items-center gap-2 px-3 py-1.5 rounded text-[11px] text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors cursor-pointer"
    >
      {theme === 'dark' ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      )}
      {theme === 'dark' ? 'Light mode' : 'Dark mode'}
    </button>
  );
}

function SeedButtonSidebar() {
  const [seeding, setSeeding] = useState(false);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await fetch('/api/seed', { method: 'POST' });
      window.location.reload();
    } catch {
      setSeeding(false);
    }
  };

  return (
    <button
      onClick={handleSeed}
      disabled={seeding}
      className="w-full flex items-center gap-2 px-3 py-1.5 rounded text-[11px] text-text-tertiary hover:bg-surface-hover hover:text-text-secondary transition-colors cursor-pointer disabled:opacity-40"
      title="Reset all data to seed state"
    >
      <RefreshCw size={12} className={seeding ? 'animate-spin' : ''} />
      Reset
    </button>
  );
}

function RequestBadge() {
  const [pendingCount, setPendingCount] = useState(0);

  const fetchCount = async () => {
    try {
      const [appeals, tools] = await Promise.all([
        fetch('/api/access-requests').then((r) => r.json()),
        fetch('/api/requests').then((r) => r.json()),
      ]);
      const appealPending = Array.isArray(appeals) ? appeals.filter((r: any) => r.status === 'pending').length : 0;
      const toolPending = Array.isArray(tools) ? tools.filter((r: any) => r.status === 'pending').length : 0;
      setPendingCount(appealPending + toolPending);
    } catch {}
  };

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 30_000);
    const handler = () => fetchCount();
    window.addEventListener('pelta:refetch-requests', handler);
    return () => {
      clearInterval(interval);
      window.removeEventListener('pelta:refetch-requests', handler);
    };
  }, []);

  if (pendingCount === 0) return null;

  return (
    <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded ml-auto leading-none"
      style={{ color: 'var(--risk-medium)', background: 'rgba(245,158,11,0.12)' }}>
      {pendingCount}
    </span>
  );
}

function NavGroup({ label, items, pathname }: { label: string; items: NavItem[]; pathname: string }) {
  return (
    <div className="space-y-1">
      <p className="px-3 py-1 text-[9px] font-semibold uppercase tracking-widest text-text-muted">{label}</p>
      {items.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : item.matchPaths.some((p) => pathname.startsWith(p));
        const isRequests = item.href === '/admin/requests';
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2.5 px-3 py-1.5 rounded-l-none rounded-r text-[12px] transition-all border-l ${
              active
                ? 'text-text-primary font-medium border-accent bg-accent-dim/60'
                : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary border-transparent'
            }`}
          >
            <span className={`shrink-0 ${active ? 'text-accent' : 'text-text-tertiary'}`}>{item.icon}</span>
            <span className="truncate">{item.label}</span>
            {isRequests && <RequestBadge />}
          </Link>
        );
      })}
    </div>
  );
}

/* ── Sidebar ───────────────────────────────────────────── */

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[210px] shrink-0 h-screen flex flex-col border-r border-border bg-surface/30 sticky top-0">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 px-4 h-12 border-b border-border shrink-0 hover:bg-surface-hover/50 transition-colors">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-accent shrink-0">
          <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
          <path d="M12 7a5 5 0 0 1 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
          <path d="M12 11a1 1 0 0 1 1 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
        </svg>
        <span className="text-sm tracking-tight font-serif">
          <span className="font-semibold text-text-primary">pelta</span>
          <span className="text-accent font-bold">.</span>
          <span className="font-light text-text-secondary">ai</span>
        </span>
      </Link>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-4">
        <NavGroup label="Employee" items={EMPLOYEE_ITEMS} pathname={pathname} />
        <NavGroup label="Admin" items={ADMIN_ITEMS} pathname={pathname} />
      </nav>

      {/* Bottom controls */}
      <div className="px-2 py-2 border-t border-border space-y-0.5">
        <SeedButtonSidebar />
        <ThemeToggleMini />
      </div>
    </aside>
  );
}

/* ── Slim top bar ──────────────────────────────────────── */

export function SlimTopBar() {
  return <SlimTopBarInner />;
}

function SlimTopBarInner() {
  const pathname = usePathname();

  // Find the best matching page title
  let best = PAGE_TITLES['/'];
  for (const [route, info] of Object.entries(PAGE_TITLES)) {
    if (pathname === route) { best = info; break; }
    if (pathname.startsWith(route + '/') && route !== '/') { best = info; break; }
  }

  return (
    <div className="flex items-center gap-2 px-4 h-9 border-b border-border bg-surface/20 shrink-0">
      <span className="text-[11px] font-semibold text-text-primary">{best.title}</span>
      {best.crumb && (
        <>
          <span className="text-text-muted text-[10px]">/</span>
          <span className="text-[10px] font-mono text-text-tertiary">{best.crumb}</span>
        </>
      )}
    </div>
  );
}
