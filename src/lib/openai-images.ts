/**
 * Helper para generar avatares con OpenAI gpt-image-1 (image edits).
 *
 * Requiere OPENAI_API_KEY en env. La organización debe estar verificada
 * para usar gpt-image-1 (https://platform.openai.com/settings/organization/general).
 */

export type AvatarStyle = 'pixar' | 'cartoon' | 'marvel';

const STYLE_PROMPTS: Record<AvatarStyle, string> = {
  pixar:
    'High-quality 3D Pixar-style character portrait. Soft cinematic lighting, subsurface scattering, expressive eyes, warm friendly smile, polished animation movie quality, professional studio rendering.',
  cartoon:
    'Classic 2D Disney animated cartoon portrait. Bold clean outlines, vibrant flat colors, smooth cel shading, charming friendly expression, hand-drawn animation aesthetic.',
  marvel:
    'Marvel comic book style portrait. Bold black ink outlines, halftone shading dots, dramatic dynamic lighting with strong shadows, heroic confident pose, vibrant comic panel colors.',
};

function levelModifier(level: number): string {
  if (level >= 10)
    return 'wearing a luxurious black suit with golden trim and a subtle golden crown of light above the head, regal dramatic golden aura background, epic confident pose';
  if (level >= 8)
    return 'wearing an elegant tailored black suit with golden cufflinks and a fine wristwatch, modern luxury penthouse office background';
  if (level >= 6)
    return 'wearing a sharp formal suit and tie, confident smile, modern high-end office background';
  if (level >= 4)
    return 'wearing a smart business shirt, friendly confident expression, blurred professional office background';
  if (level >= 2)
    return 'wearing casual smart business-casual clothing, friendly smile, warm soft background';
  return 'wearing casual everyday clothing, friendly approachable expression, simple soft neutral background';
}

export function buildAvatarPrompt(style: AvatarStyle, level: number): string {
  const stylePart = STYLE_PROMPTS[style];
  const levelPart = levelModifier(level);
  return `${stylePart} Subject is the same person as in the reference photo, preserving their facial features, gender, ethnicity, hair color and hairstyle. ${levelPart}. Head-and-shoulders portrait, square 1:1 composition, centered, clean background, no text, no logos, no watermark.`;
}

/**
 * Llama a OpenAI images/edits con gpt-image-1.
 * Devuelve PNG en buffer (1024x1024).
 */
export async function generateStyledAvatar(opts: {
  apiKey: string;
  sourceImage: Blob;
  style: AvatarStyle;
  level: number;
}): Promise<Buffer> {
  const { apiKey, sourceImage, style, level } = opts;
  const prompt = buildAvatarPrompt(style, level);

  const form = new FormData();
  form.append('model', 'gpt-image-1');
  form.append('prompt', prompt);
  form.append('size', '1024x1024');
  form.append('quality', 'medium');
  form.append('n', '1');
  // gpt-image-1 acepta image como File/Blob
  form.append('image', sourceImage, 'source.png');

  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try {
      const j = JSON.parse(text);
      msg = j?.error?.message ?? text;
    } catch {
      /* ignore */
    }
    throw new Error(`OpenAI error ${res.status}: ${msg}`);
  }

  const json = (await res.json()) as {
    data?: Array<{ b64_json?: string; url?: string }>;
  };
  const item = json.data?.[0];
  if (!item) throw new Error('OpenAI no devolvió imagen.');

  if (item.b64_json) {
    return Buffer.from(item.b64_json, 'base64');
  }
  if (item.url) {
    const dl = await fetch(item.url);
    if (!dl.ok) throw new Error('No se pudo descargar la imagen generada.');
    return Buffer.from(await dl.arrayBuffer());
  }
  throw new Error('Respuesta inesperada de OpenAI.');
}
