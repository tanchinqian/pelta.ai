import { NextResponse } from 'next/server';
import { readStore } from '@/lib/fileStore';

interface GuardLog {
  id: string;
  promptSnippet: string;
  verdict: string;
  riskLevel: string;
  reason: string;
  detectionMethod: string;
  dataCategory?: string;
  source?: string;
  tool?: string;
  timestamp: string;
}

export async function GET() {
  const logs = readStore<GuardLog>('logs');
  return NextResponse.json(logs);
}
