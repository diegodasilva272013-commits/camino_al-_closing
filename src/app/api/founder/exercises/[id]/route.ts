import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';
import { MOTOR_CAC_CEO_SYSTEM, CAPACIDADES } from '@/lib/motor-cac-ceo';

export const dynamic    = 'force-dynamic';
export const maxDuration = 300;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function requireAdmin() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createSupabaseAdminClient() as any;
  const { data: p } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if ((p as any)?.role !== 'admin') return null;
  return admin;
}

// PATCH — DESACTIVADO (F5-A: sistema 0025/0026 en modo lectura)
// Los ejercicios del founder van al sistema 0029 (/api/d2030/ejercicio)
export async function PATCH() {
  return NextResponse.json(
    { error: 'Sistema legacy desactivado. Usá /api/d2030/ejercicio — sistema 0029 es la fuente de verdad.' },
    { status: 410 }
  );
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function _PATCH_legacy(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await req.json();
  const { status, submission_text, submission_url } = body;

  // Si entrega evidencia → validar con IA
  if (submission_text || submission_url) {
    const { data: exercise } = await (admin as any)
      .from('founder_exercises')
      .select('*')
      .eq('id', params.id)
      .single();

    if (!exercise) return NextResponse.json({ error: 'Ejercicio no encontrado' }, { status: 404 });

    try {
      const capLabel = CAPACIDADES[exercise.capacity as keyof typeof CAPACIDADES] ?? exercise.capacity;
      const validationPrompt = `Sos el Motor CAC CEO. Tenés que validar si Diego completó correctamente un ejercicio de evolución.

CAPACIDAD: ${capLabel}
EJERCICIO: ${exercise.title}
DESCRIPCIÓN: ${exercise.description}
CRITERIO DE VALIDACIÓN: ${exercise.validation?.criterio_validacion ?? 'Verificar comprensión real y aplicación.'}

EVIDENCIA QUE PRESENTA DIEGO:
${submission_text ?? ''}
${submission_url ? `URL: ${submission_url}` : ''}

Evaluá si hay evidencia real de comprensión y/o cambio de comportamiento.
NO lo aprobés si solo describe el ejercicio. Necesita mostrar comprensión real o resultado concreto.

Devolvé este JSON:
{
  "aprobado": true|false,
  "nuevo_status": "approved"|"needs_correction"|"repeat",
  "feedback": "Feedback directo y específico sobre lo que entregó. Qué estuvo bien, qué falta.",
  "score_impacto": 1-10,
  "evidencia_de_cambio": "Qué evidencia concreta de cambio o comprensión viste (o no viste)."
}`;

      const completion = await (openai.chat.completions.create as any)({
        model: 'o3',
        reasoning_effort: 'medium',
        messages: [
          { role: 'system', content: MOTOR_CAC_CEO_SYSTEM },
          { role: 'user',   content: validationPrompt },
        ],
      });

      const raw       = (completion.choices[0].message.content ?? '{}').trim();
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      const validation = JSON.parse(jsonMatch ? jsonMatch[0] : raw);

      const { data: updated, error } = await (admin as any)
        .from('founder_exercises')
        .update({
          submission_text,
          submission_url,
          status:         validation.nuevo_status ?? 'delivered',
          validation,
          validated_at:   new Date().toISOString(),
        })
        .eq('id', params.id)
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ exercise: updated, validation });

    } catch (err: any) {
      // Guardar entrega sin validación IA si falla
      const { data: updated } = await (admin as any)
        .from('founder_exercises')
        .update({ submission_text, submission_url, status: 'delivered' })
        .eq('id', params.id)
        .select()
        .single();
      return NextResponse.json({ exercise: updated, error: 'Validación IA falló, entrega guardada.' });
    }
  }

  // Solo actualizar status
  if (status) {
    const { data, error } = await (admin as any)
      .from('founder_exercises')
      .update({ status })
      .eq('id', params.id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
}
