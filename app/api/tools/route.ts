import { NextResponse } from 'next/server';
import { readStore } from '@/lib/fileStore';

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
