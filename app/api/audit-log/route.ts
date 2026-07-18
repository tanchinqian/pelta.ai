import { NextResponse } from 'next/server';
import { readStore } from '@/lib/fileStore';

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
  const data = readStore<AuditEntry>('audit-log');
  // Return newest first
  return NextResponse.json([...data].reverse());
}
