import { NextRequest, NextResponse } from 'next/server';
import { readStore, updateItem } from '@/lib/fileStore';

interface ToolRecord {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'approved' | 'blocked';
  riskTier: 'Low' | 'Medium' | 'High' | null;
  nistFunctions: string[];
  dataCategories: string[];
  justification: string;
  recommendedPolicy: string;
  createdAt: string;
}

export async function GET() {
  const tools = readStore<ToolRecord>('tools');
  return NextResponse.json(tools);
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, status } = await req.json();
    if (!id || !status) {
      return NextResponse.json({ error: 'id and status are required' }, { status: 400 });
    }
    if (!['pending', 'approved', 'blocked'].includes(status)) {
      return NextResponse.json({ error: 'invalid status' }, { status: 400 });
    }
    const items = updateItem<ToolRecord>('tools', id, { status });
    const updated = items.find((i) => i.id === id);
    if (!updated) {
      return NextResponse.json({ error: 'tool not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Failed to update' }, { status: 500 });
  }
}

