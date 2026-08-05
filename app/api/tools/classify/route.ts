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
    const { name, description, existingId } = await req.json();
    if (!name || !description) {
      return NextResponse.json(
        { error: 'name and description are required' },
        { status: 400 },
      );
    }

    const tools = readStore<ToolRecord>('tools');
    const normalizedName = name.trim().toLowerCase();
    const normalizedDesc = description.trim().toLowerCase();

    // Force reclassify via existingId — skip cache, always call LLM
    if (existingId) {
      const existing = tools.find((t) => t.id === existingId);
      const llmResult = await classifyToolRisk(name.trim(), description.trim());
      const classification = {
        name: name.trim(),
        description: description.trim(),
        riskTier: llmResult.riskTier,
        nistFunctions: llmResult.nistFunctions,
        dataCategories: llmResult.dataCategories,
        justification: llmResult.justification,
        recommendedPolicy: llmResult.recommendedPolicy,
        retrievedNistContext: llmResult.retrievedNistContext,
      };

      if (existing) {
        updateItem<ToolRecord>('tools', existing.id, classification);
        return NextResponse.json({ ...existing, ...classification });
      }
      const newTool: ToolRecord = {
        id: uuid(),
        ...classification,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      addItem('tools', newTool);
      return NextResponse.json(newTool);
    }

    // Cache hit — same name AND description
    const cached = tools.find(
      (t) =>
        t.name.toLowerCase() === normalizedName &&
        t.description.toLowerCase() === normalizedDesc,
    );
    if (cached) {
      console.log(`[classify] cache hit for "${name}" — returning existing classification`);
      return NextResponse.json(cached);
    }

    // New classification — call LLM
    const llmResult = await classifyToolRisk(name.trim(), description.trim());
    const classification = {
      name: name.trim(),
      description: description.trim(),
      riskTier: llmResult.riskTier,
      nistFunctions: llmResult.nistFunctions,
      dataCategories: llmResult.dataCategories,
      justification: llmResult.justification,
      recommendedPolicy: llmResult.recommendedPolicy,
      retrievedNistContext: llmResult.retrievedNistContext,
    };

    // Update if same name with different description, otherwise create
    const nameMatch = tools.find((t) => t.name.toLowerCase() === normalizedName);
    let finalTool: ToolRecord;

    if (nameMatch) {
      updateItem<ToolRecord>('tools', nameMatch.id, classification);
      finalTool = { ...nameMatch, ...classification } as ToolRecord;
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
