/**
 * Helper para generar avatares con OpenAI gpt-image-1 (image edits).
 *
 * Requiere OPENAI_API_KEY en env. La organización debe estar verificada
 * para usar gpt-image-1 (https://platform.openai.com/settings/organization/general).
 */

export type AvatarStyle = 'pixar' | 'cartoon' | 'marvel';

const STYLE_PROMPTS: Record<AvatarStyle, string> = {
  pixar:
    'Render in high-quality 3D Pixar / Disney animation movie style. Soft cinematic three-point lighting, subsurface scattering on skin, expressive eyes with detailed iris and catchlight, subtle warm smile, professional studio-quality animated character portrait.',
  cartoon:
    'Render in modern stylized 2D animated cartoon style (Arcane / Spider-Verse / Disney TVA hybrid). Clean confident line art, painterly cel shading with soft gradients, vibrant but realistic skin tones, charming friendly expression, hand-painted animation look.',
  marvel:
    'Render in modern Marvel comic book illustration style (Alex Ross / Jim Cheung influence). Bold confident ink outlines, painted realistic comic colors with halftone accents, dramatic rim lighting and strong shadows, heroic confident expression, vibrant high-contrast comic panel.',
};

function levelModifier(level: number): string {
  if (level >= 10)
    return 'wearing a luxurious black suit with golden trim, a fine wristwatch and a subtle golden crown of light above the head, regal dramatic golden aura background, epic confident pose';
  if (level >= 8)
    return 'wearing an elegant tailored black suit with golden cufflinks and a luxury wristwatch, modern high-end penthouse office background with soft golden bokeh';
  if (level >= 6)
    return 'wearing a sharp formal suit and tie, confident calm smile, modern high-end office background with soft bokeh';
  if (level >= 4)
    return 'wearing a smart business shirt, friendly confident expression, blurred professional office background';
  if (level >= 2)
    return 'wearing smart casual business-casual clothing, friendly warm smile, soft neutral background';
  return 'wearing casual everyday clothing, friendly approachable expression, simple soft neutral background';
}

export function buildAvatarPrompt(style: AvatarStyle, level: number): string {
  const stylePart = STYLE_PROMPTS[style];
  const levelPart = levelModifier(level);
  return [
    'TASK: Transform the reference photo into a stylized portrait of the SAME PERSON.',
    'CRITICAL — faithful likeness: keep the exact same identity. Preserve and clearly recognize the person\'s:',
    '- face shape and proportions (jawline, cheekbones, forehead, chin)',
    '- eye shape, eye color and eyebrow shape',
    '- nose shape and nostril width',
    '- mouth shape and natural lip thickness',
    '- skin tone and ethnicity',
    '- exact hair color, hair length and hairstyle',
    '- facial hair (beard / stubble / clean shaven) exactly as in the photo',
    '- approximate age, gender, body type',
    '- any distinctive features (moles, scars, tattoos visible on face/neck if any)',
    'Do NOT idealize, do NOT make the person look younger, thinner, more muscular, or more generic. The viewer must instantly recognize this is the same human as in the photo, only stylized.',
    `STYLE: ${stylePart}`,
    `OUTFIT & SETTING: ${levelPart}.`,
    'COMPOSITION: head-and-shoulders portrait, square 1:1, centered, looking slightly toward camera, clean uncluttered background, no text, no logos, no watermark, no extra people.',
  ].join('\n');
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
  form.append('quality', 'high');
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
