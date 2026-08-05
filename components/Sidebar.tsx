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
  ShieldCheck,
  Bell,
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
  { href: '/employee', label: 'Workspace', icon: <ShieldCheck size={18} />, matchPaths: ['/employee'], exact: true },
  { href: '/employee/requests/new', label: 'Request Tool', icon: <Send size={18} />, matchPaths: ['/employee/requests'] },
  { href: '/employee/redress', label: 'Redress', icon: <ShieldAlert size={18} />, matchPaths: ['/employee/redress'] },
];

const ADMIN_ITEMS: NavItem[] = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: <BarChart3 size={18} />, matchPaths: ['/admin/dashboard'] },
  { href: '/admin/tools/new', label: 'Classify', icon: <Search size={18} />, matchPaths: ['/admin/tools/new'] },
  { href: '/admin/tools', label: 'Tools', icon: <Layers size={18} />, matchPaths: ['/admin/tools'], exact: true },
  { href: '/admin/requests', label: 'Requests', icon: <ClipboardList size={18} />, matchPaths: ['/admin/requests'] },
  { href: '/admin/dlp-rules', label: 'DLP Rules', icon: <ShieldCheck size={18} />, matchPaths: ['/admin/dlp-rules'] },
  { href: '/admin/logs', label: 'Logs', icon: <FileText size={18} />, matchPaths: ['/admin/logs'] },
];

/* ── Page title map ────────────────────────────────────── */

const PAGE_TITLES: Record<string, { title: string; crumb: string }> = {
  '/': { title: 'pelta.ai', crumb: 'AI Governance Platform' },
  '/employee': { title: 'Workspace', crumb: 'Employee dashboard' },
  '/employee/requests/new': { title: 'Request Tool', crumb: 'Request a new AI tool' },
  '/employee/redress': { title: 'Redress', crumb: 'Right to Explanation · EU AI Act' },
  '/admin/dashboard': { title: 'Dashboard', crumb: 'Overview' },
  '/admin/tools/new': { title: 'Classify', crumb: 'LLM-powered risk assessment' },
  '/admin/tools': { title: 'Tools', crumb: 'AI tool registry' },
  '/admin/requests': { title: 'Requests', crumb: 'Approve or deny submissions' },
  '/admin/dlp-rules': { title: 'DLP Rules', crumb: 'Custom regex-based detection patterns' },
  '/admin/logs': { title: 'Logs', crumb: 'Detection audit trail' },
};

/* ── Components ────────────────────────────────────────── */

function ThemeToggleMini({ collapsed }: { collapsed?: boolean }) {
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

  const label = theme === 'dark' ? 'Light mode' : 'Dark mode';
  const icon = theme === 'dark' ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );

  return (
    <button
      onClick={toggle}
      title={label}
      className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors cursor-pointer ${
        collapsed ? 'justify-center' : ''
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span
        className="whitespace-nowrap transition-opacity duration-150 text-xs"
        style={{ opacity: collapsed ? 0 : 1, width: collapsed ? 0 : 'auto', overflow: 'hidden' }}
      >
        {label}
      </span>
    </button>
  );
}

