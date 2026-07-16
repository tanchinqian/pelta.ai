import { NextRequest, NextResponse } from 'next/server';
import { classifyToolRisk } from '@/lib/gemini';
import { addItem, readStore } from '@/lib/fileStore';
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

    // If no API key, return a mock result
    if (!process.env.GEMINI_API_KEY) {
      const mock: ToolRecord = {
        id: uuid(),
        name,
        description,
        status: 'pending',
        riskTier: 'Medium',
        nistFunctions: ['Govern', 'Map'],
        dataCategories: ['None'],
        justification: `Mock classification: "${name}" was assessed based on its description. As a general productivity tool, it presents moderate governance concerns around data handling and access control.`,
        recommendedPolicy: 'Allow for non-sensitive tasks. Review quarterly for policy changes.',
        createdAt: new Date().toISOString(),
      };
      addItem('tools', mock);
      return NextResponse.json(mock);
    }

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
