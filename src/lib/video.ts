/**
 * Convierte una URL de video (YouTube, Vimeo o archivo directo) en una
 * URL embebible. Devuelve { kind: 'youtube' | 'vimeo' | 'file' | null, src }
 */
export function parseVideoUrl(url: string | null | undefined): {
  kind: 'youtube' | 'vimeo' | 'file' | null;
  src: string;
} {
  if (!url) return { kind: null, src: '' };
  const raw = url.trim();
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1);
      return { kind: 'youtube', src: `https://www.youtube.com/embed/${id}` };
    }
    if (host.endsWith('youtube.com')) {
      if (u.pathname === '/watch') {
        const id = u.searchParams.get('v');
        if (id) return { kind: 'youtube', src: `https://www.youtube.com/embed/${id}` };
      }
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts.length >= 2 && ['embed', 'shorts', 'v'].includes(parts[0])) {
        return { kind: 'youtube', src: `https://www.youtube.com/embed/${parts[1]}` };
      }
    }
    if (host.endsWith('vimeo.com')) {
      const parts = u.pathname.split('/').filter(Boolean);
      const id = parts[parts.length - 1];
      if (id) return { kind: 'vimeo', src: `https://player.vimeo.com/video/${id}` };
    }
    if (/\.(mp4|webm|ogg|mov|m4v)$/i.test(u.pathname)) {
      return { kind: 'file', src: raw };
    }
    return { kind: 'file', src: raw };
  } catch {
    return { kind: null, src: '' };
  }
}
