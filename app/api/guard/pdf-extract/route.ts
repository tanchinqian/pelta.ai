import { NextRequest, NextResponse } from 'next/server';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

export async function POST(req: NextRequest) {
  try {
    const { pdf, filename } = await req.json();
    if (!pdf) {
      return NextResponse.json({ error: 'No pdf data provided' }, { status: 400 });
    }

    const buffer = Buffer.from(pdf, 'base64');
    const loadingTask = pdfjsLib.getDocument({ data: buffer });
    const pdfDoc = await loadingTask.promise;

    const pages: string[] = [];
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map((item: any) => item.str).join(' '));
    }

    return NextResponse.json({
      text: pages.join('\n\n'),
      pageCount: pdfDoc.numPages,
      filename,
    }, { headers: { 'Access-Control-Allow-Origin': '*' } });
  } catch (error: any) {
    console.error('PDF extraction error:', error);
    return NextResponse.json({ error: 'Failed to extract text from PDF' }, { status: 500 });
  }
}
