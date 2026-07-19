import { NextResponse } from 'next/server';
import { writeStore } from '@/lib/fileStore';
import { SEED_TOOLS, SEED_LOGS, SEED_REQUESTS, SEED_ACCESS_REQUESTS, SEED_AUDIT_LOG } from '@/lib/seedData';

export async function POST() {
  try {
    writeStore('tools', SEED_TOOLS);
    writeStore('logs', SEED_LOGS);
    writeStore('requests', SEED_REQUESTS);
    writeStore('access-requests', SEED_ACCESS_REQUESTS);
    writeStore('audit-log', SEED_AUDIT_LOG);

    return NextResponse.json({
      ok: true,
      tools: SEED_TOOLS.length,
      logs: SEED_LOGS.length,
      requests: SEED_REQUESTS.length,
      accessRequests: SEED_ACCESS_REQUESTS.length,
      auditLog: SEED_AUDIT_LOG.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