function SeedButtonSidebar({ collapsed }: { collapsed?: boolean }) {
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
      title="Reset all data to seed state"
      className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm text-text-tertiary hover:bg-surface-hover hover:text-text-secondary transition-colors cursor-pointer disabled:opacity-40 ${
        collapsed ? 'justify-center' : ''
      }`}
    >
      <RefreshCw size={14} className={`shrink-0 ${seeding ? 'animate-spin' : ''}`} />
      <span
        className="whitespace-nowrap transition-opacity duration-150 text-xs"
        style={{ opacity: collapsed ? 0 : 1, width: collapsed ? 0 : 'auto', overflow: 'hidden' }}
      >
        Reset
      </span>
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

function NavGroup({ label, items, pathname, collapsed }: { label: string; items: NavItem[]; pathname: string; collapsed?: boolean }) {
  return (
    <div className="space-y-1">
      {/* Section label — hidden when collapsed */}
      {!collapsed && (
        <p className="px-3 py-2 text-xs font-bold uppercase tracking-widest text-text-muted">{label}</p>
      )}
      {collapsed && <div className="py-1 border-t border-border/40 mx-2" />}
      {items.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : item.matchPaths.some((p) => pathname.startsWith(p));
        const isRequests = item.href === '/admin/requests';
        return collapsed ? (
          /* Icon-only collapsed mode */
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            className={`flex items-center justify-center h-9 w-9 mx-auto rounded transition-all ${
              active
                ? 'text-accent bg-accent-dim'
                : 'text-text-muted hover:bg-surface-hover hover:text-text-secondary'
            }`}
          >
            {item.icon}
          </Link>
        ) : (
          /* Expanded mode */
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-4 py-2 rounded-l-none rounded-r text-sm transition-all border-l-2 ${
              active
                ? 'text-text-primary font-semibold border-accent bg-accent-dim'
                : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary border-transparent'
            }`}
          >
            <span className={`shrink-0 transition-colors ${active ? 'text-accent' : 'text-text-muted'}`}>{item.icon}</span>
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
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem('pelta-sidebar');
    if (stored === 'collapsed') setCollapsed(true);
  }, []);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('pelta-sidebar', next ? 'collapsed' : 'expanded');
  };

  return (
    <aside
      className="shrink-0 h-screen flex flex-col border-r border-border bg-surface/30 sticky top-0 overflow-hidden transition-[width] duration-200 ease-in-out"
      style={{ width: mounted ? (collapsed ? '56px' : '220px') : '220px' }}
    >
      {/* Logo */}
      <Link
        href="/"
        title="pelta.ai"
        className="flex items-center gap-3 px-4 h-16 border-b border-border shrink-0 hover:bg-surface-hover/50 transition-colors overflow-hidden"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-accent shrink-0">
          <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
          <path d="M12 7a5 5 0 0 1 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
          <path d="M12 11a1 1 0 0 1 1 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
        </svg>
        <span
          className="text-lg tracking-tight font-serif whitespace-nowrap transition-opacity duration-150"
          style={{ opacity: collapsed ? 0 : 1 }}
        >
          <span className="font-semibold text-text-primary">pelta</span>
          <span className="text-accent font-bold">.</span>
          <span className="font-light text-text-secondary">ai</span>
        </span>
      </Link>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-4">
        <NavGroup label="Employee" items={EMPLOYEE_ITEMS} pathname={pathname} collapsed={collapsed} />
        <NavGroup label="Admin"    items={ADMIN_ITEMS}    pathname={pathname} collapsed={collapsed} />
      </nav>

      {/* Bottom controls */}
      <div className={`py-2 border-t border-border space-y-0.5 ${collapsed ? 'px-1' : 'px-2'}`}>
        <SeedButtonSidebar collapsed={collapsed} />
        <ThemeToggleMini   collapsed={collapsed} />

        {/* Collapse toggle */}
        <button
          onClick={toggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm text-text-muted hover:bg-surface-hover hover:text-text-secondary transition-colors cursor-pointer ${collapsed ? 'justify-center' : ''}`}
        >
          {/* Chevron icon inline */}
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className="shrink-0 transition-transform duration-200"
            style={{ transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span
            className="whitespace-nowrap transition-opacity duration-150 text-xs"
            style={{ opacity: collapsed ? 0 : 1, width: collapsed ? 0 : 'auto', overflow: 'hidden' }}
          >
            Collapse
          </span>
        </button>
      </div>
    </aside>
  );
}

/* ── Slim top bar ──────────────────────────────────────── */

export function SlimTopBar() {
  return <SlimTopBarInner />;
}

/* Contextual quick-action per section */
const QUICK_ACTIONS: Record<string, { label: string; href: string; icon: React.ReactNode }> = {
  employee:       { label: 'New Request', href: '/employee/requests/new', icon: <Send size={11} /> },
  'admin/tools':  { label: 'Classify Tool', href: '/admin/tools/new',     icon: <Search size={11} /> },
};

function TopBarPendingBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const [appeals, requests] = await Promise.all([
          fetch('/api/access-requests').then((r) => r.json()),
          fetch('/api/requests').then((r) => r.json()),
        ]);
        const appealPending  = Array.isArray(appeals)   ? appeals.filter((r: any)   => r.status === 'pending').length : 0;
        const requestPending = Array.isArray(requests)  ? requests.filter((r: any)  => r.status === 'pending').length : 0;
        setCount(appealPending + requestPending);
      } catch {}
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30_000);
    const handler = () => fetchCount();
    window.addEventListener('pelta:refetch-requests', handler);
    return () => { clearInterval(interval); window.removeEventListener('pelta:refetch-requests', handler); };
  }, []);

  if (count === 0) return null;

  return (
    <div className="relative flex items-center" title={`${count} pending item${count !== 1 ? 's' : ''}`}>
      <Bell size={14} className="text-text-tertiary" />
      <span
        className="absolute -top-1.5 -right-1.5 text-[9px] font-bold font-mono leading-none px-1 py-0.5 rounded-full"
        style={{ color: 'var(--risk-medium)', background: 'rgba(217,119,6,0.15)' }}
      >
        {count}
      </span>
    </div>
  );
}

function SlimTopBarInner() {
  const pathname = usePathname();

  // Find the best matching page title
  let best = PAGE_TITLES['/'];
  for (const [route, info] of Object.entries(PAGE_TITLES)) {
    if (pathname === route) { best = info; break; }
    if (pathname.startsWith(route + '/') && route !== '/') { best = info; break; }
  }

  // Find contextual quick-action
  let quickAction: { label: string; href: string; icon: React.ReactNode } | null = null;
  for (const [prefix, action] of Object.entries(QUICK_ACTIONS)) {
    if (pathname.startsWith('/' + prefix) && pathname !== action.href) {
      quickAction = action;
      break;
    }
  }

  return (
    <div className="flex items-center gap-3 px-6 h-16 border-b border-border bg-surface/20 shrink-0">
      <span className="text-base font-semibold text-text-primary">{best.title}</span>
      {best.crumb && (
        <>
          <span className="text-text-muted text-sm">/</span>
          <span className="text-sm font-mono text-text-tertiary">{best.crumb}</span>
        </>
      )}

      <div className="ml-auto flex items-center gap-3">
        <TopBarPendingBadge />
        {quickAction && (
          <Link
            href={quickAction.href}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-border bg-surface-hover hover:border-accent/40 hover:text-accent text-text-secondary transition-colors"
          >
            {quickAction.icon}
            {quickAction.label}
          </Link>
        )}
      </div>
    </div>
  );
}
