import { NextResponse } from 'next/server';
import { readStore, updateItem } from '@/lib/fileStore';
import { NextRequest } from 'next/server';

interface RequestRecord {
  id: string;
  employeeName: string;
  department: string;
  toolRequested: string;
  status: 'pending' | 'approved' | 'denied';
  requestedAt: string;
  decidedAt: string | null;
}

export async function GET() {
  const requests = readStore<RequestRecord>('requests');
  return NextResponse.json(requests);
}

export async function PATCH(req: NextRequest) {
  const { id, status } = await req.json();
  if (!id || !status) {
    return NextResponse.json({ error: 'id and status are required' }, { status: 400 });
  }
  const items = updateItem<RequestRecord>('requests', id, { status, decidedAt: new Date().toISOString() });
  const updated = items.find((i) => i.id === id);
  return NextResponse.json(updated);
}
