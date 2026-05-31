import { NextResponse } from 'next/server';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ publicKey: env.push.publicKey });
}
