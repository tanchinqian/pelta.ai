import { NextRequest, NextResponse } from 'next/server';
import { readStore, addItem, updateItem } from '@/lib/fileStore';
import { v4 as uuid } from 'uuid';

interface AccessRequest {
  id: string;
  employeeName: string;
  sections: string[];
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  adminComment: string | null;
  logRef: string;
  requestedAt: string;
  decidedAt: string | null;
}

export async function GET() {
  const data = readStore<AccessRequest>('access-requests');
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  try {
    const { employeeName, sections, reason, logRef } = await req.json();
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
      reason,
      status: 'pending',
      adminComment: null,
      logRef: typeof logRef === 'string' ? logRef : '',
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
    const { id, status, adminComment } = await req.json();
    if (!id || !status) {
      return NextResponse.json({ error: 'id and status are required' }, { status: 400 });
    }
    if (!['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'status must be approved or rejected' }, { status: 400 });
    }
    const items = updateItem<AccessRequest>('access-requests', id, {
      status,
      adminComment: typeof adminComment === 'string' ? adminComment : null,
      decidedAt: new Date().toISOString(),
    });
    const updated = items.find((i) => i.id === id);
    return NextResponse.json(updated ?? { error: 'Not found' });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? 'Failed to update request' },
      { status: 500 },
    );
  }
}
