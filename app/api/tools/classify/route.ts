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
  createdAt: string;
}

function getSmartMockClassification(name: string, description: string): Omit<ToolRecord, 'id' | 'createdAt' | 'status'> {
  const text = `${name} ${description}`.toLowerCase();
  
  let riskTier: 'Low' | 'Medium' | 'High' = 'Low';
  let nistFunctions: string[] = ['Govern'];
  let dataCategories: string[] = ['None'];
  let justification = '';
  let recommendedPolicy = '';

  if (text.includes('code') || text.includes('coder') || text.includes('programmer') || text.includes('github') || text.includes('develop') || text.includes('api')) {
    riskTier = 'Medium';
    nistFunctions = ['Govern', 'Map', 'Manage'];
    dataCategories = ['Source Code'];
    justification = `Mock classification: "${name}" was classified as Medium Risk because its description implies access to or interaction with software source code. Exposing proprietary algorithms or code patterns to third-party models poses intermediate IP security risks.`;
    recommendedPolicy = `Allow only for open-source repositories or non-proprietary modules. Require scanning for secrets or credentials before usage.`;
  } else if (text.includes('pii') || text.includes('email') || text.includes('customer') || text.includes('hr') || text.includes('cv') || text.includes('resume') || text.includes('personal') || text.includes('employee') || text.includes('user')) {
    riskTier = 'High';
    nistFunctions = ['Govern', 'Map', 'Measure', 'Manage'];
    dataCategories = ['PII'];
    justification = `Mock classification: "${name}" was classified as High Risk because it interacts with PII (Personally Identifiable Information), customer data, or internal employee records. Transferring PII outside corporate boundaries is heavily regulated under GDPR and other privacy regimes.`;
    recommendedPolicy = `Block direct text uploads containing actual names, emails, or personal identifiers. Require local anonymization/redaction before processing.`;
  } else if (text.includes('money') || text.includes('finance') || text.includes('payment') || text.includes('bank') || text.includes('invoice') || text.includes('salary') || text.includes('billing') || text.includes('budget')) {
    riskTier = 'High';
    nistFunctions = ['Govern', 'Map', 'Measure', 'Manage'];
    dataCategories = ['Financial'];
    justification = `Mock classification: "${name}" was classified as High Risk due to potential contact with corporate financials, billing data, or payment routing. Financial data breaches carry significant regulatory fines and commercial risk.`;
    recommendedPolicy = `Strictly block uploading of spreadsheets containing actual balances, transactions, or banking credentials. Restrict usage to mock financial planning data only.`;
  } else {
    riskTier = 'Low';
    nistFunctions = ['Govern'];
    dataCategories = ['None'];
    justification = `Mock classification: "${name}" was classified as Low Risk since it appears to be a general utility, design, or formatting tool that does not process source code, corporate financials, or personal customer data.`;
    recommendedPolicy = `Allow for general organization use. Restrict clipboard integration for any internal document containing trade secrets.`;
  }

  return {
    name,
    description,
    riskTier,
    nistFunctions,
    dataCategories,
    justification,
    recommendedPolicy,
  };
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

    let classification: Omit<ToolRecord, 'id' | 'createdAt' | 'status'>;

    // If no API key, get a smart mock result
    if (!process.env.GEMINI_API_KEY) {
      classification = getSmartMockClassification(name.trim(), description.trim());
    } else {
      const geminiResult = await classifyToolRisk(name.trim(), description.trim());
      classification = {
        name: name.trim(),
        description: description.trim(),
        riskTier: geminiResult.riskTier,
        nistFunctions: geminiResult.nistFunctions,
        dataCategories: geminiResult.dataCategories,
        justification: geminiResult.justification,
        recommendedPolicy: geminiResult.recommendedPolicy,
      };
    }

    let finalTool: ToolRecord;

    if (existing) {
      // Update existing record, keeping its id, status, and createdAt
      const updates: Partial<ToolRecord> = {
        description: classification.description,
        riskTier: classification.riskTier,
        nistFunctions: classification.nistFunctions,
        dataCategories: classification.dataCategories,
        justification: classification.justification,
        recommendedPolicy: classification.recommendedPolicy,
      };
      updateItem<ToolRecord>('tools', existing.id, updates);
      finalTool = {
        ...existing,
        ...updates,
      } as ToolRecord;
    } else {
      // Create a brand new record
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

