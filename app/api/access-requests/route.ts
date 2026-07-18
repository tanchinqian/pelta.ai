import { NextRequest, NextResponse } from 'next/server';
import { readStore, addItem, updateItem } from '@/lib/fileStore';
import { v4 as uuid } from 'uuid';

interface AccessRequest {
  id: string;
  employeeName: string;
  sections: string[];
  riskLevel: 'low' | 'medium' | 'high' | null;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  adminComment: string | null;
  reviewerName: string | null;
  logRef: string;
  type?: 'appeal' | 'access';
  requestedAt: string;
  decidedAt: string | null;
}

interface AuditEntry {
  id: string;
  requestId: string;
  employeeName: string;
  action: 'approved' | 'rejected';
  reviewerName: string;
  adminComment: string | null;
  sections: string[];
  riskLevel: string | null;
  timestamp: string;
}

export async function GET() {
  const data = readStore<AccessRequest>('access-requests');
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  try {
    const { employeeName, sections, reason, logRef, riskLevel, type } = await req.json();
    if (!employeeName || !sections || !reason) {
      return NextResponse.json(
        { error: 'employeeName, sections, and reason are required' },
        { status: 400 },
      );
    }
    if (typeof reason !== 'string' || reason.length > 2000) {
      return NextResponse.json({ error: 'reason must be a string under 2000 chars' }, { status: 400 });
    }
    const record: AccessRequest = {
      id: uuid(),
      employeeName,
      sections: Array.isArray(sections) ? sections : [sections],
      riskLevel: riskLevel ?? null,
      reason,
      status: 'pending',
      adminComment: null,
      reviewerName: null,
      logRef: typeof logRef === 'string' ? logRef : '',
      type: type === 'appeal' ? 'appeal' : 'access',
      requestedAt: new Date().toISOString(),
      decidedAt: null,
    };
    addItem('access-requests', record);
    return NextResponse.json(record);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? 'Failed to create request' },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, status, adminComment, reviewerName } = await req.json();
    if (!id || !status) {
      return NextResponse.json({ error: 'id and status are required' }, { status: 400 });
    }
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return NextResponse.json({ error: 'status must be approved, rejected, or pending' }, { status: 400 });
    }

    const decidedAt = status === 'pending' ? null : new Date().toISOString();
    const items = updateItem<AccessRequest>('access-requests', id, {
      status,
      adminComment: typeof adminComment === 'string' ? adminComment : null,
      reviewerName: typeof reviewerName === 'string' ? reviewerName : 'Admin',
      decidedAt,
    });
    const updated = items.find((i) => i.id === id);

    // Write an audit log entry
    if (updated) {
      const auditEntry: AuditEntry = {
        id: uuid(),
        requestId: id,
        employeeName: updated.employeeName,
        action: status,
        reviewerName: typeof reviewerName === 'string' ? reviewerName : 'Admin',
        adminComment: typeof adminComment === 'string' ? adminComment : null,
        sections: updated.sections,
        riskLevel: updated.riskLevel ?? null,
        timestamp: decidedAt,
      };
      addItem('audit-log', auditEntry);
    }

    return NextResponse.json(updated ?? { error: 'Not found' });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? 'Failed to update request' },
      { status: 500 },
    );
  }
}
