import { NextRequest, NextResponse } from 'next/server';
import { readStore, updateItem, deleteItem } from '@/lib/fileStore';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const updates = await req.json();

    if (updates.pattern !== undefined) {
      try {
        new RegExp(updates.pattern, 'gi');
      } catch (e: any) {
        return NextResponse.json(
          { error: `Invalid regex pattern: ${e.message}` },
          { status: 400, headers: CORS_HEADERS },
        );
      }
    }

    const updated = updateItem('dlp-rules', id, updates);
    const rule = updated.find((r: any) => r.id === id);
    if (!rule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404, headers: CORS_HEADERS });
    }
    return NextResponse.json(rule, { headers: CORS_HEADERS });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? 'Failed to update rule' },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    deleteItem('dlp-rules', id);
    return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? 'Failed to delete rule' },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
