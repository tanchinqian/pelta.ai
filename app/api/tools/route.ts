import { NextRequest, NextResponse } from 'next/server';
import { readStore, updateItem, deleteItem } from '@/lib/fileStore';

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
    const data = await req.json();
    const { id, status, justification, recommendedPolicy, riskTier, nistFunctions, dataCategories } = data;
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    
    const updateFields: Partial<ToolRecord> = {};
    if (status !== undefined) {
      if (!['pending', 'approved', 'blocked'].includes(status)) {
        return NextResponse.json({ error: 'invalid status' }, { status: 400 });
      }
      updateFields.status = status;
    }
    if (justification !== undefined) {
      updateFields.justification = justification;
    }
    if (recommendedPolicy !== undefined) {
      updateFields.recommendedPolicy = recommendedPolicy;
    }
    if (riskTier !== undefined) {
      if (riskTier !== null && !['Low', 'Medium', 'High'].includes(riskTier)) {
        return NextResponse.json({ error: 'invalid riskTier' }, { status: 400 });
      }
      updateFields.riskTier = riskTier;
    }
    if (nistFunctions !== undefined) {
      updateFields.nistFunctions = nistFunctions;
    }
    if (dataCategories !== undefined) {
      updateFields.dataCategories = dataCategories;
    }

    const items = updateItem<ToolRecord>('tools', id, updateFields);
    const updated = items.find((i) => i.id === id);
    if (!updated) {
      return NextResponse.json({ error: 'tool not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id parameter is required' }, { status: 400 });
    }
    const items = deleteItem<ToolRecord>('tools', id);
    return NextResponse.json({ success: true, count: items.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Failed to delete' }, { status: 500 });
  }
}


