import { NextResponse } from 'next/server';
import { BACKEND_BASE } from '@/lib/backend';
import { parseHpaView, unavailableHpaView, type HpaSource } from '@/lib/hpaRehearsal';

export const dynamic = 'force-dynamic';

const REMOTE_URL = process.env.HPA_REHEARSAL_REMOTE_URL;
const REQUEST_TIMEOUT_MS = 3_000;

function remoteUrl(): URL | null {
  if (!REMOTE_URL) return null;
  try {
    const url = new URL(REMOTE_URL);
    return url.protocol === 'https:' ? url : null;
  } catch (error) {
    if (error instanceof TypeError) return null;
    throw error;
  }
}

export async function GET(request: Request) {
  const remote = remoteUrl();
  const source: HpaSource = remote ? 'remote' : 'local';
  const target = remote ?? new URL('/api/rehearsals/hpa', `${BACKEND_BASE}/`);
  const headers = new Headers({ accept: 'application/json' });
  if (!remote) {
    const cookie = request.headers.get('cookie');
    if (cookie) headers.set('cookie', cookie);
  }

  try {
    const response = await fetch(target, {
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (response.status === 404 && remote) {
      return NextResponse.json(unavailableHpaView('remote'), {
        headers: { 'cache-control': 'no-store, max-age=0' },
      });
    }
    if (!response.ok) throw new Error(`HPA source returned ${response.status}`);
    const snapshot = parseHpaView(await response.json(), source);
    if (!snapshot) throw new Error('HPA source returned an invalid payload');
    return NextResponse.json(snapshot, { headers: { 'cache-control': 'no-store, max-age=0' } });
  } catch (error) {
    console.warn('[hpa-rehearsal] Read-only snapshot is unavailable', error);
    return NextResponse.json(unavailableHpaView(source), {
      headers: { 'cache-control': 'no-store, max-age=0' },
    });
  }
}
