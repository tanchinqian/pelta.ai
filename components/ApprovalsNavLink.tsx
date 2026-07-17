'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function ApprovalsNavLink() {
  const [pendingCount, setPendingCount] = useState<number>(0);
  const pathname = usePathname();
  const isActive = pathname.startsWith('/admin/approvals');

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const res = await fetch('/api/access-requests');
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data)) {
          setPendingCount(data.filter((r: { status: string }) => r.status === 'pending').length);
        }
      } catch {
        // fail silently — nav badge is non-critical
      }
    };
    fetchCount();
    // Refresh every 30 s so the count stays current without a hard reload
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
      Approvals
      {pendingCount > 0 && (
        <span
          className="text-[9px] font-bold font-mono px-1 py-0.5 rounded leading-none"
          style={{
            color: 'var(--risk-medium)',
            background: 'rgba(245,158,11,0.12)',
          }}
        >
          {pendingCount}
        </span>
      )}
    </Link>
  );
}
