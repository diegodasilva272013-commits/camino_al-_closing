import { NextResponse } from 'next/server';
import { env } from '@/lib/env';

export const runtime = 'edge';

type GiphyImageVariant = { url: string; width?: string; height?: string };
type GiphyResult = {
  id: string;
  title?: string;
  images?: {
    fixed_width?: GiphyImageVariant;
    fixed_width_downsampled?: GiphyImageVariant;
    fixed_height_small?: GiphyImageVariant;
    fixed_width_small?: GiphyImageVariant;
    fixed_height?: GiphyImageVariant;
    original?: GiphyImageVariant;
    downsized_medium?: GiphyImageVariant;
  };
};

export async function GET(req: Request) {
  const apiKey = env.giphy.apiKey;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'GIPHY_API_KEY no configurada' },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') ?? '').trim();
  const limit = Math.min(Number(searchParams.get('limit') ?? 24), 50);

  const endpoint = q
    ? 'https://api.giphy.com/v1/gifs/search'
    : 'https://api.giphy.com/v1/gifs/trending';

  const url = new URL(endpoint);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('rating', 'pg-13');
  url.searchParams.set('lang', 'es');
  if (q) url.searchParams.set('q', q);

  try {
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Giphy ${res.status}` },
        { status: 502 }
      );
    }
    const json = (await res.json()) as { data?: GiphyResult[] };
    const items = (json.data ?? [])
      .map((r) => {
        const preview =
          r.images?.fixed_width_downsampled?.url ??
          r.images?.fixed_width?.url ??
          r.images?.fixed_width_small?.url ??
          r.images?.fixed_height_small?.url ??
          r.images?.fixed_height?.url;
        const full =
          r.images?.downsized_medium?.url ??
          r.images?.fixed_width?.url ??
          r.images?.fixed_height?.url ??
          r.images?.original?.url;
        if (!preview || !full) return null;
        return {
          id: r.id,
          preview,
          full,
          alt: r.title ?? 'GIF',
        };
      })
      .filter(Boolean);
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json(
      { error: 'No se pudo contactar a Giphy' },
      { status: 502 }
    );
  }
}
