import { NextRequest, NextResponse } from 'next/server';
import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Heap snapshot endpoint for debugging memory growth in the Next.js standalone
 * server. Triggering this writes a `.heapsnapshot` file that can be opened in
 * Chrome DevTools or Node.js inspectors.
 *
 * Access is gated by `HEAP_DUMP_SECRET`. If the secret is not configured, the
 * endpoint returns 403 to avoid exposing internal diagnostics.
 */
export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');
  const expectedSecret = process.env.HEAP_DUMP_SECRET;

  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // `writeHeapSnapshot` is only available in Node.js; avoid loading it during
  // the build/SSR phase by requiring it lazily inside the request handler.
  const { writeHeapSnapshot } = await import('node:v8');

  const dumpDir = '/tmp/heapdumps';
  if (!existsSync(dumpDir)) {
    mkdirSync(dumpDir, { recursive: true });
  }

  const filename = `heap-${Date.now()}.heapsnapshot`;
  const filepath = join(dumpDir, filename);

  try {
    writeHeapSnapshot(filepath);
    return NextResponse.json({
      ok: true,
      filename,
      path: filepath,
      size: 'check with `ls -lh ' + filepath + '`',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Heap dump failed', message }, { status: 500 });
  }
}
