import { NextResponse } from 'next/server';
import { env } from '@/lib/env';

export const runtime = 'edge';

type TenorResult = {
  id: string;
  content_description?: string;
  media_formats?: Record<
    string,
    { url: string; dims?: number[]; size?: number }
  >;
};

export async function GET(req: Request) {
  const apiKey = env.tenor.apiKey;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'TENOR_API_KEY no configurada' },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') ?? '').trim();
  const limit = Math.min(Number(searchParams.get('limit') ?? 24), 48);

  const endpoint = q
    ? 'https://tenor.googleapis.com/v2/search'
    : 'https://tenor.googleapis.com/v2/featured';

  const url = new URL(endpoint);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('client_key', 'camino_al_closing');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('media_filter', 'tinygif,gif');
  url.searchParams.set('contentfilter', 'high');
  url.searchParams.set('locale', 'es_ES');
  if (q) url.searchParams.set('q', q);

  try {
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Tenor ${res.status}` },
        { status: 502 }
      );
    }
    const json = (await res.json()) as { results?: TenorResult[] };
    const items = (json.results ?? [])
      .map((r) => {
        const preview = r.media_formats?.tinygif?.url;
        const full = r.media_formats?.gif?.url;
        if (!preview || !full) return null;
        return {
          id: r.id,
          preview,
          full,
          alt: r.content_description ?? 'GIF',
        };
      })
      .filter(Boolean);
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json(
      { error: 'No se pudo contactar a Tenor' },
      { status: 502 }
    );
  }
}
