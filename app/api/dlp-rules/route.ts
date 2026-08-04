import { NextRequest, NextResponse } from 'next/server';
import { readStore, addItem } from '@/lib/fileStore';
import { v4 as uuid } from 'uuid';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export interface DlpRule {
  id: string;
  name: string;
  pattern: string; // raw regex string
  severity: 'high' | 'medium' | 'low';
  category: string;
  enabled: boolean;
  createdAt: string;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  const rules = readStore<DlpRule>('dlp-rules');
  return NextResponse.json(rules, { headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  try {
    const { name, pattern, severity, category } = await req.json();

    if (!name || !pattern || !severity) {
      return NextResponse.json(
        { error: 'name, pattern, and severity are required' },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    // Validate regex is compilable
    try {
      new RegExp(pattern, 'gi');
    } catch (e: any) {
      return NextResponse.json(
        { error: `Invalid regex pattern: ${e.message}` },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const rule: DlpRule = {
      id: uuid(),
      name: String(name).trim(),
      pattern: String(pattern),
      severity: ['high', 'medium', 'low'].includes(severity) ? severity : 'medium',
      category: category ? String(category).trim() : 'Custom',
      enabled: true,
      createdAt: new Date().toISOString(),
    };

    addItem('dlp-rules', rule);
    return NextResponse.json(rule, { headers: CORS_HEADERS });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? 'Failed to create rule' },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
