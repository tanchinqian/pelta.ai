import { NextRequest, NextResponse } from 'next/server';
import { classifyToolRisk } from '@/lib/gemini';
import { addItem } from '@/lib/fileStore';
import { v4 as uuid } from 'uuid';

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

export async function POST(req: NextRequest) {
  try {
    const { name, description } = await req.json();
    if (!name || !description) {
      return NextResponse.json(
        { error: 'name and description are required' },
        { status: 400 },
      );
    }

    // Always returns a result — falls back to heuristic mock on quota/API errors
    const classification = await classifyToolRisk(name, description);

    const tool: ToolRecord = {
      id: uuid(),
      name,
      description,
      status: 'pending',
      riskTier: classification.riskTier,
      nistFunctions: classification.nistFunctions,
      dataCategories: classification.dataCategories,
      justification: classification.justification,
      recommendedPolicy: classification.recommendedPolicy,
      createdAt: new Date().toISOString(),
    };

    addItem('tools', tool);
    return NextResponse.json(tool);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? 'Classification failed' },
      { status: 500 },
    );
  }
}
