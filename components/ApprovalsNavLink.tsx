'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function RequestsNavLink() {
  const [pendingCount, setPendingCount] = useState<number>(0);
  const pathname = usePathname();
  const isActive = pathname.startsWith('/admin/approvals') || pathname.startsWith('/admin/requests');

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const [appeals, tools] = await Promise.all([
          fetch('/api/access-requests').then((r) => r.json()),
          fetch('/api/requests').then((r) => r.json()),
        ]);
        const appealPending = Array.isArray(appeals)
          ? appeals.filter((r: { status: string }) => r.status === 'pending').length
          : 0;
        const toolPending = Array.isArray(tools)
          ? tools.filter((r: { status: string }) => r.status === 'pending').length
          : 0;
        setPendingCount(appealPending + toolPending);
      } catch {
        // fail silently — nav badge is non-critical
      }
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Link
      href="/admin/approvals"
      className={`px-2.5 py-1 rounded hover:bg-surface-hover hover:text-text-primary transition-colors flex items-center gap-1 ${
        isActive ? 'text-text-primary bg-surface-hover' : ''
      }`}
    >
      Requests
      {pendingCount > 0 && (
        <span
          className="text-[9px] font-bold font-mono px-1 py-0.5 rounded leading-none"
          style={{ color: 'var(--risk-medium)', background: 'rgba(245,158,11,0.12)' }}
        >
          {pendingCount}
        </span>
      )}
    </Link>
  );
}
