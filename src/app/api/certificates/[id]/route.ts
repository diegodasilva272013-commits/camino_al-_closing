import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const { data: cert } = await supabase
    .from('certificates')
    .select('id, code, issued_at, user_id, courses(title)')
    .eq('id', params.id)
    .maybeSingle();

  if (!cert) return new NextResponse('Not found', { status: 404 });

  // Solo el dueño o admin lo descargan
  const { data: me } = await supabase
    .from('profiles')
    .select('full_name, email, role')
    .eq('id', user.id)
    .maybeSingle();
  const c = cert as any;
  const isOwner = c.user_id === user.id;
  const isAdmin = (me as any)?.role === 'admin';
  if (!isOwner && !isAdmin) return new NextResponse('Forbidden', { status: 403 });

  const { data: holder } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', c.user_id)
    .maybeSingle();
  const h = (holder ?? {}) as { full_name: string | null; email: string | null };

  const fullName = h.full_name || h.email || 'Alumno/a';
  const courseTitle = c.courses?.title ?? 'Curso completo';
  const issuedDate = new Date(c.issued_at).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Certificado · ${escape(courseTitle)} · ${escape(fullName)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>
  @page { size: A4 landscape; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #0a0a0a; color: #fafafa; font-family: 'Georgia', 'Cambria', serif; }
  .page { width: 297mm; height: 210mm; padding: 24mm; position: relative;
          background: radial-gradient(circle at 20% 20%, rgba(212,175,55,0.18), transparent 55%),
                      radial-gradient(circle at 80% 80%, rgba(212,175,55,0.10), transparent 50%),
                      #0a0a0a;
          border: 12px solid transparent;
          background-clip: padding-box; }
  .frame { border: 2px solid rgba(212,175,55,0.45); border-radius: 8px; height: 100%; padding: 22mm 28mm; display: flex; flex-direction: column; }
  .eyebrow { color: #d4af37; font-size: 14px; letter-spacing: 6px; text-transform: uppercase; }
  h1 { font-size: 56px; margin: 14px 0 10px; color: #fff; }
  .who { margin-top: 30px; }
  .name { font-size: 48px; color: #d4af37; font-weight: 700; border-bottom: 1px solid rgba(212,175,55,0.4); padding-bottom: 10px; }
  .body { font-size: 18px; line-height: 1.7; color: #d8d8d8; margin-top: 24px; max-width: 90%; }
  .course { color: #d4af37; font-weight: bold; }
  .footer { margin-top: auto; display: flex; justify-content: space-between; align-items: flex-end; font-size: 13px; color: #b8b8b8; }
  .sig { text-align: center; }
  .sig .line { border-top: 1px solid rgba(212,175,55,0.5); width: 200px; margin: 0 auto 6px; }
  .code { font-family: monospace; color: #d4af37; letter-spacing: 2px; }
  .btn { position: fixed; bottom: 16px; right: 16px; padding: 10px 16px; background: #d4af37; color: #000; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; }
  @media print { .btn { display: none } }
</style>
</head>
<body>
<div class="page">
  <div class="frame">
    <div class="eyebrow">Camino al Closing</div>
    <h1>Certificado de Finalización</h1>
    <div class="who">
      <p class="body">Se otorga el presente certificado a</p>
      <div class="name">${escape(fullName)}</div>
      <p class="body">
        por haber completado satisfactoriamente el curso
        <span class="course">"${escape(courseTitle)}"</span>,
        cumpliendo con la totalidad de las clases y evaluaciones requeridas.
      </p>
    </div>
    <div class="footer">
      <div class="sig">
        <div class="line"></div>
        <div>Camino al Closing</div>
      </div>
      <div style="text-align:right">
        Emitido el ${issuedDate}<br/>
        Código: <span class="code">${escape(c.code)}</span>
      </div>
    </div>
  </div>
</div>
<button class="btn" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function escape(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
