import { NextRequest, NextResponse } from 'next/server';
import { classifyToolRisk } from '@/lib/gemini';
import { addItem, readStore, updateItem } from '@/lib/fileStore';
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
  retrievedNistContext?: { function: string; definition: string; concerns: string[]; score: number; matchedKeywords: string[] }[];
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

    const tools = readStore<ToolRecord>('tools');
    const existing = tools.find((t) => t.name.toLowerCase() === name.trim().toLowerCase());

    // classifyToolRisk handles its own fallback (mock on no-key/quota errors)
    const geminiResult = await classifyToolRisk(name.trim(), description.trim());
    const classification = {
      name: name.trim(),
      description: description.trim(),
      riskTier: geminiResult.riskTier,
      nistFunctions: geminiResult.nistFunctions,
      dataCategories: geminiResult.dataCategories,
      justification: geminiResult.justification,
      recommendedPolicy: geminiResult.recommendedPolicy,
      retrievedNistContext: geminiResult.retrievedNistContext,
    };

    let finalTool: ToolRecord;

    if (existing) {
      const updates: Partial<ToolRecord> = {
        description: classification.description,
        riskTier: classification.riskTier,
        nistFunctions: classification.nistFunctions,
        dataCategories: classification.dataCategories,
        justification: classification.justification,
        recommendedPolicy: classification.recommendedPolicy,
        retrievedNistContext: classification.retrievedNistContext,
      };
      updateItem<ToolRecord>('tools', existing.id, updates);
      finalTool = { ...existing, ...updates } as ToolRecord;
    } else {
      finalTool = {
        id: uuid(),
        ...classification,
        status: 'pending',
        createdAt: new Date().toISOString(),
      } as ToolRecord;
      addItem('tools', finalTool);
    }

    return NextResponse.json(finalTool);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? 'Classification failed' },
      { status: 500 },
    );
  }
}
