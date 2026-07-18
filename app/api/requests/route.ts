import { NextResponse } from 'next/server';
import { readStore, updateItem, addItem } from '@/lib/fileStore';
import { NextRequest } from 'next/server';
import { v4 as uuid } from 'uuid';

interface RequestRecord {
  id: string;
  employeeName: string;
  department: string;
  toolRequested: string;
  description: string;
  status: 'pending' | 'approved' | 'denied';
  requestedAt: string;
  decidedAt: string | null;
  denialReason: string | null;
}

export async function GET() {
  const requests = readStore<RequestRecord>('requests');
  return NextResponse.json(requests);
}

export async function POST(req: NextRequest) {
  const { employeeName, department, toolRequested, description } = await req.json();
  if (!employeeName || !department || !toolRequested) {
    return NextResponse.json(
      { error: 'employeeName, department, and toolRequested are required' },
      { status: 400 },
    );
  }
  const record: RequestRecord = {
    id: uuid(),
    employeeName,
    department,
    toolRequested,
    description: description || '',
    status: 'pending',
    requestedAt: new Date().toISOString(),
    decidedAt: null,
    denialReason: null,
  };
  addItem('requests', record);
  return NextResponse.json(record);
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
